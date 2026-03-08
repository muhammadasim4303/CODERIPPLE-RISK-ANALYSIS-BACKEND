import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function githubApi(action: string, params: Record<string, string> = {}, body?: any) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const searchParams = new URLSearchParams({ action, ...params });
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-api?${searchParams.toString()}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errData.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function useGithubRepos(page = 1) {
  return useQuery({
    queryKey: ['github-repos', page],
    queryFn: () => githubApi('list-repos', { page: String(page), per_page: '30', sort: 'updated' }),
    retry: 1,
  });
}

export function useGithubRepo(owner: string, repo: string) {
  return useQuery({
    queryKey: ['github-repo', owner, repo],
    queryFn: () => githubApi('get-repo', { owner, repo }),
    enabled: !!owner && !!repo,
  });
}

export function useGithubCommits(owner: string, repo: string, page = 1) {
  return useQuery({
    queryKey: ['github-commits', owner, repo, page],
    queryFn: () => githubApi('list-commits', { owner, repo, page: String(page), per_page: '30' }),
    enabled: !!owner && !!repo,
  });
}

export function useGithubCommit(owner: string, repo: string, sha: string) {
  return useQuery({
    queryKey: ['github-commit', owner, repo, sha],
    queryFn: () => githubApi('get-commit', { owner, repo, sha }),
    enabled: !!owner && !!repo && !!sha,
  });
}

export function useGithubIssues(owner: string, repo: string, state = 'all', page = 1) {
  return useQuery({
    queryKey: ['github-issues', owner, repo, state, page],
    queryFn: () => githubApi('list-issues', { owner, repo, state, page: String(page) }),
    enabled: !!owner && !!repo,
  });
}

export function useCreateGithubIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, repo, title, body, labels }: { owner: string; repo: string; title: string; body?: string; labels?: string[] }) =>
      githubApi('create-issue', { owner, repo }, { title, body, labels }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-issues'] });
    },
  });
}

export function useUpdateGithubIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, repo, issue_number, ...body }: { owner: string; repo: string; issue_number: number; state?: string; title?: string; body?: string }) =>
      githubApi('update-issue', { owner, repo, issue_number: String(issue_number) }, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-issues'] });
    },
  });
}

export function useCreateGithubRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; private?: boolean; auto_init?: boolean }) =>
      githubApi('create-repo', {}, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-repos'] });
    },
  });
}
