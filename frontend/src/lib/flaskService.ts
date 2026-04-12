/**
 * flaskService.ts
 * Calls the local Flask backend (port 5000) for AI risk analysis.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

export interface FileRiskResult {
  file: string;
  patch?: string;
  risk_score: number;
  risk_label: string;
  correctness_risk: number;
  security_risk: number;
  maintainability_risk: number;
  integration_risk: number;
  correctness_reasons: string[];
  security_reasons: string[];
  maintainability_reasons: string[];
  integration_reasons: string[];
  risk_reasons: string[];
  added_lines: number;
  removed_lines: number;
  is_generated: boolean;
}

export interface RiskResult {
  sha: string;
  risk_label: string;
  overall_risk_score: number;
  correctness_risk: number;
  security_risk: number;
  maintainability_risk: number;
  integration_risk: number;
  risk_reasons: string[];
  correctness_reasons?: string[];
  security_reasons?: string[];
  maintainability_reasons?: string[];
  integration_reasons?: string[];
  mode: string;
  added_lines: number;
  removed_lines: number;
  files_touched: number;
  per_file: FileRiskResult[];
}

/** Map the Flask API response shape → RiskResult */
function mapApiResponse(raw: any, sha: string): RiskResult {
  const cats = raw.risk_categories ?? {};

  // Map per_file array
  const per_file: FileRiskResult[] = (raw.per_file ?? []).map((f: any) => ({
    file:                    f.file ?? f.filename ?? '',
    patch:                   f.patch ?? '',
    risk_score:              f.risk_score ?? 0,
    risk_label:              f.risk_label ?? 'LOW RISK',
    correctness_risk:        f.correctness_risk ?? 0,
    security_risk:           f.security_risk ?? 0,
    maintainability_risk:    f.maintainability_risk ?? 0,
    integration_risk:        f.integration_risk ?? 0,
    correctness_reasons:     f.correctness_reasons ?? [],
    security_reasons:        f.security_reasons ?? [],
    maintainability_reasons: f.maintainability_reasons ?? [],
    integration_reasons:     f.integration_reasons ?? [],
    risk_reasons:            f.risk_reasons ?? [],
    added_lines:             f.added_lines ?? 0,
    removed_lines:           f.removed_lines ?? 0,
    is_generated:            f.is_generated ?? false,
  }));

  return {
    sha:                    raw.sha ?? sha,
    risk_label:             raw.risk_label ?? 'LOW RISK',
    overall_risk_score:     raw.risk_score ?? raw.overall_risk_score ?? 0,
    correctness_risk:       cats.correctness        ?? raw.correctness_risk        ?? 0,
    security_risk:          cats.security           ?? raw.security_risk           ?? 0,
    maintainability_risk:   cats.maintainability    ?? raw.maintainability_risk    ?? 0,
    integration_risk:       cats.integration        ?? raw.integration_risk        ?? 0,
    risk_reasons:           raw.risk_reasons        ?? [],
    correctness_reasons:    cats.correctness_reasons    ?? [],
    security_reasons:       cats.security_reasons       ?? [],
    maintainability_reasons: cats.maintainability_reasons ?? [],
    integration_reasons:    cats.integration_reasons    ?? [],
    mode:                   raw.mode ?? raw._debug?.mode ?? 'model',
    added_lines:            raw.added_lines   ?? 0,
    removed_lines:          raw.removed_lines ?? 0,
    files_touched:          raw.files_touched ?? raw.file_rows ?? (per_file.length || 0),
    per_file,
  };
}

const NON_CODE_EXTENSIONS = new Set([
  '.md', '.txt', '.rst', '.csv', '.json', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.env', '.lock', '.log', '.xml',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz',
]);

function isNonCodeCommit(files: Array<{ filename: string }>): boolean {
  if (!files.length) return false;
  return files.every(f => {
    const ext = '.' + (f.filename.split('.').pop() ?? '').toLowerCase();
    return NON_CODE_EXTENSIONS.has(ext);
  });
}

export async function getCachedRisk(sha: string): Promise<RiskResult | null> {
  try {
    const res = await fetch(`${BASE}/commit/${sha}/risk`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.risk_label) return null;
    const mapped = mapApiResponse(data, sha);

    // Invalidate stale cache: all zeros but not LOW RISK
    const allZero =
      mapped.overall_risk_score === 0 &&
      mapped.correctness_risk === 0 &&
      mapped.security_risk === 0 &&
      mapped.maintainability_risk === 0 &&
      mapped.integration_risk === 0;
    if (allZero && mapped.risk_label !== 'LOW RISK') return null;

    return mapped;
  } catch {
    return null;
  }
}

export async function deleteCachedRisk(sha: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/commit/${sha}/risk`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeCommit(
  sha: string,
  description: string,
  files: Array<{ filename: string; patch?: string; status?: string; additions?: number; deletions?: number }>,
  force: boolean = false
): Promise<RiskResult> {
  // Check cache first
  if (!force) {
    const cached = await getCachedRisk(sha);
    if (cached) return cached;
  }

  // Short-circuit: all non-code files = automatic LOW RISK
  if (isNonCodeCommit(files)) {
    return {
      sha,
      risk_label: 'LOW RISK',
      overall_risk_score: 0.05,
      correctness_risk: 0,
      security_risk: 0,
      maintainability_risk: 0.05,
      integration_risk: 0,
      risk_reasons: ['All changed files are non-code (docs, assets, config)'],
      mode: 'rule',
      added_lines: files.reduce((a, f) => a + ((f as any).additions ?? 0), 0),
      removed_lines: files.reduce((a, f) => a + ((f as any).deletions ?? 0), 0),
      files_touched: files.length,
      per_file: files.map(f => ({
        file: f.filename,
        patch: f.patch ?? '',
        risk_score: 0.05,
        risk_label: 'LOW RISK',
        correctness_risk: 0,
        security_risk: 0,
        maintainability_risk: 0.05,
        integration_risk: 0,
        correctness_reasons: [],
        security_reasons: [],
        maintainability_reasons: [],
        integration_reasons: [],
        risk_reasons: ['Non-code file'],
        added_lines: (f as any).additions ?? 0,
        removed_lines: (f as any).deletions ?? 0,
        is_generated: false,
      })),
    };
  }

  const res = await fetch(`${BASE}/analyze/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha, description, files }),
  });
  if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
  const raw = await res.json();
  const result = mapApiResponse(raw, sha);

  // Cache it back
  try {
    await fetch(`${BASE}/commit/${sha}/risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
  } catch { /* ignore cache errors */ }

  return result;
}