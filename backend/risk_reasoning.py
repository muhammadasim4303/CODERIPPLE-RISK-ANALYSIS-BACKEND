"""
Generates human-readable risk reasons from extracted features.
These are rule-based explanations that complement the model's prediction.
"""


def generate_risk_reasons(features: dict, risk_label: str, risk_score: float) -> list:
    reasons = []
    meta    = features.get("_meta", {})

    # ── Sensitive file override (highest priority) ────────────────────────
    sensitive_files = meta.get("sensitive_file_names", [])
    if sensitive_files:
        names = ", ".join(sensitive_files[:3])
        reasons.append(
            f"CRITICAL SECURITY: Sensitive file(s) committed — {names}. "
            "Credentials or secrets may be exposed!"
        )

    if meta.get("critical_security_flag"):
        reasons.append("CRITICAL: Hardcoded secret/API key, password, or SQL injection pattern detected in code")

    # ── Security ────────────────────────────────────────────────────────
    sec_hits = features.get("security_pattern_hits", 0)
    if sec_hits >= 15:
        reasons.append(
            f"CRITICAL: Extremely high concentration of security-sensitive patterns "
            f"({sec_hits} hits) — auth, credentials, SQL, tokens detected"
        )
    elif sec_hits >= 8:
        reasons.append(
            f"High-risk security patterns detected ({sec_hits} hits) — "
            "auth/token/password/SQL patterns present"
        )
    elif sec_hits > 0:
        reasons.append(
            f"Security-sensitive keywords detected "
            f"(auth/token/password/SQL patterns: {sec_hits} hits)"
        )

    if meta.get("critical_file_names"):
        names = ", ".join(meta["critical_file_names"][:3])
        reasons.append(f"Critical/core files modified: {names}")

    # ── High-danger combos ────────────────────────────────────────────────
    if (sec_hits >= 5 and
            features.get("no_test_coverage", 0) and
            features.get("critical_files_count", 0) > 0):
        reasons.append(
            "Dangerous combination: security-sensitive code in critical file with no test coverage"
        )

    if (features.get("public_api_added", 0) >= 3 and
            features.get("no_test_coverage", 0) and
            sec_hits >= 3):
        reasons.append(
            f"Multiple new public functions ({features.get('public_api_added', 0)}) "
            "added to security module with no tests"
        )

    # ── Complexity ───────────────────────────────────────────────────────
    cyc_delta = features.get("cyclomatic_complexity_delta", 0)
    if cyc_delta > 5:
        reasons.append(
            f"Cyclomatic complexity increased significantly (+{cyc_delta}), "
            "raising the chance of untested code paths"
        )
    elif cyc_delta > 2:
        reasons.append(f"Cyclomatic complexity increased by {cyc_delta}")
    elif cyc_delta < -2:
        reasons.append(f"Cyclomatic complexity reduced by {abs(cyc_delta)} — positive refactoring")

    time_delta = features.get("time_complexity_delta", 0)
    if time_delta > 1:
        reasons.append(
            f"Estimated time complexity worsened by {time_delta} orders "
            "(possible performance regression)"
        )

    # ── Change size ──────────────────────────────────────────────────────
    added = features.get("added_lines", 0)
    if added > 300:
        reasons.append(
            f"Large addition of {added} lines increases review surface area"
        )

    diff_size = features.get("diff_size", 0)
    if diff_size > 500:
        reasons.append(
            f"Diff size ({diff_size} lines) is very large — higher integration risk"
        )

    # ── API changes ──────────────────────────────────────────────────────
    api_break = features.get("api_breaking_signal", 0)
    if api_break > 0:
        reasons.append(
            f"Public API breaking change detected "
            f"({features.get('public_api_removed', 0)} removed, "
            f"{features.get('public_api_modified', 0)} modified)"
        )
    elif features.get("api_change_total", 0) > 0:
        reasons.append(
            f"Public API surface changed ({features.get('api_change_total', 0)} modifications)"
        )

    # ── Dependencies ─────────────────────────────────────────────────────
    if features.get("has_new_deps", 0):
        reasons.append(
            f"New dependencies introduced "
            f"({features.get('import_added', 0)} imports added)"
        )

    dep_changes = features.get("dependency_changes", 0)
    if dep_changes > 5:
        reasons.append(f"High dependency churn ({dep_changes} import changes)")

    # ── Test coverage ────────────────────────────────────────────────────
    if features.get("no_test_coverage", 0):
        reasons.append(
            "Production code changed with no corresponding test file modifications"
        )

    if features.get("is_test_only", 0):
        reasons.append("Change affects only test files (lower production risk)")

    # ── Structural ───────────────────────────────────────────────────────
    structural_risk = features.get("structural_risk", 0)
    if structural_risk > 20:
        reasons.append(
            f"High structural complexity score ({structural_risk:.0f}) — "
            "many branch/structure changes"
        )

    depth_change = features.get("depth_change", 0)
    if depth_change > 8:
        reasons.append(
            f"Significant nesting depth increased (+{depth_change} indentation levels)"
        )
    elif depth_change < -8:
        reasons.append(
            f"Nesting depth reduced ({depth_change} indentation levels) — simpler structure"
        )

    # ── Code similarity ──────────────────────────────────────────────────
    sim = features.get("code_similarity", 1.0)
    if sim < 0.3:
        reasons.append(
            f"Low code similarity ({sim:.0%}) — file was substantially rewritten"
        )
    elif sim < 0.6:
        reasons.append(
            f"Moderate code similarity ({sim:.0%}) — significant refactoring detected"
        )

    # ── Exceptions ──────────────────────────────────────────────────────
    exc_net = features.get("exception_net", 0)
    if exc_net < -2:
        reasons.append(
            f"Exception handling reduced (net {exc_net}) — error handling may have regressed"
        )
    elif exc_net > 3:
        reasons.append(
            f"Many new exception handlers added ({exc_net:+d}) — review for correctness"
        )

    # ── Default fallback if no specific reason found ─────────────────────
    if not reasons:
        if risk_label in ("HIGH RISK",):
            reasons.append(
                f"Model predicts high risk (score {risk_score:.2f}) based on "
                "combined structural and complexity signals"
            )
        elif risk_label == "MEDIUM RISK":
            reasons.append(
                f"Moderate risk profile (score {risk_score:.2f}) — "
                "review recommended but not critical"
            )
        else:
            reasons.append(
                f"Low risk change (score {risk_score:.2f}) — "
                "minimal complexity and structural impact"
            )

    return reasons[:6]   # cap at 6 reasons for UI clarity


def derive_risk_categories(features: dict) -> dict:
    """
    Heuristic sub-scores for correctness / security / maintainability / integration.
    These mirror the training labels but are computed rule-based for display.
    """
    meta = features.get("_meta", {})
    
    # ── Sensitive file override (highest priority — beats all caps) ──────
    sensitive_files = meta.get("sensitive_file_names", [])
    diff_size = max(features.get("diff_size", 1), 1)   # needed by Maintainability below
    if sensitive_files:
        sec = 1.0
    elif meta.get("critical_security_flag"):
        sec = 1.0
    else:
        # Use hit *density* relative to diff size to avoid inflating on large safe diffs.
        sec_hits    = features.get("security_pattern_hits", 0)
        hit_density = sec_hits / diff_size
        sec = min(1.0, (
            hit_density          * 1.5 +
            min(sec_hits, 10)    * 0.025 +
            features.get("critical_files_count", 0) * 0.15 +
            features.get("has_new_deps", 0)  * 0.05
        ))
        # Hard cap: without a breaking signal security stays <= 0.65
        if features.get("api_breaking_signal", 0) == 0:
            sec = min(sec, 0.65)

    # ── Correctness ─────────────────────────────────────────────────────────
    # no_test_coverage is very common — weight it moderately, not as a 0.3 jump.
    cyc_delta   = max(0, features.get("cyclomatic_complexity_delta", 0))
    dissimilarity = features.get("code_dissimilarity", 0)
    cor = min(0.85, (
        features.get("no_test_coverage", 0) * 0.15 +   # common, so lower weight
        cyc_delta                            * 0.04 +   # soft complexity penalty
        dissimilarity                        * 0.25 +   # large rewrite → risk
        features.get("exception_removed", 0) * 0.04    # removed error handling
    ))

    # ── Maintainability ─────────────────────────────────────────────────────
    # log_diff_size was exploding for normal commits — replace with a soft trigger
    # that only fires for genuinely large diffs (>200 lines).
    size_penalty = max(0, (diff_size - 200) / 2000)    # 0 below 200, ~0.15 at 500
    mai = min(1.0, (
        max(0, features.get("cyclomatic_delta", 0))  * 0.04 +
        features.get("structural_risk", 0)           * 0.008 +
        max(0, -features.get("comment_delta", 0))    * 0.02 +  # comments removed
        size_penalty
    ))

    # ── Integration ─────────────────────────────────────────────────────────
    # files_touched * 0.05 was sending 20-file commits to 1.0.
    # Use a logarithmic scale for breadth, keep API-break as the primary driver.
    import math as _math
    files_touched = features.get("files_touched", 1)
    breadth_score = min(0.30, _math.log1p(max(0, files_touched - 1)) * 0.08)
    intg = min(1.0, (
        features.get("api_breaking_signal", 0)   * 0.35 +   # breaking change → high
        features.get("dependency_changes", 0)    * 0.03 +   # each import ±
        breadth_score                                        # logarithmic file spread
    ))

    # ── Per-category reasons ──────────────────────────────────────────────
    sec_reasons = []
    if sensitive_files:
        names = ", ".join(sensitive_files[:3])
        sec_reasons.append(
            f"CRITICAL: Sensitive file(s) committed ({names}) — "
            "credentials or secret keys may be exposed"
        )
    elif meta.get("critical_security_flag"):
        sec_reasons.append(
            "CRITICAL: Hardcoded API key, secret, password, or injectable SQL detected — "
            "this code exposes sensitive credentials or enables SQL injection!"
        )
    elif features.get("security_pattern_hits", 0) > 0:
        sec_reasons.append(f"Security-sensitive patterns detected ({features['security_pattern_hits']} hits)")
    if features.get("critical_files_count", 0) > 0 and not sensitive_files:
        sec_reasons.append("Critical file(s) modified (auth/api/config/db)")
    if features.get("has_new_deps", 0):
        sec_reasons.append("New external dependencies introduced")

    cor_reasons = []
    if features.get("no_test_coverage", 0):
        cor_reasons.append("No test files modified alongside production code")
    if features.get("cyclomatic_complexity_delta", 0) > 2:
        cor_reasons.append(f"Cyclomatic complexity increased by {features['cyclomatic_complexity_delta']}")
    if features.get("code_dissimilarity", 0) > 0.7:
        cor_reasons.append(f"High code dissimilarity ({features['code_dissimilarity']:.0%}) — large rewrite")

    mai_reasons = []
    if features.get("cyclomatic_delta", 0) > 2:
        mai_reasons.append(f"Branch complexity increased (+{features['cyclomatic_delta']})")
    if features.get("structural_risk", 0) > 10:
        mai_reasons.append(f"High structural risk score ({features['structural_risk']})")
    if features.get("comment_delta", 0) < -2:
        mai_reasons.append("Comments removed — reduced code documentation")
    if features.get("diff_size", 0) > 300:
        mai_reasons.append(f"Large diff ({features.get('diff_size', 0)} lines) increases review burden")

    intg_reasons = []
    if features.get("api_breaking_signal", 0) > 0:
        intg_reasons.append("Public API removed or modified — potential breaking change")
    if features.get("dependency_changes", 0) > 3:
        intg_reasons.append(f"High dependency churn ({features['dependency_changes']} import changes)")
    if features.get("files_touched", 1) > 10:
        intg_reasons.append(f"Wide-ranging change across {features['files_touched']} files")
    elif features.get("files_touched", 1) > 4:
        intg_reasons.append(f"Change spans {features['files_touched']} files — cross-module integration risk")

    return {
        "correctness":              max(0.0, round(cor,  3)),
        "correctness_reasons":      cor_reasons,
        "security":                 max(0.0, round(sec,  3)),
        "security_reasons":         sec_reasons,
        "maintainability":          max(0.0, round(mai,  3)),
        "maintainability_reasons":  mai_reasons,
        "integration":              max(0.0, round(intg, 3)),
        "integration_reasons":      intg_reasons,
    }
