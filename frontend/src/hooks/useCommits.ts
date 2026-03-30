/**
 * useCommits — GitHub commits with branch switching, risk loading and analysis.
 * Risk scores persisted in Firebase; loaded from cache first.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  listCommits, listBranches, getCommit,
  type GHCommit, type GHBranch,
} from '@/lib/githubService';
import { analyzeCommit, getCachedRisk, type RiskResult } from '@/lib/flaskService';
import {
  upsertRiskScore, getRiskScore,
  type FBRiskScore,
} from '@/lib/firebaseService';

export interface CommitRow extends GHCommit {
  risk?: RiskResult | null;
  isAnalyzing?: boolean;
}

// Module-level caches — survive navigation, cleared after 5 min
const commitCache = new Map<string, { data: CommitRow[]; ts: number }>();
const branchCache = new Map<string, { data: GHBranch[];  ts: number }>();
const CACHE_TTL   = 5 * 60 * 1000;

export function useCommits(owner?: string, repo?: string) {
  const { user } = useAuth();
  const [commits, setCommits]                 = useState<CommitRow[]>([]);
  const [branches, setBranches]               = useState<GHBranch[]>([]);
  const [currentBranch, setCurrentBranch]     = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [isBranchLoading, setIsBranchLoading] = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Load branches once with cache
  useEffect(() => {
    if (!owner || !repo) return;
    const key = `${owner}/${repo}`;
    const cached = branchCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setBranches(cached.data);
      return;
    }
    setIsBranchLoading(true);
    listBranches(owner, repo)
      .then(data => {
        branchCache.set(key, { data, ts: Date.now() });
        setBranches(data);
      })
      .catch(() => setBranches([]))
      .finally(() => setIsBranchLoading(false));
  }, [owner, repo]);

  const loadCommits = useCallback(async (branch?: string, force = false) => {
    if (!owner || !repo) return;

    const key = `${owner}/${repo}:${branch ?? ''}:${user?.id}`;
    const cached = commitCache.get(key);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      setCommits(cached.data);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const ghCommits = await listCommits(owner, repo, 1, branch || undefined);

      // Hydrate with cached risk scores from Firebase
      const rows: CommitRow[] = await Promise.all(
        ghCommits.map(async (c): Promise<CommitRow> => {
          let risk: RiskResult | null = null;
          if (user) {
            const fb = await getRiskScore(user.id, `${owner}/${repo}`, c.sha);
            if (fb) {
              risk = {
                sha:                    fb.sha,
                risk_label:             fb.risk_label,
                overall_risk_score:     fb.overall_risk_score,
                correctness_risk:       fb.correctness_risk,
                security_risk:          fb.security_risk,
                maintainability_risk:   fb.maintainability_risk,
                integration_risk:       fb.integration_risk,
                risk_reasons:           fb.risk_reasons,
                mode:                   fb.mode,
                added_lines:            fb.additions,
                removed_lines:          fb.deletions,
                files_touched:          fb.files_changed,
                per_file:               fb.per_file ?? [],
              };
            } else {
              risk = await getCachedRisk(c.sha);
            }
          }
          return { ...c, risk };
        })
      );

      commitCache.set(key, { data: rows, ts: Date.now() });
      setCommits(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commits');
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, user]);

  useEffect(() => {
    loadCommits(currentBranch || undefined);
  }, [owner, repo, currentBranch, user?.id]);

  const switchBranch = (branch: string) => {
    setCurrentBranch(branch);
    setCommits([]);
  };

  const runAnalysis = useCallback(async (sha: string): Promise<RiskResult | null> => {
    if (!owner || !repo || !user) return null;

    setCommits(prev => prev.map(c => c.sha === sha ? { ...c, isAnalyzing: true } : c));
    try {
      const full   = await getCommit(owner, repo, sha);
      const result = await analyzeCommit(sha, full.commit.message, full.files ?? []);

      // Persist to Firebase — including per_file breakdown
      const score: Omit<FBRiskScore, 'userId'> = {
        sha,
        repoFullName:         `${owner}/${repo}`,
        branch:               currentBranch || 'default',
        message:              full.commit.message ?? '',
        author_name:          full.commit.author?.name ?? '',
        author_avatar:        full.author?.avatar_url ?? '',
        committed_at:         full.commit.author?.date ?? new Date().toISOString(),
        risk_label:           result.risk_label           ?? 'LOW RISK',
        overall_risk_score:   result.overall_risk_score   ?? 0,
        correctness_risk:     result.correctness_risk     ?? 0,
        security_risk:        result.security_risk        ?? 0,
        maintainability_risk: result.maintainability_risk ?? 0,
        integration_risk:     result.integration_risk     ?? 0,
        risk_reasons:         result.risk_reasons         ?? [],
        files_changed:        result.files_touched        ?? 0,
        additions:            result.added_lines          ?? 0,
        deletions:            result.removed_lines        ?? 0,
        mode:                 result.mode                 ?? 'model',
        analyzed_at:          new Date().toISOString(),
        per_file:             result.per_file             ?? [],
      };
      await upsertRiskScore(user.id, score);

      // Update commit cache with new risk
      const key = `${owner}/${repo}:${currentBranch}:${user.id}`;
      const cached = commitCache.get(key);
      if (cached) {
        const updated = cached.data.map(c =>
          c.sha === sha ? { ...c, risk: result, isAnalyzing: false } : c
        );
        commitCache.set(key, { data: updated, ts: cached.ts });
      }

      setCommits(prev => prev.map(c =>
        c.sha === sha ? { ...c, risk: result, isAnalyzing: false } : c
      ));
      return result;
    } catch (e) {
      setCommits(prev => prev.map(c =>
        c.sha === sha ? { ...c, isAnalyzing: false } : c
      ));
      throw e;
    }
  }, [owner, repo, user, currentBranch]);

  return {
    commits, branches, currentBranch,
    isLoading, isBranchLoading, error,
    switchBranch, runAnalysis,
    refresh: () => loadCommits(currentBranch || undefined, true),
  };
}