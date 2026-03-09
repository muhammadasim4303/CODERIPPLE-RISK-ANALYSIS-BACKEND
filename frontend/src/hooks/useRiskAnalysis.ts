/**
 * useRiskAnalysis — real data from Firebase for Dashboard & RiskOverview.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getDashboardStats, type DashboardStats } from '@/lib/firebaseService';

export function useRiskAnalysis() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats(user.id);
      setDashboardData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      // Fallback empty state so pages don't crash
      setDashboardData({
        total_repositories: 0,
        total_commits_analyzed: 0,
        high_risk_commits: 0,
        medium_risk_commits: 0,
        low_risk_commits: 0,
        average_risk_score: 0,
        risk_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
        risk_trend: [],
        top_risky_repos: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboardData, isLoading, error, refetch: fetch };
}
