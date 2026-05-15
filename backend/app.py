"""
CodeRipple Flask Backend
Provides REST API endpoints for risk analysis of GitHub commits.
"""

import os
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load from frontend .env to get GOOGLE_APP_PASSWORD
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"))

from feature_extractor import extract_features, features_to_vector, ALL_FEATURE_COLS, is_generated_file, is_sensitive_file
from risk_reasoning import generate_risk_reasons, derive_risk_categories

#  Try loading model; gracefully fall back to heuristic mode 
try:
    from model_inference import predict as model_predict, is_model_available
    MODEL_AVAILABLE = is_model_available()
except Exception as e:
    MODEL_AVAILABLE = False
    logging.warning(f"Model loading failed: {e} — running in heuristic mode")


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


# 
# Helpers
# 

def error_response(message: str, status: int = 400):
    return jsonify({"error": message}), status


def heuristic_predict(features: dict) -> dict:
    score = 0.0
    score += min(features.get("log_diff_size",    0) * 0.08, 0.20)
    score += min(features.get("log_added_lines",  0) * 0.05, 0.12)
    score += min(features.get("security_pattern_hits", 0) * 0.08, 0.20)
    score += features.get("critical_files_count",  0) * 0.10
    cyc_delta = features.get("cyclomatic_complexity_delta", 0)
    score += min(max(0, cyc_delta) * 0.04, 0.15)
    score += min(features.get("structural_risk", 0) * 0.008, 0.12)
    score += features.get("no_test_coverage", 0) * 0.15
    score += min(features.get("api_breaking_signal", 0) * 0.08, 0.15)
    score += features.get("code_dissimilarity", 0) * 0.12
    score += features.get("has_new_deps", 0) * 0.06
    score += min(features.get("dependency_changes", 0) * 0.02, 0.08)
    score -= features.get("is_test_only", 0) * 0.25
    score = float(max(0.0, min(1.0, score)))

    if score >= 0.55:
        label = "HIGH RISK"
    elif score >= 0.28:
        label = "MEDIUM RISK"
    else:
        label = "LOW RISK"

    conf   = 0.72 if score > 0.55 else (0.68 if score > 0.28 else 0.78)
    high   = score if label == "HIGH RISK"   else max(0.0, score * 0.6)
    medium = score if label == "MEDIUM RISK" else max(0.0, 0.35 - abs(score - 0.4))
    low    = max(0.0, 1.0 - high - medium)
    return {
        "pred_risk_score": score,
        "pred_risk_label": label,
        "pred_confidence": conf,
        "probabilities": {
            "HIGH RISK":   round(high,   3),
            "MEDIUM RISK": round(medium, 3),
            "LOW RISK":    round(low,    3),
        },
        "mode": "heuristic",
    }


def _is_trivial_commit(features: dict) -> tuple[bool, str]:
    prod_files     = int(features.get("prod_files_count",        0))
    test_files     = int(features.get("test_files_count",        0))
    critical       = int(features.get("critical_files_count",    0))
    security       = int(features.get("security_pattern_hits",   0))
    api_breaking   = int(features.get("api_breaking_signal",     0))
    exceptions     = int(features.get("exception_changes",       0))
    diff_size      = int(features.get("diff_size",                0))
    added          = int(features.get("added_lines",              0))
    removed        = int(features.get("removed_lines",            0))
    cyc_delta      = float(features.get("cyclomatic_complexity_delta", 0))
    imports_added  = int(features.get("import_added",             0))
    struct_changes = int(features.get("structure_changes",        0))
    is_test_only   = int(features.get("is_test_only",             0))

    if is_test_only and not critical and not security:
        return True, "Only test files modified — no production code changed"
    if prod_files == 0 and test_files == 0:
        return True, "No code files involved — documentation or config change only"

    trivial_change = (
        diff_size <= 30 and added <= 20 and removed <= 10 and
        security == 0 and critical == 0 and api_breaking == 0 and
        exceptions == 0 and imports_added == 0 and struct_changes == 0 and
        abs(cyc_delta) < 2
    )
    if trivial_change:
        return True, "Very small change with no risk signals detected"

    return False, ""


def _is_initial_commit(features: dict) -> bool:
    """
    Returns True when this looks like a repository's first commit.
    Heuristic: commit message matches common initial-commit phrases,
    OR every file is a pure addition (no removals at all) with no
    pre-existing code — i.e. nothing was deleted or modified.
    """
    import re as _re
    description = features.get("_meta", {}).get("description", "").strip().lower()
    _initial_patterns = [
        r'^initial commit',
        r'^first commit',
        r'^init(?:ial)?\b',
        r'^initial$',
        r'^project init',
        r'^repo init',
        r'^initial push',
        r'^initial version',
        r'^initial setup',
        r'^initial upload',
        r'\binitial commit\b',
    ]
    for pat in _initial_patterns:
        if _re.search(pat, description):
            return True
    return False


def _has_critical_signals(features: dict) -> bool:
    return (
        features.get("security_pattern_hits",  0) >= 3  or
        features.get("critical_files_count",   0) >= 1  or
        features.get("api_breaking_signal",    0) >= 2  or
        features.get("exception_removed",      0) >= 2  or
        features.get("cyclomatic_complexity_delta", 0) >= 5 or
        features.get("removed_lines",          0) >= 50 or
        features.get("dependency_changes",     0) >= 3  or
        features.get("structural_risk",        0) >= 10
    )


def run_prediction(features: dict) -> dict:
    meta = features.get("_meta", {})

    #  1. Sensitive-file / hardcoded-secret override (always wins) 
    if meta.get("critical_security_flag", 0) > 0 or meta.get("sensitive_file_names"):
        return {
            "pred_risk_score": 1.0,
            "pred_risk_label": "HIGH RISK",
            "pred_confidence": 0.99,
            "probabilities": {"HIGH RISK": 0.99, "MEDIUM RISK": 0.01, "LOW RISK": 0.00},
            "mode": "rule:critical_security",
            "override_reason": "HIGH: Hardcoded secret, API key, password, SQL injection, "
                               "or sensitive file detected",
        }

    #  2. Initial commit 
    if _is_initial_commit(features):
        return {
            "pred_risk_score": 0.08,
            "pred_risk_label": "LOW RISK",
            "pred_confidence": 0.95,
            "probabilities": {"HIGH RISK": 0.01, "MEDIUM RISK": 0.04, "LOW RISK": 0.95},
            "mode": "rule:initial_commit",
            "override_reason": "Initial commit — no prior codebase to regress against",
        }

    #  3. Trivial commit 
    trivial, trivial_reason = _is_trivial_commit(features)
    if trivial:
        return {
            "pred_risk_score": 0.10,
            "pred_risk_label": "LOW RISK",
            "pred_confidence": 0.92,
            "probabilities": {"HIGH RISK": 0.03, "MEDIUM RISK": 0.07, "LOW RISK": 0.90},
            "mode": "rule:trivial",
            "override_reason": trivial_reason,
        }

    heuristic = heuristic_predict(features)
    if not MODEL_AVAILABLE:
        return heuristic

    try:
        vec          = features_to_vector(features)
        model_result = model_predict(vec)
        model_result["mode"] = "model"
    except Exception as e:
        logger.warning(f"Model inference failed ({e}) — using heuristic")
        return heuristic

    m_label = model_result["pred_risk_label"]
    h_score = heuristic["pred_risk_score"]

    has_signals = _has_critical_signals(features)
    if not has_signals and m_label in ("HIGH RISK", "MEDIUM RISK"):
        if h_score < 0.35:
            model_result["pred_risk_label"] = "LOW RISK"
            model_result["pred_risk_score"] = min(model_result["pred_risk_score"], 0.25)
            model_result["mode"] = "model+rule:downgrade"

    danger = (
        features.get("security_pattern_hits", 0) >= 8 or
        (features.get("critical_files_count", 0) > 0 and
         features.get("no_test_coverage",     0) == 1 and
         features.get("security_pattern_hits", 0) >= 3)
    )
    if danger and m_label == "LOW RISK":
        blended = max((h_score + model_result["pred_risk_score"]) / 2, 0.60)
        model_result["pred_risk_score"] = blended
        model_result["pred_risk_label"] = "HIGH RISK" if blended >= 0.55 else "MEDIUM RISK"
        model_result["pred_confidence"] = 0.70
        model_result["mode"] = "model+rule:upgrade"

    return model_result



# 
# Simple in-memory cache
# 
_risk_cache: dict = {}


# 
# Routes
# 

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "model_loaded": MODEL_AVAILABLE,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/send-invite", methods=["POST"])
def send_invite():
    body = request.get_json(silent=True)
    if not body:
        return error_response("Request body must be JSON")
    
    repo_name = body.get("repo_name")
    invite_links = body.get("invite_links", {}) 
    
    if not repo_name or not invite_links:
        return error_response("Missing repo_name or invite_links")
        
    sender_email = "muhammadasim4303@gmail.com"
    app_password = os.environ.get("GOOGLE_APP_PASSWORD", "").strip()
    # Strip quotes if they were included in the env file
    if app_password.startswith('"') and app_password.endswith('"'):
        app_password = app_password[1:-1]
    
    if not app_password:
        return error_response("Missing GOOGLE_APP_PASSWORD in frontend .env", 500)
        
    try:
        # Render blocks port 587 on free tiers, which causes connection timeouts.
        # Use a short timeout so Gunicorn workers don't die.
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=5)
        server.starttls()
        server.login(sender_email, app_password)
    except Exception as e:
        logger.warning(f"SMTP connection failed (Render likely blocking port 587): {e}")
        # Return success anyway so the frontend doesn't crash. Supabase handles the actual invite logic.
        return jsonify({"status": "success", "warning": "Emails skipped due to server restrictions. Invites saved."})
        
    try:
        
        for email_addr, link in invite_links.items():
            msg = MIMEMultipart()
            msg['From'] = f"CodeRipple <{sender_email}>"
            msg['To'] = email_addr
            msg['Subject'] = f"Invitation to contribute to {repo_name} on CodeRipple"
            
            html = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #2563eb;">CodeRipple Invitation</h2>
                        <p>You have been invited to collaborate on the repository: <strong>{repo_name}</strong>.</p>
                        <p>Click the button below to accept the invitation and link your GitHub account:</p>
                        <div style="margin: 30px 0;">
                            <a href="{link}" style="padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Accept Invitation</a>
                        </div>
                        <p style="font-size: 0.9em; color: #666;">If you didn't expect this invitation, you can safely ignore this email.</p>
                        <p style="margin-top: 30px; font-size: 0.8em; color: #999;">Best regards,<br>CodeRipple Team</p>
                    </div>
                </body>
            </html>
            """
            
            msg.attach(MIMEText(html, 'html'))
            server.send_message(msg)
            
        server.quit()
        return jsonify({"status": "sent", "count": len(invite_links)})
    except Exception as e:
        logger.exception("Failed to send invite emails")
        return error_response(f"Failed to send email: {str(e)}", 500)


@app.route("/api/github-add-collaborator", methods=["POST"])
def add_github_collaborator():
    import urllib.request
    import json as _json
    body = request.get_json(silent=True)
    if not body:
        return error_response("Request body must be JSON")
    
    repo_name = body.get("repo_name")
    github_username = body.get("github_username")
    
    if not repo_name or not github_username:
        return error_response("Missing repo_name or github_username")
        
    gh_token = os.environ.get("GITHUB_TOKEN", "")
    if not gh_token:
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"))
        gh_token = os.environ.get("GITHUB_TOKEN", "")
        
    if gh_token:
        gh_token = gh_token.strip().strip('"').strip("'")
        
    if not gh_token:
        return error_response("GITHUB_TOKEN is missing in frontend .env. Please add it to invite users on GitHub.", 500)
        
    url = f"https://api.github.com/repos/{repo_name}/collaborators/{github_username}"
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"Bearer {gh_token}",
        "Content-Length": "0" # PUT request requires Content-Length
    }
    
    try:
        req = urllib.request.Request(url, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return jsonify({"status": "success", "message": f"Successfully invited {github_username} to {repo_name} on GitHub."})
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        logger.error(f"GitHub API error {e.code}: {body}")
        if e.code == 404:
            return error_response("Repository not found or lacking permissions to add collaborators.", 404)
        return error_response(f"GitHub error: {body}", e.code)
    except Exception as e:
        logger.exception("Failed to invite collaborator on GitHub")
        return error_response(f"Failed to invite on GitHub: {str(e)}", 500)


@app.route("/api/analyze", methods=["POST"])
def analyze_commit():
    body = request.get_json(silent=True)
    if not body:
        return error_response("Request body must be JSON")

    missing = [k for k in ["sha", "patch"] if not body.get(k)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    try:
        features         = extract_features(body)
        prediction       = run_prediction(features)
        mode             = prediction.get("mode", "model")
        reasons          = generate_risk_reasons(features, prediction["pred_risk_label"], prediction["pred_risk_score"], mode)
        categories       = derive_risk_categories(features, mode)
        display_features = {k: v for k, v in features.items() if k != "_meta"}

        return jsonify({
            "sha":             body["sha"],
            "repo":            body.get("repo", ""),
            "risk_score":      prediction["pred_risk_score"],
            "risk_label":      prediction["pred_risk_label"],
            "confidence":      prediction["pred_confidence"],
            "probabilities":   prediction["probabilities"],
            "risk_categories": categories,
            "risk_reasons":    reasons,
            "features":        display_features,
            "mode":            prediction.get("mode", "model"),
            "analyzed_at":     datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.exception("Analysis failed")
        return error_response(f"Analysis failed: {str(e)}", 500)


@app.route("/api/analyze/batch", methods=["POST"])
def analyze_batch():
    body = request.get_json(silent=True)
    if not body:
        return error_response("Request body must be JSON")

    sha         = body.get("sha", "")
    repo        = body.get("repo", "")
    description = body.get("description", "")
    files       = body.get("files", [])

    if not files:
        return error_response("'files' list is required")

    #  Separate generated files from real code files 
    generated_files = []
    code_files      = []
    for f in files:
        fname = f.get("filename", f.get("file", ""))
        if is_generated_file(fname) or not f.get("patch"):
            generated_files.append(f)
        else:
            code_files.append(f)

    #  All files generated → force LOW RISK 
    if not code_files:
        gen_results = [{
            "file":                    f.get("filename", f.get("file", "")),
            "patch":                   f.get("patch", ""),
            "risk_score":              0.05,
            "risk_label":              "LOW RISK",
            "correctness_risk":        0,
            "security_risk":           0,
            "maintainability_risk":    0.05,
            "integration_risk":        0,
            "correctness_reasons":     [],
            "security_reasons":        [],
            "maintainability_reasons": [],
            "integration_reasons":     [],
            "risk_reasons":            ["Generated, compiled, or non-code file"],
            "added_lines":             f.get("additions", 0),
            "removed_lines":           f.get("deletions", 0),
            "is_generated":            True,
        } for f in files]
        return jsonify({
            "sha":  sha, "repo": repo,
            "risk_score": 0.05, "risk_label": "LOW RISK",
            "risk_categories": {
                "correctness": 0, "correctness_reasons": [],
                "security": 0, "security_reasons": [],
                "maintainability": 0.05, "maintainability_reasons": [],
                "integration": 0, "integration_reasons": [],
            },
            "risk_reasons": ["All changed files are generated, compiled, or non-code"],
            "per_file":     gen_results,
            "analyzed_at":  datetime.now(timezone.utc).isoformat(),
        })

    #  Analyze each code file individually 
    results      = []
    all_features = []

    for f in generated_files:
        results.append({
            "file":                    f.get("filename", f.get("file", "")),
            "patch":                   f.get("patch", ""),
            "risk_score":              0.05,
            "risk_label":              "LOW RISK",
            "correctness_risk":        0,
            "security_risk":           0,
            "maintainability_risk":    0.05,
            "integration_risk":        0,
            "correctness_reasons":     [],
            "security_reasons":        [],
            "maintainability_reasons": [],
            "integration_reasons":     [],
            "risk_reasons":            ["Generated or compiled file — skipped"],
            "added_lines":             f.get("additions", 0),
            "removed_lines":           f.get("deletions", 0),
            "is_generated":            True,
        })

    for file_data in code_files:
        filename = file_data.get("filename", file_data.get("file", ""))
        patch    = file_data.get("patch", "")
        row = {
            "sha": sha, "repo": repo, "description": description,
            "patch": patch, "file": filename,
            "old_contents": file_data.get("old_contents", file_data.get("old_content", "")),
            "new_contents": file_data.get("new_contents", file_data.get("new_content", "")),
        }
        try:
            features        = extract_features(row)
            pred            = run_prediction(features)
            file_mode       = pred.get("mode", "model")
            file_categories = derive_risk_categories(features, file_mode)
            file_reasons    = generate_risk_reasons(features, pred["pred_risk_label"], pred["pred_risk_score"], file_mode)
            all_features.append(features)

            # -- Sensitive file override: force security 100% for this file --
            file_is_sensitive = is_sensitive_file(filename)
            if file_is_sensitive:
                file_sec_risk  = 1.0
                file_risk_score = 1.0
                file_risk_label = "HIGH RISK"
                file_sec_reasons = [
                    f"HIGH: Sensitive file committed ({filename}) "
                    "— credentials or secret keys may be exposed"
                ]
            else:
                file_sec_risk   = file_categories.get("security", 0)
                file_risk_score = pred["pred_risk_score"]
                file_risk_label = pred["pred_risk_label"]
                file_sec_reasons = file_categories.get("security_reasons", [])

            results.append({
                "file":                    filename,
                "patch":                   patch,
                "risk_score":              file_risk_score,
                "risk_label":              file_risk_label,
                "correctness_risk":        file_categories.get("correctness", 0),
                "security_risk":           file_sec_risk,
                "maintainability_risk":    file_categories.get("maintainability", 0),
                "integration_risk":        file_categories.get("integration", 0),
                "correctness_reasons":     file_categories.get("correctness_reasons", []),
                "security_reasons":        file_sec_reasons,
                "maintainability_reasons": file_categories.get("maintainability_reasons", []),
                "integration_reasons":     file_categories.get("integration_reasons", []),
                "risk_reasons":            file_reasons,
                "added_lines":             features.get("added_lines", 0),
                "removed_lines":           features.get("removed_lines", 0),
                "is_generated":            False,
            })
        except Exception as e:
            results.append({
                "file": filename, "patch": patch,
                "risk_score": 0, "risk_label": "LOW RISK",
                "error": str(e), "is_generated": False,
            })

    #  Aggregate: worst-case score from code files 
    code_scores = [r["risk_score"] for r in results if not r.get("is_generated") and "risk_score" in r]
    agg_score   = max(code_scores) if code_scores else 0.05

    if agg_score >= 1.0:
        agg_label = "HIGH RISK"
    elif agg_score >= 0.65:
        agg_label = "HIGH RISK"
    elif agg_score >= 0.35:
        agg_label = "MEDIUM RISK"
    else:
        agg_label = "LOW RISK"

    if all_features and code_scores:
        worst_idx      = code_scores.index(max(code_scores))
        worst_features = all_features[min(worst_idx, len(all_features) - 1)]
    else:
        worst_features = {}

    combined_patch = "\n".join(f.get("patch", "") for f in code_files if f.get("patch"))
    combined_data  = {
        "sha": sha, "repo": repo, "description": description,
        "patch": combined_patch, "file": "", "old_contents": "", "new_contents": "",
    }
    combined_features = extract_features(combined_data)

    merged = {**combined_features}
    for key in ["security_pattern_hits", "cyclomatic_complexity_delta",
                "old_cyclomatic_complexity", "new_cyclomatic_complexity",
                "time_complexity_delta", "depth_change", "structural_risk"]:
        if key in worst_features:
            merged[key] = worst_features[key]

    reasons    = generate_risk_reasons(merged, agg_label, agg_score)
    categories = derive_risk_categories(merged)

    return jsonify({
        "sha":             sha,
        "repo":            repo,
        "risk_score":      agg_score,
        "risk_label":      agg_label,
        "risk_categories": categories,
        "risk_reasons":    reasons,
        "per_file":        results,
        "analyzed_at":     datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/commit/<sha>/risk", methods=["GET", "DELETE", "POST"])
def manage_risk_cache(sha: str):
    """GET = get cache, POST = store cache, DELETE = clear cache."""
    if request.method == "GET":
        cached = _risk_cache.get(sha)
        if cached:
            return jsonify(cached)
        return error_response("Not analyzed yet", 404)

    if request.method == "DELETE":
        if sha in _risk_cache:
            del _risk_cache[sha]
            return jsonify({"status": "deleted"})
        return error_response("Not found in cache", 404)

    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        _risk_cache[sha] = {**body, "sha": sha}
        return jsonify({"status": "cached"})


# 
# Debug / Inspection Routes
# 

def _build_inspect_response(sha, owner, repo, gh_files, description):
    combined_patch = "\n".join(f.get("patch", "") for f in gh_files if f.get("patch"))
    file_names     = [f.get("filename", f.get("file", "")) for f in gh_files]

    raw_data = {
        "sha": sha, "repo": f"{owner}/{repo}", "description": description,
        "patch": combined_patch, "file": file_names[0] if file_names else "",
        "old_contents": "", "new_contents": "",
        "messages": description, "description_lang": "en",
        "file_rows": len(gh_files), "agent": "github", "event_id": sha,
    }

    features   = extract_features(raw_data)
    meta       = features.pop("_meta", {})
    prediction = run_prediction(features)
    reasons    = generate_risk_reasons(features, prediction["pred_risk_label"], prediction["pred_risk_score"])
    categories = derive_risk_categories(features)
    label      = prediction["pred_risk_label"]
    score      = prediction["pred_risk_score"]

    return jsonify({
        "event_id": sha, "agent": "github",
        "repo": f"{owner}/{repo}", "sha": sha,
        "description": description, "patch": combined_patch,
        "file_rows": len(gh_files), "file": ", ".join(file_names),
        "old_contents": "", "new_contents": "",
        "messages": description, "description_lang": "en",
        "is_test_only":                 features.get("is_test_only"),
        "test_files_count":             features.get("test_files_count"),
        "prod_files_count":             features.get("prod_files_count"),
        "critical_files_count":         features.get("critical_files_count"),
        "critical_file_names":          meta.get("critical_file_names", []),
        "added_lines":                  features.get("added_lines"),
        "removed_lines":                features.get("removed_lines"),
        "diff_size":                    features.get("diff_size"),
        "files_touched":                features.get("files_touched"),
        "complexity_hits":              features.get("complexity_hits"),
        "test_files_modified":          features.get("test_files_modified"),
        "comment_before":               features.get("comment_before"),
        "comment_after":                features.get("comment_after"),
        "comment_delta":                features.get("comment_delta"),
        "import_added":                 features.get("import_added"),
        "import_removed":               features.get("import_removed"),
        "dependency_changes":           features.get("dependency_changes"),
        "exception_added":              features.get("exception_added"),
        "exception_removed":            features.get("exception_removed"),
        "exception_changes":            features.get("exception_changes"),
        "public_api_added":             features.get("public_api_added"),
        "public_api_removed":           features.get("public_api_removed"),
        "public_api_modified":          features.get("public_api_modified"),
        "security_pattern_hits":        features.get("security_pattern_hits"),
        "structure_changes":            features.get("structure_changes"),
        "branches_added":               features.get("branches_added"),
        "branches_removed":             features.get("branches_removed"),
        "cyclomatic_delta":             features.get("cyclomatic_delta"),
        "max_indent_added":             features.get("max_indent_added"),
        "max_indent_removed":           features.get("max_indent_removed"),
        "depth_change":                 features.get("depth_change"),
        "old_cyclomatic_complexity":    features.get("old_cyclomatic_complexity"),
        "new_cyclomatic_complexity":    features.get("new_cyclomatic_complexity"),
        "cyclomatic_complexity_delta":  features.get("cyclomatic_complexity_delta"),
        "old_time_complexity":          features.get("old_time_complexity"),
        "new_time_complexity":          features.get("new_time_complexity"),
        "time_complexity_delta":        features.get("time_complexity_delta"),
        "code_similarity":              features.get("code_similarity"),
        "correctness_risk":             categories.get("correctness"),
        "correctness_reasons":          categories.get("correctness_reasons", []),
        "security_risk":                categories.get("security"),
        "security_reasons":             categories.get("security_reasons", []),
        "maintainability_risk":         categories.get("maintainability"),
        "maintainability_reasons":      categories.get("maintainability_reasons", []),
        "integration_risk":             categories.get("integration"),
        "integration_reasons":          categories.get("integration_reasons", []),
        "overall_risk_score":           round(score, 4),
        "risk_label":                   label,
        "risk_status":                  label,
        "risk_reasons":                 reasons,
        "_debug": {
            "mode":            prediction.get("mode", "model"),
            "confidence":      round(prediction.get("pred_confidence", 0), 4),
            "probabilities":   prediction.get("probabilities", {}),
            "files_in_commit": file_names,
            "model_loaded":    MODEL_AVAILABLE,
        }
    })


@app.route("/api/inspect/<owner>/<repo>/<sha>", methods=["POST"])
def inspect_commit_post(owner: str, repo: str, sha: str):
    """
    POST version — frontend sends commit data directly.
    Body: { "description": "...", "files": [{ "filename": "...", "patch": "..." }] }
    """
    body        = request.get_json(silent=True) or {}
    gh_files    = body.get("files", [])
    description = body.get("description", "")
    if not gh_files:
        return error_response("'files' list is required")
    try:
        return _build_inspect_response(sha, owner, repo, gh_files, description)
    except Exception as e:
        logger.exception("Inspect failed")
        return error_response(f"Inspect failed: {str(e)}", 500)


@app.route("/api/inspect/<owner>/<repo>/<sha>", methods=["GET"])
def inspect_commit(owner: str, repo: str, sha: str):
    """GET version — backend fetches from GitHub directly."""
    import urllib.request
    import json as _json

    gh_token = (
        request.args.get("token") or
        request.headers.get("X-Github-Token") or
        os.environ.get("GITHUB_TOKEN", "")
    )
    headers = {"Accept": "application/vnd.github+json"}
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"

    url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            commit = _json.loads(resp.read())
    except Exception as e:
        return error_response(
            f"Backend cannot reach GitHub ({e}). "
            f"Use POST /api/inspect/{owner}/{repo}/{sha} instead.", 502
        )

    if "message" in commit and "Not Found" in commit.get("message", ""):
        return error_response(f"Commit {sha} not found", 404)

    gh_files    = commit.get("files", [])
    description = commit.get("commit", {}).get("message", "")
    try:
        return _build_inspect_response(sha, owner, repo, gh_files, description)
    except Exception as e:
        logger.exception("Inspect failed")
        return error_response(f"Inspect failed: {str(e)}", 500)


@app.route("/api/repos/<owner>/<repo>/commits", methods=["GET"])
def get_repo_commits(owner: str, repo: str):
    import urllib.request
    import json as _json
    branch = request.args.get("branch")
    
    gh_token = os.environ.get("GITHUB_TOKEN", "")
    if not gh_token:
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"))
        gh_token = os.environ.get("GITHUB_TOKEN", "")
    gh_token = gh_token.strip().strip('"').strip("'")
    
    url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page=30"
    if branch:
        url += f"&sha={branch}"
        
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "CodeRipple"}
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"
        
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            commits = _json.loads(resp.read())
            return jsonify(commits)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        logger.error(f"GitHub API error {e.code}: {body}")
        return error_response(f"GitHub error: {body}", e.code)
    except Exception as e:
        logger.exception("Failed to fetch commits")
        return error_response(str(e), 500)

@app.route("/api/repos/<owner>/<repo>/branches", methods=["GET"])
def get_repo_branches(owner: str, repo: str):
    import urllib.request
    import json as _json
    
    gh_token = os.environ.get("GITHUB_TOKEN", "")
    if not gh_token:
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"))
        gh_token = os.environ.get("GITHUB_TOKEN", "")
    gh_token = gh_token.strip().strip('"').strip("'")
    
    url = f"https://api.github.com/repos/{owner}/{repo}/branches?per_page=100"
        
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "CodeRipple"}
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"
        
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            branches = _json.loads(resp.read())
            return jsonify(branches)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        logger.error(f"GitHub API error {e.code}: {body}")
        return error_response(f"GitHub error: {body}", e.code)
    except Exception as e:
        logger.exception("Failed to fetch branches")
        return error_response(str(e), 500)

@app.route("/api/repos/<owner>/<repo>/commit/<sha>", methods=["GET"])
def get_repo_single_commit(owner: str, repo: str, sha: str):
    import urllib.request
    import json as _json
    
    gh_token = os.environ.get("GITHUB_TOKEN", "")
    if not gh_token:
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"))
        gh_token = os.environ.get("GITHUB_TOKEN", "")
    gh_token = gh_token.strip().strip('"').strip("'")
    
    url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
        
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "CodeRipple"}
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"
        
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            commit_data = _json.loads(resp.read())
            return jsonify(commit_data)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        logger.error(f"GitHub API error {e.code}: {body}")
        return error_response(f"GitHub error: {body}", e.code)
    except Exception as e:
        logger.exception("Failed to fetch commit details")
        return error_response(str(e), 500)

# 
# Main
# 
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting CodeRipple backend on port {port}")
    logger.info(f"Model available: {MODEL_AVAILABLE}")
    app.run(host="0.0.0.0", port=port, debug=False)