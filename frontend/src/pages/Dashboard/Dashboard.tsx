import {
  GitBranch,
  GitCommit,
  AlertTriangle,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';
import { RiskBarChart } from '@/components/charts/RiskBarChart';
import { RiskTrendChart } from '@/components/charts/RiskTrendChart';
import { RiskBadge } from '@/components/common/RiskBadge';
import { PageLoader } from '@/components/common/Loader';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercentage } from '@/utils/formatters';
import { getRiskLevel } from '@/utils/riskUtils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
}

function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('glass-card rounded-xl p-6 animate-slide-up', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend.positive ? (
                <ArrowDownRight className="h-3 w-3 text-risk-low" />
              ) : (
                <ArrowUpRight className="h-3 w-3 text-risk-high" />
              )}
              <span className={trend.positive ? 'text-risk-low' : 'text-risk-high'}>
                {Math.abs(trend.value)}% from last week
              </span>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3 text-primary">{icon}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { dashboardData, isLoading } = useRiskAnalysis();

  if (isLoading || !dashboardData) {
    return (
      <MainLayout title="Dashboard">
        <PageLoader />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Repositories"
            value={dashboardData.total_repositories}
            icon={<GitBranch className="h-5 w-5" />}
            className="[animation-delay:0ms]"
          />
          <StatCard
            title="Commits Analyzed"
            value={formatNumber(dashboardData.total_commits_analyzed)}
            icon={<GitCommit className="h-5 w-5" />}
            className="[animation-delay:100ms]"
          />
          <StatCard
            title="High Risk Commits"
            value={dashboardData.high_risk_commits}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={{ value: 12, positive: true }}
            className="[animation-delay:200ms]"
          />
          <StatCard
            title="Average Risk Score"
            value={formatPercentage(dashboardData.average_risk_score)}
            icon={<TrendingDown className="h-5 w-5" />}
            trend={{ value: 8, positive: true }}
            className="[animation-delay:300ms]"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Risk Distribution */}
          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:400ms]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Risk Distribution</h3>
            <RiskBarChart data={dashboardData.risk_distribution} />
          </div>

          {/* Risk Trend */}
          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:500ms]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Risk Trend (7 Weeks)</h3>
            <RiskTrendChart data={dashboardData.risk_trend} />
          </div>
        </div>

        {/* Top Risky Repos */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:600ms]">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Top Risky Repositories</h3>
          <div className="space-y-3">
            {dashboardData.top_risky_repos.map((repo, index) => (
              <div
                key={repo.repo_name}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{repo.repo_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {repo.high_risk_count} high risk commits
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Avg Risk</p>
                    <p className="font-mono font-medium text-foreground">
                      {formatPercentage(repo.average_risk)}
                    </p>
                  </div>
                  <RiskBadge score={repo.average_risk} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
