/**
 * useRepositories — fetches GitHub repos live, persists to Firebase,
 * and merges risk stats so cards show avg risk, bar, counts.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listRepos, type GHRepo } from '@/lib/githubService';
import { upsertRepo, listRepos as fbListRepos, listRiskScoresByRepo, type FBRepo } from '@/lib/firebaseService';
import { supabase } from '@/lib/supabaseClient';

export type Repository = FBRepo & { html_url?: string; topics?: string[]; pushed_at?: string; is_collab?: boolean };

// Module-level cache — survives navigation, cleared after 5 min
const repoCache = new Map<string, { data: Repository[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function ghToFBBase(r: GHRepo): Omit<FBRepo, 'userId' | 'average_risk_score' | 'total_commits_analyzed' | 'high_risk_commits_count' | 'medium_risk_commits_count' | 'low_risk_commits_count' | 'last_analyzed_at'> {
  return {
    id: String(r.id || r.full_name),
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    private: r.private,
    language: r.language,
    stars_count: r.stargazers_count || 0,
    forks_count: r.forks_count || 0,
    open_issues_count: r.open_issues_count || 0,
    default_branch: r.default_branch || 'main',
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  };
}

export function useRepositories() {
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (force = false) => {
    if (!user) return;

    // Return cached data if fresh
    const cached = repoCache.get(user.id);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      setRepositories(cached.data);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 1. Pull live repos from GitHub
      let ghRepos = await listRepos();

      // 1.5. Pull collaborated repos from Supabase
      const orConditions = [];
      if (user.email) orConditions.push(`email.eq.${user.email}`);
      if (user.username) orConditions.push(`github_username.eq.${user.username}`);
      
      if (orConditions.length > 0) {
        const { data: collabs } = await supabase
          .from('repo_contributors')
          .select('repo_name')
          .or(orConditions.join(','))
          .eq('status', 'accepted');
          
        if (collabs && collabs.length > 0) {
          const ghNames = new Set(ghRepos.map(r => r.full_name));
          const newCollabs = collabs.filter(c => !ghNames.has(c.repo_name));
          
          for (const c of newCollabs) {
            const [owner, name] = c.repo_name.split('/');
            // Add a stub repo for UI to display
            ghRepos.push({
              id: c.repo_name as any,
              name: name || c.repo_name,
              full_name: c.repo_name,
              description: 'Collaborated Repository',
              private: true,
              language: null,
              stargazers_count: 0,
              forks_count: 0,
              open_issues_count: 0,
              default_branch: 'main',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              html_url: `https://github.com/${c.repo_name}`,
              topics: ['collaborator']
            } as any);
          }
        }
      }

      // 2. Read current Firebase state FIRST (has risk stats)
      const fbRepos = await fbListRepos(user.id);
      const fbMap = new Map(fbRepos.map(r => [r.full_name, r]));

      // 3. Upsert only non-risk fields to Firebase (preserves risk stats via merge:true)
      await Promise.all(ghRepos.map(r => upsertRepo(user.id, {
        ...ghToFBBase(r),
        average_risk_score:        fbMap.get(r.full_name)?.average_risk_score        ?? 0,
        total_commits_analyzed:    fbMap.get(r.full_name)?.total_commits_analyzed    ?? 0,
        high_risk_commits_count:   fbMap.get(r.full_name)?.high_risk_commits_count   ?? 0,
        medium_risk_commits_count: fbMap.get(r.full_name)?.medium_risk_commits_count ?? 0,
        low_risk_commits_count:    fbMap.get(r.full_name)?.low_risk_commits_count    ?? 0,
        last_analyzed_at:          fbMap.get(r.full_name)?.last_analyzed_at          ?? null,
      })));

      // 4. Compute live risk stats from riskScores collection for each repo
      const enriched = await Promise.all(ghRepos.map(async gh => {
        const fb = fbMap.get(gh.full_name);

        const scores = await listRiskScoresByRepo(user.id, gh.full_name);
        const total  = scores.length;
        const high   = scores.filter(s => s.risk_label === 'HIGH RISK').length;
        const medium = scores.filter(s => s.risk_label === 'MEDIUM RISK').length;
        const low    = scores.filter(s => s.risk_label === 'LOW RISK').length;
        const avg    = total ? scores.reduce((a, s) => a + s.overall_risk_score, 0) / total : 0;
        const lastAnalyzed = total
          ? scores.sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at))[0].analyzed_at
          : null;

        if (total > 0) {
          await upsertRepo(user.id, {
            ...ghToFBBase(gh),
            average_risk_score:        avg,
            total_commits_analyzed:    total,
            high_risk_commits_count:   high,
            medium_risk_commits_count: medium,
            low_risk_commits_count:    low,
            last_analyzed_at:          lastAnalyzed,
          });
        }

        return {
          ...(fb ?? { ...ghToFBBase(gh), average_risk_score: 0, total_commits_analyzed: 0, high_risk_commits_count: 0, medium_risk_commits_count: 0, low_risk_commits_count: 0, last_analyzed_at: null }),
          userId: user.id,
          average_risk_score:        total > 0 ? avg        : (fb?.average_risk_score        ?? 0),
          total_commits_analyzed:    total > 0 ? total      : (fb?.total_commits_analyzed    ?? 0),
          high_risk_commits_count:   total > 0 ? high       : (fb?.high_risk_commits_count   ?? 0),
          medium_risk_commits_count: total > 0 ? medium     : (fb?.medium_risk_commits_count ?? 0),
          low_risk_commits_count:    total > 0 ? low        : (fb?.low_risk_commits_count    ?? 0),
          last_analyzed_at:          total > 0 ? lastAnalyzed : (fb?.last_analyzed_at        ?? null),
          stars_count:       gh.stargazers_count,
          forks_count:       gh.forks_count,
          open_issues_count: gh.open_issues_count,
          html_url:          gh.html_url,
          topics:            gh.topics,
          pushed_at:         gh.pushed_at,
        } as Repository;
      }));

      repoCache.set(user.id, { data: enriched, ts: Date.now() });
      setRepositories(enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load repositories';
      setError(msg);
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
    (id: string) => repositories.find(r => r.id === id || r.full_name === id || r.name === id),
    [repositories]
  );

  // Expose invalidate so runAnalysis in useCommits can bust the cache
  const invalidateCache = useCallback(() => {
    if (user) repoCache.delete(user.id);
  }, [user]);

  return { repositories, isLoading, error, getRepository, refetch: () => fetch(true), invalidateCache };
}