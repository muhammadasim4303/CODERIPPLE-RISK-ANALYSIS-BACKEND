/**
 * ADD THIS to firebaseService.ts
 *
 * This function saves a CodeRipple analysis result alongside the standard
 * FBRiskScore. Call it instead of (or after) upsertRiskScore when you have
 * CodeRipple data available.
 *
 * The cr_* fields are stored flat in the same Firestore document so existing
 * listAllRiskScores() queries continue to work without any changes.
 */

import type { CodeRippleResult } from '@/types/coderippleTypes';

/**
 * Merge CodeRipple analysis data into an existing risk score document.
 * Call this after analyzeCommit() resolves, passing in the CodeRipple response.
 *
 * Usage (in your repo analysis flow):
 *
 *   const crResult = await fetchCodeRippleAnalysis(repoPath, sha);
 *   await mergeCodeRippleResult(userId, sha, crResult);
 */
export async function mergeCodeRippleResult(
  userId: string,
  sha: string,
  cr: CodeRippleResult,
): Promise<void> {
  const ref = doc(db, 'users', userId, 'riskScores', sha);

  await setDoc(ref, {
    // Mark this document as CodeRipple-enriched
    cr_analyzed: true,

    // Core risk prediction from CodeRipple
    cr_risk_prediction:       cr.risk_prediction,
    cr_risk_score:            cr.risk_score,
    cr_risk_confidence:       cr.risk_confidence,

    // Semantic analysis
    cr_change_type:           cr.change_type,
    cr_model_used:            cr.model_used,
    cr_semantic_change_score: cr.semantic_change_score,
    cr_similarity:            cr.similarity,

    // Ripple engine
    cr_ripple_depth:          cr.ripple_depth,
    cr_ripple_size:           cr.ripple_size,
    cr_direct_impact:         cr.direct_impact,
    cr_indirect_impact:       cr.indirect_impact,
    cr_impacted_files:        cr.impacted_files,

    // Function-level detail
    cr_changed_function:      cr.changed_function,
    cr_changed_functions:     cr.changed_functions,
    cr_functions_changed:     cr.functions_changed,
    cr_total_lines_changed:   cr.total_lines_changed,

    // Explainability
    cr_contributing_factors:  cr.contributing_factors,
    cr_feature_breakdown:     cr.feature_breakdown,

    // Full dependency graph (for DependencyGraph component)
    cr_dependency_graph:      cr.dependency_graph,
  }, { merge: true });
}

/**
 * Fetch the CodeRipple analysis from your Flask backend and store it.
 * Replace VITE_API_BASE_URL with your actual Flask base URL.
 *
 * Usage:
 *   await analyzeAndStoreCR(userId, sha, repoPath);
 */
export async function analyzeAndStoreCR(
  userId: string,
  sha: string,
  repoPath: string,
): Promise<CodeRippleResult | null> {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';
  try {
    const res = await fetch(`${base}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit: sha, repo: repoPath }),
    });
    if (!res.ok) return null;
    const cr: CodeRippleResult = await res.json();
    await mergeCodeRippleResult(userId, sha, cr);
    return cr;
  } catch (err) {
    console.error('[CodeRipple] Failed to analyze commit:', err);
    return null;
  }
}
