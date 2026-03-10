/**
 * flaskService.ts
 * Calls the local Flask backend (port 5000) for AI risk analysis.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

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
}

/** Map the Flask API response shape → RiskResult */
function mapApiResponse(raw: any, sha: string): RiskResult {
  const cats = raw.risk_categories ?? {};
  return {
    sha:                    raw.sha ?? sha,
    risk_label:             raw.risk_label ?? 'LOW RISK',
    overall_risk_score:     raw.risk_score ?? raw.overall_risk_score ?? 0,
    correctness_risk:       cats.correctness   ?? raw.correctness_risk   ?? 0,
    security_risk:          cats.security      ?? raw.security_risk      ?? 0,
    maintainability_risk:   cats.maintainability ?? raw.maintainability_risk ?? 0,
    integration_risk:       cats.integration   ?? raw.integration_risk   ?? 0,
    risk_reasons:           raw.risk_reasons   ?? [],
    correctness_reasons:    cats.correctness_reasons   ?? [],
    security_reasons:       cats.security_reasons      ?? [],
    maintainability_reasons: cats.maintainability_reasons ?? [],
    integration_reasons:    cats.integration_reasons   ?? [],
    mode:                   raw.mode ?? raw._debug?.mode ?? 'model',
    added_lines:            raw.added_lines   ?? 0,
    removed_lines:          raw.removed_lines ?? 0,
    files_touched:          raw.files_touched ?? raw.file_rows ?? 0,
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
    const ext = '.' + f.filename.split('.').pop()!.toLowerCase();
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
    
    // Invalidate stale cache: if all scores are 0 but label isn't LOW RISK, ignore cache
    const allZero = mapped.overall_risk_score === 0 &&
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

export async function analyzeCommit(
  sha: string,
  description: string,
  files: Array<{ filename: string; patch?: string; status?: string; additions?: number; deletions?: number }>
): Promise<RiskResult> {
  // Check cache first
  const cached = await getCachedRisk(sha);
  if (cached) return cached;

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
      added_lines: files.reduce((a, f) => a + (f.additions ?? 0), 0),
      removed_lines: files.reduce((a, f) => a + (f.deletions ?? 0), 0),
      files_touched: files.length,
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