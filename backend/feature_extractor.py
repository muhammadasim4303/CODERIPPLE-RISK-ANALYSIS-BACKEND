"""
Feature extraction module: computes all engineered features
from raw GitHub commit data (patch, old_contents, new_contents, etc.)

When old_contents/new_contents are not available (patch-only mode),
we reconstruct them directly from the unified diff.
"""

import re
import math
import numpy as np
from difflib import SequenceMatcher


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def normalize_code(code) -> str:
    if code is None:
        return ""
    if isinstance(code, (list, tuple)):
        return "\n".join(str(x) for x in code)
    if not isinstance(code, str):
        return str(code)
    return code


def is_test_file(filename: str) -> bool:
    fname = filename.lower()
    return (
        "test" in fname or "spec" in fname or
        fname.startswith("tests/") or "/test/" in fname or
        "/tests/" in fname or "/__tests__/" in fname
    )


def is_critical_file(filename: str) -> bool:
    fname = filename.lower()
    critical_patterns = [
        "auth", "security", "payment", "login", "password",
        "config", "settings", "database", "db", "migration",
        "secret", "token", "key", "credential", "api",
        "main", "app", "server", "index", "core", "base",
        "middleware", "router", "route", "controller",
    ]
    return any(p in fname for p in critical_patterns)


def detect_test_only_change(patch: str) -> bool:
    all_files = re.findall(r"diff --git a/(.*?) b/", patch)
    if not all_files:
        return False
    return all(is_test_file(f) for f in all_files)


# ─────────────────────────────────────────────
# Reconstruct old/new code from a unified diff
# ─────────────────────────────────────────────

def reconstruct_from_patch(patch: str):
    """
    Parse a unified diff and reconstruct:
      - old_code: lines that existed before (context + removed)
      - new_code: lines that exist after   (context + added)
    Works even when old_contents/new_contents are not provided.
    """
    old_lines = []
    new_lines = []

    for line in patch.split('\n'):
        # Skip all diff headers
        if (line.startswith('diff ') or line.startswith('index ') or
                line.startswith('--- ') or line.startswith('+++ ') or
                line.startswith('@@')):
            continue
        if line.startswith('-'):
            old_lines.append(line[1:])
        elif line.startswith('+'):
            new_lines.append(line[1:])
        else:
            # Context line (starts with space or is empty)
            ctx = line[1:] if line.startswith(' ') else line
            old_lines.append(ctx)
            new_lines.append(ctx)

    return '\n'.join(old_lines), '\n'.join(new_lines)


def calculate_cyclomatic_complexity(code: str) -> int:
    code = normalize_code(code)
    if not code.strip():
        return 1
    complexity = 1
    patterns = [
        r'\bif\b', r'\belse\b', r'\bfor\b', r'\bwhile\b',
        r'\bcase\b', r'\bcatch\b', r'\bthrow\b', r'\braise\b',
        r'\?.*:', r'&&', r'\|\|',
    ]
    for p in patterns:
        complexity += len(re.findall(p, code, re.IGNORECASE))
    return complexity


def analyze_time_complexity(code: str) -> int:
    code = normalize_code(code)
    if not code.strip():
        return 1
    score = 1
    lines = code.split("\n")
    indent_levels = []
    for line in lines:
        indent = len(line) - len(line.lstrip())
        indent_levels.append(indent)
        if any(k in line for k in ['for', 'while', 'forEach', 'map', 'filter']):
            nesting = sum(1 for i in indent_levels if i < indent) // 4
            score = max(score, nesting + 1)
    if len(re.findall(r'\b\w+\s*\([^)]*\)', code)) > 0:
        score = max(score, 3)
    if any(k in code for k in ['.sort(', 'sorted(', 'Arrays.sort', 'Collections.sort']):
        score = max(score, 2)
    return score


def code_similarity(old_code: str, new_code: str) -> float:
    old = normalize_code(old_code)
    new = normalize_code(new_code)
    if not old and not new:
        return 1.0
    if not old or not new:
        return 0.0
    return SequenceMatcher(None, old[:3000], new[:3000]).ratio()


# ─────────────────────────────────────────────
# Main extraction
# ─────────────────────────────────────────────

def extract_features(data: dict) -> dict:
    patch        = normalize_code(data.get("patch", ""))
    old_code     = normalize_code(data.get("old_contents", ""))
    new_code     = normalize_code(data.get("new_contents", ""))
    filename     = data.get("file", "")

    # ── If old/new contents are missing, reconstruct from patch ──────────
    if (not old_code.strip() or not new_code.strip()) and patch.strip():
        reconstructed_old, reconstructed_new = reconstruct_from_patch(patch)
        if not old_code.strip():
            old_code = reconstructed_old
        if not new_code.strip():
            new_code = reconstructed_new

    # ── Test-only detection ──────────────────────────────────────────────
    is_test_only = detect_test_only_change(patch)

    # ── Basic line counts ────────────────────────────────────────────────
    added_lines   = len(re.findall(r'^\+(?!\+)', patch, flags=re.MULTILINE))
    removed_lines = len(re.findall(r'^-(?!-)',   patch, flags=re.MULTILINE))
    diff_size     = added_lines + removed_lines

    # ── File breakdown ───────────────────────────────────────────────────
    all_files = re.findall(r'diff --git a/(.*?) b/', patch)
    if not all_files and filename:
        all_files = [filename]
    test_files     = [f for f in all_files if is_test_file(f)]
    prod_files     = [f for f in all_files if not is_test_file(f)]
    critical_files = [f for f in prod_files if is_critical_file(f)]

    files_touched        = max(len(all_files), 1)
    test_files_count     = len(test_files)
    prod_files_count     = max(len(prod_files), 1 if not is_test_only else 0)
    critical_files_count = len(critical_files)
    test_files_modified  = int(len(test_files) > 0)

    # ── Cyclomatic complexity (now uses reconstructed code) ──────────────
    old_cyclomatic = calculate_cyclomatic_complexity(old_code)
    new_cyclomatic = calculate_cyclomatic_complexity(new_code)
    cyc_delta      = new_cyclomatic - old_cyclomatic

    old_time   = analyze_time_complexity(old_code)
    new_time   = analyze_time_complexity(new_code)
    time_delta = new_time - old_time

    # ── Complexity keywords in patch ─────────────────────────────────────
    if not is_test_only:
        complexity_hits  = len(re.findall(
            r'\b(if|for|while|try|catch|except|switch|case)\b', patch, re.IGNORECASE))
        branches_added   = len(re.findall(r'^\+.*(if|for|while|case|&&|\|\|)', patch, re.MULTILINE))
        branches_removed = len(re.findall(r'^-.*(if|for|while|case|&&|\|\|)',  patch, re.MULTILINE))
    else:
        complexity_hits = branches_added = branches_removed = 0

    cyclomatic_delta = branches_added - branches_removed

    # ── Comments ─────────────────────────────────────────────────────────
    comment_before = len(re.findall(r'^-\s*(#|//|/\*|\*)', patch, re.MULTILINE))
    comment_after  = len(re.findall(r'^\+\s*(#|//|/\*|\*)', patch, re.MULTILINE))
    comment_delta  = comment_after - comment_before

    # ── Imports / dependencies ────────────────────────────────────────────
    import_added       = len(re.findall(r'^\+.*\b(import|require|include|using)\b', patch, re.MULTILINE))
    import_removed     = len(re.findall(r'^-.*\b(import|require|include|using)\b',  patch, re.MULTILINE))
    dependency_changes = import_added + import_removed

    # ── Exception handling ────────────────────────────────────────────────
    exception_added   = len(re.findall(r'^\+.*(try|catch|except|finally|raise|throw)', patch, re.MULTILINE))
    exception_removed = len(re.findall(r'^-.*(try|catch|except|finally|raise|throw)',  patch, re.MULTILINE))
    exception_changes = exception_added + exception_removed

    # ── Public API ────────────────────────────────────────────────────────
    if not is_test_only:
        public_api_added   = len(re.findall(r'^\+.*\b(def|function|class|public|export)\b', patch, re.MULTILINE))
        public_api_removed = len(re.findall(r'^-.*\b(def|function|class|public|export)\b',  patch, re.MULTILINE))
    else:
        public_api_added = public_api_removed = 0

    public_api_modified = int(public_api_added > 0 or public_api_removed > 0)

    # ── Security patterns ─────────────────────────────────────────────────
    security_pattern_hits = len(re.findall(
        r'\b(password|token|secret|api_key|private_key|auth|credential|sql|query|eval|exec)\b',
        patch, re.IGNORECASE))

    # ── Structure changes ─────────────────────────────────────────────────
    structure_changes = (
        len(re.findall(r'^\+\s*[\{\}\[\]\(\)]', patch, re.MULTILINE)) +
        len(re.findall(r'^-\s*[\{\}\[\]\(\)]',  patch, re.MULTILINE))
    )

    # ── Indentation depth ─────────────────────────────────────────────────
    max_indent_added = max_indent_removed = 0
    for line in patch.split('\n'):
        if line.startswith('+'):
            m = re.match(r'\+(\s*)', line)
            if m:
                max_indent_added = max(max_indent_added, len(m.group(1)))
        elif line.startswith('-'):
            m = re.match(r'-(\s*)', line)
            if m:
                max_indent_removed = max(max_indent_removed, len(m.group(1)))
    depth_change = max_indent_added - max_indent_removed

    # ── Code similarity (now meaningful with reconstructed code) ──────────
    sim = code_similarity(old_code, new_code)

    # ─────────────────────────────────────────────────────────────────────
    # STRUCTURED_COLS
    # ─────────────────────────────────────────────────────────────────────
    structured = {
        "is_test_only":                int(is_test_only),
        "test_files_count":            test_files_count,
        "prod_files_count":            prod_files_count,
        "critical_files_count":        critical_files_count,
        "added_lines":                 added_lines,
        "removed_lines":               removed_lines,
        "diff_size":                   diff_size,
        "files_touched":               files_touched,
        "complexity_hits":             complexity_hits,
        "test_files_modified":         test_files_modified,
        "comment_before":              comment_before,
        "comment_after":               comment_after,
        "comment_delta":               comment_delta,
        "import_added":                import_added,
        "import_removed":              import_removed,
        "dependency_changes":          dependency_changes,
        "exception_added":             exception_added,
        "exception_removed":           exception_removed,
        "exception_changes":           exception_changes,
        "public_api_added":            public_api_added,
        "public_api_removed":          public_api_removed,
        "public_api_modified":         public_api_modified,
        "security_pattern_hits":       security_pattern_hits,
        "structure_changes":           structure_changes,
        "branches_added":              branches_added,
        "branches_removed":            branches_removed,
        "cyclomatic_delta":            cyclomatic_delta,
        "max_indent_added":            max_indent_added,
        "max_indent_removed":          max_indent_removed,
        "depth_change":                depth_change,
        "old_cyclomatic_complexity":   old_cyclomatic,
        "new_cyclomatic_complexity":   new_cyclomatic,
        "cyclomatic_complexity_delta": cyc_delta,
        "old_time_complexity":         old_time,
        "new_time_complexity":         new_time,
        "time_complexity_delta":       time_delta,
        "code_similarity":             sim,
    }

    # ─────────────────────────────────────────────────────────────────────
    # ENGINEERED_COLS
    # ─────────────────────────────────────────────────────────────────────
    eps = 1e-6
    change_ratio            = added_lines / (removed_lines + eps)
    churn                   = added_lines + removed_lines
    net_lines               = added_lines - removed_lines
    cyclomatic_increase_pct = float(np.clip(cyc_delta / (old_cyclomatic + eps), -5, 5))
    api_change_total        = public_api_added + public_api_removed + public_api_modified
    api_breaking_signal     = public_api_removed + public_api_modified
    exception_net           = exception_added - exception_removed
    import_net              = import_added - import_removed
    has_new_deps            = int(import_added > 0)
    test_coverage_ratio     = test_files_count / (prod_files_count + test_files_count + eps)
    no_test_coverage        = int((not is_test_only) and (test_files_modified == 0))
    code_dissimilarity      = 1.0 - sim
    structural_risk         = (
        structure_changes +
        branches_added +
        branches_removed +
        abs(depth_change) * 2 +
        abs(cyclomatic_delta)
    )
    log_added_lines   = math.log1p(added_lines)
    log_removed_lines = math.log1p(removed_lines)
    log_diff_size     = math.log1p(diff_size)
    log_churn         = math.log1p(churn)

    engineered = {
        "change_ratio":            change_ratio,
        "churn":                   churn,
        "net_lines":               net_lines,
        "cyclomatic_increase_pct": cyclomatic_increase_pct,
        "api_change_total":        api_change_total,
        "api_breaking_signal":     api_breaking_signal,
        "exception_net":           exception_net,
        "import_net":              import_net,
        "has_new_deps":            has_new_deps,
        "test_coverage_ratio":     test_coverage_ratio,
        "no_test_coverage":        no_test_coverage,
        "code_dissimilarity":      code_dissimilarity,
        "structural_risk":         structural_risk,
        "log_added_lines":         log_added_lines,
        "log_removed_lines":       log_removed_lines,
        "log_diff_size":           log_diff_size,
        "log_churn":               log_churn,
    }

    all_features = {**structured, **engineered}
    all_features["_meta"] = {
        "critical_file_names": critical_files,
        "is_test_only":        is_test_only,
        "all_files":           all_files,
    }
    return all_features


# ─────────────────────────────────────────────
# Feature column order (must match scaler training order)
# ─────────────────────────────────────────────

STRUCTURED_COLS = [
    'is_test_only', 'test_files_count', 'prod_files_count', 'critical_files_count',
    'added_lines', 'removed_lines', 'diff_size', 'files_touched',
    'complexity_hits', 'test_files_modified',
    'comment_before', 'comment_after', 'comment_delta',
    'import_added', 'import_removed', 'dependency_changes',
    'exception_added', 'exception_removed', 'exception_changes',
    'public_api_added', 'public_api_removed', 'public_api_modified',
    'security_pattern_hits', 'structure_changes',
    'branches_added', 'branches_removed', 'cyclomatic_delta',
    'max_indent_added', 'max_indent_removed', 'depth_change',
    'old_cyclomatic_complexity', 'new_cyclomatic_complexity',
    'cyclomatic_complexity_delta',
    'old_time_complexity', 'new_time_complexity', 'time_complexity_delta',
    'code_similarity',
]

ENGINEERED_COLS = [
    'change_ratio', 'churn', 'net_lines', 'cyclomatic_increase_pct',
    'api_change_total', 'api_breaking_signal', 'exception_net',
    'import_net', 'has_new_deps', 'test_coverage_ratio', 'no_test_coverage',
    'code_dissimilarity', 'structural_risk',
    'log_added_lines', 'log_removed_lines', 'log_diff_size', 'log_churn',
]

ALL_FEATURE_COLS = STRUCTURED_COLS + ENGINEERED_COLS


def features_to_vector(feature_dict: dict) -> list:
    return [float(feature_dict.get(col, 0.0)) for col in ALL_FEATURE_COLS]
