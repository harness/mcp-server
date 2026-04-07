"""
Langfuse evaluators and integration layer for SCS MCP smoke tests.

Provides:
  - Trajectory evaluator (tool selection matching with ordering awareness)
  - Parameter validation evaluator (checks tool args against expected patterns)
  - Answer quality evaluator (LLM-as-Judge via configurable model)
  - Latency evaluator (flags slow queries)
  - Chain completeness evaluator (all expected tools present)
  - Run-level aggregate evaluators
  - Langfuse Experiments (A/B run comparison via dataset_item.link())
  - Session tracking (per-turn traces with session_id for multi-turn)
  - Span-level tracing (child spans for tool calls and LLM generations)
  - Harness ai-evals LLM-as-Judge integration (rubric-based scoring via REST API)

Usage:
  Called from scs_llm_smoke_test.py when --langfuse flag is passed.
  Requires: pip install langfuse openai (or anthropic)

Environment variables:
  LANGFUSE_PUBLIC_KEY       - Langfuse project public key
  LANGFUSE_SECRET_KEY       - Langfuse project secret key
  LANGFUSE_HOST             - Langfuse host (default: https://langfuse-prod.harness.io)
  EVAL_JUDGE_MODEL          - LLM judge model (default: gpt-4.1-mini)
  EVAL_JUDGE_PROVIDER       - Judge provider: openai, anthropic, or harness (default: openai)
  HARNESS_EVAL_API_URL      - Harness ai-evals API URL (for --harness-judge)
  HARNESS_EVAL_API_TOKEN    - Harness ai-evals API token (Bearer auth)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://langfuse-prod.harness.io")
DATASET_NAME_SINGLE = "scs-mcp-smoke-single-turn"
DATASET_NAME_MULTI = "scs-mcp-smoke-multi-turn"
LATENCY_WARN_THRESHOLD_S = 60.0
LATENCY_FAIL_THRESHOLD_S = 120.0

# Quality coverage: fraction of items scoring above this threshold on the judge score
QUALITY_COVERAGE_THRESHOLD = float(os.getenv("QUALITY_COVERAGE_THRESHOLD", "0.7"))

# MCP Quality Index (MQI) weights — composite score across all evaluator dimensions
MQI_WEIGHTS = {
    "trajectory": 0.30,
    "parameters": 0.15,
    "harness_judge_score": 0.35,
    "latency": 0.10,
    "error_free": 0.05,
    "answer_presence": 0.05,
}

# Query categories for per-category aggregate breakdown
QUERY_CATEGORIES: dict[str, str] = {
    # Artifact queries
    "Q01": "artifact", "Q02": "artifact", "Q03": "artifact", "Q07": "artifact",
    "Q11": "artifact", "Q12": "artifact", "Q15": "artifact", "Q31": "artifact",
    # Repo queries
    "Q04": "repo", "Q05": "repo", "Q06": "repo", "Q16": "repo", "Q17": "repo",
    # Compliance
    "Q08": "compliance", "Q30": "compliance", "Q32": "compliance", "Q33": "compliance",
    "Q34": "compliance", "Q35": "compliance", "Q36": "compliance", "Q37": "compliance",
    # Remediation
    "Q13": "remediation", "Q20": "remediation", "Q23": "remediation", "Q27": "remediation",
    # Dependencies
    "Q21": "dependency", "Q22": "dependency", "Q28": "dependency",
    # SBOM & provenance
    "Q09": "sbom", "Q10": "sbom", "Q40": "sbom",
    # Cross-toolset
    "Q19": "cross_toolset", "Q26": "cross_toolset", "Q29": "cross_toolset",
    # OSS risk
    "Q38": "oss_risk", "Q39": "oss_risk", "Q41": "oss_risk", "Q42": "oss_risk",
    # N/A
    "Q14": "unsupported",
    # Multi-turn conversations
    "M01": "artifact",          # Artifact deep-dive
    "M02": "repo",              # Repo security overview → compliance
    "M03": "remediation",       # Remediation journey
    "M04": "artifact",          # Artifact refinement & correction
    "M05": "cross_toolset",     # Repo → artifacts → cross-entity
    "M06": "dependency",        # Dependency investigation + remediation
    "M07": "artifact",          # Invalid artifact ID error recovery
    "M08": "remediation",       # Remediation scope limitation recovery
    "M09": "cross_toolset",     # OPA policy management (governance ↔ SCS)
    "M10": "cross_toolset",     # Pipeline SBOM step inspection (SCS ↔ pipeline)
    "M11": "cross_toolset",     # Security → policy → pipeline (3 toolsets)
    "M12": "compliance",        # BOM enforcement violation investigation
    "M13": "compliance",        # BOM violation → remediation chain
    "M14": "oss_risk",          # Component OSS risk assessment
    "M15": "sbom",              # SBOM drift between versions
    "M16": "oss_risk",          # Project OSS risk → drill-down
}

# Truncation limits
MAX_ANSWER_IN_PROMPT = 3000
MAX_TRACE_OUTPUT = 5000
MAX_COMMENT_LEN = 500
MAX_TOOL_RESULT_OUTPUT = 2000

# Harness ai-evals LLM-as-Judge service
HARNESS_EVAL_API_URL = os.getenv("HARNESS_EVAL_API_URL", "")
HARNESS_EVAL_API_TOKEN = os.getenv("HARNESS_EVAL_API_TOKEN", "")
HARNESS_EVAL_ORG = os.getenv("HARNESS_ORG_ID", "SSCA")
HARNESS_EVAL_PROJECT = os.getenv("HARNESS_PROJECT_ID", "SSCA_Sanity_Automation")


def _get_judge_config() -> tuple[str, str]:
    """Return (provider, model) for the LLM judge from env vars."""
    provider = os.getenv("EVAL_JUDGE_PROVIDER", "openai")
    default_model = "claude-sonnet-4-20250514" if provider == "anthropic" else "gpt-4.1-mini"
    model = os.getenv("EVAL_JUDGE_MODEL", default_model)
    return provider, model


# Parameter patterns to validate per query (query_id -> list of checks)
# Each check: {"tool": (name, resource_type), "param": "key", "pattern": regex_or_value}
PARAM_VALIDATION_RULES: dict[str, list[dict[str, Any]]] = {
    # Compliance: standards array must include CIS
    "Q08": [{"tool": ("harness_list", "scs_compliance_result"), "param": "standards", "contains": "CIS"}],
    # Repo dependencies: dependency_type should be DIRECT
    "Q21": [{"tool": ("harness_list", "scs_artifact_component"), "param": "dependency_type", "equals": "DIRECT"}],
    # Dependency tree: purl must be passed to scs_component_dependencies
    "Q22": [{"tool": ("harness_get", "scs_component_dependencies"), "param": "resource_id", "pattern": r"pkg:"}],
    # Remediation: purl must be passed
    "Q13": [{"tool": ("harness_get", "scs_component_remediation"), "param": "resource_id", "pattern": r"pkg:"}],
    "Q23": [{"tool": ("harness_get", "scs_component_remediation"), "param": "resource_id", "pattern": r"pkg:"}],
    "Q27": [{"tool": ("harness_get", "scs_component_remediation"), "param": "resource_id", "pattern": r"pkg:"}],
    # Dependency tree disambiguation: must route to scs_component_dependencies, not scs_artifact_component
    "Q28": [{"tool": ("harness_get", "scs_component_dependencies"), "param": "resource_id", "pattern": r"pkg:"}],
    # BOM violations: enforcement_id must be extracted from artifact_security
    "Q34": [{"tool": ("harness_list", "scs_bom_violation"), "param": "enforcement_id", "pattern": r".+"}],
    "Q36": [{"tool": ("harness_list", "scs_bom_violation"), "param": "enforcement_id", "pattern": r".+"}],
    "Q37": [{"tool": ("harness_list", "scs_bom_violation"), "param": "enforcement_id", "pattern": r".+"}],
    # Enrichment: purl must be passed to scs_component_enrichment
    "Q38": [{"tool": ("harness_get", "scs_component_enrichment"), "param": "resource_id", "pattern": r"pkg:"}],
    # SBOM drift: action must be calculate
    "Q40": [{"tool": ("harness_execute", "scs_sbom_drift"), "param": "action", "equals": "calculate"}],
    # OSS risk filtering: oss_risk_filter must contain EOL values
    "Q42": [{"tool": ("harness_list", "scs_artifact_component"), "param": "oss_risk_filter", "contains": "DEFINITE_EOL"}],
}


def _fmt_tool(spec: Any) -> str:
    if isinstance(spec, (list, tuple)) and len(spec) == 2:
        return f"{spec[0]}({spec[1]})"
    return str(spec)


def _fmt_tool_results(extracted: dict, max_per_tool: int = 800, max_total: int = 4000) -> str:
    """Format tool results for inclusion in judge prompts.

    Handles tool_results as either:
    - A list of {name, is_error, content_length, content_preview} dicts (from extract_tools_from_events)
    - A dict keyed by tool display name (legacy format)

    Truncates each result and the total to keep the prompt within token limits.
    Returns "(no tool results captured)" if none available.
    """
    raw_results = extracted.get("tool_results", {})
    tools_called = extracted.get("tools_called", [])
    if not raw_results and not tools_called:
        return "(no tool results captured)"

    parts = []
    total_len = 0

    if isinstance(raw_results, list):
        # New format: list of result dicts with content_preview
        for i, result in enumerate(raw_results):
            tool_name = result.get("name", f"tool_{i}")
            # Match with tools_called to get display name
            display_name = tool_name
            if i < len(tools_called):
                display_name = _fmt_tool(tools_called[i])
            is_error = result.get("is_error", False)
            preview = result.get("content_preview", "")
            if not preview:
                preview = f"(content_length={result.get('content_length', 0)})"
            else:
                preview = preview[:max_per_tool]
                if result.get("content_length", 0) > max_per_tool:
                    preview += "... (truncated)"

            error_tag = " [ERROR]" if is_error else ""
            entry = f"### {display_name}{error_tag}\n{preview}"
            if total_len + len(entry) > max_total:
                parts.append("... (remaining tool results truncated)")
                break
            parts.append(entry)
            total_len += len(entry)
    elif isinstance(raw_results, dict):
        # Legacy dict format
        for tool_key, result in raw_results.items():
            result_str = str(result)[:max_per_tool]
            if len(str(result)) > max_per_tool:
                result_str += "... (truncated)"
            entry = f"### {tool_key}\n{result_str}"
            if total_len + len(entry) > max_total:
                parts.append("... (remaining tool results truncated)")
                break
            parts.append(entry)
            total_len += len(entry)

    return "\n\n".join(parts) if parts else "(no tool results captured)"


# ---------------------------------------------------------------------------
# Item-Level Evaluators
# ---------------------------------------------------------------------------

def trajectory_evaluator(*, output: Any, expected_output: Any, **kwargs) -> dict:
    """Glass-box trajectory evaluation: checks if expected tools were called.

    Scores:
      1.0 = all expected tools present (superset ok)
      0.0-0.99 = partial match (proportional to overlap)
      0.0 = no overlap or no tools called when expected
    """
    expected_raw = expected_output.get("trajectory", [])
    if not expected_raw:
        # No expected tools — anything is fine
        return {"name": "trajectory", "value": 1.0, "comment": "No trajectory expectation"}

    actual_raw = output.get("tools_called", []) if isinstance(output, dict) else []

    expected_set = set(tuple(t) if isinstance(t, list) else t for t in expected_raw)
    actual_set = set(tuple(t) if isinstance(t, list) else t for t in actual_raw)

    if not actual_set:
        return {"name": "trajectory", "value": 0.0,
                "comment": f"No tools called. Expected: {[_fmt_tool(t) for t in expected_set]}"}

    if expected_set.issubset(actual_set):
        extra = actual_set - expected_set
        comment = "All expected tools called"
        if extra:
            comment += f". Extra tools: {[_fmt_tool(t) for t in extra]}"
        return {"name": "trajectory", "value": 1.0, "comment": comment}

    overlap = expected_set & actual_set
    missing = expected_set - actual_set
    unexpected = actual_set - expected_set
    score = len(overlap) / len(expected_set)

    comment_parts = []
    if missing:
        comment_parts.append(f"Missing: {[_fmt_tool(t) for t in missing]}")
    if unexpected:
        comment_parts.append(f"Unexpected: {[_fmt_tool(t) for t in unexpected]}")
    return {"name": "trajectory", "value": round(score, 3), "comment": ". ".join(comment_parts)}


def trajectory_order_evaluator(*, output: Any, expected_output: Any, **kwargs) -> dict:
    """Checks if tools were called in the expected order (subsequence check).

    A tool chain like [A, B, C] is correct if A appears before B and B before C
    in the actual call sequence, even with extra tools interleaved.
    """
    expected_raw = expected_output.get("trajectory", [])
    if not expected_raw:
        return {"name": "trajectory_order", "value": 1.0, "comment": "No ordering expectation"}

    actual_raw = output.get("tools_called", []) if isinstance(output, dict) else []
    if not actual_raw:
        return {"name": "trajectory_order", "value": 0.0, "comment": "No tools called"}

    expected = [tuple(t) if isinstance(t, list) else t for t in expected_raw]
    actual = [tuple(t) if isinstance(t, list) else t for t in actual_raw]

    # Check if expected is a subsequence of actual
    exp_idx = 0
    for tool in actual:
        if exp_idx < len(expected) and tool == expected[exp_idx]:
            exp_idx += 1
    if exp_idx == len(expected):
        return {"name": "trajectory_order", "value": 1.0, "comment": "Tools called in expected order"}

    return {"name": "trajectory_order", "value": round(exp_idx / len(expected), 3),
            "comment": f"Order mismatch: matched {exp_idx}/{len(expected)} expected tools in sequence"}


def parameter_evaluator(*, input: Any, output: Any, expected_output: Any, **kwargs) -> dict:
    """Validates that tool calls included correct parameters.

    Uses PARAM_VALIDATION_RULES keyed by query ID. Each rule checks
    if a specific parameter was passed with the expected value/pattern.
    """
    query_id = input.get("id", "") if isinstance(input, dict) else ""
    rules = PARAM_VALIDATION_RULES.get(query_id, [])
    if not rules:
        return {"name": "parameters", "value": 1.0, "comment": "No parameter rules for this query"}

    tool_params = output.get("tool_params", {}) if isinstance(output, dict) else {}
    passed = 0
    total = len(rules)
    details = []

    for rule in rules:
        tool_key = _fmt_tool(rule["tool"])
        params = tool_params.get(tool_key, {})
        param_name = rule["param"]
        param_val = params.get(param_name)

        if param_val is None:
            # Check if param is in any tool call's args (tool_key might differ slightly)
            found = False
            for key, args in tool_params.items():
                if param_name in args:
                    param_val = args[param_name]
                    found = True
                    break
            if not found:
                details.append(f"MISS: {tool_key}.{param_name} not found")
                continue

        param_str = str(param_val)
        if "equals" in rule:
            if param_str.lower() == str(rule["equals"]).lower():
                passed += 1
                details.append(f"OK: {param_name}={param_str}")
            else:
                details.append(f"WRONG: {param_name}={param_str}, expected={rule['equals']}")
        elif "contains" in rule:
            if str(rule["contains"]).lower() in param_str.lower():
                passed += 1
                details.append(f"OK: {param_name} contains '{rule['contains']}'")
            else:
                details.append(f"MISS: {param_name}={param_str} doesn't contain '{rule['contains']}'")
        elif "pattern" in rule:
            if re.search(rule["pattern"], param_str):
                passed += 1
                details.append(f"OK: {param_name} matches pattern")
            else:
                details.append(f"MISS: {param_name}={param_str} doesn't match pattern '{rule['pattern']}'")

    score = passed / total if total > 0 else 1.0
    return {"name": "parameters", "value": round(score, 3), "comment": "; ".join(details)}


def latency_evaluator(*, output: Any, **kwargs) -> dict:
    """Scores based on response latency. Fast = 1.0, Slow = 0.5, Very slow = 0.0."""
    duration = output.get("duration_s", 0) if isinstance(output, dict) else 0
    if duration <= LATENCY_WARN_THRESHOLD_S:
        return {"name": "latency", "value": 1.0, "comment": f"{duration:.1f}s — fast"}
    elif duration <= LATENCY_FAIL_THRESHOLD_S:
        return {"name": "latency", "value": 0.5, "comment": f"{duration:.1f}s — slow (>{LATENCY_WARN_THRESHOLD_S}s)"}
    else:
        return {"name": "latency", "value": 0.0, "comment": f"{duration:.1f}s — very slow (>{LATENCY_FAIL_THRESHOLD_S}s)"}


def error_evaluator(*, output: Any, **kwargs) -> dict:
    """Checks if the execution had errors. 1.0 = no errors, 0.0 = errors present."""
    errors = output.get("errors", []) if isinstance(output, dict) else []
    if not errors:
        return {"name": "error_free", "value": 1.0, "comment": "No errors"}
    return {"name": "error_free", "value": 0.0, "comment": f"Errors: {errors[:3]}"}


def answer_presence_evaluator(*, output: Any, **kwargs) -> dict:
    """Checks if a non-trivial answer was generated. Simple heuristic check."""
    answer = ""
    if isinstance(output, dict):
        answer = output.get("answer", "") or output.get("final_answer", "")
    elif isinstance(output, str):
        answer = output

    if not answer or len(answer.strip()) < 10:
        return {"name": "answer_presence", "value": 0.0, "comment": "No meaningful answer generated"}
    if len(answer.strip()) < 50:
        return {"name": "answer_presence", "value": 0.5, "comment": f"Very short answer ({len(answer)} chars)"}
    return {"name": "answer_presence", "value": 1.0, "comment": f"Answer present ({len(answer)} chars)"}


# ---------------------------------------------------------------------------
# LLM-as-Judge Answer Quality Evaluator
# ---------------------------------------------------------------------------

def _call_judge_openai(prompt: str, model: str, max_tokens: int = 1200,
                       use_logprobs: bool = False) -> str | tuple[str, list | None]:
    """Call OpenAI-compatible model for judging.

    When use_logprobs=True, returns (text, logprobs_list) tuple for token
    probability calibration per G-Eval methodology.
    """
    try:
        import openai
        client = openai.OpenAI()
        kwargs: dict = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.0,
        }
        if use_logprobs:
            kwargs["logprobs"] = True
            kwargs["top_logprobs"] = 5
        response = client.chat.completions.create(**kwargs)
        text = response.choices[0].message.content or ""
        if use_logprobs:
            lp = response.choices[0].logprobs
            logprobs_data = lp.content if lp else None
            return text, logprobs_data
        return text
    except Exception as e:
        if use_logprobs:
            return f"JUDGE_ERROR: {e}", None
        return f"JUDGE_ERROR: {e}"


def _calibrate_score_from_logprobs(logprobs_data: list | None, parsed_score: float) -> float:
    """Compute calibrated score from token probability distribution (G-Eval).

    Scans logprobs for tokens that look like score values (0.0-1.0 range) in
    the JSON output. For each score token, computes the expected value by
    weighting alternative score tokens by their probability.

    Falls back to parsed_score if logprobs are unavailable or can't be
    calibrated (e.g., Anthropic models, non-OpenAI providers).
    """
    import math

    if not logprobs_data:
        return parsed_score

    # Look for the "score" key's value token in the logprobs
    score_token_idx = None
    for i, token_info in enumerate(logprobs_data):
        token_text = getattr(token_info, 'token', '')
        # Look for tokens that are the "score" key in JSON
        if '"score"' in token_text or "'score'" in token_text:
            # The value token should be 1-3 tokens after the key (skip `:` and space)
            for j in range(i + 1, min(i + 4, len(logprobs_data))):
                candidate = getattr(logprobs_data[j], 'token', '').strip()
                try:
                    val = float(candidate)
                    if 0.0 <= val <= 1.0:
                        score_token_idx = j
                        break
                except (ValueError, TypeError):
                    continue
            if score_token_idx is not None:
                break

    if score_token_idx is None:
        return parsed_score

    # Compute expected value from top_logprobs at this position
    token_info = logprobs_data[score_token_idx]
    top_logprobs = getattr(token_info, 'top_logprobs', [])
    if not top_logprobs:
        return parsed_score

    weighted_sum = 0.0
    prob_sum = 0.0
    for alt in top_logprobs:
        alt_token = getattr(alt, 'token', '').strip()
        alt_logprob = getattr(alt, 'logprob', -100)
        try:
            alt_val = float(alt_token)
            if 0.0 <= alt_val <= 1.0:
                prob = math.exp(alt_logprob)
                weighted_sum += alt_val * prob
                prob_sum += prob
        except (ValueError, TypeError):
            continue

    if prob_sum > 0:
        return round(weighted_sum / prob_sum, 3)
    return parsed_score


def _extract_json_from_cot(raw: str) -> dict:
    """Extract JSON object from a Chain-of-Thought response.

    The rubric prompt produces step-by-step reasoning followed by a JSON
    object on its own line. This function finds and parses that JSON,
    handling cases where the model wraps it in markdown code fences.
    Falls back to parsing the entire response as JSON for backward compat.
    """
    # Try parsing the whole response first (backward compatibility)
    try:
        return json.loads(raw.strip())
    except (json.JSONDecodeError, ValueError):
        pass

    # Strip markdown code fences if present
    cleaned = raw.strip()
    if "```json" in cleaned:
        start = cleaned.index("```json") + len("```json")
        end = cleaned.index("```", start) if "```" in cleaned[start:] else len(cleaned)
        cleaned = cleaned[start:start + end].strip()
        try:
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            pass
    elif "```" in cleaned:
        # Generic code fence
        parts = cleaned.split("```")
        for part in parts[1::2]:  # odd indices are inside fences
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except (json.JSONDecodeError, ValueError):
                continue

    # Scan lines from the end — JSON is typically the last thing output
    lines = raw.strip().splitlines()
    brace_depth = 0
    json_start = -1
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        brace_depth += line.count("}") - line.count("{")
        if brace_depth <= 0 and "{" in line:
            json_start = i
            break
    if json_start >= 0:
        candidate = "\n".join(lines[json_start:])
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            pass

    # Last resort: find first { to last }
    first_brace = raw.find("{")
    last_brace = raw.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        try:
            return json.loads(raw[first_brace:last_brace + 1])
        except (json.JSONDecodeError, ValueError):
            pass

    raise json.JSONDecodeError("No valid JSON found in CoT response", raw, 0)


def _call_judge_anthropic(prompt: str, model: str, max_tokens: int = 1200) -> str:
    """Call Anthropic model for judging."""
    try:
        import anthropic
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text if response.content else ""
    except Exception as e:
        return f"JUDGE_ERROR: {e}"


def _harness_eval_headers() -> dict[str, str]:
    """Build auth headers for Harness ai-evals API.

    Supports both x-api-key (PAT/SA tokens) and Bearer (OAuth) auth.
    Auto-detects based on HARNESS_EVAL_AUTH_TYPE env var (default: x-api-key).
    """
    auth_type = os.getenv("HARNESS_EVAL_AUTH_TYPE", "x-api-key")
    headers = {"Content-Type": "application/json"}
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {HARNESS_EVAL_API_TOKEN}"
    else:
        headers["x-api-key"] = HARNESS_EVAL_API_TOKEN
    return headers


def _harness_eval_request(url: str, payload: dict, timeout: int = 30) -> dict:
    """Make a single request to the Harness ai-evals API with error details."""
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=_harness_eval_headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def validate_harness_eval_connection() -> tuple[bool, str]:
    """Test connectivity to the Harness ai-evals service.

    Returns (success: bool, message: str).
    Call this at startup to verify the service is reachable.
    """
    if not HARNESS_EVAL_API_URL or not HARNESS_EVAL_API_TOKEN:
        return False, "HARNESS_EVAL_API_URL or HARNESS_EVAL_API_TOKEN not set"
    try:
        # Lightweight test: send a minimal scoring request
        payload = {
            "scorer_config": {
                "type": "llm",
                "name": "connection_test",
                "model": "gpt-4.1-mini",
                "prompt": "Respond with exactly: {\"score\": 1.0, \"reasoning\": \"test\"}",
                "temperature": 0.0,
                "max_tokens": 50,
            },
            "org": HARNESS_EVAL_ORG,
            "project": HARNESS_EVAL_PROJECT,
        }
        url = f"{HARNESS_EVAL_API_URL.rstrip('/')}/evaluate/scorer/score"
        result = _harness_eval_request(url, payload, timeout=15)
        return True, f"Connected — response: {str(result)[:100]}"
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")[:200]
        except Exception:
            pass
        return False, f"HTTP {e.code}: {e.reason} — {body}"
    except Exception as e:
        return False, f"Connection failed: {e}"


def _call_judge_harness(prompt: str, model: str, max_retries: int = 2) -> str:
    """Call Harness ai-evals LLM-as-Judge service via REST API.

    Uses the /evaluate/scorer/* endpoint with an LLM judge scorer.
    Falls back to direct Anthropic/OpenAI call if Harness ai-evals is unavailable.
    Retries on transient failures (timeout, 5xx).
    """
    if not HARNESS_EVAL_API_URL or not HARNESS_EVAL_API_TOKEN:
        provider, _ = _get_judge_config()
        print(f"  [harness-judge] HARNESS_EVAL_API_URL or HARNESS_EVAL_API_TOKEN not set, falling back to {provider}")
        return _call_judge_anthropic(prompt, model) if provider == "anthropic" else _call_judge_openai(prompt, model)

    payload = {
        "scorer_config": {
            "type": "llm",
            "name": "scs_answer_quality",
            "model": model,
            "prompt": prompt,
            "temperature": 0.0,
            "max_tokens": 1200,
        },
        "org": HARNESS_EVAL_ORG,
        "project": HARNESS_EVAL_PROJECT,
    }
    url = f"{HARNESS_EVAL_API_URL.rstrip('/')}/evaluate/scorer/score"

    last_error = None
    for attempt in range(max_retries + 1):
        try:
            result = _harness_eval_request(url, payload, timeout=30)
            # ai-evals returns: {"score": {"value": float, "comment": str, ...}}
            # or directly: {"value": float, "reasoning": str}
            if isinstance(result, dict):
                score_obj = result.get("score", result.get("result", result))
                if isinstance(score_obj, dict):
                    score_val = score_obj.get("value", score_obj.get("score"))
                    reasoning = score_obj.get("comment", score_obj.get("reasoning", ""))
                    if score_val is not None:
                        return json.dumps({"score": float(score_val), "reasoning": str(reasoning)})
                # Try parsing the response as a direct score
                if "score" in result and isinstance(result["score"], (int, float)):
                    return json.dumps({"score": float(result["score"]), "reasoning": result.get("reasoning", "")})
            return json.dumps({"score": 0.5, "reasoning": f"Unexpected response format: {str(result)[:200]}"})
        except urllib.error.HTTPError as e:
            last_error = e
            # Retry on 5xx or 429 (rate limit)
            if e.code >= 500 or e.code == 429:
                if attempt < max_retries:
                    wait = 2 ** attempt
                    print(f"  [harness-judge] HTTP {e.code}, retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait)
                    continue
            # Non-retryable error — fall back
            break
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
            last_error = e
            if attempt < max_retries:
                time.sleep(2 ** attempt)
                continue
            break
        except Exception as e:
            return f"JUDGE_ERROR: {e}"

    # All retries exhausted — fall back to direct provider
    provider, _ = _get_judge_config()
    print(f"  [harness-judge] API error after {max_retries + 1} attempts: {last_error}, falling back to {provider}")
    return _call_judge_anthropic(prompt, model) if provider == "anthropic" else _call_judge_openai(prompt, model)


HARNESS_JUDGE_RUBRIC_PROMPT = """You are an expert evaluator for an AI agent that assists with Software Supply Chain Security (SCS).

## User Query
{query}

## Agent's Response
{answer}

## Expected Behavior
{observe}

## Tools Called by Agent
{tools_called}

## Actual Tool Results (API Responses)
{tool_results}

## Multi-Criteria Rubric
Evaluate the response on EACH criterion independently (0.0-1.0), then compute a weighted average.

### 1. Task Completion (weight: 0.35)
- 1.0: Fully addresses the user's request with complete, actionable information
- 0.5: Partially addresses the request; some key information missing
- 0.0: Fails to address the request or provides empty/irrelevant response

### 2. Tool Usage Correctness (weight: 0.25)
- 1.0: Uses the correct tools with correct parameters; no hallucinated tool calls
- 0.5: Uses some correct tools but misses key ones or uses wrong parameters
- 0.0: Uses completely wrong tools or fails to use any tools

### 3. Factual Accuracy (weight: 0.20)
- 1.0: All claims in the response are directly supported by the Actual Tool Results above; no hallucinated data
- 0.5: Mostly accurate but some minor inconsistencies or unsupported claims vs the tool results
- 0.0: Contains significant hallucinations or fabricated data not present in tool results

### 4. Response Quality (weight: 0.20)
- 1.0: Well-structured, clear, and actionable; appropriate level of detail
- 0.5: Understandable but poorly organized or missing context
- 0.0: Incoherent, overly verbose, or unusable

## Evaluation Instructions (Chain-of-Thought)
You MUST reason step-by-step before scoring. Follow this process exactly:

Step 1: Read the user query and identify what was asked.
Step 2: Check which tools were called and whether they match the expected behavior.
Step 3: Compare the agent's response against the actual tool results — flag any claims not supported by the data.
Step 4: Assess the overall response structure, clarity, and actionability.
Step 5: Assign a score (0.0-1.0) to each criterion based on your analysis above.
Step 6: Compute the weighted average: score = 0.35*task_completion + 0.25*tool_usage + 0.20*factual_accuracy + 0.20*response_quality.

## Output Format
First write your step-by-step analysis (Steps 1-6 above), then output the final scores as a JSON object on its own line:
{{"task_completion": <float>, "tool_usage": <float>, "factual_accuracy": <float>, "response_quality": <float>, "score": <weighted_average_float>, "reasoning": "<one-sentence summary>"}}"""


JUDGE_PROMPT_TEMPLATE = """You are evaluating an AI assistant's response to a user query about software supply chain security (SCS).

## User Query
{query}

## Assistant's Response
{answer}

## Expected Behavior
{observe}

## Tools Called
{tools_called}

## Actual Tool Results (API Responses)
{tool_results}

## Evaluation Criteria
Score the response on a scale of 0.0 to 1.0:
- **1.0**: Response fully addresses the query, uses correct tools, provides accurate and actionable information
- **0.75**: Response mostly addresses the query but misses minor details or has slight inaccuracies
- **0.5**: Response partially addresses the query, key information is missing or incorrect
- **0.25**: Response barely addresses the query, mostly irrelevant or incorrect
- **0.0**: Response fails to address the query, is completely wrong, or is empty

Consider:
1. Does the response answer what the user actually asked?
2. Is the information factually consistent with the Actual Tool Results provided above?
3. Is the response well-structured and actionable?
4. Does it avoid hallucinating data that is not present in the tool results?

## Output Format
Respond with ONLY a JSON object (no markdown):
{{"score": <float 0.0-1.0>, "reasoning": "<brief explanation>"}}"""


def answer_quality_evaluator(*, input: Any, output: Any, expected_output: Any, **kwargs) -> dict:
    """LLM-as-Judge evaluation of answer quality.

    Uses a fast model to evaluate whether the final answer is correct,
    complete, well-formatted, and addresses the user's query.
    """
    judge_provider, judge_model = _get_judge_config()

    query = input.get("query", "") if isinstance(input, dict) else str(input)
    observe = expected_output.get("observe", "") if isinstance(expected_output, dict) else ""

    answer = ""
    tools_called_str = "(none)"
    if isinstance(output, dict):
        answer = output.get("answer", "") or output.get("final_answer", "")
        tools = output.get("tools_called", [])
        tools_called_str = ", ".join(_fmt_tool(t) for t in tools) if tools else "(none)"
    elif isinstance(output, str):
        answer = output

    if not answer or len(answer.strip()) < 10:
        return {"name": "answer_quality", "value": 0.0,
                "comment": "No answer to evaluate"}

    tool_results_str = _fmt_tool_results(output) if isinstance(output, dict) else "(none)"

    prompt = JUDGE_PROMPT_TEMPLATE.format(
        query=query,
        answer=answer[:MAX_ANSWER_IN_PROMPT],
        observe=observe,
        tools_called=tools_called_str,
        tool_results=tool_results_str,
    )

    if judge_provider == "anthropic":
        raw = _call_judge_anthropic(prompt, judge_model)
    else:
        raw = _call_judge_openai(prompt, judge_model)

    if raw.startswith("JUDGE_ERROR"):
        return {"name": "answer_quality", "value": None, "comment": raw}

    try:
        # Extract JSON from response (handle potential markdown wrapping)
        json_match = re.search(r'\{[^{}]*"score"[^{}]*\}', raw)
        if json_match:
            result = json.loads(json_match.group())
            score = float(result.get("score", 0))
            reasoning = result.get("reasoning", "")
            return {"name": "answer_quality", "value": round(min(max(score, 0.0), 1.0), 3),
                    "comment": reasoning[:MAX_COMMENT_LEN]}
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    return {"name": "answer_quality", "value": None,
            "comment": f"Failed to parse judge response: {raw[:200]}"}


# ---------------------------------------------------------------------------
# Run-Level Aggregate Evaluators
# ---------------------------------------------------------------------------

def _stddev(values: list[float]) -> float:
    """Population standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def aggregate_trajectory_accuracy(*, item_results: list, **kwargs) -> dict:
    """Average trajectory score across all items."""
    scores = [
        r["evaluations"]["trajectory"]["value"]
        for r in item_results
        if r.get("evaluations", {}).get("trajectory", {}).get("value") is not None
    ]
    if not scores:
        return {"name": "avg_trajectory_accuracy", "value": None, "comment": "No trajectory scores"}
    avg = sum(scores) / len(scores)
    sd = _stddev(scores)
    return {"name": "avg_trajectory_accuracy", "value": round(avg, 3),
            "comment": f"Average over {len(scores)} items: {avg:.1%} (σ={sd:.3f})"}


def aggregate_pass_rate(*, item_results: list, **kwargs) -> dict:
    """Percentage of items with trajectory score == 1.0 (fully correct)."""
    scores = [
        r["evaluations"]["trajectory"]["value"]
        for r in item_results
        if r.get("evaluations", {}).get("trajectory", {}).get("value") is not None
    ]
    if not scores:
        return {"name": "pass_rate", "value": None, "comment": "No scores"}
    passed = sum(1 for s in scores if s == 1.0)
    rate = passed / len(scores)
    return {"name": "pass_rate", "value": round(rate, 3),
            "comment": f"{passed}/{len(scores)} passed ({rate:.1%})"}


# Approximate per-token costs (USD) for common models — used for cost estimation
_TOKEN_COST_PER_1K = {
    "claude-sonnet-4-20250514": {"prompt": 0.003, "completion": 0.015},
    "gpt-4.1-mini": {"prompt": 0.0004, "completion": 0.0016},
    "gpt-4.1": {"prompt": 0.002, "completion": 0.008},
}
_DEFAULT_COST_PER_1K = {"prompt": 0.003, "completion": 0.015}  # conservative default


def aggregate_token_cost(*, item_results: list, **kwargs) -> dict:
    """Aggregate token usage and estimated cost across all items.

    Reads token_usage from each item's output dict and computes totals.
    Returns the total token count as the value and cost breakdown as comment.
    """
    total_prompt = 0
    total_completion = 0
    items_with_usage = 0
    for r in item_results:
        usage = r.get("token_usage", {})
        if not usage:
            # Try extracting from evaluations metadata
            continue
        p = usage.get("prompt_tokens", 0)
        c = usage.get("completion_tokens", 0)
        if p or c:
            total_prompt += p
            total_completion += c
            items_with_usage += 1

    total = total_prompt + total_completion
    if total == 0:
        return {"name": "token_cost", "value": None, "comment": "No token usage data"}

    # Estimate cost using default model pricing
    model = os.getenv("EVAL_JUDGE_MODEL", "claude-sonnet-4-20250514")
    costs = _TOKEN_COST_PER_1K.get(model, _DEFAULT_COST_PER_1K)
    est_cost = (total_prompt / 1000 * costs["prompt"]) + (total_completion / 1000 * costs["completion"])

    return {
        "name": "token_cost",
        "value": total,
        "comment": f"prompt={total_prompt:,} completion={total_completion:,} total={total:,} "
                   f"est_cost=${est_cost:.2f} ({items_with_usage} items, model={model})",
    }


def aggregate_quality_coverage(*, item_results: list, **kwargs) -> dict:
    """Percentage of items with judge score >= QUALITY_COVERAGE_THRESHOLD.

    Inspired by Sumeet Rai's Remediation Quality Index (RQI) coverage metric.
    Uses harness_judge_score if available, falls back to answer_quality.
    """
    scores = []
    for r in item_results:
        evals = r.get("evaluations", {})
        val = (evals.get("harness_judge_score", {}).get("value")
               or evals.get("answer_quality", {}).get("value"))
        if val is not None:
            scores.append(val)

    if not scores:
        return {"name": "quality_coverage", "value": None,
                "comment": "No judge scores available"}

    above = sum(1 for s in scores if s >= QUALITY_COVERAGE_THRESHOLD)
    rate = above / len(scores)
    return {
        "name": "quality_coverage",
        "value": round(rate, 3),
        "comment": f"{above}/{len(scores)} items >= {QUALITY_COVERAGE_THRESHOLD} threshold ({rate:.1%})",
    }


def aggregate_by_category(*, item_results: list, **kwargs) -> dict:
    """Per-category pass rate breakdown using QUERY_CATEGORIES mapping.

    Returns a single aggregate dict with per-category stats in the comment.
    The value is the number of categories with 100% pass rate.
    """
    cat_scores: dict[str, list[float]] = {}
    for r in item_results:
        query_id = r.get("query_id", "")
        # Strip per-turn suffix (e.g. M01-T1 → M01) for category lookup
        base_id = query_id.split("-T")[0] if "-T" in query_id else query_id
        category = QUERY_CATEGORIES.get(base_id, QUERY_CATEGORIES.get(query_id, "unknown"))
        if category == "unsupported":
            continue
        traj_val = r.get("evaluations", {}).get("trajectory", {}).get("value")
        if traj_val is not None:
            cat_scores.setdefault(category, []).append(traj_val)

    if not cat_scores:
        return {"name": "category_breakdown", "value": None, "comment": "No categorized scores"}

    parts = []
    perfect_cats = 0
    categories_detail = {}
    for cat in sorted(cat_scores.keys()):
        scores = cat_scores[cat]
        avg = sum(scores) / len(scores)
        passed = sum(1 for s in scores if s == 1.0)
        if passed == len(scores):
            perfect_cats += 1
        parts.append(f"{cat}: {passed}/{len(scores)} ({avg:.0%})")
        categories_detail[cat] = {
            "pass_rate": round(passed / len(scores), 3),
            "avg_trajectory": round(avg, 3),
            "passed": passed,
            "total": len(scores),
        }

    return {
        "name": "category_breakdown",
        "value": perfect_cats,
        "comment": f"{perfect_cats}/{len(cat_scores)} categories at 100%. " + "; ".join(parts),
        "categories": categories_detail,
    }


# Confidence level weights for MQI — higher confidence queries matter more
CONFIDENCE_WEIGHTS: dict[str, float] = {
    "Supported": 1.0,
    "High": 1.0,
    "Medium": 0.7,
    "Low": 0.4,
    "N/A": 0.2,
    "": 0.2,       # empty string from query_def.get("confidence", "")
}


def aggregate_mqi(*, item_results: list, **kwargs) -> dict:
    """MCP Quality Index (MQI) — confidence-weighted composite of all evaluator dimensions.

    Combines trajectory, parameters, judge score, latency, error_free, and
    answer_presence into a single 0.0-1.0 score per item. Items are then
    averaged with weights based on their confidence level (Supported/High=1.0,
    Medium=0.7, Low=0.4, N/A=0.2) so that high-confidence queries drive the
    composite score more than exploratory/unsupported ones.
    Inspired by Sumeet Rai's Remediation Quality Index (RQI).
    """
    item_mqis = []  # (mqi_score, confidence_weight)
    for r in item_results:
        evals = r.get("evaluations", {})
        weighted_sum = 0.0
        weight_sum = 0.0
        for metric, weight in MQI_WEIGHTS.items():
            val = evals.get(metric, {}).get("value")
            if val is not None:
                weighted_sum += val * weight
                weight_sum += weight
        if weight_sum > 0:
            mqi_val = weighted_sum / weight_sum
            conf = r.get("confidence", "N/A")
            conf_weight = CONFIDENCE_WEIGHTS.get(conf, 0.5)
            item_mqis.append((mqi_val, conf_weight))

    if not item_mqis:
        return {"name": "mqi", "value": None, "comment": "No evaluator scores available"}

    # Confidence-weighted average
    total_weight = sum(cw for _, cw in item_mqis)
    if total_weight > 0:
        avg_mqi = sum(mqi * cw for mqi, cw in item_mqis) / total_weight
    else:
        avg_mqi = sum(mqi for mqi, _ in item_mqis) / len(item_mqis)

    # Also compute unweighted + stddev for stability insight
    raw_scores = [mqi for mqi, _ in item_mqis]
    unweighted = sum(raw_scores) / len(raw_scores)
    sd = _stddev(raw_scores)

    return {
        "name": "mqi",
        "value": round(avg_mqi, 3),
        "comment": f"MCP Quality Index: {avg_mqi:.1%} (confidence-weighted) / "
                   f"{unweighted:.1%} (unweighted) over {len(item_mqis)} items "
                   f"(σ={sd:.3f})",
    }


# ---------------------------------------------------------------------------
# Evaluator Registry
# ---------------------------------------------------------------------------

# Fast evaluators (deterministic, no LLM calls)
FAST_EVALUATORS = [
    trajectory_evaluator,
    trajectory_order_evaluator,
    parameter_evaluator,
    latency_evaluator,
    error_evaluator,
    answer_presence_evaluator,
]

# Full evaluators (includes LLM-as-Judge — adds cost and latency)
FULL_EVALUATORS = FAST_EVALUATORS + [
    answer_quality_evaluator,
]

RUN_EVALUATORS = [
    aggregate_trajectory_accuracy,
    aggregate_pass_rate,
    aggregate_token_cost,
    aggregate_quality_coverage,
    aggregate_by_category,
    aggregate_mqi,
]

# ---------------------------------------------------------------------------
# Regression Detection
# ---------------------------------------------------------------------------

# Thresholds: if a metric drops by more than this fraction, flag it as a regression
REGRESSION_THRESHOLDS = {
    "correct_rate": 0.05,        # 5% drop in correct rate
    "avg_trajectory_accuracy": 0.05,
    "pass_rate": 0.05,
    "quality_coverage": 0.05,    # 5% drop in items above judge threshold
    "mqi": 0.05,                 # 5% drop in MCP Quality Index
    "avg_duration_s": 0.20,      # 20% increase threshold (lower is better)
    "total_tokens": 0.15,        # 15% increase threshold (lower is better)
}


def detect_regressions(current_summary: dict, previous_summary_path: str) -> list[dict]:
    """Compare current run metrics against the previous run and flag regressions.

    Returns a list of {metric, current, previous, delta, status} dicts.
    status is one of: "regression", "improvement", "stable".
    """
    import pathlib
    prev_path = pathlib.Path(previous_summary_path)
    if not prev_path.exists():
        return [{"metric": "_baseline", "status": "no_previous",
                 "comment": f"No previous run found at {previous_summary_path}"}]

    try:
        with open(prev_path) as f:
            prev = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        return [{"metric": "_baseline", "status": "error", "comment": f"Failed to load previous: {e}"}]

    results = []
    cur_s = current_summary.get("summary", {})
    prev_s = prev.get("summary", {})

    # Correct rate
    cur_total = cur_s.get("total_queries", 0)
    prev_total = prev_s.get("total_queries", 0)
    if cur_total > 0 and prev_total > 0:
        cur_rate = cur_s.get("tool_selection_correct", 0) / cur_total
        prev_rate = prev_s.get("tool_selection_correct", 0) / prev_total
        results.append(_compare_metric("correct_rate", cur_rate, prev_rate, higher_is_better=True))

    # Avg duration
    cur_dur = cur_s.get("avg_duration_s", 0)
    prev_dur = prev_s.get("avg_duration_s", 0)
    if cur_dur > 0 and prev_dur > 0:
        results.append(_compare_metric("avg_duration_s", cur_dur, prev_dur, higher_is_better=False))

    # Total tokens
    cur_tok = cur_s.get("total_tokens", 0)
    prev_tok = prev_s.get("total_tokens", 0)
    if cur_tok > 0 and prev_tok > 0:
        results.append(_compare_metric("total_tokens", cur_tok, prev_tok, higher_is_better=False))

    # Run aggregates (if both have them)
    cur_agg = current_summary.get("run_aggregates", {})
    prev_agg = prev.get("run_aggregates", {})
    for metric_name in ("avg_trajectory_accuracy", "pass_rate", "quality_coverage", "mqi"):
        cur_val = cur_agg.get(metric_name, {}).get("value")
        prev_val = prev_agg.get(metric_name, {}).get("value")
        if cur_val is not None and prev_val is not None:
            results.append(_compare_metric(metric_name, cur_val, prev_val, higher_is_better=True))

    # Per-category regression detection
    cur_cats = cur_agg.get("category_breakdown", {}).get("categories", {})
    prev_cats = prev_agg.get("category_breakdown", {}).get("categories", {})
    if cur_cats and prev_cats:
        for cat in sorted(set(cur_cats) | set(prev_cats)):
            cur_pr = cur_cats.get(cat, {}).get("pass_rate")
            prev_pr = prev_cats.get(cat, {}).get("pass_rate")
            if cur_pr is not None and prev_pr is not None:
                results.append(_compare_metric(
                    f"category:{cat}", cur_pr, prev_pr, higher_is_better=True
                ))

    return results


def detect_flaky_queries(current_summary: dict, results_dir: str,
                         history_depth: int = 5) -> list[dict]:
    """Detect queries whose tool_selection flips between runs.

    Loads up to `history_depth` previous summary files (sorted by modification
    time) and builds a per-query history of tool_selection outcomes. A query is
    flagged as "flaky" if it has 2+ distinct outcomes across the window.

    Returns a list of {query_id, history, distinct_outcomes, flaky} dicts.
    """
    import pathlib, glob

    results_path = pathlib.Path(results_dir)
    # Find all timestamped result files, sorted newest-first
    pattern = str(results_path / "smoke_test_results_*.json")
    history_files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)

    # Build per-query history: {query_id: [outcome1, outcome2, ...]}
    query_history: dict[str, list[str]] = {}

    # Add current run first (single-turn + multi-turn)
    for r in current_summary.get("results", []):
        qid = r.get("id", "")
        outcome = r.get("scoring", {}).get("tool_selection", "UNKNOWN")
        query_history.setdefault(qid, []).append(outcome)
    for cr in current_summary.get("conversation_results", []):
        qid = cr.get("id", "")
        outcome = cr.get("scoring", {}).get("overall", "UNKNOWN")
        query_history.setdefault(qid, []).append(outcome)

    # Load previous runs (up to history_depth)
    loaded = 0
    for fpath in history_files:
        if loaded >= history_depth:
            break
        try:
            with open(fpath) as f:
                prev = json.load(f)
            for r in prev.get("results", []):
                qid = r.get("id", "")
                outcome = r.get("scoring", {}).get("tool_selection", "UNKNOWN")
                query_history.setdefault(qid, []).append(outcome)
            for cr in prev.get("conversation_results", []):
                qid = cr.get("id", "")
                outcome = cr.get("scoring", {}).get("overall", "UNKNOWN")
                query_history.setdefault(qid, []).append(outcome)
            loaded += 1
        except (json.JSONDecodeError, OSError):
            continue

    # Identify flaky queries (2+ distinct outcomes)
    flaky_results = []
    for qid in sorted(query_history.keys()):
        history = query_history[qid]
        distinct = set(history)
        is_flaky = len(distinct) >= 2 and len(history) >= 2
        if is_flaky:
            flaky_results.append({
                "query_id": qid,
                "history": history[:history_depth + 1],  # most recent first
                "distinct_outcomes": sorted(distinct),
                "flaky": True,
                "flip_count": sum(1 for i in range(1, len(history)) if history[i] != history[i-1]),
            })

    return flaky_results


def _compare_metric(name: str, current: float, previous: float, higher_is_better: bool) -> dict:
    """Compare a single metric and determine regression status."""
    if previous == 0:
        delta_pct = 0.0
    else:
        delta_pct = (current - previous) / abs(previous)

    threshold = REGRESSION_THRESHOLDS.get(name, 0.05)

    if higher_is_better:
        # For metrics where higher = better, regression = current < previous by threshold
        if delta_pct < -threshold:
            status = "regression"
        elif delta_pct > threshold:
            status = "improvement"
        else:
            status = "stable"
    else:
        # For metrics where lower = better (duration, tokens), regression = increase
        if delta_pct > threshold:
            status = "regression"
        elif delta_pct < -threshold:
            status = "improvement"
        else:
            status = "stable"

    return {
        "metric": name, "current": round(current, 4), "previous": round(previous, 4),
        "delta_pct": round(delta_pct * 100, 1), "status": status,
    }


# ---------------------------------------------------------------------------
# Langfuse Integration Layer
# ---------------------------------------------------------------------------

class LangfuseIntegration:
    """Wraps the smoke test execution with Langfuse tracing, experiments, and scoring.

    Features:
        - Experiments: A/B run comparison via dataset_item.link(trace)
        - Session tracking: Per-turn traces with session_id for multi-turn conversations
        - Span-level tracing: Child spans for individual tool calls and LLM generations
        - Harness ai-evals: Rubric-based LLM-as-Judge scoring via REST API

    Usage:
        lf = LangfuseIntegration(enable_judge=True, use_harness_judge=True)
        lf.sync_dataset(queries)
        lf.sync_conversation_dataset(conversations)
        # Post-run: score via _run_langfuse_scoring() in scs_llm_smoke_test.py
        lf.flush()
    """

    def __init__(self, enable_judge: bool = False, experiment_prefix: str = "scs-smoke",
                 use_harness_judge: bool = False):
        try:
            # Try newer SDK (>=3.10.6) first, fall back to legacy constructor
            try:
                from langfuse import get_client
                self._langfuse = get_client()
            except ImportError:
                from langfuse import Langfuse
                self._langfuse = Langfuse(
                    host=LANGFUSE_HOST,
                )
            auth_ok = self._langfuse.auth_check()
            if not auth_ok:
                raise RuntimeError("Langfuse auth check failed — verify LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY")
            print(f"  [langfuse] Connected to {LANGFUSE_HOST}")
        except ImportError:
            raise ImportError("langfuse package not installed. Run: pip install langfuse")

        self._enable_judge = enable_judge
        self._use_harness_judge = use_harness_judge
        self._experiment_prefix = experiment_prefix
        self._judge_provider, self._judge_model = _get_judge_config()
        # Compute prompt version hash for tracking which prompt produced which scores
        prompt_content = JUDGE_PROMPT_TEMPLATE + HARNESS_JUDGE_RUBRIC_PROMPT
        self._prompt_version = hashlib.sha256(prompt_content.encode()).hexdigest()[:12]
        # When harness judge is active, skip answer_quality_evaluator (redundant —
        # the rubric judge in _run_harness_rubric_judge is strictly better).
        # Use FAST_EVALUATORS only; harness rubric scores are added separately.
        if use_harness_judge and enable_judge:
            self._evaluators = FAST_EVALUATORS
        elif enable_judge:
            self._evaluators = FULL_EVALUATORS
        else:
            self._evaluators = FAST_EVALUATORS
        # Experiment run name: prefix + timestamp for unique identification
        self._experiment_run = f"{experiment_prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        # Dataset item caches for experiment linking
        self._single_dataset_items: dict[str, Any] = {}  # query_id -> dataset_item
        self._multi_dataset_items: dict[str, Any] = {}   # conv_id -> dataset_item

        if enable_judge:
            print(f"  [langfuse] Judge prompt version: {self._prompt_version}")

        if use_harness_judge:
            if HARNESS_EVAL_API_URL and HARNESS_EVAL_API_TOKEN:
                ok, msg = validate_harness_eval_connection()
                if ok:
                    print(f"  [langfuse] Harness ai-evals judge CONNECTED ({HARNESS_EVAL_API_URL})")
                else:
                    print(f"  [langfuse] Harness ai-evals connection failed: {msg}")
                    print(f"  [langfuse] Will fallback to direct {self._judge_provider} calls for judging")
            else:
                print(f"  [langfuse] Harness ai-evals judge requested but HARNESS_EVAL_API_URL/TOKEN not set — will fallback to {self._judge_provider}")

    @property
    def experiment_run_name(self) -> str:
        """Return the current experiment run name for display."""
        return self._experiment_run

    def sync_dataset(self, queries: list[dict], dataset_name: str = DATASET_NAME_SINGLE) -> None:
        """Create or update the Langfuse dataset from smoke test query definitions."""
        try:
            self._langfuse.create_dataset(name=dataset_name)
            print(f"  [langfuse] Created dataset '{dataset_name}'")
        except Exception:
            print(f"  [langfuse] Dataset '{dataset_name}' already exists, updating items...")

        for q in queries:
            item = self._langfuse.create_dataset_item(
                dataset_name=dataset_name,
                input={
                    "id": q["id"],
                    "query": q["query"],
                    "confidence": q.get("confidence", "N/A"),
                },
                expected_output={
                    "trajectory": [list(t) for t in q.get("expected_tools", [])],
                    "observe": q.get("observe", ""),
                    "expected_intent": q.get("expected_intent", ""),
                    "confidence": q.get("confidence", "N/A"),
                },
                metadata={
                    "query_id": q["id"],
                    "confidence": q.get("confidence", "N/A"),
                },
            )
            self._single_dataset_items[q["id"]] = item
        print(f"  [langfuse] Synced {len(queries)} items to '{dataset_name}'")

    def sync_conversation_dataset(self, conversations: list[dict],
                                  dataset_name: str = DATASET_NAME_MULTI) -> None:
        """Create or update the Langfuse dataset for multi-turn conversations."""
        try:
            self._langfuse.create_dataset(name=dataset_name)
        except Exception:
            pass

        for conv in conversations:
            item = self._langfuse.create_dataset_item(
                dataset_name=dataset_name,
                input={
                    "id": conv["id"],
                    "title": conv["title"],
                    "description": conv["description"],
                    "turns": [
                        {
                            "turn": t["turn"],
                            "query": t["query"],
                            "expected_tools": [list(x) for x in t.get("expected_tools", [])],
                            "observe": t.get("observe", ""),
                        }
                        for t in conv["turns"]
                    ],
                },
                expected_output={
                    "turn_trajectories": [
                        [list(x) for x in t.get("expected_tools", [])]
                        for t in conv["turns"]
                    ],
                },
                metadata={"conversation_id": conv["id"], "num_turns": len(conv["turns"])},
            )
            self._multi_dataset_items[conv["id"]] = item
        print(f"  [langfuse] Synced {len(conversations)} conversations to '{dataset_name}'")

    # -------------------------------------------------------------------
    # Span-Level Tracing: Creates child spans for each tool call
    # -------------------------------------------------------------------
    def _create_tool_spans(self, root_span: Any, extracted: dict) -> None:
        """Create child spans on a root span for each tool call in the execution.

        Uses SDK v3.7.0 API: root_span.start_span() / root_span.start_generation().
        This enables granular Langfuse UI drill-down into individual tool
        invocations, their parameters, and timing.
        """
        tools_called = extracted.get("tools_called", [])
        tool_params = extracted.get("tool_params", {})
        raw_results = extracted.get("tool_results", {})
        # tool_results may be a list (from extract_tools_from_events) or a dict — normalize
        tool_results = raw_results if isinstance(raw_results, dict) else {}

        for i, tool_spec in enumerate(tools_called):
            tool_name = tool_spec[0] if isinstance(tool_spec, (list, tuple)) else str(tool_spec)
            resource_type = tool_spec[1] if isinstance(tool_spec, (list, tuple)) and len(tool_spec) > 1 else ""
            display_name = f"{tool_name}({resource_type})" if resource_type else tool_name

            # Find matching params and results
            params = tool_params.get(display_name, tool_params.get(tool_name, {}))
            result_data = tool_results.get(display_name, tool_results.get(tool_name, ""))

            child = root_span.start_span(
                name=display_name,
                input=params,
                metadata={
                    "tool_name": tool_name,
                    "resource_type": resource_type,
                    "call_index": i,
                },
            )
            child.update(output=str(result_data)[:MAX_TOOL_RESULT_OUTPUT] if result_data else "")
            child.end()

        # Create a generation span for the LLM's final answer synthesis
        final_answer = extracted.get("final_answer", "")
        token_usage = extracted.get("token_usage", {})
        if final_answer:
            usage = None
            if token_usage:
                usage = {
                    "input": token_usage.get("prompt_tokens", 0),
                    "output": token_usage.get("completion_tokens", 0),
                    "total": token_usage.get("total_tokens", 0),
                }
            _, judge_model = _get_judge_config()
            gen = root_span.start_generation(
                name="answer-synthesis",
                input=f"Synthesize answer from {len(tools_called)} tool calls",
                model=judge_model,
            )
            gen.update(output=final_answer[:MAX_TRACE_OUTPUT], usage_details=usage)
            gen.end()

    # -------------------------------------------------------------------
    # Experiment Linking: Links traces to dataset items for A/B comparison
    # -------------------------------------------------------------------
    def _link_to_dataset_item(self, trace_id: str, query_id: str, is_conversation: bool = False) -> None:
        """Link a trace to its corresponding Langfuse dataset item for experiment tracking.

        Uses SDK v3.7.0 API: dataset_run_items.create() to link trace → item → run.
        This enables the Langfuse Experiments UI to compare runs across different
        model versions, prompt changes, or configuration tweaks.
        """
        items = self._multi_dataset_items if is_conversation else self._single_dataset_items
        dataset_item = items.get(query_id)
        if dataset_item:
            try:
                self._langfuse.api.dataset_run_items.create(
                    request={
                        "datasetItemId": dataset_item.id,
                        "traceId": trace_id,
                        "runName": self._experiment_run,
                    }
                )
            except Exception as e:
                print(f"    [langfuse] Failed to link {query_id} to experiment: {e}")

    # -------------------------------------------------------------------
    # Single-Turn Trace + Score
    # -------------------------------------------------------------------
    def create_trace(self, query_def: dict, extracted: dict, duration_s: float,
                     session_id: Optional[str] = None) -> str:
        """Create a Langfuse trace for a single query execution with span-level detail.

        Uses SDK v3.7.0: start_span() creates a root span (and implicitly a trace),
        then update_trace() sets trace-level metadata (session_id, tags, etc.).
        """
        trace_id = self._langfuse.create_trace_id(seed=f"{self._experiment_run}-{query_def['id']}")
        root = self._langfuse.start_span(
            trace_context={"trace_id": trace_id},
            name=f"scs-smoke-{query_def['id']}",
            input={"query": query_def["query"], "id": query_def["id"]},
        )
        root.update_trace(
            name=f"scs-smoke-{query_def['id']}",
            session_id=session_id,
            input={"query": query_def["query"], "id": query_def["id"]},
            output=extracted.get("final_answer", "")[:MAX_TRACE_OUTPUT],
            metadata={
                "query_id": query_def["id"],
                "confidence": query_def.get("confidence", "N/A"),
                "tools_called": [list(t) for t in extracted.get("tools_called", [])],
                "tool_params": extracted.get("tool_params", {}),
                "duration_s": duration_s,
                "token_usage": extracted.get("token_usage", {}),
                "errors": extracted.get("errors", []),
                "experiment_run": self._experiment_run,
                "prompt_version": self._prompt_version,
                "judge_model": self._judge_model,
                "judge_provider": self._judge_provider,
            },
            tags=["scs-smoke-test", query_def.get("confidence", "N/A"), self._experiment_run],
        )
        # Span-level tracing: create child spans for each tool call
        self._create_tool_spans(root, extracted)
        root.end()
        # Experiment linking: associate trace with dataset item
        self._link_to_dataset_item(trace_id, query_def["id"], is_conversation=False)
        return trace_id

    @staticmethod
    def _build_turn_extracted(turn_result: dict) -> dict:
        """Build a normalized extracted dict from a turn result for scoring/tracing."""
        return {
            "tools_called": [tuple(t) if isinstance(t, list) else t for t in turn_result.get("tools_called", [])],
            "tool_params": turn_result.get("tool_params", {}),
            "tool_results": turn_result.get("tool_results", {}),
            "final_answer": turn_result.get("final_answer", ""),
            "token_usage": turn_result.get("token_usage", {}),
            "chain_depth": len(turn_result.get("tools_called", [])),
        }

    def _push_scores(self, trace_id: Optional[str], scores: dict[str, Any]) -> None:
        """Push a dict of {name: {value, comment}} scores to Langfuse for a trace."""
        if not trace_id:
            return
        for name, score_data in scores.items():
            if score_data.get("value") is not None:
                self._langfuse.create_score(
                    trace_id=trace_id,
                    name=name,
                    value=score_data["value"],
                    comment=score_data.get("comment", "")[:MAX_COMMENT_LEN],
                )

    def score_single_query(self, query_def: dict, extracted: dict, duration_s: float,
                           trace_id: Optional[str] = None) -> dict[str, Any]:
        """Score a single query execution and push scores to Langfuse.

        Returns dict of {evaluator_name: {value, comment}}.
        If use_harness_judge is enabled, uses the Harness ai-evals rubric-based
        scorer instead of the basic LLM-as-Judge prompt.
        """
        output = {
            "answer": extracted.get("final_answer", ""),
            "tools_called": [list(t) for t in extracted.get("tools_called", [])],
            "tool_params": extracted.get("tool_params", {}),
            "tool_results": extracted.get("tool_results", {}),
            "duration_s": duration_s,
            "token_usage": extracted.get("token_usage", {}),
            "errors": extracted.get("errors", []),
            "chain_depth": extracted.get("chain_depth", 0),
        }
        expected_output = {
            "trajectory": [list(t) for t in query_def.get("expected_tools", [])],
            "observe": query_def.get("observe", ""),
            "confidence": query_def.get("confidence", "N/A"),
        }
        input_data = {
            "id": query_def["id"],
            "query": query_def["query"],
            "confidence": query_def.get("confidence", "N/A"),
        }

        scores = {}
        for evaluator in self._evaluators:
            try:
                result = evaluator(
                    input=input_data,
                    output=output,
                    expected_output=expected_output,
                )
                if isinstance(result, dict) and result.get("value") is not None:
                    scores[result["name"]] = {
                        "value": result["value"],
                        "comment": result.get("comment", ""),
                    }
            except Exception as e:
                scores[evaluator.__name__] = {"value": None, "comment": f"Error: {e}"}

        # Harness ai-evals rubric-based judge (additional multi-criteria scoring)
        if self._use_harness_judge and self._enable_judge:
            harness_scores = self._run_harness_rubric_judge(query_def, extracted, trace_id)
            scores.update(harness_scores)

        # Push all scores to Langfuse in one pass
        self._push_scores(trace_id, scores)
        return scores

    def _run_harness_rubric_judge(self, query_def: dict, extracted: dict,
                                  trace_id: Optional[str] = None) -> dict[str, Any]:
        """Run Harness ai-evals rubric-based multi-criteria judge.

        Returns sub-scores for task_completion, tool_usage, factual_accuracy,
        response_quality, and an overall harness_judge_score.
        """
        scores = {}
        tools_str = ", ".join(
            _fmt_tool(t) for t in extracted.get("tools_called", [])
        ) or "(none)"

        tool_results_str = _fmt_tool_results(extracted)

        prompt = HARNESS_JUDGE_RUBRIC_PROMPT.format(
            query=query_def["query"],
            answer=extracted.get("final_answer", "")[:MAX_ANSWER_IN_PROMPT],
            observe=query_def.get("observe", ""),
            tools_called=tools_str,
            tool_results=tool_results_str,
        )

        try:
            provider, model = _get_judge_config()
            logprobs_data = None

            # Try Harness ai-evals first (respects --harness-judge intent)
            raw = _call_judge_harness(prompt, model)

            # If Harness returned an error and provider is OpenAI, retry with
            # direct OpenAI call + logprobs for token probability calibration.
            # When Harness succeeds, trust its response without double-calling.
            if raw.startswith("JUDGE_ERROR") and provider == "openai":
                # Harness failed — retry with direct OpenAI + logprobs
                result = _call_judge_openai(prompt, model, use_logprobs=True)
                if isinstance(result, tuple):
                    raw, logprobs_data = result
                else:
                    raw = result
            elif not raw.startswith("JUDGE_ERROR") and provider == "openai":
                # Harness succeeded — optionally get logprobs via a lightweight
                # OpenAI call for calibration. Skip if it would double cost.
                # We only calibrate when Harness isn't configured (fallback path).
                # When Harness IS configured and returns valid JSON, trust it.
                pass

            if raw.startswith("JUDGE_ERROR"):
                scores["harness_judge_score"] = {"value": None, "comment": raw}
                return scores

            # Parse JSON from CoT response (text reasoning followed by JSON)
            parsed = _extract_json_from_cot(raw)
            if isinstance(parsed, dict) and "score" in parsed:
                overall = float(parsed["score"])
                reasoning = parsed.get("reasoning", "")

                # Apply token probability calibration if logprobs available
                calibrated = _calibrate_score_from_logprobs(logprobs_data, overall)

                scores["harness_judge_score"] = {
                    "value": round(calibrated, 3),
                    "comment": reasoning[:MAX_COMMENT_LEN],
                }
                if calibrated != overall:
                    scores["harness_judge_score"]["comment"] += f" [calibrated: {overall:.3f}→{calibrated:.3f}]"

                # Extract sub-criteria if present
                for criterion in ["task_completion", "tool_usage", "factual_accuracy", "response_quality"]:
                    if criterion in parsed:
                        val = float(parsed[criterion])
                        scores[f"hj_{criterion}"] = {"value": round(val, 3), "comment": ""}

                # Push all sub-scores to Langfuse
                self._push_scores(trace_id, scores)
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            scores["harness_judge_score"] = {"value": None, "comment": f"Parse error: {e}"}

        return scores

    # -------------------------------------------------------------------
    # Multi-Turn Conversation: Session Tracking + Per-Turn Traces
    # -------------------------------------------------------------------
    def create_conversation_trace(self, conv_def: dict, turn_results: list[dict],
                                  total_duration: float) -> str:
        """Create Langfuse traces for a multi-turn conversation with session tracking.

        Creates:
        1. A parent trace for the overall conversation
        2. Per-turn child traces linked via session_id for turn-level analysis
        3. Tool call spans within each turn trace
        """
        session_id = f"scs-smoke-{conv_def['id']}-{self._experiment_run}"

        # Parent conversation trace via start_span + update_trace (SDK v3.7.0)
        parent_trace_id = self._langfuse.create_trace_id(seed=f"{self._experiment_run}-{conv_def['id']}")
        parent_root = self._langfuse.start_span(
            trace_context={"trace_id": parent_trace_id},
            name=f"scs-smoke-{conv_def['id']}",
            input={"id": conv_def["id"], "title": conv_def["title"]},
        )
        parent_root.update_trace(
            name=f"scs-smoke-{conv_def['id']}",
            session_id=session_id,
            input={"id": conv_def["id"], "title": conv_def["title"],
                   "turns": [t["query"] for t in conv_def["turns"]]},
            output=json.dumps({
                "turns": [
                    {
                        "turn": tr.get("turn"),
                        "tool_selection": tr.get("tool_selection"),
                        "tools_called": tr.get("tools_called", []),
                        "answer_preview": tr.get("final_answer", "")[:200],
                    }
                    for tr in turn_results
                ],
            }),
            metadata={
                "conversation_id": conv_def["id"],
                "num_turns": len(conv_def["turns"]),
                "total_duration_s": total_duration,
                "experiment_run": self._experiment_run,
                "prompt_version": self._prompt_version,
                "judge_model": self._judge_model,
                "judge_provider": self._judge_provider,
            },
            tags=["scs-smoke-test", "multi-turn", self._experiment_run],
        )
        parent_root.end()

        # Per-turn traces with same session_id for session tracking
        for turn_def, turn_result in zip(conv_def["turns"], turn_results):
            turn_num = turn_def["turn"]
            turn_trace_id = self._langfuse.create_trace_id(
                seed=f"{self._experiment_run}-{conv_def['id']}-T{turn_num}"
            )
            turn_root = self._langfuse.start_span(
                trace_context={"trace_id": turn_trace_id},
                name=f"scs-smoke-{conv_def['id']}-T{turn_num}",
                input={"query": turn_def["query"], "turn": turn_num},
            )
            turn_root.update_trace(
                name=f"scs-smoke-{conv_def['id']}-T{turn_num}",
                session_id=session_id,
                input={"query": turn_def["query"], "turn": turn_num,
                       "conversation_id": conv_def["id"]},
                output=turn_result.get("final_answer", "")[:MAX_TRACE_OUTPUT],
                metadata={
                    "turn": turn_num,
                    "conversation_id": conv_def["id"],
                    "tool_selection": turn_result.get("tool_selection"),
                    "tools_called": turn_result.get("tools_called", []),
                    "duration_s": turn_result.get("duration_s", 0),
                },
                tags=["scs-smoke-test", "multi-turn", f"turn-{turn_num}"],
            )
            # Span-level tracing for each turn's tool calls
            self._create_tool_spans(turn_root, self._build_turn_extracted(turn_result))
            turn_root.end()

        # Experiment linking: associate parent trace with dataset item
        self._link_to_dataset_item(parent_trace_id, conv_def["id"], is_conversation=True)

        return parent_trace_id

    def score_conversation(self, conv_def: dict, turn_results: list[dict],
                           total_duration: float, trace_id: Optional[str] = None) -> dict[str, Any]:
        """Score a full conversation and push aggregate scores to Langfuse.

        When judge is enabled, runs LLM-as-Judge on each turn and computes
        an aggregate conversation-level judge score.

        Returns conversation-level scores dict. Also attaches per-turn score
        dicts directly onto each turn_result as ``turn_result["langfuse_scores"]``
        so downstream MQI aggregation can include individual turn contributions.
        """
        scores = {}

        # Per-turn trajectory scores
        turn_trajectory_scores = []
        for i, (turn_def, turn_result) in enumerate(zip(conv_def["turns"], turn_results)):
            expected = [list(t) for t in turn_def.get("expected_tools", [])]
            actual = turn_result.get("tools_called", [])
            if not expected:
                turn_trajectory_scores.append(1.0)
                continue
            result = trajectory_evaluator(
                output={"tools_called": actual},
                expected_output={"trajectory": expected},
            )
            turn_trajectory_scores.append(result.get("value", 0.0))

        # Aggregate turn accuracy
        if turn_trajectory_scores:
            avg_turn_score = sum(turn_trajectory_scores) / len(turn_trajectory_scores)
            scores["turn_trajectory_avg"] = {
                "value": round(avg_turn_score, 3),
                "comment": f"Per-turn scores: {[round(s, 2) for s in turn_trajectory_scores]}",
            }

        # Turns correct count
        turns_with_expected = sum(1 for t in conv_def["turns"] if t.get("expected_tools"))
        turns_correct = sum(1 for s in turn_trajectory_scores if s == 1.0)
        if turns_with_expected > 0:
            scores["turns_correct_rate"] = {
                "value": round(turns_correct / turns_with_expected, 3),
                "comment": f"{turns_correct}/{turns_with_expected} turns fully correct",
            }

        # Per-turn LLM-as-Judge scoring (when judge is enabled)
        turn_judge_scores = []
        if self._enable_judge:
            for i, (turn_def, turn_result) in enumerate(zip(conv_def["turns"], turn_results)):
                turn_num = turn_def.get("turn", i + 1)
                turn_extracted = self._build_turn_extracted(turn_result)
                turn_query_def = {
                    "id": f"{conv_def['id']}-T{turn_num}",
                    "query": turn_def["query"],
                    "expected_tools": turn_def.get("expected_tools", []),
                    "observe": turn_def.get("observe", ""),
                }

                # Get per-turn trace ID for score attachment
                turn_trace_id = None
                try:
                    turn_trace_id = self._langfuse.create_trace_id(
                        seed=f"{self._experiment_run}-{conv_def['id']}-T{turn_num}"
                    )
                except Exception:
                    pass

                if self._use_harness_judge:
                    turn_scores = self._run_harness_rubric_judge(
                        turn_query_def, turn_extracted, trace_id=turn_trace_id
                    )
                    judge_val = turn_scores.get("harness_judge_score", {}).get("value")
                else:
                    # Use answer_quality_evaluator for basic judge
                    output = {
                        "answer": turn_extracted.get("final_answer", ""),
                        "tools_called": [list(t) for t in turn_extracted.get("tools_called", [])],
                        "tool_results": turn_extracted.get("tool_results", []),
                    }
                    expected_output = {
                        "trajectory": [list(t) for t in turn_def.get("expected_tools", [])],
                        "observe": turn_def.get("observe", ""),
                    }
                    aq_result = answer_quality_evaluator(
                        input={"id": turn_query_def["id"], "query": turn_def["query"]},
                        output=output,
                        expected_output=expected_output,
                    )
                    judge_val = aq_result.get("value")
                    if turn_trace_id and judge_val is not None:
                        self._langfuse.create_score(
                            trace_id=turn_trace_id,
                            name="answer_quality",
                            value=judge_val,
                            comment=aq_result.get("comment", "")[:500],
                        )

                if judge_val is not None:
                    turn_judge_scores.append(judge_val)

            # Aggregate conversation-level judge score
            if turn_judge_scores:
                avg_judge = sum(turn_judge_scores) / len(turn_judge_scores)
                score_name = "harness_judge_score" if self._use_harness_judge else "answer_quality_avg"
                scores[score_name] = {
                    "value": round(avg_judge, 3),
                    "comment": f"Per-turn: {[round(s, 2) for s in turn_judge_scores]}",
                }

        # Latency — per-turn average
        per_turn_avg_dur = total_duration / max(len(turn_results), 1)

        # Errors
        all_errors = [e for tr in turn_results for e in tr.get("errors", [])]
        scores["error_free"] = {
            "value": 1.0 if not all_errors else 0.0,
            "comment": "No errors" if not all_errors else f"Errors: {all_errors[:3]}",
        }

        # Latency (conversation level)
        lat_result = latency_evaluator(output={"duration_s": total_duration})
        scores["latency"] = {"value": lat_result["value"], "comment": lat_result["comment"]}

        # --- Build per-turn score dicts and attach to turn_results ---
        for i, turn_result in enumerate(turn_results):
            turn_lf: dict[str, Any] = {}
            # Trajectory
            if i < len(turn_trajectory_scores):
                turn_lf["trajectory"] = {
                    "value": round(turn_trajectory_scores[i], 3),
                    "comment": "",
                }
            # Judge score
            if i < len(turn_judge_scores):
                judge_name = "harness_judge_score" if self._use_harness_judge else "answer_quality"
                turn_lf[judge_name] = {
                    "value": round(turn_judge_scores[i], 3),
                    "comment": "",
                }
            # Latency (per-turn)
            turn_dur = turn_result.get("duration_s", per_turn_avg_dur)
            turn_lat = latency_evaluator(output={"duration_s": turn_dur})
            turn_lf["latency"] = {"value": turn_lat["value"], "comment": turn_lat["comment"]}
            # Error-free (per-turn)
            turn_errors = turn_result.get("errors", [])
            turn_lf["error_free"] = {
                "value": 1.0 if not turn_errors else 0.0,
                "comment": "No errors" if not turn_errors else f"Errors: {turn_errors[:3]}",
            }
            turn_result["langfuse_scores"] = turn_lf

        # Push to Langfuse
        self._push_scores(trace_id, scores)
        return scores

    def push_run_aggregates(self, aggregates: dict[str, Any]) -> Optional[str]:
        """Create a run-summary trace in Langfuse and attach aggregate scores.

        This makes run-level metrics (avg_trajectory_accuracy, pass_rate,
        token_cost) visible in the Langfuse UI alongside per-query traces.
        Returns the trace_id of the summary trace.
        """
        if not aggregates:
            return None
        try:
            trace_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"run-summary-{self._experiment_run}"))
            root = self._langfuse.start_span(
                trace_context={"trace_id": trace_id},
                name=f"Run Summary: {self._experiment_run}",
                input={"experiment_run": self._experiment_run, "aggregates": aggregates},
            )
            root.update_trace(
                session_id=self._experiment_run,
                tags=["run-summary", "aggregate"],
                metadata={"experiment_run": self._experiment_run},
            )
            root.end()

            for name, data in aggregates.items():
                if data.get("value") is not None:
                    self._langfuse.create_score(
                        trace_id=trace_id,
                        name=name,
                        value=data["value"],
                        comment=data.get("comment", "")[:500],
                    )
            print(f"  [langfuse] Pushed {len(aggregates)} run-level scores to trace {trace_id}")
            return trace_id
        except Exception as e:
            print(f"  [langfuse] Failed to push run aggregates: {e}")
            return None

    def flush(self) -> None:
        """Flush all pending Langfuse events."""
        try:
            self._langfuse.flush()
            print("  [langfuse] Flushed all events")
        except Exception as e:
            print(f"  [langfuse] Flush error: {e}")

    def shutdown(self) -> None:
        """Shutdown Langfuse client."""
        try:
            self._langfuse.flush()
            self._langfuse.shutdown()
        except Exception:
            pass
