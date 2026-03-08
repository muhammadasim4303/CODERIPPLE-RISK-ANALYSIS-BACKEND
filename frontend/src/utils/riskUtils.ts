import { RISK_THRESHOLDS, type RiskLevel } from './constants';

export function getRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= RISK_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= RISK_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'risk-low',
    MEDIUM: 'risk-medium',
    HIGH: 'risk-high',
    CRITICAL: 'risk-critical',
  };
  return colors[level];
}

export function getRiskBadgeClass(level: RiskLevel): string {
  const classes: Record<RiskLevel, string> = {
    LOW: 'risk-badge-low',
    MEDIUM: 'risk-badge-medium',
    HIGH: 'risk-badge-high',
    CRITICAL: 'risk-badge-critical',
  };
  return classes[level];
}

export function formatRiskScore(score: number): string {
  return (score * 100).toFixed(0) + '%';
}

export function calculateOverallRisk(scores: {
  correctness: number;
  security: number;
  maintainability: number;
  integration: number;
}): number {
  // Weighted average with security having highest weight
  const weights = {
    correctness: 0.25,
    security: 0.35,
    maintainability: 0.15,
    integration: 0.25,
  };

  return (
    scores.correctness * weights.correctness +
    scores.security * weights.security +
    scores.maintainability * weights.maintainability +
    scores.integration * weights.integration
  );
}

export function getRiskDescription(level: RiskLevel): string {
  const descriptions: Record<RiskLevel, string> = {
    LOW: 'This change appears safe with minimal risk factors.',
    MEDIUM: 'Some risk factors detected. Review recommended.',
    HIGH: 'Significant risk detected. Careful review required.',
    CRITICAL: 'Critical risk level. Immediate attention needed.',
  };
  return descriptions[level];
}
