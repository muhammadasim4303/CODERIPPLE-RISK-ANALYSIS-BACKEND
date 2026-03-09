/**
 * useRepositories — fetches GitHub repos live, persists to Firebase,
 * and merges risk stats so cards show avg risk, bar, counts.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listRepos, type GHRepo } from '@/lib/githubService';
import { upsertRepo, listRepos as fbListRepos, type FBRepo } from '@/lib/firebaseService';

// Shape that pages consume — superset of FBRepo + live GH fields
export type Repository = FBRepo & { html_url?: string; topics?: string[]; pushed_at?: string };

function ghToFB(r: GHRepo, userId: string): Omit<FBRepo, 'userId'> {
  return {
    id: String(r.id),
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    private: r.private,
    language: r.language,
    stars_count: r.stargazers_count,
    forks_count: r.forks_count,
    open_issues_count: r.open_issues_count,
    default_branch: r.default_branch,
    average_risk_score: 0,
    total_commits_analyzed: 0,
    high_risk_commits_count: 0,
    medium_risk_commits_count: 0,
    low_risk_commits_count: 0,
    last_analyzed_at: null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function useRepositories() {
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Pull live repos from GitHub
      const ghRepos = await listRepos();

      // 2. Upsert each to Firebase (merge: true preserves risk stats)
      await Promise.all(ghRepos.map(r => upsertRepo(user.id, ghToFB(r, user.id))));

      // 3. Read back from Firebase to get merged risk stats
      const fbRepos = await fbListRepos(user.id);
      const fbMap = new Map(fbRepos.map(r => [r.full_name, r]));

      // 4. Merge — GH provides live star/fork counts, Firebase provides risk stats
      const merged: Repository[] = ghRepos.map(gh => ({
        ...(fbMap.get(gh.full_name) ?? ghToFB(gh, user.id)),
        userId: user.id,
        stars_count: gh.stargazers_count,
        forks_count: gh.forks_count,
        open_issues_count: gh.open_issues_count,
        html_url: gh.html_url,
        topics: gh.topics,
        pushed_at: gh.pushed_at,
      }));

      setRepositories(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load repositories';
      setError(msg);
      // Fallback: load whatever is in Firebase
      try {
        const fb = await fbListRepos(user.id);
        setRepositories(fb.map(r => ({ ...r, userId: user.id })));
      } catch { /* ignore */ }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const getRepository = useCallback(
    (id: string) =>
      repositories.find(r => r.id === id || r.full_name === id || r.name === id),
    [repositories]
  );

  return { repositories, isLoading, error, getRepository, refetch: fetch };
}
