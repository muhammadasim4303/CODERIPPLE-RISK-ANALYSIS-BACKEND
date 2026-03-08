import { useState } from 'react';
import { Shield, Loader2, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CommitRiskResult } from '@/api/riskApi';

// ── Risk colour helpers ────────────────────────────────────────────────────

function riskColor(label?: string) {
  switch (label) {
    case 'HIGH RISK':   return 'text-red-400';
    case 'MEDIUM RISK': return 'text-yellow-400';
    case 'LOW RISK':    return 'text-emerald-400';
    default:            return 'text-muted-foreground';
  }
}

function riskBg(label?: string) {
  switch (label) {
    case 'HIGH RISK':   return 'bg-red-500/10 border-red-500/30 text-red-400';
    case 'MEDIUM RISK': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    case 'LOW RISK':    return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    default:            return 'bg-muted/30 border-border text-muted-foreground';
  }
}

function riskBarColor(label?: string) {
  switch (label) {
    case 'HIGH RISK':   return 'bg-red-500';
    case 'MEDIUM RISK': return 'bg-yellow-400';
    case 'LOW RISK':    return 'bg-emerald-500';
    default:            return 'bg-primary';
  }
}

function RiskIcon({ label }: { label?: string }) {
  if (label === 'HIGH RISK')   return <AlertTriangle className="h-3.5 w-3.5" />;
  if (label === 'MEDIUM RISK') return <Info           className="h-3.5 w-3.5" />;
  if (label === 'LOW RISK')    return <CheckCircle    className="h-3.5 w-3.5" />;
  return <Shield className="h-3.5 w-3.5" />;
}

// ── Sub-score bar ──────────────────────────────────────────────────────────

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 65 ? 'bg-red-500' :
    pct >= 35 ? 'bg-yellow-400' :
                'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={cn('font-mono', pct >= 65 ? 'text-red-400' : pct >= 35 ? 'text-yellow-400' : 'text-emerald-400')}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface CommitRiskCardProps {
  sha:          string;
  owner:        string;
  repo:         string;
  commitData: {
    message: string;
  };
  analysisStatus: 'idle' | 'loading' | 'done' | 'error';
  analysisResult?: CommitRiskResult;
  analysisError?:  string;
  onComputeRisk:   () => void;
  onReset?:        () => void;
  compact?:        boolean;   // when true, just shows badge + button inline
}

// ── Component ──────────────────────────────────────────────────────────────

export function CommitRiskCard({
  sha,
  analysisStatus,
  analysisResult,
  analysisError,
  onComputeRisk,
  onReset,
  compact = false,
}: CommitRiskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const result = analysisResult;
  const label  = result?.risk_label;

  // ── Compact inline badge + button ────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {analysisStatus === 'done' && result && (
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
            riskBg(label)
          )}>
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', riskBarColor(label))} />
              <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', riskBarColor(label))} />
            </span>
            {label}
          </span>
        )}

        {analysisStatus === 'error' && (
          <span className="text-xs text-red-400">Error</span>
        )}

        {analysisStatus === 'loading' && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}

        {analysisStatus === 'idle' && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onComputeRisk(); }}
            className="h-7 gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10"
          >
            <Shield className="h-3 w-3" />
            Compute Risk
          </Button>
        )}

        {(analysisStatus === 'done' || analysisStatus === 'error') && onReset && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReset(); }}
            title="Re-analyze"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // ── Full card (used in CommitDetails) ─────────────────────────────────────
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-lg p-2', result ? riskBg(label) : 'bg-primary/10')}>
            <Shield className={cn('h-5 w-5', result ? riskColor(label) : 'text-primary')} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Risk Analysis</h3>
            {result && (
              <p className="text-xs text-muted-foreground">
                Confidence {Math.round((result.confidence ?? 0) * 100)}% •{' '}
                {result.mode === 'heuristic' ? 'heuristic mode' : 'model prediction'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {analysisStatus === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyzing…
            </div>
          )}

          {analysisStatus === 'idle' && (
            <Button
              onClick={onComputeRisk}
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Shield className="h-4 w-4" />
              Compute Risk for this Commit
            </Button>
          )}

          {analysisStatus === 'error' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400">{analysisError}</span>
              <Button variant="outline" size="sm" onClick={onComputeRisk} className="gap-1 border-border">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}

          {analysisStatus === 'done' && result && (
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold',
                riskBg(label)
              )}>
                <RiskIcon label={label} />
                {label}
                <span className="opacity-70">({Math.round((result.risk_score ?? 0) * 100)}%)</span>
              </span>
              {onReset && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onReset}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded result detail */}
      {analysisStatus === 'done' && result && (
        <>
          {/* Risk score bar */}
          <div className="border-t border-border px-4 py-3">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Overall Risk Score</span>
              <span className={cn('font-mono font-semibold', riskColor(label))}>
                {Math.round((result.risk_score ?? 0) * 100)}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000 ease-out', riskBarColor(label))}
                style={{ width: `${Math.round((result.risk_score ?? 0) * 100)}%` }}
              />
            </div>
          </div>

          {/* Sub-scores */}
          {result.risk_categories && (
            <div className="border-t border-border px-4 py-3 grid grid-cols-2 gap-3">
              <SubScoreBar label="Correctness"     value={result.risk_categories.correctness}     />
              <SubScoreBar label="Security"        value={result.risk_categories.security}        />
              <SubScoreBar label="Maintainability" value={result.risk_categories.maintainability} />
              <SubScoreBar label="Integration"     value={result.risk_categories.integration}     />
            </div>
          )}

          {/* Risk reasons — collapsible */}
          {result.risk_reasons?.length > 0 && (
            <div className="border-t border-border">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors"
                onClick={() => setExpanded(!expanded)}
              >
                <span>Risk Insights ({result.risk_reasons.length})</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {expanded && (
                <ul className="space-y-2 px-4 pb-4">
                  {result.risk_reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-lg bg-secondary/40 p-2.5 text-sm">
                      <span className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        label === 'HIGH RISK'   ? 'bg-red-500/20 text-red-400'     :
                        label === 'MEDIUM RISK' ? 'bg-yellow-500/20 text-yellow-400' :
                                                  'bg-emerald-500/20 text-emerald-400'
                      )}>
                        {i + 1}
                      </span>
                      <span className="text-foreground/90">{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="border-t border-border px-4 py-2 text-right">
            <span className="text-xs text-muted-foreground">
              Analyzed {new Date(result.analyzed_at).toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
