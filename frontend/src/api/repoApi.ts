import axiosInstance from './axiosInstance';

export interface Repository {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  last_analyzed_at: string | null;
  average_risk_score: number;
  total_commits_analyzed: number;
  high_risk_commits_count: number;
  created_at: string;
  updated_at: string;
}

export interface RepoSummary {
  total_commits: number;
  average_risk: number;
  high_risk_count: number;
  risk_by_category: {
    correctness: number;
    security: number;
    maintainability: number;
    integration: number;
  };
  high_risk_files: Array<{
    file_path: string;
    risk_score: number;
    commit_count: number;
  }>;
}

export const repoApi = {
  // List all connected repositories
  listRepositories: async (): Promise<Repository[]> => {
    const response = await axiosInstance.get<Repository[]>('/repos');
    return response.data;
  },

  // Get single repository details
  getRepository: async (repoId: string): Promise<Repository> => {
    const response = await axiosInstance.get<Repository>(`/repos/${repoId}`);
    return response.data;
  },

  // Get repository risk summary
  getRepoSummary: async (repoId: string): Promise<RepoSummary> => {
    const response = await axiosInstance.get<RepoSummary>(`/repos/${repoId}/summary`);
    return response.data;
  },

  // Connect a new repository
  connectRepository: async (repoFullName: string): Promise<Repository> => {
    const response = await axiosInstance.post<Repository>('/repos/connect', { repo: repoFullName });
    return response.data;
  },

  // Sync repository commits
  syncRepository: async (repoId: string): Promise<{ status: string; commits_synced: number }> => {
    const response = await axiosInstance.post(`/repos/${repoId}/sync`);
    return response.data;
  },

  // Remove repository
  removeRepository: async (repoId: string): Promise<void> => {
    await axiosInstance.delete(`/repos/${repoId}`);
  },
};
