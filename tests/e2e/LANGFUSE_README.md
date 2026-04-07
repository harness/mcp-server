# Langfuse + LLM-as-Judge Integration

Automated evaluation framework for SCS MCP smoke tests using [Langfuse](https://langfuse.com) observability, LLM-as-Judge scoring, and optional [DeepEval](https://github.com/confident-ai/deepeval) G-Eval metrics.

Inspired by the [AI Remediation Evaluation Framework](https://harness.atlassian.net/wiki/spaces/STOH/pages/23442620461) and its Remediation Quality Index (RQI) methodology.

## Quick Start

```bash
# 1. Source Langfuse credentials
source langfuse.env  # or export LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST

# 2. Run smoke tests with Langfuse tracing only (no judge)
python scs_llm_smoke_test.py --langfuse

# 3. Run with LLM-as-Judge scoring (uses OpenAI by default)
python scs_llm_smoke_test.py --langfuse --langfuse-judge

# 4. Run with Harness ai-evals judge (multi-criteria rubric)
python scs_llm_smoke_test.py --langfuse --langfuse-judge --harness-judge

# 5. Run with DeepEval G-Eval metrics (independent of Langfuse)
pip install deepeval
python scs_llm_smoke_test.py --deepeval

# 6. Run with everything
python scs_llm_smoke_test.py --langfuse --langfuse-judge --harness-judge --deepeval

# 7. Sync datasets only (no test execution)
python scs_llm_smoke_test.py --langfuse --langfuse-sync-only
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--langfuse` | Enable Langfuse tracing and post-run scoring |
| `--langfuse-judge` | Enable LLM-as-Judge answer quality evaluation (requires `--langfuse`) |
| `--harness-judge` | Use Harness ai-evals service for rubric-based multi-criteria scoring (requires `--langfuse-judge`) |
| `--deepeval` | Enable DeepEval G-Eval metrics (requires `pip install deepeval` + `OPENAI_API_KEY`) |
| `--langfuse-sync-only` | Sync dataset definitions to Langfuse and exit (no test execution) |

## Environment Variables

### Required (for `--langfuse`)

| Variable | Description |
|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Langfuse project public key |
| `LANGFUSE_SECRET_KEY` | Langfuse project secret key |
| `LANGFUSE_HOST` | Langfuse host URL (default: `https://langfuse-prod.harness.io`) |

### Judge Configuration (for `--langfuse-judge`)

| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_JUDGE_PROVIDER` | `openai` | Judge provider: `openai`, `anthropic`, or `harness` |
| `EVAL_JUDGE_MODEL` | `gpt-4.1-mini` | Model for LLM-as-Judge calls |
| `OPENAI_API_KEY` | — | Required if `EVAL_JUDGE_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | — | Required if `EVAL_JUDGE_PROVIDER=anthropic` |

### Harness ai-evals (for `--harness-judge`)

| Variable | Default | Description |
|----------|---------|-------------|
| `HARNESS_EVAL_API_URL` | — | Harness ai-evals REST API URL |
| `HARNESS_EVAL_API_TOKEN` | — | API token for authentication |
| `HARNESS_EVAL_AUTH_TYPE` | `api-key` | Auth type: `api-key` (x-api-key header) or `bearer` |
| `HARNESS_EVAL_ORG` | — | Harness org identifier (optional) |
| `HARNESS_EVAL_PROJECT` | — | Harness project identifier (optional) |

### DeepEval (for `--deepeval`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPEVAL_MODEL` | `gpt-4.1-mini` | Model for G-Eval judge calls |
| `OPENAI_API_KEY` | — | Required (DeepEval uses OpenAI by default) |

### Quality Thresholds

| Variable | Default | Description |
|----------|---------|-------------|
| `QUALITY_COVERAGE_THRESHOLD` | `0.7` | Minimum judge score to count as "quality pass" for coverage metric |

## Evaluators

### Per-Query Evaluators (deterministic, no LLM calls)

| Name | Score | Description |
|------|-------|-------------|
| `trajectory` | 0.0–1.0 | Tool selection accuracy — proportion of expected tools called |
| `trajectory_order` | 0.0–1.0 | Whether tools were called in the expected subsequence order |
| `parameters` | 0.0–1.0 | Validates tool parameters against `PARAM_VALIDATION_RULES` |
| `latency` | 0.0–1.0 | Flags slow queries (>60s warn, >120s fail) |
| `error_free` | 0.0/1.0 | Whether execution had any errors |
| `answer_presence` | 0.0/1.0 | Whether a non-trivial answer was generated |

### LLM-as-Judge Evaluators (with `--langfuse-judge`)

| Name | Score | Description |
|------|-------|-------------|
| `answer_quality` | 0.0–1.0 | Single-criterion quality score (used when `--harness-judge` is NOT active) |

### Harness Rubric Judge (with `--harness-judge`)

Uses a **Chain-of-Thought (CoT)** prompt following the [G-Eval](https://arxiv.org/abs/2303.16634) methodology — the judge reasons step-by-step before producing scores, yielding more reliable evaluations.

When using OpenAI as the judge provider, **token probability calibration** is applied: instead of taking the model's raw score, the expected value is computed from the probability distribution across possible score tokens.

| Name | Weight | Description |
|------|--------|-------------|
| `task_completion` | 35% | Does the response fully address the user's request? |
| `tool_usage` | 25% | Correct tools with correct parameters, no hallucinated calls |
| `factual_accuracy` | 20% | Claims supported by actual tool results, no hallucinations |
| `response_quality` | 20% | Well-structured, actionable, professional formatting |
| `harness_judge_score` | — | Weighted average of above criteria (with optional logprobs calibration) |

### DeepEval G-Eval Metrics (with `--deepeval`)

Uses the [DeepEval](https://docs.confident-ai.com/docs/metrics-llm-evals) framework's battle-tested G-Eval implementation with chain-of-thought + token probability calibration built-in.

| Name | Description |
|------|-------------|
| `deepeval_tool_correctness` | G-Eval metric for MCP tool selection quality |
| `deepeval_answer_quality` | G-Eval metric for response completeness and accuracy |
| `deepeval_faithfulness` | Anti-hallucination check — claims vs actual tool results |

### Run-Level Aggregates

| Name | Description |
|------|-------------|
| `avg_trajectory_accuracy` | Average trajectory score across all items |
| `pass_rate` | Percentage of items with trajectory score = 1.0 |
| `token_cost` | Total tokens (prompt + completion) with USD cost estimate |
| `quality_coverage` | Percentage of items with judge score >= threshold (default 0.7). Inspired by RQI coverage metric. |
| `category_breakdown` | Per-category pass rate (artifact, repo, compliance, remediation, dependency, sbom, cross_toolset, oss_risk). Structured `categories` field enables per-category regression detection. |
| `mqi` | **MCP Quality Index** — confidence-weighted composite of trajectory (30%), parameters (15%), judge score (35%), latency (10%), error_free (5%), answer_presence (5%). Items are weighted by confidence level: Supported/High=1.0, Medium=0.7, Low=0.4, N/A=0.2. Inspired by RQI. |

## Features

### Experiment Tracking
Each run creates a unique experiment name (`scs-smoke-YYYYMMDD-HHMMSS`). Traces are linked to Langfuse dataset items, enabling A/B comparison in the Experiments UI.

### Regression Detection
After scoring, the runner compares key metrics against the previous run's summary file:
- **correct_rate**: 5% drop threshold
- **avg_trajectory_accuracy**: 5% drop threshold
- **pass_rate**: 5% drop threshold
- **quality_coverage**: 5% drop threshold
- **mqi**: 5% drop threshold
- **avg_duration_s**: 20% increase threshold
- **total_tokens**: 15% increase threshold
- **category:\<name\>**: 5% drop threshold per category (artifact, repo, compliance, etc.)

Per-category regression detection compares each category's pass rate independently, so a drop in e.g. `category:compliance` is flagged even if overall MQI is stable. Regressions are flagged with ⚠️ in console output and stored in the JSON results.

**CI gating**: The script exits with code 1 when any regression is detected, enabling CI pipelines to gate merges on quality.

### Flaky Query Detection
After regression detection, the runner scans the last 5 result files in `benchmark_results/` and builds a per-query history of `tool_selection` outcomes. Queries with 2+ distinct outcomes (e.g. CORRECT → PARTIAL → CORRECT) are flagged as flaky with their flip count and outcome history. Results are stored in `summary["flaky_queries"]`.

### Score Stability (σ)
Aggregate metrics (trajectory accuracy, MQI) include population standard deviation (σ) in their comments. A high mean with high σ indicates inconsistent results across queries — useful for spotting fragile prompt configurations even when the average looks good.

### Prompt Version Tracking
Judge prompts are hashed (SHA-256, 12-char prefix) and stored in trace metadata as `prompt_version`. This allows correlating scores with the exact prompt that produced them across different experiment runs.

### Multi-Turn Conversation Support
- Parent trace per conversation with per-turn child traces
- Session tracking via shared `session_id`
- Per-turn judge scoring with conversation-level aggregation

### Chain-of-Thought Judge (G-Eval)
The Harness Rubric Judge uses a structured CoT evaluation:
1. The judge reasons step-by-step through each criterion before scoring
2. JSON scores are extracted from the CoT output (handles markdown fences, mixed text)
3. When using OpenAI, logprobs-based calibration adjusts the final score using the probability distribution

### A/B Comparison (Prompt Validation)

When making changes to the judge prompt (e.g., adding CoT reasoning), validate the impact by running both versions as separate experiments and comparing in Langfuse:

```bash
# 1. Run baseline (before prompt change) — save results first
python scs_llm_smoke_test.py --langfuse --langfuse-judge --harness-judge

# 2. Apply prompt changes, then run again
#    Each run auto-generates a unique experiment name (scs-smoke-YYYYMMDD-HHMMSS)
python scs_llm_smoke_test.py --langfuse --langfuse-judge --harness-judge

# 3. Compare in Langfuse UI:
#    - Go to Experiments tab → select both experiment runs
#    - Compare harness_judge_score distributions
#    - Check per-query score differences
#    - Verify category-level regression detection (console output)
```

Key metrics to compare:
- **MQI**: Composite quality index should not drop (includes confidence weighting)
- **harness_judge_score**: Mean and distribution across queries
- **Per-category pass rates**: Ensure no category regresses
- **Prompt version hash**: Recorded in trace metadata — confirms which prompt produced which scores

The regression detection runs automatically and flags any metric drops exceeding thresholds.

### Harness ai-evals Resilience
- Automatic retry on 5xx/429 errors (exponential backoff, up to 2 retries)
- Connection validation at startup
- Graceful fallback to direct OpenAI/Anthropic calls if service is unavailable; logprobs calibration applied on fallback path

## Output

Scores appear in:
1. **Console** — summary table with per-query scores
2. **JSON** — `benchmark_results/smoke_test_summary.json` includes `langfuse_scores`, `deepeval_scores`, `run_aggregates`, and `deepeval_aggregates`
3. **JSON (timestamped)** — `benchmark_results/smoke_test_results_YYYYMMDD_HHMMSS.json` — historical copies used by flaky detection and trend analysis
4. **Langfuse UI** — traces with attached scores, filterable by experiment run, session, and tags

### CLI Flags

| Flag | Description |
|------|-------------|
| `--langfuse` | Enable Langfuse trace + score push |
| `--langfuse-judge` | Enable LLM-as-Judge scoring |
| `--harness-judge` | Use Harness ai-evals rubric judge (fallback to OpenAI) |
| `--deepeval` | Enable DeepEval G-Eval metrics |
| `--no-fail-on-regression` | Don't exit(1) on regression (useful for local dev) |
| `--skip-na` | Skip queries with N/A confidence |
| `--query-ids Q01,M03` | Run specific query/conversation IDs only |
| `--concurrency 5` | Parallel query execution |

## Files

| File | Description |
|------|-------------|
| `langfuse_evaluators.py` | Evaluator functions, `LangfuseIntegration` class, regression detection, CoT judge, logprobs calibration |
| `deepeval_evaluators.py` | Optional DeepEval G-Eval metric definitions and scoring (requires `pip install deepeval`) |
| `scs_llm_smoke_test.py` | Main test runner with `--langfuse*` and `--deepeval` flag handling |
| `langfuse.env` | Credentials file (DO NOT commit) |
