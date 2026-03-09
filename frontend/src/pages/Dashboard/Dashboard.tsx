import { GitBranch, GitCommit, AlertTriangle, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';
import { RiskBarChart } from '@/components/charts/RiskBarChart';
import { RiskTrendChart } from '@/components/charts/RiskTrendChart';
import { RiskBadge } from '@/components/common/RiskBadge';
import { PageLoader } from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercentage } from '@/utils/formatters';
import { Link } from 'react-router-dom';

function StatCard({ title, value, icon, trend, className }: {
  title: string; value: string | number; icon: React.ReactNode;
  trend?: { value: number; positive: boolean }; className?: string;
}) {
  return (
    <div className={cn('glass-card rounded-xl p-6 animate-slide-up', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend.positive
                ? <ArrowDownRight className="h-3 w-3 text-risk-low" />
                : <ArrowUpRight className="h-3 w-3 text-risk-high" />}
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
  const { dashboardData, isLoading, refetch } = useRiskAnalysis();

  if (isLoading || !dashboardData) {
    return <MainLayout title="Dashboard"><PageLoader /></MainLayout>;
  }

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Overview of your repository risk landscape</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 border-border" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Repositories" value={dashboardData.total_repositories} icon={<GitBranch className="h-5 w-5" />} className="[animation-delay:0ms]" />
          <StatCard title="Commits Analyzed"   value={formatNumber(dashboardData.total_commits_analyzed)} icon={<GitCommit className="h-5 w-5" />} className="[animation-delay:100ms]" />
          <StatCard title="High Risk Commits"  value={dashboardData.high_risk_commits} icon={<AlertTriangle className="h-5 w-5" />} className="[animation-delay:200ms]" />
          <StatCard title="Average Risk Score" value={formatPercentage(dashboardData.average_risk_score)} icon={<TrendingDown className="h-5 w-5" />} className="[animation-delay:300ms]" />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:400ms]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Risk Distribution</h3>
            {dashboardData.total_commits_analyzed === 0
              ? <p className="text-center text-sm text-muted-foreground py-8">No commits analyzed yet. Go to Repositories and analyze some commits.</p>
              : <RiskBarChart data={dashboardData.risk_distribution} />
            }
          </div>
          <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:500ms]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Risk Trend (7 Weeks)</h3>
            {dashboardData.risk_trend.every(t => t.commit_count === 0)
              ? <p className="text-center text-sm text-muted-foreground py-8">No trend data yet.</p>
              : <RiskTrendChart data={dashboardData.risk_trend} />
            }
          </div>
        </div>

        {/* Top risky repos */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:600ms]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Top Risky Repositories</h3>
            <Link to="/repos"><Button variant="ghost" size="sm" className="text-xs text-primary">View all</Button></Link>
          </div>
          {dashboardData.top_risky_repos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No risk data yet. <Link to="/repos" className="text-primary hover:underline">Analyze repositories</Link> to see results here.
            </p>
          ) : (
            <div className="space-y-3">
              {dashboardData.top_risky_repos.map((repo, index) => (
                <Link
                  key={repo.full_name}
                  to={`/repos/${encodeURIComponent(repo.full_name)}`}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{repo.repo_name}</p>
                      <p className="text-sm text-muted-foreground">{repo.high_risk_count} high risk commits</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Avg Risk</p>
                      <p className="font-mono font-medium text-foreground">{formatPercentage(repo.average_risk)}</p>
                    </div>
                    <RiskBadge score={repo.average_risk} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
