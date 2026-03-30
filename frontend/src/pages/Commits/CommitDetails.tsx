import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GitCommit, Clock, FileCode, AlertCircle, Play, Loader2, ExternalLink } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { getCommit, type GHCommit } from '@/lib/githubService';
import { analyzeCommit, type RiskResult } from '@/lib/flaskService';
import { upsertRiskScore, getRiskScore, type FBRiskScore } from '@/lib/firebaseService';
import { RiskBadge, RiskScoreBar } from '@/components/common/RiskBadge';
import { RiskRadarChart } from '@/components/charts/RiskRadarChart';
import { DependencyGraph } from '@/components/graphs/DependencyGraph';
import { PageLoader } from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDate, truncateSha } from '@/utils/formatters';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function CommitDetails() {
  const { sha } = useParams<{ sha: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const owner = searchParams.get('owner') ?? '';
  const repoName = searchParams.get('repo') ?? '';

  const [commit, setCommit] = useState<GHCommit | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const activeRiskMetrics = useMemo(() => {
    if (!risk) return null;
    if (!selectedFilename) return risk;

    const fileRisk = risk.per_file?.find(f => f.file === selectedFilename) || risk.per_file?.find(f => f.file.endsWith(selectedFilename));
    if (!fileRisk) return risk;

    const ext = '.' + (selectedFilename.split('.').pop()?.toLowerCase() || '');
    const NON_CODE_EXTS = ['.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.lock', '.log', '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.pdf', '.zip', '.tar', '.gz'];
    const isEnv = selectedFilename.toLowerCase().includes('.env') || selectedFilename.toLowerCase().includes('secret') || selectedFilename.toLowerCase().includes('credentials');

    const isGit = selectedFilename.toLowerCase().includes('.git');
    const isNonCode = NON_CODE_EXTS.includes(ext) || isGit;
    let finalReasons = fileRisk.risk_reasons ? [...fileRisk.risk_reasons] : [];

    if (isNonCode) {
      finalReasons = ["Changed file is non code (documentation, asset, or config)"];
    }
    if (isEnv) {
      finalReasons.unshift("CRITICAL: Environmental file or credentials may have been pushed!");
    }

    return {
      ...risk, // preserve overall score and sha
      correctness_risk: fileRisk.correctness_risk ?? 0,
      security_risk: fileRisk.security_risk ?? 0,
      maintainability_risk: fileRisk.maintainability_risk ?? 0,
      integration_risk: fileRisk.integration_risk ?? 0,
      risk_reasons: finalReasons,
      mode: risk.mode,
      isNonCode: isNonCode,
    };
  }, [risk, selectedFilename]);

  useEffect(() => {
    if (!sha) return;
    const load = async () => {
      setIsLoading(true);
      try {
        // Try Firebase first
        if (user) {
          const fb = await getRiskScore(user.id, `${owner}/${repoName}`, sha);
          if (fb) {
            setRisk({
              sha: fb.sha, risk_label: fb.risk_label,
              overall_risk_score: fb.overall_risk_score,
              correctness_risk: fb.correctness_risk,
              security_risk: fb.security_risk,
              maintainability_risk: fb.maintainability_risk,
              integration_risk: fb.integration_risk,
              risk_reasons: fb.risk_reasons,
              mode: fb.mode, added_lines: fb.additions,
              removed_lines: fb.deletions, files_touched: fb.files_changed,
              per_file: fb.per_file ?? [],
            });
          }
        }
        // Always fetch live commit data if owner/repo provided
        if (owner && repoName) {
          const c = await getCommit(owner, repoName, sha);
          setCommit(c);
        }
      } catch (e) {
        console.error('Failed to load commit', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [sha, owner, repoName, user]);

  const handleAnalyze = async () => {
    if (!sha || !commit) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeCommit(sha, commit.commit.message, commit.files ?? [], true);
      setRisk(result);
      // Persist
      if (user && owner && repoName) {
        const score: Omit<FBRiskScore, 'userId'> = {
          sha, repoFullName: `${owner}/${repoName}`, branch: 'default',
          message: commit.commit.message,
          author_name: commit.commit.author.name,
          author_avatar: commit.author?.avatar_url ?? '',
          committed_at: commit.commit.author.date,
          risk_label: result.risk_label,
          overall_risk_score: result.overall_risk_score,
          correctness_risk: result.correctness_risk ?? 0,
          security_risk: result.security_risk ?? 0,
          maintainability_risk: result.maintainability_risk ?? 0,
          integration_risk: result.integration_risk ?? 0,
          risk_reasons: result.risk_reasons ?? [],
          files_changed: result.files_touched ?? 0,
          additions: result.added_lines ?? 0,
          deletions: result.removed_lines ?? 0,
          mode: result.mode ?? 'model',
          analyzed_at: new Date().toISOString(),
          per_file: result.per_file ?? [],
        };
        await upsertRiskScore(user.id, score);
      }
      toast({ title: 'Analysis complete' });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) return <MainLayout><PageLoader /></MainLayout>;

  const message = commit?.commit.message ?? sha ?? '';
  const authorName = commit?.commit.author.name ?? 'Unknown';
  const authorAvatar = commit?.author?.avatar_url ?? '';
  const committedAt = commit?.commit.author.date ?? '';
  const files = commit?.files ?? [];

  // Build simple dependency graph from files
  const depGraph = {
    nodes: files.slice(0, 6).map((f, i) => ({
      id: String(i + 1),
      label: f.filename.split('/').pop() ?? f.filename,
      type: (i === 0 ? 'source' : f.additions > f.deletions ? 'impacted' : 'unaffected') as 'source' | 'impacted' | 'unaffected',
      risk_score: risk ? risk.overall_risk_score * (1 - i * 0.1) : undefined,
    })),
    edges: files.slice(1, 6).map((_, i) => ({
      source: '1',
      target: String(i + 2),
      relationship: 'modifies',
    })),
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link to={owner && repoName ? `/repos/${encodeURIComponent(`${owner}/${repoName}`)}` : '/repos'}>
            <Button variant="ghost" size="icon" className="shrink-0 mt-1"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground line-clamp-2">{message.split('\n')[0]}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={authorAvatar} />
                      <AvatarFallback className="text-xs">{authorName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{authorName}</span>
                  </div>
                  <span className="flex items-center gap-1"><GitCommit className="h-4 w-4" />{truncateSha(sha ?? '')}</span>
                  {committedAt && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatDate(committedAt, 'PPpp')}</span>}
                  {commit?.html_url && (
                    <a href={commit.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />GitHub
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {risk && <RiskBadge score={risk.overall_risk_score} showScore size="lg" />}
                <Button onClick={handleAnalyze} disabled={isAnalyzing || !commit} variant={risk ? 'outline' : 'default'} className="gap-2">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" />{risk ? 'Re-running…' : 'Analyzing…'}</> : <><Play className="h-4 w-4" />{risk ? 'Re-run Analysis' : 'Analyze Commit'}</>}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left — risk */}
          <div className="space-y-6 lg:col-span-2">
            {risk ? (
              <>
                {/* Risk scores */}
                <div className="glass-card rounded-xl p-6 animate-slide-up">
                  <h3 className="mb-4 text-lg font-semibold">{selectedFilename ? 'File Risk Analysis' : 'Risk Analysis'}</h3>
                  {(activeRiskMetrics as any)?.isNonCode ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/20 rounded-xl border border-dashed border-muted-foreground/30">
                      <FileCode className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-foreground font-medium">Non-Code File</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Risk scores are not calculated for documentation, configuration, `.git`, or asset files.</p>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <RiskScoreBar score={activeRiskMetrics?.correctness_risk ?? 0} label="Correctness" />
                        <RiskScoreBar score={activeRiskMetrics?.security_risk ?? 0} label="Security" />
                        <RiskScoreBar score={activeRiskMetrics?.maintainability_risk ?? 0} label="Maintainability" />
                        <RiskScoreBar score={activeRiskMetrics?.integration_risk ?? 0} label="Integration" />
                      </div>
                      <RiskRadarChart data={{
                        correctness: activeRiskMetrics?.correctness_risk ?? 0,
                        security: activeRiskMetrics?.security_risk ?? 0,
                        maintainability: activeRiskMetrics?.maintainability_risk ?? 0,
                        integration: activeRiskMetrics?.integration_risk ?? 0,
                      }} />
                    </div>
                  )}
                </div>

                {/* Risk reasons */}
                <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:100ms]">
                  <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-risk-high" />AI Risk Insights {selectedFilename && <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-md ml-2">{selectedFilename.split('/').pop()}</span>}
                  </h3>
                  <ul className="space-y-3">
                    {(activeRiskMetrics?.risk_reasons ?? []).map((reason, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-risk-high/20 text-xs font-bold text-risk-high">{i + 1}</span>
                        <span className="text-foreground">{reason}</span>
                      </li>
                    ))}
                  </ul>
                  {activeRiskMetrics?.mode && (
                    <p className="mt-3 text-xs text-muted-foreground">Analysis mode: <span className="font-mono">{activeRiskMetrics.mode}</span></p>
                  )}
                </div>
              </>
            ) : (
              <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
                <Play className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Not yet analyzed</h3>
                <p className="text-sm text-muted-foreground mb-4">Click Analyze Commit to get AI risk insights</p>
                <Button onClick={handleAnalyze} disabled={isAnalyzing || !commit}>
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</> : 'Analyze Now'}
                </Button>
              </div>
            )}

            {/* Dependency graph */}
            {files.length > 0 && (
              <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
                <h3 className="mb-4 text-lg font-semibold">Change Impact Graph</h3>
                <DependencyGraph data={depGraph} />
                <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-node-source" />Source</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-node-impacted" />Impacted</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-node-default" />Unaffected</span>
                </div>
              </div>
            )}
          </div>

          {/* Right — files & stats */}
          <div className="space-y-6">
            {/* Change stats */}
            <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:150ms]">
              <h3 className="mb-4 font-semibold">Changes</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{files.length || risk?.files_touched || 0}</p>
                  <p className="text-xs text-muted-foreground">Files</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-risk-low">+{commit?.stats?.additions ?? risk?.added_lines ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Additions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-risk-high">-{commit?.stats?.deletions ?? risk?.removed_lines ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Deletions</p>
                </div>
              </div>
            </div>

            {/* Files list */}
            {files.length > 0 && (
              <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:250ms]">
                <h3 className="mb-4 font-semibold flex items-center justify-between">
                  <span>Files Changed</span>
                  {selectedFilename && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFilename(null)} className="h-7 text-xs px-2">
                      Clear Selection
                    </Button>
                  )}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {files.map(file => {
                    const isSelected = file.filename === selectedFilename;
                    return (
                      <div
                        key={file.filename}
                        onClick={() => setSelectedFilename(isSelected ? null : file.filename)}
                        className={cn(
                          "flex items-center justify-between rounded-lg p-3 cursor-pointer transition-colors",
                          isSelected ? "bg-primary/20 ring-1 ring-primary" : "bg-secondary/50 hover:bg-secondary/80"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("truncate text-sm font-mono", isSelected ? "text-primary font-semibold" : "text-foreground")}>{file.filename.split('/').pop()}</span>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                          file.status === 'added' && 'bg-risk-low/20 text-risk-low',
                          file.status === 'modified' && 'bg-risk-medium/20 text-risk-medium',
                          file.status === 'removed' && 'bg-risk-high/20 text-risk-high',
                          file.status === 'renamed' && 'bg-primary/20 text-primary',
                        )}>
                          {file.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Patch preview */}
            {(selectedFilename ? files.find(f => f.filename === selectedFilename) : files[0])?.patch && (
              <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:350ms]">
                <h3 className="mb-4 font-semibold flex items-center justify-between">
                  <span>Patch Preview</span>
                  {selectedFilename && <span className="text-xs font-normal text-muted-foreground truncate ml-4" title={selectedFilename}>{selectedFilename}</span>}
                </h3>
                <pre className="max-h-64 overflow-auto rounded-lg bg-background/80 p-4 text-xs font-mono scrollbar-thin">
                  {(selectedFilename ? files.find(f => f.filename === selectedFilename) : files[0])!.patch!.split('\n').map((line, i) => (
                    <div key={i} className={cn(
                      'py-0.5 px-2 -mx-2',
                      line.startsWith('+') && !line.startsWith('+++') && 'diff-add',
                      line.startsWith('-') && !line.startsWith('---') && 'diff-remove',
                      line.startsWith('@@') && 'text-muted-foreground',
                    )}>
                      {line}
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
