import axiosInstance from './axiosInstance';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskCategories {
  correctness:     number;
  security:        number;
  maintainability: number;
  integration:     number;
}

export interface RiskProbabilities {
  'HIGH RISK':   number;
  'LOW RISK':    number;
  'MEDIUM RISK': number;
}

export interface CommitRiskResult {
  sha:             string;
  repo:            string;
  risk_score:      number;
  risk_label:      'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';
  confidence:      number;
  probabilities:   RiskProbabilities;
  risk_categories: RiskCategories;
  risk_reasons:    string[];
  features:        Record<string, number>;
  mode:            'model' | 'heuristic';
  analyzed_at:     string;
}

export interface AnalyzeCommitPayload {
  sha:           string;
  repo:          string;
  description:   string;
  patch:         string;
  file:          string;
  old_contents:  string;
  new_contents:  string;
  messages?:     string;
  description_lang?: string;
  file_rows?:    number;
}

export interface BatchAnalyzePayload {
  sha:         string;
  repo:        string;
  description: string;
  files: Array<{
    patch:         string;
    file:          string;
    old_contents?: string;
    new_contents?: string;
  }>;
}

export interface BatchRiskResult extends CommitRiskResult {
  per_file: Array<{
    file:        string;
    risk_score?: number;
    risk_label?: string;
    error?:      string;
  }>;
}

export interface BackendHealth {
  status:       string;
  model_loaded: boolean;
  timestamp:    string;
}

// ── API ────────────────────────────────────────────────────────────────────

export const riskApi = {
  health: async (): Promise<BackendHealth> => {
    const res = await axiosInstance.get<BackendHealth>('/health');
    return res.data;
  },

  analyzeCommit: async (payload: AnalyzeCommitPayload): Promise<CommitRiskResult> => {
    const res = await axiosInstance.post<CommitRiskResult>('/analyze', payload);
    return res.data;
  },

  analyzeBatch: async (payload: BatchAnalyzePayload): Promise<BatchRiskResult> => {
    const res = await axiosInstance.post<BatchRiskResult>('/analyze/batch', payload);
    return res.data;
  },

  getCachedRisk: async (sha: string): Promise<CommitRiskResult | null> => {
    try {
      const res = await axiosInstance.get<CommitRiskResult>(`/commit/${sha}/risk`);
      return res.data;
    } catch {
      return null;
    }
  },

  cacheRisk: async (sha: string, result: CommitRiskResult): Promise<void> => {
    await axiosInstance.post(`/commit/${sha}/risk`, result);
  },
};
