"""
Generates human-readable risk reasons from extracted features.
These are rule-based explanations that complement the model's prediction.
"""


def generate_risk_reasons(features: dict, risk_label: str, risk_score: float, mode: str = "model") -> list:
    reasons = []
    meta    = features.get("_meta", {})

    #  Override context 
    if "rule:" in mode:
        reasons.append(f"Safety override triggered ({mode}) — model prediction bypassed by heuristics")

    #  Sensitive file override (highest priority) 
    sensitive_files = meta.get("sensitive_file_names", [])
    if sensitive_files:
        names = ", ".join(sensitive_files[:3])
        reasons.append(
            f"HIGH SECURITY: Sensitive file(s) committed — {names}. "
            "Credentials or secrets may be exposed!"
        )

    if meta.get("critical_security_flag"):
        reasons.append("HIGH: Genuine hardcoded secret, API key, or SQL injection pattern detected in code")

    #  Security 
    sec_hits = features.get("security_pattern_hits", 0)
    if sec_hits >= 15:
        reasons.append(
            f"Concentration of security-sensitive patterns "
            f"({sec_hits} hits) — auth, credentials, SQL patterns present"
        )
    elif sec_hits > 0:
        reasons.append(
            f"Security-sensitive keywords detected "
            f"({sec_hits} hits) — auth/token/password/SQL patterns present"
        )

    if meta.get("critical_file_names"):
        names = ", ".join(meta["critical_file_names"][:3])
        reasons.append(f"Critical/core files modified: {names}")

    #  High-danger combos 
    if (sec_hits >= 5 and
            features.get("no_test_coverage", 0) and
            features.get("critical_files_count", 0) > 0):
        reasons.append(
            "Security-sensitive changes in core file with no test coverage"
        )

    #  Complexity 
    cyc_delta = features.get("cyclomatic_complexity_delta", 0)
    if cyc_delta > 5:
        reasons.append(
            f"Logic complexity increased (+{cyc_delta}), "
            "raising the chance of untested code paths"
        )
    elif cyc_delta > 2:
        reasons.append(f"Conditional complexity increased by {cyc_delta}")

    time_delta = features.get("time_complexity_delta", 0)
    if time_delta > 0:
        reasons.append(
            "Performance regression signal detected — increased algorithmic complexity"
        )

    #  Change size 
    added = features.get("added_lines", 0)
    if added > 300:
        reasons.append(
            f"Large addition of {added} lines increases review surface"
        )

    #  API changes 
    api_break = features.get("api_breaking_signal", 0)
    if api_break > 0:
        reasons.append(
            f"Public API breaking change detected "
            f"({features.get('public_api_removed', 0)} removed)"
        )
    
    if features.get("api_method_change_total", 0) > 0:
        reasons.append(
            f"Web API contract modified: {features.get('api_method_change_total')} method change(s) (GET/POST/etc)"
        )

    #  Dependencies 
    if features.get("has_new_deps", 0):
        reasons.append(
            f"New dependencies introduced ({features.get('import_added', 0)} imports)"
        )

    #  Test coverage 
    if features.get("no_test_coverage", 0):
        reasons.append(
            "No corresponding test file modifications found"
        )

    #  Structural 
    structural_risk = features.get("structural_risk", 0)
    if structural_risk > 20:
        reasons.append(
            f"High structural risk score ({structural_risk:.0f}) — many branch/nesting changes"
        )

    #  Code similarity 
    sim = features.get("code_similarity", 1.0)
    if sim < 0.4:
        reasons.append(
            f"Major refactor detected (code similarity {sim:.0%})"
        )

    #  Default fallback if no specific reason found 
    if not reasons:
        reasons.append(f"Model risk estimation (score {risk_score:.2f}, label {risk_label})")

    return reasons[:6]


def derive_risk_categories(features: dict, mode: str = "model") -> dict:
    meta = features.get("_meta", {})
    diff_size = max(features.get("diff_size", 1), 1)
    
    #  Security 
    # User constraint: 1.0 ONLY if genuine secrets or .env files are pushed.
    sensitive_files = meta.get("sensitive_file_names", [])
    if sensitive_files:
        sec = 1.0
    elif meta.get("critical_security_flag"):
        sec = 1.0
    else:
        sec_hits = features.get("security_pattern_hits", 0)
        # Use hit density relative to diff size
        hit_density = min(0.4, sec_hits / (diff_size + 10))
        sec = min(0.75, (
            hit_density          * 1.2 +
            min(sec_hits, 20)    * 0.015 +
            features.get("critical_files_count", 0) * 0.12 +
            features.get("has_new_deps", 0)  * 0.04
        ))
        # CAP: Stay below 0.75 unless genuine critical flag is set
        sec = min(sec, 0.75)

    #  Correctness 
    cyc_delta   = max(0, features.get("cyclomatic_complexity_delta", 0))
    dissimilarity = features.get("code_dissimilarity", 0)
    cor = min(0.90, (
        features.get("no_test_coverage", 0) * 0.15 +
        cyc_delta                            * 0.04 +
        dissimilarity                        * 0.25 +
        features.get("exception_removed", 0) * 0.05
    ))

    #  Maintainability 
    size_penalty = max(0, (diff_size - 250) / 1000)
    mai = min(1.0, (
        max(0, features.get("cyclomatic_delta", 0))  * 0.04 +
        features.get("structural_risk", 0)           * 0.008 +
        max(0, -features.get("comment_delta", 0))    * 0.02 +
        size_penalty
    ))

    #  Integration 
    import math as _math
    files_touched = features.get("files_touched", 1)
    breadth_score = min(0.35, _math.log1p(max(0, files_touched - 1)) * 0.08)
    
    intg = min(1.0, (
        features.get("api_breaking_signal", 0)       * 0.40 +
        features.get("api_method_change_total", 0)   * 0.30 +  # Contract change detected
        features.get("dependency_changes", 0)        * 0.04 +
        breadth_score
    ))

    #  Per-category reasons 
    sec_reasons = []
    if sensitive_files:
        names = ", ".join(sensitive_files[:3])
        sec_reasons.append(f"CRITICAL: Sensitive file(s) ({names}) — credentials likely exposed")
    elif meta.get("critical_security_flag"):
        sec_reasons.append("CRITICAL: Hardcoded secret or injectable SQL detected")
    elif features.get("security_pattern_hits", 0) > 0:
        sec_reasons.append(f"Security-sensitive keywords ({features['security_pattern_hits']} hits)")
    
    if features.get("critical_files_count", 0) > 0:
        sec_reasons.append("Project-critical files modified")

    cor_reasons = []
    if features.get("no_test_coverage", 0):
        cor_reasons.append("No test file modifications found")
    if cyc_delta > 2:
        cor_reasons.append(f"Cyclomatic complexity increased by {cyc_delta}")

    mai_reasons = []
    if features.get("cyclomatic_delta", 0) > 2:
        mai_reasons.append(f"Branch logic increased (+{features['cyclomatic_delta']})")
    if features.get("structural_risk", 0) > 10:
        mai_reasons.append(f"High structural risk score ({features['structural_risk']})")

    intg_reasons = []
    if features.get("api_breaking_signal", 0) > 0:
        intg_reasons.append("Potential breaking change in public API")
    if features.get("api_method_change_total", 0) > 0:
        intg_reasons.append("API contract methods modified (GET/POST/etc)")
    if files_touched > 8:
        intg_reasons.append(f"Wide impact across {files_touched} files")

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
