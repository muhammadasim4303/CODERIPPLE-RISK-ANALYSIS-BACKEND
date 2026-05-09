import axiosInstance from './axiosInstance';

export interface RiskScore {
  correctness_risk: number;
  security_risk: number;
  maintainability_risk: number;
  integration_risk: number;
  overall_risk_score: number;
  risk_label: string;
  risk_reasons: string[];
  analyzed_at: string;
}

export interface ChangeImpact {
  source_file: string;
  impacted_files: Array<{
    file_path: string;
    impact_type: 'direct' | 'indirect';
    impact_score: number;
    relationship: string;
  }>;
  dependency_graph: {
    nodes: Array<{
      id: string;
      label: string;
      type: 'source' | 'impacted' | 'unaffected';
      risk_score?: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship: string;
    }>;
  };
}

export interface DashboardSummary {
  total_repositories: number;
  total_commits_analyzed: number;
  high_risk_commits: number;
  average_risk_score: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  risk_trend: Array<{
    date: string;
    average_risk: number;
    commit_count: number;
  }>;
  top_risky_repos: Array<{
    repo_name: string;
    average_risk: number;
    high_risk_count: number;
  }>;
}

export const riskApi = {
  // Get risk scores for a commit
  getCommitRisk: async (sha: string): Promise<RiskScore> => {
    const response = await axiosInstance.get<RiskScore>(`/commit/${sha}/risk`);
    return response.data;
  },

  // Get change impact analysis
  getChangeImpact: async (sha: string): Promise<ChangeImpact> => {
    const response = await axiosInstance.get<ChangeImpact>(`/impact/${sha}`);
    return response.data;
  },

  // Get dashboard summary
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await axiosInstance.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },

  // Get organization-wide risk overview
  getRiskOverview: async (): Promise<{
    by_repo: Array<{ repo: string; risk: number }>;
    by_file_type: Array<{ extension: string; risk: number; count: number }>;
    trends: Array<{ week: string; risk: number }>;
  }> => {
    const response = await axiosInstance.get('/risk/overview');
    return response.data;
  },
};
