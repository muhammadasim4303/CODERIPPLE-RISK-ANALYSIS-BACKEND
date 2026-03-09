/**
 * firebaseService.ts
 * All Firestore reads/writes for CodeRipple.
 *
 * Data model (per authenticated user):
 *   users/{userId}/repositories/{repoFullName}   — repo metadata + risk stats
 *   users/{userId}/riskScores/{sha}              — per-commit risk result
 */

import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FBRepo {
  id: string;            // GitHub numeric id as string
  userId: string;
  name: string;
  full_name: string;     // "owner/repo" — used as Firestore doc id
  description: string | null;
  private: boolean;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  // risk stats written back after analysis
  average_risk_score: number;
  total_commits_analyzed: number;
  high_risk_commits_count: number;
  medium_risk_commits_count: number;
  low_risk_commits_count: number;
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FBRiskScore {
  sha: string;            // doc id
  userId: string;
  repoFullName: string;   // "owner/repo"
  branch: string;
  message: string;
  author_name: string;
  author_avatar: string;
  committed_at: string;
  // risk output
  risk_label: string;     // "HIGH RISK" | "MEDIUM RISK" | "LOW RISK"
  overall_risk_score: number;
  correctness_risk: number;
  security_risk: number;
  maintainability_risk: number;
  integration_risk: number;
  risk_reasons: string[];
  // git stats
  files_changed: number;
  additions: number;
  deletions: number;
  mode: string;
  analyzed_at: string;
}

// ─── Repositories ─────────────────────────────────────────────────────────────

export async function upsertRepo(userId: string, repo: Omit<FBRepo, 'userId'>): Promise<void> {
  // const ref = doc(db, 'users', userId, 'repositories', repo.full_name);

  const repoId = repo.full_name.replace("/", "_");
  const ref = doc(db, 'users', userId, 'repositories', repoId);
  // merge: true so existing risk stats are not overwritten on re-sync
  await setDoc(ref, { ...repo, userId, updated_at: new Date().toISOString() }, { merge: true });
}

export async function listRepos(userId: string): Promise<FBRepo[]> {
  const snap = await getDocs(
    query(collection(db, 'users', userId, 'repositories'), orderBy('updated_at', 'desc'))
  );
  return snap.docs.map(d => d.data() as FBRepo);
}

export async function getRepo(userId: string, fullName: string): Promise<FBRepo | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'repositories', fullName.replace("/", "_")));
  return snap.exists() ? (snap.data() as FBRepo) : null;
}

export async function updateRepoStats(
  userId: string,
  fullName: string,
  stats: Partial<Pick<FBRepo,
    'average_risk_score' | 'total_commits_analyzed' |
    'high_risk_commits_count' | 'medium_risk_commits_count' |
    'low_risk_commits_count' | 'last_analyzed_at'>>
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'repositories', fullName.replace("/", "_")), {
    ...stats,
    updated_at: new Date().toISOString(),
  });
}

// ─── Risk Scores ──────────────────────────────────────────────────────────────

export async function upsertRiskScore(userId: string, score: Omit<FBRiskScore, 'userId'>): Promise<void> {
  await setDoc(
    doc(db, 'users', userId, 'riskScores', score.sha),
    { ...score, userId, analyzed_at: new Date().toISOString() },
    { merge: true }
  );
}

export async function getRiskScore(userId: string, sha: string): Promise<FBRiskScore | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'riskScores', sha));
  return snap.exists() ? (snap.data() as FBRiskScore) : null;
}

export async function listRiskScoresByRepo(
  userId: string,
  repoFullName: string,
  branch?: string
): Promise<FBRiskScore[]> {
  let q = query(
    collection(db, 'users', userId, 'riskScores'),
    where('repoFullName', '==', repoFullName),
    orderBy('committed_at', 'desc'),
    limit(100)
  );
  if (branch) {
    q = query(
      collection(db, 'users', userId, 'riskScores'),
      where('repoFullName', '==', repoFullName),
      where('branch', '==', branch),
      orderBy('committed_at', 'desc'),
      limit(100)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FBRiskScore);
}

export async function listAllRiskScores(userId: string, maxItems = 500): Promise<FBRiskScore[]> {
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'riskScores'),
      orderBy('analyzed_at', 'desc'),
      limit(maxItems)
    )
  );
  return snap.docs.map(d => d.data() as FBRiskScore);
}

// ─── Dashboard aggregation ────────────────────────────────────────────────────

export interface DashboardStats {
  total_repositories: number;
  total_commits_analyzed: number;
  high_risk_commits: number;
  medium_risk_commits: number;
  low_risk_commits: number;
  average_risk_score: number;
  risk_distribution: { low: number; medium: number; high: number; critical: number };
  risk_trend: Array<{ date: string; average_risk: number; commit_count: number }>;
  top_risky_repos: Array<{ repo_name: string; full_name: string; average_risk: number; high_risk_count: number }>;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [repos, scores] = await Promise.all([
    listRepos(userId),
    listAllRiskScores(userId),
  ]);

  const high   = scores.filter(s => s.risk_label === 'HIGH RISK').length;
  const medium = scores.filter(s => s.risk_label === 'MEDIUM RISK').length;
  const low    = scores.filter(s => s.risk_label === 'LOW RISK').length;
  const avgRisk = scores.length
    ? scores.reduce((acc, s) => acc + s.overall_risk_score, 0) / scores.length
    : 0;

  // per-repo aggregation
  const repoMap = new Map<string, { sum: number; count: number; high: number; name: string }>();
  for (const s of scores) {
    const cur = repoMap.get(s.repoFullName) ?? { sum: 0, count: 0, high: 0, name: s.repoFullName.split('/')[1] };
    repoMap.set(s.repoFullName, {
      sum:   cur.sum + s.overall_risk_score,
      count: cur.count + 1,
      high:  cur.high + (s.risk_label === 'HIGH RISK' ? 1 : 0),
      name:  cur.name,
    });
  }

  const top_risky_repos = [...repoMap.entries()]
    .map(([full_name, v]) => ({ repo_name: v.name, full_name, average_risk: v.sum / v.count, high_risk_count: v.high }))
    .sort((a, b) => b.average_risk - a.average_risk)
    .slice(0, 5);

  // weekly trend (last 7 weeks)
  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;
  const risk_trend = Array.from({ length: 7 }, (_, i) => {
    const start = now - (7 - i) * WEEK;
    const end   = now - (6 - i) * WEEK;
    const week  = scores.filter(s => {
      const t = new Date(s.committed_at).getTime();
      return t >= start && t < end;
    });
    return {
      date: new Date(start).toISOString().slice(0, 10),
      average_risk: week.length ? week.reduce((a, s) => a + s.overall_risk_score, 0) / week.length : 0,
      commit_count: week.length,
    };
  });

  return {
    total_repositories: repos.length,
    total_commits_analyzed: scores.length,
    high_risk_commits: high,
    medium_risk_commits: medium,
    low_risk_commits: low,
    average_risk_score: avgRisk,
    risk_distribution: { low, medium, high, critical: 0 },
    risk_trend,
    top_risky_repos,
  };
}
