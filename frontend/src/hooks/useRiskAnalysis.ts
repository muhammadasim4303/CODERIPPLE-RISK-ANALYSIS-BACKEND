import { useState, useCallback } from 'react';
import { riskApi, CommitRiskResult, BatchAnalyzePayload } from '@/api/riskApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Per-commit analysis state ──────────────────────────────────────────────

interface CommitAnalysisState {
  status:  'idle' | 'loading' | 'done' | 'error';
  result?: CommitRiskResult;
  error?:  string;
}

// ── GitHub API helper (mirrors useGithubApi.ts) ───────────────────────────

async function fetchFullCommit(owner: string, repo: string, sha: string): Promise<any> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey    = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const url = `${supabaseUrl}/functions/v1/github-api?action=get-commit&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(sha)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch commit' }));
    throw new Error(err.error || `GitHub API error: ${res.status}`);
  }

  return res.json();
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRiskAnalysis() {
  const [analyses, setAnalyses] = useState<Record<string, CommitAnalysisState>>({});

  const getState = useCallback(
    (sha: string): CommitAnalysisState => analyses[sha] ?? { status: 'idle' },
    [analyses]
  );

  const computeRisk = useCallback(
    async (sha: string, owner: string, repo: string, commitMessage?: string) => {
      if (analyses[sha]?.status === 'loading') return;

      setAnalyses(prev => ({ ...prev, [sha]: { status: 'loading' } }));

      try {
        // 1. Check cache first
        const cached = await riskApi.getCachedRisk(sha);
        if (cached) {
          setAnalyses(prev => ({ ...prev, [sha]: { status: 'done', result: cached } }));
          toast.success('Risk loaded from cache');
          return cached;
        }

        // 2. Fetch full commit from GitHub (includes files[] with patch)
        const fullCommit = await fetchFullCommit(owner, repo, sha);

        const files = (fullCommit.files || []).map((f: any) => ({
          patch:         f.patch        || '',
          file:          f.filename     || '',
          old_contents:  '',   // GitHub list API doesn't return raw content
          new_contents:  '',
        }));

        if (files.length === 0) {
          throw new Error('No file changes found in this commit');
        }

        // 3. Send to Flask backend
        const payload: BatchAnalyzePayload = {
          sha,
          repo:        `${owner}/${repo}`,
          description: commitMessage || fullCommit.commit?.message || '',
          files,
        };

        const result = await riskApi.analyzeBatch(payload);

        // 4. Cache it
        await riskApi.cacheRisk(sha, result).catch(() => {});

        setAnalyses(prev => ({ ...prev, [sha]: { status: 'done', result } }));
        toast.success(`Risk computed: ${result.risk_label}`);
        return result;

      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Analysis failed';
        setAnalyses(prev => ({ ...prev, [sha]: { status: 'error', error: msg } }));
        toast.error(`Risk analysis failed: ${msg}`);
        return null;
      }
    },
    [analyses]
  );

  const resetAnalysis = useCallback((sha: string) => {
    setAnalyses(prev => {
      const next = { ...prev };
      delete next[sha];
      return next;
    });
  }, []);

  return { getState, computeRisk, resetAnalysis };
}
