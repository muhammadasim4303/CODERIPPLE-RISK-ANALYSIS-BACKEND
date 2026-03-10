import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/utils/constants';
import { getRiskLevel, getRiskBadgeClass, riskLabelToLevel } from '@/utils/riskUtils';


interface RiskBadgeProps {
  score?: number;
  level?: RiskLevel;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function RiskBadge({ score, level, showScore = false, size = 'md', className }: RiskBadgeProps) {
  const riskLevel = level
    ? (level.includes(' ') ? riskLabelToLevel(level) : level as RiskLevel)
    : (score !== undefined ? getRiskLevel(score) : 'LOW');
  const badgeClass = getRiskBadgeClass(riskLevel);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-all',
        badgeClass,
        sizeClasses[size],
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            riskLevel === 'CRITICAL' && 'bg-risk-critical',
            riskLevel === 'HIGH' && 'bg-risk-high',
            riskLevel === 'MEDIUM' && 'bg-risk-medium',
            riskLevel === 'LOW' && 'bg-risk-low'
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            riskLevel === 'CRITICAL' && 'bg-risk-critical',
            riskLevel === 'HIGH' && 'bg-risk-high',
            riskLevel === 'MEDIUM' && 'bg-risk-medium',
            riskLevel === 'LOW' && 'bg-risk-low'
          )}
        />
      </span>
      <span>{riskLevel}</span>
      {showScore && score !== undefined && (
        <span className="opacity-75">({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
}

interface RiskScoreBarProps {
  score: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function RiskScoreBar({ score, label, showPercentage = true, className }: RiskScoreBarProps) {
  const riskLevel = getRiskLevel(score);
  const percentage = score * 100;

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className={cn(
              'font-mono font-medium',
              riskLevel === 'CRITICAL' && 'text-risk-critical',
              riskLevel === 'HIGH' && 'text-risk-high',
              riskLevel === 'MEDIUM' && 'text-risk-medium',
              riskLevel === 'LOW' && 'text-risk-low'
            )}>
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            riskLevel === 'CRITICAL' && 'bg-risk-critical',
            riskLevel === 'HIGH' && 'bg-risk-high',
            riskLevel === 'MEDIUM' && 'bg-risk-medium',
            riskLevel === 'LOW' && 'bg-risk-low'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
