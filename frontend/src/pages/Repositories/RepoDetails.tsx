import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, GitCommit, Clock, RefreshCw, ExternalLink,
  GitBranch, AlertCircle, ChevronDown, Play, Bug, Star, GitFork, Info, Loader2,
} from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useRepositories } from '@/hooks/useRepositories';
import { useCommits } from '@/hooks/useCommits';
import { listIssues, type GHIssue } from '@/lib/githubService';
import { RiskBadge, RiskScoreBar } from '@/components/common/RiskBadge';
import { PageLoader } from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatRelativeTime, truncateSha, formatNumber } from '@/utils/formatters';
import { useToast } from '@/hooks/use-toast';

// Label colour helper
function labelColour(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const bright = (r * 299 + g * 587 + b * 114) / 1000;
  return { bg: `#${hex}`, text: bright > 128 ? '#000' : '#fff' };
}

export default function RepoDetails() {
  const { repoId } = useParams<{ repoId: string }>();
  const { getRepository, isLoading: reposLoading } = useRepositories();
  const { toast } = useToast();

  const decodedId = repoId ? decodeURIComponent(repoId) : '';
  const repo = decodedId ? getRepository(decodedId) : undefined;

  // Parse owner/repo from full_name or id
  const fullName = repo?.full_name ?? decodedId;
  const [owner, repoName] = fullName.includes('/') ? fullName.split('/') : ['', fullName];

  const {
    commits, branches, currentBranch,
    isLoading: commitsLoading, isBranchLoading,
    switchBranch, runAnalysis, refresh,
  } = useCommits(owner || undefined, repoName || undefined);

  const [issues, setIssues]         = useState<GHIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issueFilter, setIssueFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [analyzingAll, setAnalyzingAll] = useState(false);

  // Load issues when tab switches to issues
  const loadIssues = async (state: 'open' | 'closed' | 'all' = 'open') => {
    if (!owner || !repoName) return;
    setIssuesLoading(true);
    try {
      const res = await listIssues(owner, repoName, state);
      setIssues(res.filter(i => !i.pull_request)); // exclude PRs
    } catch { setIssues([]); }
    finally { setIssuesLoading(false); }
  };

  const handleAnalyzeOne = async (sha: string) => {
    try {
      await runAnalysis(sha);
      toast({ title: 'Analysis complete', description: `Risk score calculated for ${truncateSha(sha)}` });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleAnalyzeAll = async () => {
    const unanalyzed = commits.filter(c => !c.risk);
    if (!unanalyzed.length) return;
    setAnalyzingAll(true);
    for (const c of unanalyzed.slice(0, 10)) {
      try { await runAnalysis(c.sha); } catch { /* continue */ }
    }
    setAnalyzingAll(false);
    toast({ title: 'Batch analysis complete', description: `Analyzed ${Math.min(10, unanalyzed.length)} commits` });
  };

  if (reposLoading) return <MainLayout><PageLoader /></MainLayout>;
  if (!repo && !reposLoading) return (
    <MainLayout>
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">Repository not found</p>
        <Link to="/repos"><Button variant="outline">Back to Repositories</Button></Link>
      </div>
    </MainLayout>
  );

  const activeBranchName = currentBranch || repo?.default_branch || 'main';

  // Aggregate risk stats from loaded commits
  const analyzedCommits = commits.filter(c => c.risk);
  const avgRisk = analyzedCommits.length
    ? analyzedCommits.reduce((s, c) => s + (c.risk?.overall_risk_score ?? 0), 0) / analyzedCommits.length
    : repo?.average_risk_score ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link to="/repos">
            <Button variant="ghost" size="icon" className="shrink-0 mt-1"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-foreground truncate">{repo?.full_name ?? decodedId}</h1>
              <RiskBadge score={avgRisk} />
              {repo?.private && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Private</span>}
            </div>
            {repo?.description && <p className="text-muted-foreground text-sm line-clamp-2">{repo.description}</p>}
            {/* Repo stats */}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              {repo?.language && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  {repo.language}
                </span>
              )}
              <span className="flex items-center gap-1"><Star className="h-3 w-3" />{formatNumber(repo?.stars_count ?? 0)}</span>
              <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{formatNumber(repo?.forks_count ?? 0)}</span>
              <span className="flex items-center gap-1"><Bug className="h-3 w-3" />{formatNumber(repo?.open_issues_count ?? 0)} issues</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Branch selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-border" disabled={isBranchLoading}>
                  <GitBranch className="h-4 w-4" />
                  {isBranchLoading ? 'Loading…' : activeBranchName}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {branches.length === 0 && (
                  <DropdownMenuItem disabled>No branches found</DropdownMenuItem>
                )}
                {branches.map(b => (
                  <DropdownMenuItem
                    key={b.name}
                    onClick={() => switchBranch(b.name)}
                    className={cn('gap-2', b.name === activeBranchName && 'bg-primary/10 text-primary')}
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    {b.name}
                    {b.protected && <span className="ml-auto text-xs text-muted-foreground">protected</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" className="gap-2 border-border" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />Sync
            </Button>
            {repo?.full_name && (
              <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="icon" className="border-border"><ExternalLink className="h-4 w-4" /></Button>
              </a>
            )}
          </div>
        </div>

        {/* Tabs: Commits | Issues | Risk Summary */}
        <Tabs defaultValue="commits" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-secondary/50 border border-border">
              <TabsTrigger value="commits" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Commits {commits.length > 0 && <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-xs">{commits.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="issues" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                onClick={() => loadIssues(issueFilter)}>
                Issues {repo?.open_issues_count ? <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-xs">{repo.open_issues_count}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Risk Summary
              </TabsTrigger>
            </TabsList>

            {/* Analyze all button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-xs"
              onClick={handleAnalyzeAll}
              disabled={analyzingAll || commitsLoading}
            >
              {analyzingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Analyze All
            </Button>
          </div>

          {/* ── Commits Tab ─────────────────────────────────────── */}
          <TabsContent value="commits" className="space-y-3">
            {commitsLoading && <PageLoader />}
            {!commitsLoading && commits.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
                <p className="text-muted-foreground text-sm">No commits found on branch <strong>{activeBranchName}</strong></p>
              </div>
            )}
            {commits.map((commit, index) => (
              <div
                key={commit.sha}
                className={cn('glass-card group flex items-center gap-4 rounded-xl p-4 transition-all hover:border-primary/30 animate-slide-up')}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={commit.author?.avatar_url ?? ''} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(commit.commit.author.name ?? 'U').charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <Link to={`/commits/${commit.sha}?owner=${owner}&repo=${repoName}`} className="block">
                    <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                      {commit.commit.message.split('\n')[0]}
                    </p>
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{commit.commit.author.name}</span>
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />{truncateSha(commit.sha)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{formatRelativeTime(commit.commit.author.date)}
                    </span>
                    {commit.stats && (
                      <span>
                        <span className="text-risk-low">+{commit.stats.additions}</span>
                        {' / '}
                        <span className="text-risk-high">-{commit.stats.deletions}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {commit.risk ? (
                    <RiskBadge score={commit.risk.overall_risk_score} showScore size="sm" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs border-border"
                      onClick={() => handleAnalyzeOne(commit.sha)}
                      disabled={commit.isAnalyzing}
                    >
                      {commit.isAnalyzing
                        ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing…</>
                        : <><Play className="h-3 w-3" />Analyze</>
                      }
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── Issues Tab ──────────────────────────────────────── */}
          <TabsContent value="issues" className="space-y-3">
            <div className="flex items-center gap-2">
              {(['open', 'closed', 'all'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setIssueFilter(s); loadIssues(s); }}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize',
                    issueFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {issuesLoading && <PageLoader />}
            {!issuesLoading && issues.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
                <p className="text-muted-foreground text-sm">No {issueFilter} issues</p>
              </div>
            )}
            {issues.map((issue, index) => (
              <a
                key={issue.id}
                href={issue.html_url}
                target="_blank"
                rel="noreferrer"
                className={cn('glass-card group flex items-start gap-4 rounded-xl p-4 transition-all hover:border-primary/30 animate-slide-up')}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className={cn('mt-1 h-2.5 w-2.5 rounded-full shrink-0', issue.state === 'open' ? 'bg-risk-low' : 'bg-muted-foreground')} />

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    #{issue.number} {issue.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={issue.user.avatar_url} />
                      <AvatarFallback>{issue.user.login.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{issue.user.login}</span>
                    <span>{formatRelativeTime(issue.created_at)}</span>
                    {issue.comments > 0 && <span>{issue.comments} comments</span>}
                  </div>
                  {/* Labels */}
                  {issue.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {issue.labels.map(lbl => {
                        const { bg, text } = labelColour(lbl.color);
                        return (
                          <span
                            key={lbl.id}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: bg, color: text }}
                          >
                            {lbl.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors mt-0.5" />
              </a>
            ))}
          </TabsContent>

          {/* ── Risk Summary Tab ─────────────────────────────────── */}
          <TabsContent value="summary">
            <div className="glass-card rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Risk Summary — {activeBranchName}</h3>
                {analyzedCommits.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    Analyze commits to see real stats
                  </div>
                )}
              </div>

              {/* Overall + sub-scores */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <RiskScoreBar
                    score={avgRisk}
                    label="Overall Risk"
                  />
                  <RiskScoreBar
                    score={analyzedCommits.length ? analyzedCommits.reduce((s,c) => s + (c.risk?.correctness_risk ?? 0), 0) / analyzedCommits.length : 0}
                    label="Correctness Risk"
                  />
                  <RiskScoreBar
                    score={analyzedCommits.length ? analyzedCommits.reduce((s,c) => s + (c.risk?.security_risk ?? 0), 0) / analyzedCommits.length : 0}
                    label="Security Risk"
                  />
                </div>
                <div className="space-y-4">
                  <RiskScoreBar
                    score={analyzedCommits.length ? analyzedCommits.reduce((s,c) => s + (c.risk?.maintainability_risk ?? 0), 0) / analyzedCommits.length : 0}
                    label="Maintainability Risk"
                  />
                  <RiskScoreBar
                    score={analyzedCommits.length ? analyzedCommits.reduce((s,c) => s + (c.risk?.integration_risk ?? 0), 0) / analyzedCommits.length : 0}
                    label="Integration Risk"
                  />
                </div>
              </div>

              {/* Distribution */}
              {analyzedCommits.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-muted-foreground">Risk Distribution ({analyzedCommits.length} analyzed)</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'High Risk', count: analyzedCommits.filter(c => (c.risk?.overall_risk_score ?? 0) >= 0.7).length, color: 'text-risk-high bg-risk-high/10' },
                      { label: 'Medium Risk', count: analyzedCommits.filter(c => { const s = c.risk?.overall_risk_score ?? 0; return s >= 0.4 && s < 0.7; }).length, color: 'text-risk-medium bg-risk-medium/10' },
                      { label: 'Low Risk', count: analyzedCommits.filter(c => (c.risk?.overall_risk_score ?? 0) < 0.4).length, color: 'text-risk-low bg-risk-low/10' },
                    ].map(item => (
                      <div key={item.label} className={cn('rounded-xl p-4 text-center', item.color)}>
                        <p className="text-2xl font-bold">{item.count}</p>
                        <p className="text-xs mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
