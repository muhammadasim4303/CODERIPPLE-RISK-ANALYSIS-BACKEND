/**
 * githubService.ts
 * Calls Supabase Edge Function "github-api" to proxy all GitHub requests.
 * The edge function handles OAuth token injection.
 */
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
// const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SUPABASE_ANON = "sb_publishable_Dwk_o3iBYma7jjpYpWz1rw_t_G-hfn_";

async function ghEdge(action: string, params: Record<string, string> = {}, body?: unknown) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token ?? '';

  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/github-api?${qs}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));

  if (!res.ok) {
    console.error('EDGE FUNCTION ERROR:', json);
    throw new Error(json?.error ?? `GitHub API error ${res.status}`);
  }

  return json;
}


// ─── Types ────────────────────────────────────────────────────────────────────

export interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  topics?: string[];
  html_url: string;
}

export interface GHBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

export interface GHCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; date: string };
  };
  author: { login: string; avatar_url: string; html_url: string } | null;
  stats?: { additions: number; deletions: number; total: number };
  files?: GHFile[];
  html_url: string;
}

export interface GHFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GHIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string | null;
  user: { login: string; avatar_url: string };
  labels: Array<{ id: number; name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; avatar_url: string }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  html_url: string;
  pull_request?: { url: string };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listRepos(page = 1): Promise<GHRepo[]> {
  return ghEdge('list-repos', { page: String(page), per_page: '50', sort: 'updated' });
}

export async function listBranches(owner: string, repo: string): Promise<GHBranch[]> {
  try {
    const res = await ghEdge('list-branches', { owner, repo });
    if (Array.isArray(res) && res.length > 0) return res;
    throw new Error('Empty or invalid response from edge function');
  } catch {
    try {
      const url = `${import.meta.env.VITE_API_BASE_URL}/repos/${owner}/${repo}/branches`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.error("Backend listBranches fallback failed:", err);
    }
    return [];
  }
}

export async function listCommits(
  owner: string, repo: string, page = 1, branch?: string
): Promise<GHCommit[]> {
  const params: Record<string, string> = { owner, repo, page: String(page), per_page: '30' };
  if (branch) params.sha = branch;
  try {
    const res = await ghEdge('list-commits', params);
    if (Array.isArray(res) && res.length > 0) return res;
    throw new Error('Empty or invalid response from edge function');
  } catch (err) {
    try {
      let url = `${import.meta.env.VITE_API_BASE_URL}/repos/${owner}/${repo}/commits`;
      if (branch) url += `?branch=${branch}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (fallbackErr) {
      console.error("Backend listCommits fallback failed:", fallbackErr);
    }
    return [];
  }
}

export async function getCommit(owner: string, repo: string, sha: string): Promise<GHCommit> {
  try {
    return await ghEdge('get-commit', { owner, repo, sha });
  } catch (err) {
    try {
      const url = `${import.meta.env.VITE_API_BASE_URL}/repos/${owner}/${repo}/commit/${sha}`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (fallbackErr) {
      console.error("Backend getCommit fallback failed:", fallbackErr);
    }
    throw err;
  }
}

export async function listIssues(
  owner: string, repo: string, state = 'all', page = 1
): Promise<GHIssue[]> {
  try {
    const res = await ghEdge('list-issues', { owner, repo, state, page: String(page), per_page: '30' });
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}
