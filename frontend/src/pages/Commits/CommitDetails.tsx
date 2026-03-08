import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GitCommit, Clock, FileCode, AlertCircle, CheckCircle } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useCommits } from '@/hooks/useCommits';
import { RiskBadge, RiskScoreBar } from '@/components/common/RiskBadge';
import { RiskRadarChart } from '@/components/charts/RiskRadarChart';
import { DependencyGraph } from '@/components/graphs/DependencyGraph';
import { PageLoader } from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDate, truncateSha } from '@/utils/formatters';
import type { CommitDetails as CommitDetailsType } from '@/api/commitApi';
import { CommitRiskCard } from '@/components/common/CommitRiskCard';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';

// Mock dependency graph data
const mockDependencyGraph = {
  nodes: [
    { id: '1', label: 'useAuth.ts', type: 'source' as const, risk_score: 0.72 },
    { id: '2', label: 'oauth.ts', type: 'impacted' as const, risk_score: 0.65 },
    { id: '3', label: 'tokens.ts', type: 'impacted' as const, risk_score: 0.58 },
    { id: '4', label: 'Login.tsx', type: 'impacted' as const, risk_score: 0.45 },
    { id: '5', label: 'AuthContext.tsx', type: 'impacted' as const, risk_score: 0.52 },
    { id: '6', label: 'api.ts', type: 'unaffected' as const },
  ],
  edges: [
    { source: '1', target: '2', relationship: 'imports' },
    { source: '1', target: '3', relationship: 'imports' },
    { source: '4', target: '1', relationship: 'uses hook' },
    { source: '5', target: '1', relationship: 'wraps' },
    { source: '2', target: '6', relationship: 'calls' },
  ],
};

export default function CommitDetails() {
  const { sha } = useParams<{ sha: string }>();
  const [searchParams] = useSearchParams();
  const owner = searchParams.get('owner') || '';
  const repo  = searchParams.get('repo')  || '';
  const { getCommitDetails } = useCommits();
  const [commit, setCommit] = useState<CommitDetailsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getState, computeRisk, resetAnalysis } = useRiskAnalysis();

  useEffect(() => {
    const fetchDetails = async () => {
      if (!sha) return;
      setIsLoading(true);
      const details = await getCommitDetails(sha);
      setCommit(details);
      setIsLoading(false);
    };
    fetchDetails();
  }, [sha, getCommitDetails]);

  if (isLoading || !commit) {
    return (
      <MainLayout>
        <PageLoader />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link to="/repos">
            <Button variant="ghost" size="icon" className="shrink-0 mt-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-foreground">{commit.message}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={commit.author.avatar_url} />
                      <AvatarFallback className="text-xs">{commit.author.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{commit.author.name}</span>
                  </div>
                  <span className="flex items-center gap-1">
                    <GitCommit className="h-4 w-4" />
                    {truncateSha(commit.sha)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDate(commit.committed_at, 'PPpp')}
                  </span>
                </div>
              </div>
              <RiskBadge score={commit.overall_risk_score} showScore size="lg" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Risk Analysis */}
          <div className="space-y-6 lg:col-span-2">
            {/* AI Risk Analysis Card — compute on demand */}
            {sha && (
              <CommitRiskCard
                sha={sha}
                owner={owner}
                repo={repo}
                commitData={{
                  message: commit.message,
                  files: commit.files?.map((f) => ({
                    filename:           f.filename,
                    patch:              f.patch,
                    previous_contents:  '',
                    new_contents:       '',
                  })),
                }}
                analysisStatus={getState(sha).status}
                analysisResult={getState(sha).result}
                analysisError={getState(sha).error}
                onComputeRisk={() =>
                  computeRisk(sha, owner, repo, commit.message)
                }
                onReset={() => resetAnalysis(sha)}
              />
            )}

            {/* Dependency Graph */}
            <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
              <h3 className="mb-4 text-lg font-semibold text-foreground">Change Impact Graph</h3>
              <DependencyGraph data={mockDependencyGraph} />
              <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-node-source" />
                  Source File
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-node-impacted" />
                  Impacted
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-node-default" />
                  Unaffected
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Files Changed */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:150ms]">
              <h3 className="mb-4 font-semibold text-foreground">Changes</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{commit.files_changed}</p>
                  <p className="text-xs text-muted-foreground">Files</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-risk-low">+{commit.additions}</p>
                  <p className="text-xs text-muted-foreground">Additions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-risk-high">-{commit.deletions}</p>
                  <p className="text-xs text-muted-foreground">Deletions</p>
                </div>
              </div>
            </div>

            {/* Files List */}
            <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:250ms]">
              <h3 className="mb-4 font-semibold text-foreground">Files Changed</h3>
              <div className="space-y-2">
                {commit.files.map((file) => (
                  <div
                    key={file.filename}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-mono text-foreground">
                        {file.filename.split('/').pop()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs font-medium',
                          file.status === 'added' && 'bg-risk-low/20 text-risk-low',
                          file.status === 'modified' && 'bg-risk-medium/20 text-risk-medium',
                          file.status === 'removed' && 'bg-risk-high/20 text-risk-high'
                        )}
                      >
                        {file.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Diff Preview */}
            <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:350ms]">
              <h3 className="mb-4 font-semibold text-foreground">Patch Preview</h3>
              <pre className="max-h-64 overflow-auto rounded-lg bg-background/80 p-4 text-xs font-mono scrollbar-thin">
                {commit.patch.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      'py-0.5 px-2 -mx-2',
                      line.startsWith('+') && !line.startsWith('+++') && 'diff-add',
                      line.startsWith('-') && !line.startsWith('---') && 'diff-remove',
                      (line.startsWith('@@') || line.startsWith('diff') || line.startsWith('index')) && 'text-muted-foreground'
                    )}
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
