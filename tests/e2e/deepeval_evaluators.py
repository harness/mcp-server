"""
Optional DeepEval G-Eval integration for SCS MCP smoke tests.

Provides battle-tested G-Eval metrics (chain-of-thought + token probability
calibration) as drop-in replacements for the hand-rolled LLM-as-Judge in
langfuse_evaluators.py.

Usage:
  pip install deepeval
  python scs_llm_smoke_test.py --langfuse --deepeval

Metrics provided:
  - tool_correctness: G-Eval metric for tool selection quality
  - answer_quality:   G-Eval metric for response completeness and accuracy
  - faithfulness:     Checks claims against actual tool results (anti-hallucination)

These metrics use the G-Eval paper's methodology:
  1. Chain-of-thought reasoning before scoring
  2. Token probability calibration for reliable continuous scores
  3. Custom evaluation criteria per metric

Environment variables:
  DEEPEVAL_MODEL       - Model for G-Eval judge (default: gpt-4.1-mini)
  OPENAI_API_KEY       - Required for DeepEval's default OpenAI backend

References:
  - G-Eval paper: https://arxiv.org/abs/2303.16634
  - DeepEval docs: https://docs.confident-ai.com/docs/metrics-llm-evals
  - Inspired by Sumeet Rai's AI Remediation Evaluation Framework
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Lazy import — DeepEval is an optional dependency
# ---------------------------------------------------------------------------
def _check_deepeval() -> bool:
    """Check if deepeval is installed."""
    try:
        import deepeval  # noqa: F401
        return True
    except ImportError:
        return False


def _get_deepeval_model() -> str:
    """Return the model string for DeepEval metrics."""
    return os.getenv("DEEPEVAL_MODEL", "gpt-4.1-mini")


# ---------------------------------------------------------------------------
# G-Eval Metric Definitions
# ---------------------------------------------------------------------------

# Tool selection quality — evaluates whether the agent chose the right tools
TOOL_CORRECTNESS_CRITERIA = """\
Evaluate whether the AI agent selected the correct MCP tools (harness_list, \
harness_get, harness_execute, harness_describe) with the correct resource_type \
parameters to fulfill the user's request about software supply chain security.

Consider:
1. Were the essential tools called? Missing a critical tool in the chain is a major flaw.
2. Were the resource_types correct? Using scs_artifact_source vs code_repo_security \
   vs artifact_security matters — each serves a different purpose.
3. Was the tool chain ordered logically? (e.g., list sources before getting details)
4. Were extra unnecessary tools called? Minor penalty for noise, but not a failure.
5. Were parameters correct? (e.g., correct artifact_id, purl, enforcement_id extracted \
   from previous tool results)
"""

# Answer quality — evaluates the final response
ANSWER_QUALITY_CRITERIA = """\
Evaluate the quality of the AI agent's final response to the user's software \
supply chain security query.

Consider:
1. Task completion: Does the response fully address what the user asked?
2. Accuracy: Are all claims directly supported by the tool results? No hallucinated data.
3. Actionability: Can the user take concrete action based on this response?
4. Clarity: Is the response well-structured and easy to understand?
5. Appropriate detail level: Not too verbose, not too terse.
"""

# Faithfulness — anti-hallucination check against tool results
FAITHFULNESS_CRITERIA = """\
Evaluate whether every factual claim in the agent's response is directly \
supported by the actual tool results (API responses) provided.

A claim is unfaithful if:
- It states specific numbers, names, or values not present in the tool results
- It fabricates security findings, vulnerability counts, or component details
- It references entities (artifacts, repos, components) not returned by any tool
- It makes definitive statements about security status without supporting data

Minor rephrasing or summarization of tool results is acceptable. \
Extrapolation or inference beyond the data is not.
"""


def create_geval_metrics() -> list:
    """Create DeepEval G-Eval metric instances.

    Returns a list of (name, metric) tuples. Each metric can be evaluated
    via metric.measure(test_case).
    """
    try:
        from deepeval.metrics import GEval
        from deepeval.test_case import LLMTestCaseParams
    except ImportError:
        raise ImportError(
            "deepeval package not installed. Run: pip install deepeval"
        )

    model = _get_deepeval_model()

    tool_correctness = GEval(
        name="deepeval_tool_correctness",
        criteria=TOOL_CORRECTNESS_CRITERIA,
        evaluation_params=[
            LLMTestCaseParams.INPUT,
            LLMTestCaseParams.ACTUAL_OUTPUT,
            LLMTestCaseParams.EXPECTED_OUTPUT,
        ],
        model=model,
        threshold=0.7,
    )

    answer_quality = GEval(
        name="deepeval_answer_quality",
        criteria=ANSWER_QUALITY_CRITERIA,
        evaluation_params=[
            LLMTestCaseParams.INPUT,
            LLMTestCaseParams.ACTUAL_OUTPUT,
            LLMTestCaseParams.EXPECTED_OUTPUT,
        ],
        model=model,
        threshold=0.7,
    )

    faithfulness = GEval(
        name="deepeval_faithfulness",
        criteria=FAITHFULNESS_CRITERIA,
        evaluation_params=[
            LLMTestCaseParams.INPUT,
            LLMTestCaseParams.ACTUAL_OUTPUT,
            LLMTestCaseParams.RETRIEVAL_CONTEXT,
        ],
        model=model,
        threshold=0.7,
    )

    return [
        ("deepeval_tool_correctness", tool_correctness),
        ("deepeval_answer_quality", answer_quality),
        ("deepeval_faithfulness", faithfulness),
    ]


def _fmt_tool(spec: Any) -> str:
    if isinstance(spec, (list, tuple)) and len(spec) == 2:
        return f"{spec[0]}({spec[1]})"
    return str(spec)


def build_test_case(query_def: dict, extracted: dict) -> Any:
    """Build a DeepEval LLMTestCase from smoke test data.

    Maps our internal data format to DeepEval's expected structure:
    - input: user query
    - actual_output: agent's final answer + tool call summary
    - expected_output: expected behavior description
    - retrieval_context: actual tool results (for faithfulness check)
    """
    from deepeval.test_case import LLMTestCase

    # Build actual_output: answer + tool summary
    answer = extracted.get("final_answer", "")
    tools = extracted.get("tools_called", [])
    tools_str = ", ".join(_fmt_tool(t) for t in tools) if tools else "(none)"
    actual_output = f"Tools called: {tools_str}\n\nResponse:\n{answer}"

    # Build expected_output from query definition
    expected_parts = []
    expected_tools = query_def.get("expected_tools", [])
    if expected_tools:
        expected_parts.append(
            f"Expected tools: {', '.join(_fmt_tool(t) for t in expected_tools)}"
        )
    observe = query_def.get("observe", "")
    if observe:
        expected_parts.append(f"Expected behavior: {observe}")
    expected_output = "\n".join(expected_parts) or "Respond correctly to the query."

    # Build retrieval_context from tool results (for faithfulness)
    retrieval_context = []
    raw_results = extracted.get("tool_results", [])
    if isinstance(raw_results, list):
        for r in raw_results:
            preview = r.get("content_preview", "")
            if preview:
                name = r.get("name", "tool")
                retrieval_context.append(f"[{name}]: {preview[:2000]}")
    elif isinstance(raw_results, dict):
        for key, val in raw_results.items():
            retrieval_context.append(f"[{key}]: {str(val)[:2000]}")

    return LLMTestCase(
        input=query_def["query"],
        actual_output=actual_output,
        expected_output=expected_output,
        retrieval_context=retrieval_context if retrieval_context else ["(no tool results)"],
    )


def run_deepeval_scoring(
    query_def: dict,
    extracted: dict,
    metrics: Optional[list] = None,
) -> dict[str, Any]:
    """Run DeepEval G-Eval metrics on a single query result.

    Returns dict of {metric_name: {"value": float, "comment": str, "reason": str}}.
    """
    if metrics is None:
        metrics = create_geval_metrics()

    test_case = build_test_case(query_def, extracted)
    scores: dict[str, Any] = {}

    for name, metric in metrics:
        try:
            metric.measure(test_case)
            scores[name] = {
                "value": round(metric.score, 3),
                "comment": (metric.reason or "")[:500],
                "passed": metric.score >= metric.threshold,
            }
        except Exception as e:
            scores[name] = {
                "value": None,
                "comment": f"DeepEval error: {e}",
                "passed": False,
            }

    return scores


def run_deepeval_aggregate(item_scores: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute aggregate DeepEval scores across all items.

    Returns dict of {metric_name: {"value": avg_score, "comment": summary}}.
    """
    metric_scores: dict[str, list[float]] = {}
    for scores in item_scores:
        for name, data in scores.items():
            if data.get("value") is not None:
                metric_scores.setdefault(name, []).append(data["value"])

    aggregates = {}
    for name, values in metric_scores.items():
        avg = sum(values) / len(values)
        passed = sum(1 for v in values if v >= 0.7)
        aggregates[f"avg_{name}"] = {
            "value": round(avg, 3),
            "comment": f"Avg: {avg:.1%}, passed: {passed}/{len(values)} (>= 0.7)",
        }

    return aggregates
