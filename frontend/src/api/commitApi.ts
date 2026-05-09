import axiosInstance from './axiosInstance';

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar_url: string;
  };
  committed_at: string;
  overall_risk_score: number;
  risk_label: string;
  files_changed: number;
  additions: number;
  deletions: number;
  analyzed: boolean;
}

export interface CommitDetails extends Commit {
  risk_scores: {
    correctness: number;
    security: number;
    maintainability: number;
    integration: number;
  };
  risk_reasons: string[];
  patch: string;
  files: Array<{
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    patch: string;
    risk_contribution: number;
  }>;
}

export interface CommitListParams {
  page?: number;
  limit?: number;
  risk_filter?: 'all' | 'low' | 'medium' | 'high';
  author?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const commitApi = {
  // List commits for a repository
  listCommits: async (
    repoId: string,
    params: CommitListParams = {}
  ): Promise<PaginatedResponse<Commit>> => {
    const response = await axiosInstance.get<PaginatedResponse<Commit>>(
      `/repos/${repoId}/commits`,
      { params }
    );
    return response.data;
  },

  // Get commit details
  getCommitDetails: async (sha: string): Promise<CommitDetails> => {
    const response = await axiosInstance.get<CommitDetails>(`/commits/${sha}`);
    return response.data;
  },

  // Trigger analysis for a specific commit
  analyzeCommit: async (sha: string): Promise<{ status: string; job_id: string }> => {
    const response = await axiosInstance.post(`/commits/${sha}/analyze`);
    return response.data;
  },

  // Get analysis status
  getAnalysisStatus: async (jobId: string): Promise<{ status: string; progress: number }> => {
    const response = await axiosInstance.get(`/jobs/${jobId}/status`);
    return response.data;
  },
};
