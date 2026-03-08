import { MainLayout } from '@/components/layouts/MainLayout';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';
import { RiskTrendChart } from '@/components/charts/RiskTrendChart';
import { RiskBarChart } from '@/components/charts/RiskBarChart';
import { RiskBadge } from '@/components/common/RiskBadge';
import { PageLoader } from '@/components/common/Loader';
import { Shield, TrendingUp, FileCode, Folder } from 'lucide-react';
import { formatPercentage } from '@/utils/formatters';

export default function RiskOverview() {
  const { dashboardData, isLoading } = useRiskAnalysis();

  if (isLoading || !dashboardData) {
    return (
      <MainLayout title="Risk Overview">
        <PageLoader />
      </MainLayout>
    );
  }

  // Mock data for file type risk
  const fileTypeRisk = [
    { extension: '.ts', risk: 0.45, count: 234 },
    { extension: '.tsx', risk: 0.52, count: 189 },
    { extension: '.py', risk: 0.38, count: 156 },
    { extension: '.js', risk: 0.61, count: 123 },
    { extension: '.go', risk: 0.29, count: 98 },
  ];

  return (
    <MainLayout title="Risk Overview">
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatPercentage(dashboardData.average_risk_score)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:100ms]">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-risk-high/10 p-3">
                <TrendingUp className="h-6 w-6 text-risk-high" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Risk Rate</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatPercentage(dashboardData.high_risk_commits / dashboardData.total_commits_analyzed)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-risk-low/10 p-3">
                <Folder className="h-6 w-6 text-risk-low" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Safe Commits</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatPercentage((dashboardData.risk_distribution.low) / dashboardData.total_commits_analyzed)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:300ms]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Risk Trend Over Time</h3>
            <RiskTrendChart data={dashboardData.risk_trend} />
          </div>

          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:400ms]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Commits by Risk Level</h3>
            <RiskBarChart data={dashboardData.risk_distribution} />
          </div>
        </div>

        {/* File Type Risk */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:500ms]">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Risk by File Type</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {fileTypeRisk.map((item) => (
              <div
                key={item.extension}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-mono font-medium text-foreground">{item.extension}</p>
                    <p className="text-xs text-muted-foreground">{item.count} files</p>
                  </div>
                </div>
                <RiskBadge score={item.risk} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Repo Risk Table */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:600ms]">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Repository Risk Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Repository</th>
                  <th className="pb-3 font-medium">Average Risk</th>
                  <th className="pb-3 font-medium">High Risk</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.top_risky_repos.map((repo) => (
                  <tr key={repo.repo_name} className="border-b border-border/50">
                    <td className="py-4 font-medium text-foreground">{repo.repo_name}</td>
                    <td className="py-4 font-mono">{formatPercentage(repo.average_risk)}</td>
                    <td className="py-4">{repo.high_risk_count} commits</td>
                    <td className="py-4">
                      <RiskBadge score={repo.average_risk} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
