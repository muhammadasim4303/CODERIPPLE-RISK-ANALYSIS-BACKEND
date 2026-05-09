// Risk Level Constants
export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type RiskLevel = keyof typeof RISK_LEVELS;

// Risk Thresholds
export const RISK_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
};

// API Base URL (placeholder for backend integration)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Risk Categories
export const RISK_CATEGORIES = [
  { key: 'correctness', label: 'Correctness', description: 'Code logic and functional correctness' },
  { key: 'security', label: 'Security', description: 'Security vulnerabilities and exposures' },
  { key: 'maintainability', label: 'Maintainability', description: 'Code readability and maintenance burden' },
  { key: 'integration', label: 'Integration', description: 'Impact on connected components' },
] as const;

// Navigation Items
export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/repos', label: 'Repositories', icon: 'GitBranch' },
  { path: '/risk-overview', label: 'Risk Overview', icon: 'Shield' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
] as const;

// Chart Colors
export const CHART_COLORS = {
  primary: 'hsl(195, 100%, 50%)',
  success: 'hsl(145, 70%, 42%)',
  warning: 'hsl(40, 95%, 55%)',
  danger: 'hsl(0, 75%, 55%)',
  muted: 'hsl(220, 25%, 35%)',
};

// Date Formats
export const DATE_FORMATS = {
  FULL: 'MMMM d, yyyy h:mm a',
  SHORT: 'MMM d, yyyy',
  TIME: 'h:mm a',
  RELATIVE: 'relative',
};
