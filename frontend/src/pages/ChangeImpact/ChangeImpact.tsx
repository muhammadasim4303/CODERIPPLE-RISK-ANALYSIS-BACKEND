import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { listAllRiskScores, analyzeAndStoreCR, type FBRiskScore } from '@/lib/firebaseService';
import { DependencyGraph } from '@/components/graphs/DependencyGraph';
import { RiskBadge } from '@/components/common/RiskBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/common/Loader';
import {
  GitCommit, FileCode, Search, Network, Layers, AlertTriangle,
  ChevronRight, Zap, GitBranch, ArrowRight, Brain,
  Waves, FunctionSquare, Shield, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateSha, formatRelativeTime } from '@/utils/formatters';
import { useAuth } from '@/context/AuthContext';
import type { CRChangedFunction } from '@/types/coderippleTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────
function changeTypeColor(ct: string) {
  if (ct === 'LOGIC_CHANGE') return 'text-risk-high bg-risk-high/10 border-risk-high/30';
  if (ct === 'REFACTOR') return 'text-warning bg-warning/10 border-warning/30';
  return 'text-muted-foreground bg-secondary/60 border-border';
}
function changeTypeLabel(ct: string) {
  if (ct === 'LOGIC_CHANGE') return 'Logic Change';
  if (ct === 'REFACTOR') return 'Refactor';
  return 'Format Only';
}

function buildGraphData(score: FBRiskScore) {
  if (score.cr_dependency_graph?.nodes?.length) {
    const { nodes, edges } = score.cr_dependency_graph;
    return {
      nodes: nodes.map(n => ({
        id: n.id,
        label: n.label,
        type: (n.category === 'changed' ? 'source' : n.category === 'direct' ? 'impacted' : 'unaffected') as 'source' | 'impacted' | 'unaffected',
        risk_score: n.category === 'changed' ? (score.cr_risk_score ?? score.overall_risk_score)
          : n.category === 'direct' ? (score.cr_risk_score ?? score.overall_risk_score) * 0.7
            : (score.cr_risk_score ?? score.overall_risk_score) * 0.35,
      })),
      edges: edges.map(e => ({ source: e.source, target: e.target, relationship: e.type })),
    };
  }
  if ((score.cr_direct_impact?.length ?? 0) > 0) {
    const nodes: Array<{ id: string; label: string; type: 'source' | 'impacted' | 'unaffected'; risk_score?: number }> = [];
    const edges: Array<{ source: string; target: string; relationship: string }> = [];
    const root = score.cr_changed_function ?? 'changed';
    nodes.push({ id: 'root', label: root.split('::')[1] ?? root, type: 'source', risk_score: score.cr_risk_score ?? score.overall_risk_score });
    (score.cr_direct_impact ?? []).slice(0, 6).forEach((id, i) => {
      nodes.push({ id: `d${i}`, label: id.split('::')[1] ?? id, type: 'impacted', risk_score: (score.cr_risk_score ?? 0.5) * 0.7 });
      edges.push({ source: 'root', target: `d${i}`, relationship: 'calls' });
    });
    (score.cr_indirect_impact ?? []).slice(0, 4).forEach((id, i) => {
      const parent = `d${i % Math.max(score.cr_direct_impact?.length ?? 1, 1)}`;
      nodes.push({ id: `i${i}`, label: id.split('::')[1] ?? id, type: 'unaffected', risk_score: (score.cr_risk_score ?? 0.3) * 0.4 });
      edges.push({ source: parent, target: `i${i}`, relationship: 'indirect' });
    });
    return { nodes, edges };
  }
  // fallback to old derived graph
  return {
    nodes: [
      { id: '1', label: score.repoFullName.split('/')[1] ?? 'repo', type: 'source' as const, risk_score: score.overall_risk_score },
      ...(score.risk_reasons ?? []).slice(0, 4).map((_, i) => ({
        id: String(i + 2), label: `Component ${i + 1}`,
        type: (i < 2 ? 'impacted' : 'unaffected') as 'impacted' | 'unaffected',
        risk_score: score.overall_risk_score * (1 - i * 0.15),
      })),
    ],
    edges: (score.risk_reasons ?? []).slice(0, 4).map((_, i) => ({ source: '1', target: String(i + 2), relationship: 'impacts' })),
  };
}



function FunctionRow({ fn }: { fn: CRChangedFunction }) {
  const pct = Math.round(fn.similarity * 100);
  const color = fn.similarity >= 0.97 ? '#4ade80' : fn.similarity >= 0.92 ? '#facc15' : fn.similarity >= 0.75 ? '#fb923c' : '#f87171';
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-mono text-xs text-foreground truncate">{fn.function}</span>
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', changeTypeColor(fn.change_type))}>
          {changeTypeLabel(fn.change_type)}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground truncate">{fn.file}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color }}>{pct}% similar</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="text-emerald-400">+{fn.added_lines}</span>
        <span className="text-rose-400">−{fn.removed_lines}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChangeImpact() {
  const { user } = useAuth();
  const [scores, setScores] = useState<FBRiskScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<FBRiskScore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'graph' | 'functions' | 'ripple'>('graph');
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const loadScores = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const s = await listAllRiskScores(user.id, 100);
      setScores(s);
      if (s.length) setSelected(s[0]);
    } catch { setScores([]); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadScores(); }, [user]);

  const repos = useMemo(() => ['all', ...Array.from(new Set(scores.map(s => s.repoFullName)))], [scores]);

  const filtered = useMemo(() => scores.filter(s => {
    const q = searchQuery.toLowerCase();
    return (s.message.toLowerCase().includes(q) || s.sha.toLowerCase().includes(q)) &&
      (repoFilter === 'all' || s.repoFullName === repoFilter);
  }), [scores, searchQuery, repoFilter]);

  const depGraph = useMemo(() => selected ? buildGraphData(selected) : { nodes: [], edges: [] }, [selected]);

  const stats = useMemo(() => ({
    highImpact: scores.filter(s => s.cr_risk_prediction === 'HIGH' || s.risk_label === 'HIGH RISK').length,
    withRipple: scores.filter(s => (s.cr_ripple_size ?? 0) > 0).length,
    logicChange: scores.filter(s => s.cr_change_type === 'LOGIC_CHANGE').length,
    crAnalyzed: scores.filter(s => s.cr_analyzed).length,
  }), [scores]);

  // Run CodeRipple analysis on selected commit
  const runCRAnalysis = async () => {
    if (!user || !selected) return;
    setAnalyzing(selected.sha);
    try {
      // Pass repoFullName ("owner/repo") — CR backend clones it automatically
      const cr = await analyzeAndStoreCR(user.id, selected.sha, selected.repoFullName);
      if (cr) await loadScores();
    } finally { setAnalyzing(null); }
  };

  if (isLoading) return <MainLayout title="Change Impact"><PageLoader /></MainLayout>;

  return (
    <MainLayout title="Change Impact">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Waves className="h-6 w-6 text-primary" />Change Impact Analysis
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Powered by GraphCodeBERT · Semantic ripple analysis across your codebase
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search commits or SHA…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 bg-secondary/50 pl-10 border-border" />
            </div>
            <Select value={repoFilter} onValueChange={setRepoFilter}>
              <SelectTrigger className="w-44 border-border bg-secondary/50">
                <SelectValue placeholder="Filter by repo" />
              </SelectTrigger>
              <SelectContent>
                {repos.map(r => <SelectItem key={r} value={r}>{r === 'all' ? 'All Repos' : r.split('/')[1] ?? r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: <GitCommit className="h-5 w-5 text-primary" />, bg: 'bg-primary/10', value: scores.length, label: 'Analyzed Commits' },
            { icon: <AlertTriangle className="h-5 w-5 text-risk-high" />, bg: 'bg-risk-high/10', value: stats.highImpact, label: 'High Risk' },
            { icon: <Zap className="h-5 w-5 text-warning" />, bg: 'bg-warning/10', value: stats.withRipple, label: 'With Ripple Effect' },
            { icon: <Brain className="h-5 w-5 text-info" />, bg: 'bg-info/10', value: stats.crAnalyzed, label: 'CR Analyzed' },
          ].map((s, i) => (
            <div key={i} className="glass-card rounded-xl p-5 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
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
              <p className="text-sm text-muted-foreground">Analyze commits in your repositories to see impact data.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Commit list */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Analyzed Changes</h2>
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {filtered.map(score => (
                  <button key={score.sha} onClick={() => { setSelected(score); setActiveTab('graph'); }}
                    className={cn('w-full glass-card rounded-xl p-4 text-left transition-all hover:border-primary/30',
                      selected?.sha === score.sha && 'ring-2 ring-primary border-primary/50')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={score.author_avatar} />
                          <AvatarFallback>{score.author_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">{score.message.split('\n')[0]}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <GitCommit className="h-3 w-3" />
                            <span className="font-mono">{truncateSha(score.sha)}</span>
                            <span>·</span>
                            <span>{formatRelativeTime(score.committed_at)}</span>
                          </div>
                        </div>
                      </div>
                      <RiskBadge score={score.cr_risk_score ?? score.overall_risk_score} size="sm" />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {score.cr_analyzed && score.cr_change_type && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold', changeTypeColor(score.cr_change_type))}>
                          {changeTypeLabel(score.cr_change_type)}
                        </span>
                      )}
                      {score.cr_analyzed && (score.cr_ripple_size ?? 0) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 border border-warning/30 text-warning font-medium flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" />{score.cr_ripple_size} nodes
                        </span>
                      )}
                      {score.cr_analyzed
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium flex items-center gap-1"><Brain className="h-2.5 w-2.5" />CR</span>
                        : <span className="text-[10px] text-muted-foreground">{score.files_changed} files · +{score.additions}</span>
                      }
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="lg:col-span-2 space-y-5">

                {/* Commit header */}
                <div className="glass-card rounded-xl p-5 animate-slide-up">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{selected.message.split('\n')[0]}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono bg-secondary px-2 py-0.5 rounded">{truncateSha(selected.sha)}</span>
                        <GitBranch className="h-3 w-3" /><span>{selected.branch}</span>
                        <span>·</span><span>{selected.repoFullName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <RiskBadge score={selected.cr_risk_score ?? selected.overall_risk_score} size="md" />
                      {selected.cr_risk_confidence !== undefined && (
                        <span className="text-[10px] text-muted-foreground">{Math.round(selected.cr_risk_confidence * 100)}% confidence</span>
                      )}
                    </div>
                  </div>

                  {/* Quick metrics */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {[
                      { label: 'Functions', value: selected.cr_functions_changed ?? selected.files_changed, icon: <FunctionSquare className="h-3.5 w-3.5" /> },
                      { label: 'Lines', value: selected.cr_total_lines_changed ?? (selected.additions + selected.deletions), icon: <FileCode className="h-3.5 w-3.5" /> },
                      { label: 'Ripple', value: `${selected.cr_ripple_size ?? 0} nodes`, icon: <Waves className="h-3.5 w-3.5" /> },
                      { label: 'Depth', value: `d${selected.cr_ripple_depth ?? 0}`, icon: <Layers className="h-3.5 w-3.5" /> },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg bg-secondary/50 p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{m.icon}<span className="text-[10px]">{m.label}</span></div>
                        <p className="text-sm font-bold text-foreground">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Run CR analysis button if not yet analyzed */}
                  {!selected.cr_analyzed && (
                    <button onClick={runCRAnalysis} disabled={!!analyzing}
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary font-medium hover:bg-primary/20 transition-all disabled:opacity-50">
                      <RefreshCw className={cn('h-4 w-4', analyzing === selected.sha && 'animate-spin')} />
                      {analyzing === selected.sha ? 'Running CodeRipple analysis…' : 'Run CodeRipple Analysis'}
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-1 border border-border">
                  {([
                    { id: 'graph', label: 'Dependency Graph', icon: <Network className="h-3.5 w-3.5" /> },
                    { id: 'functions', label: 'Functions', icon: <FunctionSquare className="h-3.5 w-3.5" /> },
                    { id: 'ripple', label: 'Ripple Effect', icon: <Zap className="h-3.5 w-3.5" /> },
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all',
                        activeTab === tab.id ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground')}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab: Dependency Graph */}
                {activeTab === 'graph' && (
                  <div className="glass-card rounded-xl p-5 animate-slide-up">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />Dependency Flow
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-node-source" />Changed</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-node-impacted" />Impacted</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-node-default" />Indirect</span>
                      </div>
                    </div>
                    {depGraph.nodes.length > 0
                      ? <DependencyGraph data={depGraph} className="h-[320px]" />
                      : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        <div className="text-center"><Network className="h-8 w-8 mx-auto mb-2 opacity-30" />No dependency data available</div>
                      </div>
                    }
                    {(selected.cr_impacted_files ?? []).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Impacted Files</p>
                        <div className="flex flex-wrap gap-2">
                          {selected.cr_impacted_files!.map(f => (
                            <span key={f} className="text-[11px] font-mono bg-secondary/60 border border-border px-2 py-1 rounded">{f.split(/[/\\]/).pop()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Functions */}
                {activeTab === 'functions' && (
                  <div className="glass-card rounded-xl p-5 animate-slide-up space-y-3">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                      <FunctionSquare className="h-4 w-4 text-primary" />Changed Functions
                      {selected.cr_changed_functions?.length ? (
                        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selected.cr_changed_functions.length} functions</span>
                      ) : null}
                    </h3>
                    {selected.cr_changed_functions?.length
                      ? <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {selected.cr_changed_functions.map((fn, i) => <FunctionRow key={i} fn={fn} />)}
                      </div>
                      : <div className="text-center py-10 text-muted-foreground text-sm">
                        <FunctionSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No function-level data — run CodeRipple analysis on this commit
                      </div>
                    }
                    {selected.cr_semantic_change_score !== undefined && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-muted-foreground">Overall Semantic Change</span>
                          <span className="font-mono text-foreground">{(selected.cr_semantic_change_score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-risk-high" style={{ width: `${selected.cr_semantic_change_score * 100}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Format only</span><span>Logic change</span></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Ripple Effect */}
                {activeTab === 'ripple' && (
                  <div className="glass-card rounded-xl p-5 animate-slide-up space-y-4">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4 text-warning" />Ripple Effect
                    </h3>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-foreground">Direct Impact</span>
                        <span className="text-[10px] bg-risk-high/20 text-risk-high px-1.5 py-0.5 rounded">{(selected.cr_direct_impact ?? []).length} functions</span>
                      </div>
                      {(selected.cr_direct_impact ?? []).length > 0
                        ? <div className="space-y-1.5">
                          {selected.cr_direct_impact!.map((fn, i) => (
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
                        <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded">{(selected.cr_indirect_impact ?? []).length} nodes</span>
                      </div>
                      {(selected.cr_indirect_impact ?? []).length > 0
                        ? <div className="space-y-1.5">
                          {selected.cr_indirect_impact!.map((fn, i) => (
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
                    {(selected.cr_contributing_factors ?? selected.risk_reasons ?? []).length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-primary" />Contributing Factors</p>
                        <div className="space-y-1.5">
                          {(selected.cr_contributing_factors ?? selected.risk_reasons ?? []).map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-foreground rounded bg-secondary/40 px-3 py-2">
                              <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
