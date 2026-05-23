import { MainLayout } from '@/components/layouts/MainLayout';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';
import { RiskTrendChart } from '@/components/charts/RiskTrendChart';
import { RiskBarChart } from '@/components/charts/RiskBarChart';
import { RiskBadge, RiskScoreBar } from '@/components/common/RiskBadge';
import { PageLoader } from '@/components/common/Loader';
import { Shield, TrendingUp, Folder, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPercentage } from '@/utils/formatters';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function RiskOverview() {
  useDocumentTitle('Risk Overview');
  const { dashboardData, isLoading, refetch } = useRiskAnalysis();

  if (isLoading || !dashboardData) {
    return <MainLayout title="Risk Overview"><PageLoader /></MainLayout>;
  }

  const highRiskRate = dashboardData.total_commits_analyzed
    ? dashboardData.high_risk_commits / dashboardData.total_commits_analyzed : 0;
  const safeRate = dashboardData.total_commits_analyzed
    ? dashboardData.low_risk_commits / dashboardData.total_commits_analyzed : 0;

  return (
    <MainLayout title="Risk Overview">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Risk Overview</h1>
            <p className="text-muted-foreground text-sm">Aggregated risk data across all analyzed commits</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 border-border" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>

        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <Shield className="h-6 w-6 text-primary" />, bg: 'bg-primary/10', label: 'Overall Risk Score', value: formatPercentage(dashboardData.average_risk_score) },
            { icon: <TrendingUp className="h-6 w-6 text-risk-high" />, bg: 'bg-risk-high/10', label: 'High Risk Rate', value: formatPercentage(highRiskRate) },
            { icon: <Folder className="h-6 w-6 text-risk-low" />, bg: 'bg-risk-low/10', label: 'Safe Commit Rate', value: formatPercentage(safeRate) },
          ].map((s, i) => (
            <div key={i} className={`glass-card rounded-xl p-6 animate-slide-up`} style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${s.bg}`}>{s.icon}</div>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold text-foreground">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
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

        {/* Repository Risk Breakdown */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:500ms]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Repository Risk Breakdown</h3>
            <Link to="/repos"><Button variant="ghost" size="sm" className="text-xs text-primary">View all repos</Button></Link>
          </div>
          {dashboardData.top_risky_repos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No data yet. <Link to="/repos" className="text-primary hover:underline">Analyze repositories</Link> first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Repository</th>
                    <th className="pb-3 font-medium">Average Risk</th>
                    <th className="pb-3 font-medium">High Risk Commits</th>
                    <th className="pb-3 font-medium">Risk Bar</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.top_risky_repos.map(repo => (
                    <tr key={repo.full_name} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-4">
                        <Link to={`/repos/${encodeURIComponent(repo.full_name)}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {repo.repo_name}
                        </Link>
                      </td>
                      <td className="py-4 font-mono">{formatPercentage(repo.average_risk)}</td>
                      <td className="py-4">{repo.high_risk_count} commits</td>
                      <td className="py-4 w-40">
                        <RiskScoreBar score={repo.average_risk} showPercentage={false} />
                      </td>
                      <td className="py-4"><RiskBadge score={repo.average_risk} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
