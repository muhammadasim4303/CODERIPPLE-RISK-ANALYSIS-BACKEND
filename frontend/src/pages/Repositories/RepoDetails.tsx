import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, GitCommit, Clock, RefreshCw, ExternalLink, AlertCircle, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useGithubRepo, useGithubCommits, useGithubIssues, useCreateGithubIssue, useUpdateGithubIssue, useGithubCommit } from '@/hooks/useGithubApi';
import { PageLoader } from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/formatters';
import { toast } from 'sonner';
import { CommitRiskCard } from '@/components/common/CommitRiskCard';
import { useRiskAnalysis } from '@/hooks/useRiskAnalysis';

export default function RepoDetails() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [commitPage, setCommitPage] = useState(1);
  const { getState, computeRisk, resetAnalysis } = useRiskAnalysis();
  const [issueState, setIssueState] = useState('all');
  const [issuePage, setIssuePage] = useState(1);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({ title: '', body: '' });

  const { data: repoData, isLoading: repoLoading } = useGithubRepo(owner || '', repo || '');
  const { data: commits, isLoading: commitsLoading } = useGithubCommits(owner || '', repo || '', commitPage);
  const { data: issues, isLoading: issuesLoading } = useGithubIssues(owner || '', repo || '', issueState, issuePage);
  const createIssue = useCreateGithubIssue();
  const updateIssue = useUpdateGithubIssue();

  if (repoLoading) {
    return <MainLayout><PageLoader /></MainLayout>;
  }

  if (!repoData) {
    return (
      <MainLayout>
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Repository not found</p>
        </div>
      </MainLayout>
    );
  }

  const handleCreateIssue = async () => {
    if (!newIssue.title.trim() || !owner || !repo) return;
    try {
      await createIssue.mutateAsync({ owner, repo, title: newIssue.title, body: newIssue.body });
      toast.success('Issue created!');
      setCreateIssueOpen(false);
      setNewIssue({ title: '', body: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create issue');
    }
  };

  const handleCloseIssue = async (issueNumber: number) => {
    if (!owner || !repo) return;
    try {
      await updateIssue.mutateAsync({ owner, repo, issue_number: issueNumber, state: 'closed' });
      toast.success('Issue closed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/repos">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{repoData.full_name}</h1>
            </div>
            <p className="text-muted-foreground">{repoData.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={repoData.html_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="icon" className="border-border">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="commits" className="space-y-4">
          <TabsList className="bg-secondary/50 border border-border">
            <TabsTrigger value="commits" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Commits
            </TabsTrigger>
            <TabsTrigger value="issues" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Issues
            </TabsTrigger>
          </TabsList>

          {/* Commits Tab */}
          <TabsContent value="commits" className="space-y-4">
            {commitsLoading ? (
              <PageLoader />
            ) : (
              <>
                {(commits || []).map((commit: any, index: number) => {
                  const state = getState(commit.sha);
                  return (
                    <div
                      key={commit.sha}
                      className={cn(
                        'glass-card group rounded-xl overflow-hidden transition-all hover:border-primary/30 animate-slide-up'
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Commit row */}
                      <div className="flex items-center gap-4 p-4">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={commit.author?.avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {commit.commit?.author?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {commit.commit?.message?.split('\n')[0]}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{commit.commit?.author?.name}</span>
                            <span className="flex items-center gap-1">
                              <GitCommit className="h-3 w-3" />
                              {commit.sha?.substring(0, 7)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(commit.commit?.author?.date)}
                            </span>
                          </div>
                        </div>

                        {/* Compact risk badge + compute button */}
                        <CommitRiskCard
                          compact
                          sha={commit.sha}
                          owner={owner || ''}
                          repo={repo || ''}
                          commitData={{ message: commit.commit?.message || '' }}
                          analysisStatus={state.status}
                          analysisResult={state.result}
                          analysisError={state.error}
                          onComputeRisk={() =>
                            computeRisk(
                              commit.sha,
                              owner || '',
                              repo || '',
                              commit.commit?.message || ''
                            )
                          }
                          onReset={() => resetAnalysis(commit.sha)}
                        />

                        <a
                          href={commit.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-muted-foreground hover:text-primary shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}

                {/* Commit Pagination */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={commitPage === 1}
                    onClick={() => setCommitPage((p) => p - 1)}
                    className="border-border"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {commitPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCommitPage((p) => p + 1)}
                    disabled={(commits || []).length < 30}
                    className="border-border"
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {['all', 'open', 'closed'].map((s) => (
                  <Button
                    key={s}
                    variant={issueState === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setIssueState(s); setIssuePage(1); }}
                    className={issueState === s ? 'bg-primary text-primary-foreground' : 'border-border'}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
              <Dialog open={createIssueOpen} onOpenChange={setCreateIssueOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary text-primary-foreground">
                    <Plus className="h-4 w-4" /> New Issue
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Create Issue</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Title</Label>
                      <Input
                        placeholder="Issue title"
                        value={newIssue.title}
                        onChange={(e) => setNewIssue((p) => ({ ...p, title: e.target.value }))}
                        className="bg-secondary/50 border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Description</Label>
                      <Textarea
                        placeholder="Describe the issue..."
                        value={newIssue.body}
                        onChange={(e) => setNewIssue((p) => ({ ...p, body: e.target.value }))}
                        className="bg-secondary/50 border-border min-h-[120px]"
                      />
                    </div>
                    <Button
                      onClick={handleCreateIssue}
                      disabled={createIssue.isPending || !newIssue.title.trim()}
                      className="w-full bg-primary text-primary-foreground"
                    >
                      Create Issue
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {issuesLoading ? (
              <PageLoader />
            ) : (
              <>
                {(issues || []).filter((i: any) => !i.pull_request).map((issue: any, index: number) => (
                  <div
                    key={issue.id}
                    className="glass-card rounded-xl p-4 animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <AlertCircle className={cn(
                            "h-4 w-4 shrink-0",
                            issue.state === 'open' ? 'text-risk-low' : 'text-muted-foreground'
                          )} />
                          <a
                            href={issue.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary truncate"
                          >
                            {issue.title}
                          </a>
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                            issue.state === 'open'
                              ? 'bg-risk-low/15 text-risk-low'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {issue.state}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>#{issue.number}</span>
                          <span>by {issue.user?.login}</span>
                          <span>{formatRelativeTime(issue.created_at)}</span>
                        </div>
                        {issue.labels?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {issue.labels.map((label: any) => (
                              <span
                                key={label.id}
                                className="rounded-full px-2 py-0.5 text-xs border border-border"
                                style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {issue.state === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCloseIssue(issue.number)}
                          className="border-border shrink-0"
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {(issues || []).filter((i: any) => !i.pull_request).length === 0 && (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
                    <p className="text-muted-foreground">No issues found</p>
                  </div>
                )}

                {/* Issue Pagination */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={issuePage === 1}
                    onClick={() => setIssuePage((p) => p - 1)}
                    className="border-border"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {issuePage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIssuePage((p) => p + 1)}
                    disabled={(issues || []).filter((i: any) => !i.pull_request).length < 30}
                    className="border-border"
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
