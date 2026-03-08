import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { DependencyGraph } from '@/components/graphs/DependencyGraph';
import { RiskBadge } from '@/components/common/RiskBadge';
import { Loader } from '@/components/common/Loader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitCommit,
  FileCode,
  ArrowRight,
  Search,
  Network,
  Layers,
  AlertTriangle,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateSha, formatRelativeTime } from '@/utils/formatters';
import {
  useGithubRepos,
  useGithubCommits,
  useGithubCommit,
} from '@/hooks/useGithubApi';
import {
  buildGraphFromFiles,
  extractModules,
  getTopModule,
  type CommitFile,
} from '@/utils/changeImpactUtils';

export default function ChangeImpact() {
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');

  // Fetch repos
  const { data: repos, isLoading: reposLoading } = useGithubRepos();

  // Fetch commits for selected repo
  const {
    data: commits,
    isLoading: commitsLoading,
  } = useGithubCommits(
    selectedRepo?.owner || '',
    selectedRepo?.repo || ''
  );

  // Fetch commit detail (files) for selected commit
  const {
    data: commitDetail,
    isLoading: detailLoading,
  } = useGithubCommit(
    selectedRepo?.owner || '',
    selectedRepo?.repo || '',
    selectedSha || ''
  );

  // Derive data from commit detail
  const changedFiles: CommitFile[] = useMemo(
    () => commitDetail?.files || [],
    [commitDetail]
  );

  const modules = useMemo(() => extractModules(changedFiles), [changedFiles]);

  const graphData = useMemo(() => buildGraphFromFiles(changedFiles), [changedFiles]);

  const filteredFiles = useMemo(() => {
    return changedFiles.filter((f) => {
      const matchesSearch = f.filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = filterModule === 'all' || getTopModule(f.filename) === filterModule;
      return matchesSearch && matchesModule;
    });
  }, [changedFiles, searchQuery, filterModule]);

  // Filter commits by search
  const filteredCommits = useMemo(() => {
    if (!commits) return [];
    return (commits as any[]).filter((c: any) =>
      c.commit?.message?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [commits, searchQuery]);

  // Stats
  const highImpactCount = changedFiles.filter((f) => f.additions + f.deletions > 50).length;

  return (
    <MainLayout title="Change Impact">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Change Impact Analysis</h1>
            <p className="text-muted-foreground">
              Track how code changes propagate through your codebase
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Repo selector */}
            <Select
              value={selectedRepo ? `${selectedRepo.owner}/${selectedRepo.repo}` : ''}
              onValueChange={(val) => {
                const [owner, repo] = val.split('/');
                setSelectedRepo({ owner, repo });
                setSelectedSha(null);
              }}
            >
              <SelectTrigger className="w-56 border-border bg-secondary/50">
                <GitBranch className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select repository" />
              </SelectTrigger>
              <SelectContent>
                {reposLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  (repos as any[] || []).map((r: any) => (
                    <SelectItem key={r.id} value={r.full_name}>
                      {r.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-52 bg-secondary/50 pl-10 border-border"
              />
            </div>
            {modules.length > 0 && (
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="w-40 border-border bg-secondary/50">
                  <SelectValue placeholder="Filter module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {!selectedRepo ? (
          <div className="glass-card rounded-xl p-12 text-center animate-fade-in">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Select a Repository</h2>
            <p className="text-muted-foreground">Choose a repository above to start analyzing change impact.</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            {selectedSha && commitDetail && (
              <div className="grid gap-4 md:grid-cols-4">
                <StatsCard
                  icon={<GitCommit className="h-5 w-5 text-primary" />}
                  value={commitDetail.stats?.total || 0}
                  label="Total Changes"
                  delay="0ms"
                  iconBg="bg-primary/10"
                />
                <StatsCard
                  icon={<AlertTriangle className="h-5 w-5 text-risk-high" />}
                  value={highImpactCount}
                  label="High Impact Files"
                  delay="100ms"
                  iconBg="bg-risk-high/10"
                />
                <StatsCard
                  icon={<FileCode className="h-5 w-5 text-info" />}
                  value={changedFiles.length}
                  label="Files Changed"
                  delay="200ms"
                  iconBg="bg-info/10"
                />
                <StatsCard
                  icon={<Layers className="h-5 w-5 text-warning" />}
                  value={modules.length}
                  label="Modules Affected"
                  delay="300ms"
                  iconBg="bg-warning/10"
                />
              </div>
            )}

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Commit List */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Commits</h2>
                {commitsLoading ? (
                  <div className="flex justify-center py-8"><Loader /></div>
                ) : filteredCommits.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No commits found.</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
                    {filteredCommits.slice(0, 30).map((c: any) => (
                      <button
                        key={c.sha}
                        onClick={() => setSelectedSha(c.sha)}
                        className={cn(
                          'w-full glass-card rounded-xl p-4 text-left transition-all hover:border-primary/30',
                          selectedSha === c.sha && 'ring-2 ring-primary border-primary/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={c.author?.avatar_url || c.committer?.avatar_url} />
                            <AvatarFallback>
                              {(c.commit?.author?.name || '?').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate text-sm">
                              {c.commit?.message?.split('\n')[0]}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <GitCommit className="h-3 w-3" />
                              <span className="font-mono">{truncateSha(c.sha)}</span>
                              <span>•</span>
                              <span>{formatRelativeTime(c.commit?.author?.date || c.commit?.committer?.date)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Impact Details */}
              <div className="lg:col-span-2 space-y-6">
                {!selectedSha ? (
                  <div className="glass-card rounded-xl p-12 text-center animate-fade-in">
                    <GitCommit className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-foreground font-semibold mb-1">Select a Commit</h3>
                    <p className="text-muted-foreground text-sm">Click a commit to see its change impact analysis.</p>
                  </div>
                ) : detailLoading ? (
                  <div className="flex justify-center py-12"><Loader /></div>
                ) : (
                  <>
                    {/* Dependency Graph */}
                    {graphData.nodes.length > 0 && (
                      <div className="glass-card rounded-xl p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Network className="h-5 w-5 text-primary" />
                            Dependency Flow
                          </h3>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-node-source" />
                              High Churn
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-node-impacted" />
                              Changed
                            </span>
                          </div>
                        </div>
                        <DependencyGraph data={graphData} className="h-[350px]" />
                      </div>
                    )}

                    {/* Changed Files */}
                    <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:100ms]">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <FileCode className="h-5 w-5 text-primary" />
                        Changed Files ({filteredFiles.length})
                      </h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                        {filteredFiles.map((file, index) => {
                          const isHighImpact = file.additions + file.deletions > 50;
                          return (
                            <div
                              key={file.filename}
                              className={cn(
                                'flex items-center justify-between rounded-lg p-3 transition-colors',
                                isHighImpact ? 'bg-risk-high/10' : 'bg-secondary/50'
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <FileCode
                                  className={cn(
                                    'h-4 w-4 shrink-0',
                                    isHighImpact ? 'text-risk-high' : 'text-muted-foreground'
                                  )}
                                />
                                <span className="font-mono text-sm text-foreground truncate">
                                  {file.filename}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                  {getTopModule(file.filename)}
                                </span>
                                <span className="text-xs text-success font-mono">+{file.additions}</span>
                                <span className="text-xs text-destructive font-mono">-{file.deletions}</span>
                                <span
                                  className={cn(
                                    'rounded px-2 py-0.5 text-xs font-medium',
                                    file.status === 'added'
                                      ? 'bg-success/20 text-success'
                                      : file.status === 'removed'
                                      ? 'bg-destructive/20 text-destructive'
                                      : file.status === 'renamed'
                                      ? 'bg-warning/20 text-warning'
                                      : 'bg-info/20 text-info'
                                  )}
                                >
                                  {file.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Module Summary */}
                    {modules.length > 0 && (
                      <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                          <Layers className="h-5 w-5 text-warning" />
                          Affected Modules
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {modules.map((module, index) => {
                            const fileCount = changedFiles.filter(
                              (f) => getTopModule(f.filename) === module
                            ).length;
                            return (
                              <div
                                key={module}
                                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2"
                              >
                                <div
                                  className={cn(
                                    'h-2 w-2 rounded-full',
                                    index === 0 ? 'bg-risk-high' : index === 1 ? 'bg-risk-medium' : 'bg-risk-low'
                                  )}
                                />
                                <span className="font-medium text-foreground">{module}</span>
                                <span className="text-xs text-muted-foreground">({fileCount} files)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function StatsCard({
  icon,
  value,
  label,
  delay,
  iconBg,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  delay: string;
  iconBg: string;
}) {
  return (
    <div className={`glass-card rounded-xl p-5 animate-slide-up`} style={{ animationDelay: delay }}>
      <div className="flex items-center gap-3">
        <div className={cn('rounded-lg p-2', iconBg)}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
