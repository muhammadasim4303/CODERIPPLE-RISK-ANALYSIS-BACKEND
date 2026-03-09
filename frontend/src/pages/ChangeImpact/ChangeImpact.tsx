import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';
import { listAllRiskScores, type FBRiskScore } from '@/lib/firebaseService';
import { DependencyGraph } from '@/components/graphs/DependencyGraph';
import { RiskBadge } from '@/components/common/RiskBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/common/Loader';
import { GitCommit, FileCode, ArrowRight, Search, Network, Layers, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateSha, formatRelativeTime } from '@/utils/formatters';
import { useAuth } from '@/context/AuthContext';

export default function ChangeImpact() {
  const { user } = useAuth();
  const [scores, setScores]         = useState<FBRiskScore[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [selected, setSelected]     = useState<FBRiskScore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    listAllRiskScores(user.id, 100)
      .then(s => {
        setScores(s);
        if (s.length) setSelected(s[0]);
      })
      .catch(() => setScores([]))
      .finally(() => setIsLoading(false));
  }, [user]);

  const repos = ['all', ...Array.from(new Set(scores.map(s => s.repoFullName)))];

  const filtered = scores.filter(s => {
    const matchSearch = s.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRepo   = repoFilter === 'all' || s.repoFullName === repoFilter;
    return matchSearch && matchRepo;
  });

  // Build a simple dep graph from the selected commit's reasons
  const depGraph = selected ? {
    nodes: [
      { id: '1', label: selected.repoFullName.split('/')[1] ?? 'repo', type: 'source' as const, risk_score: selected.overall_risk_score },
      ...(selected.risk_reasons ?? []).slice(0, 4).map((_, i) => ({
        id: String(i + 2),
        label: `Component ${i + 1}`,
        type: (i < 2 ? 'impacted' : 'unaffected') as 'impacted' | 'unaffected',
        risk_score: selected.overall_risk_score * (1 - i * 0.15),
      })),
    ],
    edges: (selected.risk_reasons ?? []).slice(0, 4).map((_, i) => ({
      source: '1', target: String(i + 2), relationship: 'impacts',
    })),
  } : { nodes: [], edges: [] };

  if (isLoading) return <MainLayout title="Change Impact"><PageLoader /></MainLayout>;

  return (
    <MainLayout title="Change Impact">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Change Impact Analysis</h1>
            <p className="text-muted-foreground">Track how code changes propagate through your codebase</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search commits…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 bg-secondary/50 pl-10 border-border"
              />
            </div>
            <Select value={repoFilter} onValueChange={setRepoFilter}>
              <SelectTrigger className="w-44 border-border bg-secondary/50">
                <SelectValue placeholder="Filter by repo" />
              </SelectTrigger>
              <SelectContent>
                {repos.map(r => (
                  <SelectItem key={r} value={r}>{r === 'all' ? 'All Repos' : r.split('/')[1] ?? r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: <GitCommit className="h-5 w-5 text-primary" />, bg: 'bg-primary/10', value: scores.length, label: 'Analyzed Commits' },
            { icon: <AlertTriangle className="h-5 w-5 text-risk-high" />, bg: 'bg-risk-high/10', value: scores.filter(s => s.risk_label === 'HIGH RISK').length, label: 'High Impact' },
            { icon: <FileCode className="h-5 w-5 text-info" />, bg: 'bg-info/10', value: scores.reduce((a, s) => a + s.files_changed, 0), label: 'Files Affected' },
            { icon: <Layers className="h-5 w-5 text-warning" />, bg: 'bg-warning/10', value: new Set(scores.map(s => s.repoFullName)).size, label: 'Repos Tracked' },
          ].map((s, i) => (
            <div key={i} className={`glass-card rounded-xl p-5 animate-slide-up`} style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-3">
                <div className={cn('rounded-lg p-2', s.bg)}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {scores.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="text-center">
              <Network className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No analyzed commits yet</h3>
              <p className="text-sm text-muted-foreground">Go to Repositories and run analysis on some commits to see impact data here.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Commit list */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Analyzed Changes</h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filtered.map(score => (
                  <button
                    key={score.sha}
                    onClick={() => setSelected(score)}
                    className={cn(
                      'w-full glass-card rounded-xl p-4 text-left transition-all hover:border-primary/30',
                      selected?.sha === score.sha && 'ring-2 ring-primary border-primary/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={score.author_avatar} />
                          <AvatarFallback>{score.author_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">{score.message.split('\n')[0]}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <GitCommit className="h-3 w-3" />
                            <span className="font-mono">{truncateSha(score.sha)}</span>
                            <span>•</span>
                            <span>{formatRelativeTime(score.committed_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{score.repoFullName}</p>
                        </div>
                      </div>
                      <RiskBadge score={score.overall_risk_score} size="sm" />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{score.files_changed} files</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className={score.risk_label === 'HIGH RISK' ? 'text-risk-high' : 'text-risk-medium'}>
                        {score.additions} additions
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="lg:col-span-2 space-y-6">
                {/* Dependency graph */}
                <div className="glass-card rounded-xl p-6 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Network className="h-5 w-5 text-primary" />Dependency Flow
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-node-source" />Source</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-node-impacted" />Impacted</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-node-default" />Unaffected</span>
                    </div>
                  </div>
                  <DependencyGraph data={depGraph} className="h-[300px]" />
                </div>

                {/* Risk reasons as impacted areas */}
                <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:100ms]">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-warning" />Risk Reasons & Impact
                  </h3>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {['files changed', 'lines added', 'lines removed'].map((tag, i) => (
                      <span key={tag} className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-primary" />
                        <span className="font-mono text-primary">
                          {i === 0 ? selected.files_changed : i === 1 ? `+${selected.additions}` : `-${selected.deletions}`}
                          {' '}{tag}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <ChevronRight className="h-5 w-5 text-muted-foreground rotate-90" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Risk Signals Detected</p>
                    {(selected.risk_reasons ?? []).map((reason, i) => (
                      <div key={i} className={cn('flex items-start justify-between rounded-lg p-3', i < 2 ? 'bg-risk-high/10' : 'bg-secondary/50')}>
                        <div className="flex items-start gap-3">
                          <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            i < 2 ? 'bg-risk-high/20 text-risk-high' : 'bg-secondary text-muted-foreground'
                          )}>{i + 1}</span>
                          <span className="text-sm text-foreground">{reason}</span>
                        </div>
                        <span className={cn('rounded px-2 py-0.5 text-xs font-medium shrink-0 ml-2',
                          i < 2 ? 'bg-risk-high/20 text-risk-high' : 'bg-risk-medium/20 text-risk-medium'
                        )}>
                          {i < 2 ? 'direct' : 'indirect'}
                        </span>
                      </div>
                    ))}
                    {(selected.risk_reasons ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">No risk signals for this commit.</p>
                    )}
                  </div>
                </div>

                {/* Module summary */}
                <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Commit Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-muted-foreground text-xs mb-1">Repository</p>
                      <p className="font-medium text-foreground truncate">{selected.repoFullName}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-muted-foreground text-xs mb-1">Branch</p>
                      <p className="font-medium text-foreground">{selected.branch}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-muted-foreground text-xs mb-1">Risk Label</p>
                      <RiskBadge score={selected.overall_risk_score} size="sm" />
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-muted-foreground text-xs mb-1">Mode</p>
                      <p className="font-mono text-xs text-foreground">{selected.mode}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
