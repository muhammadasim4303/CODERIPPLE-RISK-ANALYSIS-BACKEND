/**
 * firebaseService.ts
 * All Firestore reads/writes for CodeRipple.
 *
 * Data model (per authenticated user):
 *   users/{userId}/repositories/{repoFullName}        — repo metadata + risk stats
 *   users/{userId}/riskScores/{sha}                   — per-commit risk result
 *   users/{userId}/changeImpactScores/{sha}           — Change Impact / CodeRipple analysis
 */

import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CodeRippleResult, CRChangedFunction, CRDependencyGraph } from '@/types/coderippleTypes';

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FBRepo {
  id: string;
  userId: string;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  average_risk_score: number;
  total_commits_analyzed: number;
  high_risk_commits_count: number;
  medium_risk_commits_count: number;
  low_risk_commits_count: number;
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FBFileScore {
  file: string;
  // patch is stripped by trimPerFile() before writing to Firestore (too large).
  // Kept optional here so FileRiskResult (which carries patch for the UI) is assignable.
  patch?: string;
  risk_score: number;
  risk_label: string;
  correctness_risk: number;
  security_risk: number;
  maintainability_risk: number;
  integration_risk: number;
  correctness_reasons: string[];
  security_reasons: string[];
  maintainability_reasons: string[];
  integration_reasons: string[];
  risk_reasons: string[];
  added_lines: number;
  removed_lines: number;
  is_generated: boolean;
}

export interface FBRiskScore {
  sha: string;
  userId: string;
  repoFullName: string;
  branch: string;
  message: string;
  author_name: string;
  author_avatar: string;
  committed_at: string;
  // commit-level risk
  risk_label: string;
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
  // per-file breakdown
  per_file: FBFileScore[];

  // ── CodeRipple enrichment (optional — present after CR analysis) ──────
  cr_analyzed?: boolean;
  cr_risk_prediction?: 'LOW' | 'MEDIUM' | 'HIGH';
  cr_risk_score?: number;
  cr_risk_confidence?: number;
  cr_change_type?: string;
  cr_model_used?: string;
  cr_semantic_change_score?: number;
  cr_similarity?: number;
  cr_ripple_depth?: number;
  cr_ripple_size?: number;
  cr_direct_impact?: string[];
  cr_indirect_impact?: string[];
  cr_impacted_files?: string[];
  cr_changed_function?: string | null;
  cr_changed_functions?: CRChangedFunction[];
  cr_functions_changed?: number;
  cr_total_lines_changed?: number;
  cr_contributing_factors?: string[];
  cr_feature_breakdown?: Record<string, number>;
  cr_dependency_graph?: CRDependencyGraph;
}

// ─── Change Impact Score (dedicated collection) ───────────────────────────────

export interface FBChangeImpactScore {
  sha: string;
  userId: string;
  repoFullName: string;
  analyzed_at: string;
  // Commit metadata (for standalone display without needing riskScores)
  message?: string;
  author_name?: string;
  committed_at?: string;
  // Core CR prediction
  risk_prediction: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_score: number;
  risk_confidence: number;
  change_type: string;
  model_used: string;
  // Semantic scores
  semantic_change_score: number;
  similarity: number;
  // Ripple engine
  ripple_depth: number;
  ripple_size: number;
  direct_impact: string[];
  indirect_impact: string[];
  impacted_files: string[];
  // Function-level detail
  changed_function: string | null;
  changed_functions: import('@/types/coderippleTypes').CRChangedFunction[];
  functions_changed: number;
  total_lines_changed: number;
  // Explainability
  contributing_factors: string[];
  feature_breakdown: Record<string, number>;
  // Full dependency graph
  dependency_graph: import('@/types/coderippleTypes').CRDependencyGraph;
}

// ─── Repositories ─────────────────────────────────────────────────────────────

export async function upsertRepo(userId: string, repo: Omit<FBRepo, 'userId'>): Promise<void> {
  const repoId = repo.full_name.replace("/", "_");
  const ref = doc(db, 'users', userId, 'repositories', repoId);
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

// ─── Risk Scores (nested under repositories) ──────────────────────────────────
/** Helper: derive repoId consistent with upsertRepo */
function repoId(repoFullName: string) { return repoFullName.replace('/', '_'); }

/** Strip large text blobs from per-file entries before writing to Firestore. */
function trimPerFile(perFile: FBFileScore[]): FBFileScore[] {
  return perFile.map(({ patch: _patch, ...rest }: any) => rest as FBFileScore);
}

export async function upsertRiskScore(userId: string, score: Omit<FBRiskScore, 'userId'>): Promise<void> {
  const trimmed = {
    ...score,
    per_file: trimPerFile(score.per_file ?? []),
  };
  await setDoc(
    doc(db, 'users', userId, 'repositories', repoId(score.repoFullName), 'riskScores', score.sha),
    clean({ ...trimmed, userId, analyzed_at: new Date().toISOString() }),
    { merge: true }
  );
}

export async function getRiskScore(userId: string, repoFullName: string, sha: string): Promise<FBRiskScore | null> {
  const snap = await getDoc(
    doc(db, 'users', userId, 'repositories', repoId(repoFullName), 'riskScores', sha)
  );
  return snap.exists() ? (snap.data() as FBRiskScore) : null;
}

export async function listRiskScoresByRepo(
  userId: string,
  repoFullName: string,
  branch?: string
): Promise<FBRiskScore[]> {
  const base = collection(db, 'users', userId, 'repositories', repoId(repoFullName), 'riskScores');
  const q = branch
    ? query(base, where('branch', '==', branch), orderBy('committed_at', 'desc'), limit(100))
    : query(base, orderBy('committed_at', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FBRiskScore);
}

export async function listAllRiskScores(userId: string, maxItems = 500): Promise<FBRiskScore[]> {
  // Iterate all repos and collect from each nested riskScores subcollection
  const repos = await listRepos(userId);
  const perRepo = await Promise.all(
    repos.map(r =>
      getDocs(
        query(
          collection(db, 'users', userId, 'repositories', repoId(r.full_name), 'riskScores'),
          orderBy('analyzed_at', 'desc'),
          limit(maxItems)
        )
      ).then(snap => snap.docs.map(d => d.data() as FBRiskScore))
    )
  );
  return perRepo
    .flat()
    .sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at))
    .slice(0, maxItems);
}

// ─── Change Impact Score CRUD (nested under repositories) ─────────────────────

export async function upsertChangeImpactScore(
  userId: string,
  score: Omit<FBChangeImpactScore, 'userId'>
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId, 'repositories', repoId(score.repoFullName), 'changeImpactScores', score.sha),
    clean({ ...score, userId, analyzed_at: new Date().toISOString() }),
    { merge: true }
  );
}

export async function getChangeImpactScore(
  userId: string,
  repoFullName: string,
  sha: string
): Promise<FBChangeImpactScore | null> {
  const snap = await getDoc(
    doc(db, 'users', userId, 'repositories', repoId(repoFullName), 'changeImpactScores', sha)
  );
  return snap.exists() ? (snap.data() as FBChangeImpactScore) : null;
}

export async function listChangeImpactScoresByRepo(
  userId: string,
  repoFullName: string
): Promise<FBChangeImpactScore[]> {
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'repositories', repoId(repoFullName), 'changeImpactScores'),
      orderBy('analyzed_at', 'desc'),
      limit(100)
    )
  );
  return snap.docs.map(d => d.data() as FBChangeImpactScore);
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

  const high = scores.filter(s => s.risk_label === 'HIGH RISK').length;
  const medium = scores.filter(s => s.risk_label === 'MEDIUM RISK').length;
  const low = scores.filter(s => s.risk_label === 'LOW RISK').length;
  const avgRisk = scores.length
    ? scores.reduce((acc, s) => acc + s.overall_risk_score, 0) / scores.length
    : 0;

  const repoMap = new Map<string, { sum: number; count: number; high: number; name: string }>();
  for (const s of scores) {
    const cur = repoMap.get(s.repoFullName) ?? { sum: 0, count: 0, high: 0, name: s.repoFullName.split('/')[1] };
    repoMap.set(s.repoFullName, {
      sum: cur.sum + s.overall_risk_score,
      count: cur.count + 1,
      high: cur.high + (s.risk_label === 'HIGH RISK' ? 1 : 0),
      name: cur.name,
    });
  }

  const top_risky_repos = [...repoMap.entries()]
    .map(([full_name, v]) => ({ repo_name: v.name, full_name, average_risk: v.sum / v.count, high_risk_count: v.high }))
    .sort((a, b) => b.average_risk - a.average_risk)
    .slice(0, 5);

  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;
  const risk_trend = Array.from({ length: 7 }, (_, i) => {
    const start = now - (7 - i) * WEEK;
    const end = now - (6 - i) * WEEK;
    const week = scores.filter(s => {
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

// ─── CodeRipple Integration ───────────────────────────────────────────────────

const CR_BASE = import.meta.env.VITE_CR_API_BASE_URL ?? 'http://localhost:5001';

/**
 * Merge a CodeRipple analysis result into an existing Firestore risk score doc.
 * Call this after running the CR backend on a commit.
 */
export async function mergeCodeRippleResult(
  userId: string,
  sha: string,
  repoFullName: string,
  cr: CodeRippleResult,
): Promise<void> {
  const ref = doc(db, 'users', userId, 'repositories', repoId(repoFullName), 'riskScores', sha);
  await setDoc(ref, {
    cr_analyzed: true,
    cr_risk_prediction: cr.risk_prediction,
    cr_risk_score: cr.risk_score,
    cr_risk_confidence: cr.risk_confidence,
    cr_change_type: cr.change_type,
    cr_model_used: cr.model_used,
    cr_semantic_change_score: cr.semantic_change_score,
    cr_similarity: cr.similarity,
    cr_ripple_depth: cr.ripple_depth,
    cr_ripple_size: cr.ripple_size,
    cr_direct_impact: cr.direct_impact,
    cr_indirect_impact: cr.indirect_impact,
    cr_impacted_files: cr.impacted_files,
    cr_changed_function: cr.changed_function,
    cr_changed_functions: cr.changed_functions,
    cr_functions_changed: cr.functions_changed,
    cr_total_lines_changed: cr.total_lines_changed,
    cr_contributing_factors: cr.contributing_factors,
    cr_feature_breakdown: cr.feature_breakdown,
    cr_dependency_graph: cr.dependency_graph,
  }, { merge: true });
}

/**
 * Call the CodeRipple backend (port 5001) to analyze a commit,
 * then store the result in Firestore merged into the existing risk score doc.
 *
 * Usage (call this from RepoDetails or wherever you trigger analysis):
 *   await analyzeAndStoreCR(userId, sha, 'C:/path/to/repo');
 */
export async function analyzeAndStoreCR(
  userId: string,
  sha: string,
  repoFullName: string,   // e.g. "owner/repo" — cloned automatically by CR backend
  commitMeta?: { message?: string; author_name?: string; committed_at?: string }
): Promise<CodeRippleResult | null> {
  try {
    const res = await fetch(`${CR_BASE}/change-impact-commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_full_name: repoFullName, commit_hash: sha }),
    });
    if (!res.ok) {
      console.error('[CodeRipple] API error:', res.status, await res.text());
      return null;
    }
    const cr: CodeRippleResult = await res.json();

    // 1. Merge CR fields into the riskScores doc (nested under repository)
    await mergeCodeRippleResult(userId, sha, repoFullName, cr);

    // 2. Write to dedicated changeImpactScores subcollection (also nested)
    const ciScore: Omit<FBChangeImpactScore, 'userId'> = {
      sha,
      repoFullName,
      analyzed_at: new Date().toISOString(),
      ...(commitMeta ?? {}),
      risk_prediction: cr.risk_prediction,
      risk_score: cr.risk_score,
      risk_confidence: cr.risk_confidence,
      change_type: cr.change_type,
      model_used: cr.model_used,
      semantic_change_score: cr.semantic_change_score,
      similarity: cr.similarity,
      ripple_depth: cr.ripple_depth,
      ripple_size: cr.ripple_size,
      direct_impact: cr.direct_impact,
      indirect_impact: cr.indirect_impact,
      impacted_files: cr.impacted_files,
      changed_function: cr.changed_function,
      changed_functions: cr.changed_functions,
      functions_changed: cr.functions_changed,
      total_lines_changed: cr.total_lines_changed,
      contributing_factors: cr.contributing_factors,
      feature_breakdown: cr.feature_breakdown,
      dependency_graph: cr.dependency_graph,
    };
    await upsertChangeImpactScore(userId, ciScore);

    return cr;
  } catch (err) {
    console.error('[CodeRipple] Failed to analyze commit:', err);
    return null;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
export async function wipeUserData(userId: string): Promise<void> {
  // Delete subcollections inside each repository, then the repository docs
  const repoSnap = await getDocs(collection(db, 'users', userId, 'repositories'));
  await Promise.all(
    repoSnap.docs.map(async repoDoc => {
      // Delete riskScores subcollection
      const riskSnap = await getDocs(collection(repoDoc.ref, 'riskScores'));
      await Promise.all(riskSnap.docs.map(d => deleteDoc(d.ref)));
      // Delete changeImpactScores subcollection
      const ciSnap = await getDocs(collection(repoDoc.ref, 'changeImpactScores'));
      await Promise.all(ciSnap.docs.map(d => deleteDoc(d.ref)));
      // Delete the repository document itself
      await deleteDoc(repoDoc.ref);
    })
  );
  // Wipe parent doc
  try { await deleteDoc(doc(db, 'users', userId)); } catch (e) { }
}
