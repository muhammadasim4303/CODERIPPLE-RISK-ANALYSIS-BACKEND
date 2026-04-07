import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, GitCommit, Clock, FileCode, AlertCircle,
  Play, Loader2, ExternalLink, Network, Zap, FunctionSquare,
  BarChart3, Waves, ChevronRight, ArrowRight, Shield,
} from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { getCommit, type GHCommit } from '@/lib/githubService';
import { analyzeCommit, type RiskResult } from '@/lib/flaskService';
import { upsertRiskScore, getRiskScore, getChangeImpactScore, analyzeAndStoreCR, type FBRiskScore, type FBChangeImpactScore } from '@/lib/firebaseService';
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
import type { CRChangedFunction } from '@/types/coderippleTypes';

export default function CommitDetails() {
  const { sha } = useParams<{ sha: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const owner = searchParams.get('owner') ?? '';
  const repoName = searchParams.get('repo') ?? '';

  const [commit, setCommit] = useState<GHCommit | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [fbScore, setFbScore] = useState<FBRiskScore | null>(null);
  const [ciScore, setCiScore] = useState<FBChangeImpactScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCRRunning, setIsCRRunning] = useState(false);
  const [ciTab, setCiTab] = useState<'graph' | 'functions' | 'ripple' | 'breakdown'>('graph');

  useEffect(() => {
    if (!sha) return;
    const load = async () => {
      setIsLoading(true);
      try {
        if (user) {
          // Load risk score
          const fb = await getRiskScore(user.id, `${owner}/${repoName}`, sha);
          if (fb) {
            setFbScore(fb);
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
          // Load Change Impact score from dedicated collection
          const ci = await getChangeImpactScore(user.id, `${owner}/${repoName}`, sha);
          if (ci) {
            setCiScore(ci);
            // Also backfill fbScore cr_* fields if riskScore doc is missing them
            if (fb && !fb.cr_analyzed) {
              setFbScore(prev => prev ? {
                ...prev,
                cr_analyzed: true,
                cr_risk_prediction: ci.risk_prediction,
                cr_risk_score: ci.risk_score,
                cr_risk_confidence: ci.risk_confidence,
                cr_change_type: ci.change_type,
                cr_model_used: ci.model_used,
                cr_semantic_change_score: ci.semantic_change_score,
                cr_similarity: ci.similarity,
                cr_ripple_depth: ci.ripple_depth,
                cr_ripple_size: ci.ripple_size,
                cr_direct_impact: ci.direct_impact,
                cr_indirect_impact: ci.indirect_impact,
                cr_impacted_files: ci.impacted_files,
                cr_changed_function: ci.changed_function,
                cr_changed_functions: ci.changed_functions,
                cr_functions_changed: ci.functions_changed,
                cr_total_lines_changed: ci.total_lines_changed,
                cr_contributing_factors: ci.contributing_factors,
                cr_feature_breakdown: ci.feature_breakdown,
                cr_dependency_graph: ci.dependency_graph,
              } : prev);
            }
          }
        }
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

  //  Risk analysis (port 5000) 
  const handleAnalyze = async () => {
    if (!sha || !commit) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeCommit(sha, commit.commit.message, commit.files ?? [], true);
      setRisk(result);
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
        const updated = await getRiskScore(user.id, `${owner}/${repoName}`, sha);
        if (updated) setFbScore(updated);
      }
      toast({ title: 'Risk analysis complete' });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  //  Change impact analysis (port 5001) — no risk, only impact 
  const handleCRAnalysis = async () => {
    if (!sha || !user) return;
    setIsCRRunning(true);
    try {
      const commitMeta = commit ? {
        message: commit.commit.message,
        author_name: commit.commit.author.name,
        committed_at: commit.commit.author.date,
      } : undefined;

      const cr = await analyzeAndStoreCR(user.id, sha, `${owner}/${repoName}`, commitMeta);
      if (cr) {
        // Refresh both the merged riskScore doc and the dedicated CI score
        const [updated, ci] = await Promise.all([
          getRiskScore(user.id, `${owner}/${repoName}`, sha),
          getChangeImpactScore(user.id, `${owner}/${repoName}`, sha),
        ]);
        if (updated) setFbScore(updated);
        if (ci) setCiScore(ci);
        toast({ title: 'Change impact analysis complete', description: `${cr.functions_changed} functions analyzed · ripple depth ${cr.ripple_depth}` });
      } else {
        toast({ title: 'Change impact failed', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Change impact failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsCRRunning(false);
    }
  };

  if (isLoading) return <MainLayout><PageLoader /></MainLayout>;

  const message = commit?.commit.message ?? sha ?? '';
  const authorName = commit?.commit.author.name ?? 'Unknown';
  const authorAvatar = commit?.author?.avatar_url ?? '';
  const committedAt = commit?.commit.author.date ?? '';
  const files = commit?.files ?? [];
  const hasCR = !!fbScore?.cr_analyzed;

  //  Build dependency graph 
  //  Helper: make a human-readable label from whatever the CR backend gives us 
  const formatNodeLabel = (rawLabel: string, nodeId: string, category: string): string => {
    // Strip a leading "file::" prefix that the CR backend sometimes adds
    const stripped = rawLabel.replace(/^file::/i, '').replace(/^func::/i, '');

    // If the label is __file__ or blank, try to derive from id
    if (!stripped || stripped === '__file__' || stripped === '__module__') {
      // id might be "path/to/file.py" or "file.py::fn"
      const base = nodeId.split('::')[0];
      return base.split(/[/\\]/).pop() ?? base;
    }

    // If it looks like an absolute/relative path (contains / or \) and category is file-level
    if ((stripped.includes('/') || stripped.includes('\\')) &&
      (category === 'changed' || category === 'direct' || category === 'unaffected')) {
      return stripped.split(/[/\\]/).pop() ?? stripped;
    }

    // If it contains :: it's file::function — for file nodes show just filename, for fn nodes show fn
    if (stripped.includes('::')) {
      const [filePart, fnPart] = stripped.split('::');
      if (category === 'changed' || category === 'direct') {
        // show the function name since file is an artifact-level container
        return (fnPart || filePart.split(/[/\\]/).pop()) ?? filePart;
      }
      return fnPart || filePart;
    }

    return stripped;
  };

  const depGraph = (() => {
    // Use real CR graph if available
    if (hasCR && fbScore?.cr_dependency_graph?.nodes?.length) {
      const { nodes, edges } = fbScore.cr_dependency_graph;
      return {
        nodes: nodes.map(n => ({
          id: n.id,
          label: formatNodeLabel(n.label ?? '', n.id, n.category),
          type: (n.category === 'changed' ? 'source' : n.category === 'direct' ? 'impacted' : 'unaffected') as 'source' | 'impacted' | 'unaffected',
          risk_score: n.category === 'changed' ? 0.8 : n.category === 'direct' ? 0.5 : 0.2,
        })),
        edges: edges.map(e => ({ source: e.source, target: e.target, relationship: e.type })),
      };
    }
    // Fallback: file-level graph from GitHub API
    return {
      nodes: files.slice(0, 6).map((f, i) => ({
        id: String(i + 1),
        label: f.filename.split('/').pop() ?? f.filename,
        type: (i === 0 ? 'source' : f.additions > f.deletions ? 'impacted' : 'unaffected') as 'source' | 'impacted' | 'unaffected',
        risk_score: undefined,
      })),
      edges: files.slice(1, 6).map((_, i) => ({ source: '1', target: String(i + 2), relationship: 'modifies' })),
    };
  })();


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
              <div className="flex items-center gap-2">
                {risk && <RiskBadge score={risk.overall_risk_score} showScore size="lg" />}
                <Button onClick={handleAnalyze} disabled={isAnalyzing || !commit} variant={risk ? 'outline' : 'default'} className="gap-2">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" />{risk ? 'Re-running…' : 'Analyzing…'}</> : <><Play className="h-4 w-4" />{risk ? 'Re-run Risk' : 'Risk Analysis'}</>}
                </Button>
                {/* CR button — separate from risk */}
                <Button
                  onClick={handleCRAnalysis}
                  disabled={isCRRunning || !commit}
                  variant={hasCR ? 'outline' : 'default'}
                  className="gap-2"
                >
                  {isCRRunning
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Running CR…</>
                    : <><Waves className="h-4 w-4" />{hasCR ? 'Re-run Impact' : 'Change Impact'}</>
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left — risk + change impact */}
          <div className="space-y-6 lg:col-span-2">

            {/* Risk analysis section (computed by port 5000 model) */}
            {risk ? (
              <>
                <div className="glass-card rounded-xl p-6 animate-slide-up">
                  <h3 className="mb-4 text-lg font-semibold">Risk Analysis <span className="text-xs font-normal text-muted-foreground ml-2">computed by risk model</span></h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <RiskScoreBar score={risk.correctness_risk ?? 0} label="Correctness" />
                      <RiskScoreBar score={risk.security_risk ?? 0} label="Security" />
                      <RiskScoreBar score={risk.maintainability_risk ?? 0} label="Maintainability" />
                      <RiskScoreBar score={risk.integration_risk ?? 0} label="Integration" />
                    </div>
                    <RiskRadarChart data={{
                      correctness: risk.correctness_risk ?? 0,
                      security: risk.security_risk ?? 0,
                      maintainability: risk.maintainability_risk ?? 0,
                      integration: risk.integration_risk ?? 0,
                    }} />
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:100ms]">
                  <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-risk-high" />Risk Insights
                  </h3>
                  <ul className="space-y-3">
                    {(risk.risk_reasons ?? []).map((reason, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-risk-high/20 text-xs font-bold text-risk-high">{i + 1}</span>
                        <span className="text-foreground">{reason}</span>
                      </li>
                    ))}
                  </ul>
                  {risk.mode && <p className="mt-3 text-xs text-muted-foreground">Mode: <span className="font-mono">{risk.mode}</span></p>}
                </div>
              </>
            ) : (
              <div className="glass-card rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Play className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h3 className="text-base font-medium text-foreground mb-1">Risk not yet analyzed</h3>
                <p className="text-sm text-muted-foreground mb-4">Click "Risk Analysis" to get risk scores from the model</p>
                <Button onClick={handleAnalyze} disabled={isAnalyzing || !commit} size="sm">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</> : 'Run Risk Analysis'}
                </Button>
              </div>
            )}

            {/*  Change Impact section (CR backend, port 5001)  */}
            <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Waves className="h-5 w-5 text-primary" />Change Impact Analysis
                  {hasCR && (
                    <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">
                      GraphCodeBERT · {fbScore?.cr_model_used}
                    </span>
                  )}
                </h3>
                {hasCR && (
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-node-source" />Changed</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-node-impacted" />Impacted</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-node-default" />Indirect</span>
                  </div>
                )}
              </div>

              {/* CR quick stats */}
              {hasCR && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Functions', value: fbScore?.cr_functions_changed ?? 0, icon: <FunctionSquare className="h-3.5 w-3.5" /> },
                    { label: 'Lines', value: fbScore?.cr_total_lines_changed ?? 0, icon: <FileCode className="h-3.5 w-3.5" /> },
                    { label: 'Ripple nodes', value: fbScore?.cr_ripple_size ?? 0, icon: <Waves className="h-3.5 w-3.5" /> },
                    { label: 'Depth', value: `d${fbScore?.cr_ripple_depth ?? 0}`, icon: <Zap className="h-3.5 w-3.5" /> },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg bg-secondary/50 p-2 text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{m.icon}<span className="text-[10px]">{m.label}</span></div>
                      <p className="text-sm font-bold text-foreground">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs — only shown when CR data exists */}
              {hasCR && (
                <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-1 border border-border mb-4">
                  {([
                    { id: 'graph', label: 'Dependency Graph', icon: <Network className="h-3.5 w-3.5" /> },
                    { id: 'functions', label: 'Functions', icon: <FunctionSquare className="h-3.5 w-3.5" /> },
                    { id: 'ripple', label: 'Ripple Effect', icon: <Zap className="h-3.5 w-3.5" /> },
                    { id: 'breakdown', label: 'Feature Scores', icon: <BarChart3 className="h-3.5 w-3.5" /> },
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setCiTab(tab.id)}
                      className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                        ciTab === tab.id ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground')}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab: Graph (always shown — falls back to file graph) */}
              {(!hasCR || ciTab === 'graph') && (
                <>
                  <DependencyGraph data={depGraph} className="h-[280px]" />
                  <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-node-source" />Changed</span>
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-node-impacted" />Impacted</span>
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-node-default" />Unaffected</span>
                  </div>
                  {!hasCR && (
                    <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Showing file-level graph. Click <strong>Change Impact</strong> for semantic function-level analysis.</p>
                    </div>
                  )}
                  {/* Impacted files */}
                  {hasCR && (fbScore?.cr_impacted_files ?? []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Impacted Files</p>
                      <div className="flex flex-wrap gap-2">
                        {fbScore!.cr_impacted_files!.map(f => (
                          <span key={f} className="text-[11px] font-mono bg-secondary/60 border border-border px-2 py-1 rounded">{f.split(/[/\\]/).pop()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Tab: Functions */}
              {hasCR && ciTab === 'functions' && (
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {(fbScore?.cr_changed_functions ?? []).length > 0
                    ? (fbScore!.cr_changed_functions!.map((fn: CRChangedFunction, i: number) => {
                      const pct = Math.round(fn.similarity * 100);
                      const col = fn.similarity >= 0.97 ? '#4ade80' : fn.similarity >= 0.92 ? '#facc15' : fn.similarity >= 0.75 ? '#fb923c' : '#f87171';
                      const ctLabel = fn.change_type === 'LOGIC_CHANGE' ? 'Logic Change' : fn.change_type === 'REFACTOR' ? 'Refactor' : 'Format Only';
                      const ctColor = fn.change_type === 'LOGIC_CHANGE' ? 'text-risk-high bg-risk-high/10 border-risk-high/30'
                        : fn.change_type === 'REFACTOR' ? 'text-warning bg-warning/10 border-warning/30'
                          : 'text-muted-foreground bg-secondary/60 border-border';
                      return (
                        <div key={i} className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="font-mono text-xs text-foreground truncate">{fn.function}</span>
                            </div>
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', ctColor)}>{ctLabel}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{fn.file}</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: col }} />
                            </div>
                            <span className="text-[10px] font-mono shrink-0" style={{ color: col }}>{pct}% similar</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="text-emerald-400">+{fn.added_lines}</span>
                            <span className="text-rose-400">−{fn.removed_lines}</span>
                          </div>
                        </div>
                      );
                    }))
                    : <p className="text-sm text-center text-muted-foreground py-8">No function-level data</p>
                  }
                </div>
              )}

              {/* Tab: Ripple Effect */}
              {hasCR && ciTab === 'ripple' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-foreground">Direct Impact</span>
                      <span className="text-[10px] bg-risk-high/20 text-risk-high px-1.5 py-0.5 rounded">{(fbScore?.cr_direct_impact ?? []).length}</span>
                    </div>
                    {(fbScore?.cr_direct_impact ?? []).length > 0
                      ? <div className="space-y-1.5">
                        {fbScore!.cr_direct_impact!.map((fn, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-risk-high/5 border border-risk-high/20 px-3 py-2">
                            <ArrowRight className="h-3 w-3 text-risk-high shrink-0" />
                            <span className="font-mono text-foreground truncate">{fn.split('::')[1] ?? fn}</span>
                            <span className="text-muted-foreground text-[10px] ml-auto truncate">{fn.split('::')[0]}</span>
                          </div>
                        ))}
                      </div>
                      : <p className="text-xs text-muted-foreground italic">No direct dependents — isolated change</p>
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-foreground">Indirect Impact</span>
                      <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded">{(fbScore?.cr_indirect_impact ?? []).length}</span>
                    </div>
                    {(fbScore?.cr_indirect_impact ?? []).length > 0
                      ? <div className="space-y-1.5">
                        {fbScore!.cr_indirect_impact!.map((fn, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-warning/5 border border-warning/20 px-3 py-2">
                            <ChevronRight className="h-3 w-3 text-warning shrink-0" />
                            <span className="font-mono text-foreground truncate">{fn.split('::')[1] ?? fn}</span>
                            <span className="text-muted-foreground text-[10px] ml-auto truncate">{fn.split('::')[0]}</span>
                          </div>
                        ))}
                      </div>
                      : <p className="text-xs text-muted-foreground italic">No indirect propagation detected</p>
                    }
                  </div>
                  {(fbScore?.cr_contributing_factors ?? []).length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-primary" />Contributing Factors</p>
                      <div className="space-y-1.5">
                        {fbScore!.cr_contributing_factors!.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs rounded bg-secondary/40 px-3 py-2">
                            <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Feature Breakdown */}
              {hasCR && ciTab === 'breakdown' && (
                <div className="space-y-3">
                  {fbScore?.cr_feature_breakdown && Object.keys(fbScore.cr_feature_breakdown).length > 0
                    ? Object.entries(fbScore.cr_feature_breakdown).sort(([, a], [, b]) => b - a).map(([k, v]) => {
                      const pct = Math.round(v * 100);
                      const col = v >= 0.7 ? 'bg-risk-high' : v >= 0.4 ? 'bg-warning' : 'bg-primary';
                      return (
                        <div key={k} className="flex items-center gap-3 text-xs">
                          <span className="w-28 shrink-0 text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-secondary/80 overflow-hidden">
                            <div className={cn('h-full rounded-full', col)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right font-mono text-foreground">{pct}%</span>
                        </div>
                      );
                    })
                    : <p className="text-sm text-center text-muted-foreground py-8">No feature data</p>
                  }
                </div>
              )}

              {/* No CR data yet */}
              {!hasCR && !isCRRunning && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Graph above shows file-level impact only. Click <strong>Change Impact</strong> for deep semantic analysis.
                  </p>
                </div>
              )}
              {isCRRunning && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />Cloning repo and running semantic analysis…
                </div>
              )}
            </div>
          </div>

          {/* Right — files & stats */}
          <div className="space-y-6">
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

            {files.length > 0 && (
              <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:250ms]">
                <h3 className="mb-4 font-semibold">Files Changed</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {files.map(file => (
                    <div key={file.filename} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-mono text-foreground">{file.filename.split('/').pop()}</span>
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
                  ))}
                </div>
              </div>
            )}

            {files[0]?.patch && (
              <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:350ms]">
                <h3 className="mb-4 font-semibold">Patch Preview</h3>
                <pre className="max-h-64 overflow-auto rounded-lg bg-background/80 p-4 text-xs font-mono scrollbar-thin">
                  {files[0].patch.split('\n').map((line, i) => (
                    <div key={i} className={cn(
                      'py-0.5 px-2 -mx-2',
                      line.startsWith('+') && !line.startsWith('+++') && 'diff-add',
                      line.startsWith('-') && !line.startsWith('---') && 'diff-remove',
                      line.startsWith('@@') && 'text-muted-foreground',
                    )}>{line}</div>
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
