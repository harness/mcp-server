#!/usr/bin/env python3
"""
Phase 0.5: LLM Smoke Test for SCS MCP Tools (V2 — harness-mcp-v2)

V2 Tool Model: Generic tools (harness_list, harness_get, harness_describe)
dispatched via resource_type parameter. Scoring checks (tool_name, resource_type) tuples.

Prerequisites:
  1. genai-service at GENAI_URL with SKIP_AUTHORIZATION=true, MCP external mode
  2. harness-mcp-v2 built (pnpm build), HARNESS_MCP_BIN_PATH=build/index.js
  3. ml-infra .env: ML_ENABLE_MCP_OVER_HTTP=false, HARNESS_TOOLSETS=scs
  4. ANTHROPIC_API_KEY, HARNESS_API_KEY set

Usage:
  python tests/e2e/scs_llm_smoke_test.py [--url URL] [--query-ids Q01,M01,...] [--delay SECS]

Langfuse Integration (optional):
  pip install langfuse openai  # or: pip install langfuse anthropic
  export LANGFUSE_PUBLIC_KEY=pk-lf-...
  export LANGFUSE_SECRET_KEY=sk-lf-...
  export LANGFUSE_HOST=https://langfuse-prod.harness.io  # optional, this is the default

  # Run with Langfuse tracing + deterministic evaluators:
  python tests/e2e/scs_llm_smoke_test.py --langfuse

  # Run with Langfuse + LLM-as-Judge answer quality evaluation:
  python tests/e2e/scs_llm_smoke_test.py --langfuse --langfuse-judge

  # Only sync test datasets to Langfuse (no test execution):
  python tests/e2e/scs_llm_smoke_test.py --langfuse --langfuse-sync-only

  Evaluators provided (see langfuse_evaluators.py):
    - trajectory: Tool selection matching (proportional score 0.0-1.0)
    - trajectory_order: Subsequence check on tool call ordering
    - parameters: Validates key tool arguments against expected values
    - latency: Flags slow queries (>60s warn, >120s fail)
    - error_free: Checks for execution errors
    - answer_presence: Verifies non-trivial answer was generated
    - answer_quality: LLM-as-Judge (only with --langfuse-judge)
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import urllib.error
import urllib.request

# ---------------------------------------------------------------------------
# Types & Config
# ---------------------------------------------------------------------------
ToolSpec = tuple  # (tool_name, resource_type) — Python 3.9 compat

GENAI_URL = os.getenv("GENAI_URL", "http://localhost:8000")
ACCOUNT_ID = os.getenv("HARNESS_ACCOUNT_ID", "ppbLW9YpRharzPs_JtWT7g")
ORG_ID = os.getenv("HARNESS_ORG_ID", "SSCA")
PROJECT_ID = os.getenv("HARNESS_PROJECT_ID", "SSCA_Sanity_Automation")
MCP_LOG_FILE = os.getenv("HARNESS_MCP_LOG_FILE", "/tmp/scs-smoke-mcp.log")
INTER_QUERY_DELAY = float(os.getenv("INTER_QUERY_DELAY", "5"))
OUTPUT_DIR = Path(__file__).resolve().parent / "benchmark_results"


def _fmt_tool(spec: ToolSpec) -> str:
    if isinstance(spec, (list, tuple)) and len(spec) == 2:
        return f"{spec[0]}({spec[1]})"
    return str(spec)


def _fmt_tools(specs: list) -> str:
    return ", ".join(_fmt_tool(s) for s in specs) if specs else "(none)"


MAX_HISTORY_CHARS = 4000

# History mode constants
HISTORY_MODE_ANSWER_ONLY = "answer_only"     # Strategy A: only final answer text
HISTORY_MODE_TOOL_SUMMARY = "tool_summary"   # Strategy B: answer + structured tool call summary


def build_tool_call_summary(extracted: dict[str, Any]) -> str:
    """Build a structured tool call summary for conversation history enrichment (Strategy B).

    Includes tool names, resource types, and key parameters to help the LLM
    retain context across multi-turn conversations without re-discovering
    resource types and entity IDs.
    """
    tools = extracted.get("tools_called", [])
    params = extracted.get("tool_params", {})

    if not tools:
        return ""

    lines = ["", "---", "[Tool calls in this turn]"]
    for tool_spec in tools:
        tool_str = _fmt_tool(tool_spec)
        tool_args = params.get(tool_str, {})
        # Extract key parameters (skip resource_type — already in tool_spec)
        id_parts = []
        for key, val in tool_args.items():
            if key == "resource_type":
                continue
            if val is not None and isinstance(val, str) and len(val) < 200:
                id_parts.append(f"{key}={val}")
        param_str = f" | {', '.join(id_parts)}" if id_parts else ""
        lines.append(f"- {tool_str}{param_str}")

    lines.append("[Retain the resource_type and entity IDs above for follow-up queries]")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 33 Test Queries — V2
# expected_tools: list of (tool_name, resource_type) tuples
# Q02, Q03, Q05: Downgraded — filters not ported to v2
# Q15: Reclassified per PD-1 — vuln counts are CORRECT behavior
# Q20-Q26: Phase 3 queries (P3-6, P3-7, P3-8, P3-9, P3-12)
# Q27-Q31: Disambiguation queries — test tool selection when multiple resources match
# Q34-Q37: P3-1 BOM enforcement violation queries
# Q41-Q42: P3-2 OSS risk summary & filtering queries
# ---------------------------------------------------------------------------
QUERIES = [
    {
        "id": "Q01", "query": "List all my artifacts",
        "expected_intent": "Partially Supported: List artifacts",
        "confidence": "Supported",
        "expected_tools": [("harness_list", "scs_artifact_source")],
        "observe": "Does it call harness_list with resource_type=scs_artifact_source?",
    },
    {
        "id": "Q02", "query": "Show me only Docker image artifacts",
        "expected_intent": "Not Supported in v2: artifact_type filter not ported",
        "confidence": "N/A", "expected_tools": [],
        "observe": "V2 has no artifact_type filter. Graceful decline or client-side filter?",
    },
    {
        "id": "Q03", "query": "Which artifacts have policy violations?",
        "expected_intent": "Not Supported in v2: policy_violation filter not ported",
        "confidence": "N/A", "expected_tools": [],
        "observe": "V2 has no policy_violation filter. Graceful decline?",
    },
    {
        "id": "Q04", "query": "List my code repositories that have been scanned",
        "expected_intent": "Supported: List scanned code repos",
        "confidence": "Supported",
        "expected_tools": [("harness_list", "code_repo_security")],
        "observe": "Does it call harness_list with resource_type=code_repo_security?",
    },
    {
        "id": "Q05", "query": "Which of my code repos contain the lodash dependency?",
        "expected_intent": "Not Supported in v2: dependency_filter not ported",
        "confidence": "N/A", "expected_tools": [],
        "observe": "V2 has no dependency_filter. Graceful decline?",
    },
    {
        "id": "Q06", "query": "What is the security status of my first code repository?",
        "expected_intent": "Partially Supported: Repo security overview",
        "confidence": "High",
        "expected_tools": [("harness_list", "code_repo_security"), ("harness_get", "code_repo_security")],
        "observe": "Does it chain harness_list → harness_get with correct repo_id?",
    },
    {
        "id": "Q07", "query": "Show me the SBOM components for one of my artifacts",
        "expected_intent": "Partially Supported: SBOM inspection",
        "confidence": "High",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component")],
        "observe": "Does it chain scs_artifact_source → scs_artifact_component? May call artifact_security in between.",
    },
    {
        "id": "Q08", "query": "Is my first code repository compliant with CIS benchmarks?",
        "expected_intent": "Partially Supported: CIS compliance check",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_compliance_result")],
        "observe": "Does it pass standards=['CIS']? Watch for array normalization bug (T2-v2).",
    },
    {
        "id": "Q09", "query": "Download the SBOM for one of my artifacts",
        "expected_intent": "Partially Supported: SBOM download",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_get", "scs_sbom")],
        "observe": "Does it extract orchestration_id? Compact mode may strip it.",
    },
    {
        "id": "Q10", "query": "Show me the supply chain provenance for one of my artifacts",
        "expected_intent": "Partially Supported: Chain of custody",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_get", "scs_chain_of_custody")],
        "observe": "Does it chain source list → chain of custody with correct artifact_id?",
    },
    {
        "id": "Q11", "query": "What licenses are present in the SBOM of one of my artifacts?",
        "expected_intent": "Partially Supported: SBOM license inspection",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component")],
        "observe": "Compact mode strips package_license — LLM should use compact=false.",
    },
    {
        "id": "Q12", "query": "Show me recently scanned artifacts, sorted by most recent first",
        "expected_intent": "Partially Supported: Recent scans",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source")],
        "observe": "V2 scs_artifact_source has no sort param. Does LLM attempt sort?",
    },
    {
        "id": "Q13",
        "query": "I want remediation guidance for the zlib component in my artifacts. Can you find it and tell me what version to upgrade to?",
        "expected_intent": "Partially Supported: Remediation (4-call chain in v2). scs_component_remediation preferred over scs_artifact_remediation.",
        "confidence": "Low",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
        "observe": "Needs purl from component list. scs_component_remediation (structured) is preferred over scs_artifact_remediation (text-only).",
    },
    {
        "id": "Q14", "query": "Give me a complete security overview of my entire project including all artifacts and repos",
        "expected_intent": "Deprioritized (PD-5): Project-level overview blocked on risk scoring",
        "confidence": "N/A", "expected_tools": [],
        "observe": "Does it gracefully decline or attempt partial answer?",
    },
    {
        "id": "Q15", "query": "Which of my artifacts have critical vulnerabilities? List only those with critical severity.",
        "expected_intent": "Deprioritized (PD-1): Vuln severity is STO territory. Counts-only is CORRECT.",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_get", "artifact_security")],
        "observe": "Per PD-1: CORRECT if it returns vuln counts. No penalty for no severity filter.",
    },
    {
        "id": "Q16", "query": "List my code repositories",
        "expected_intent": "P2-13: Bare repo query — should route to code_repo_security via SCS module context",
        "confidence": "Supported",
        "expected_tools": [("harness_list", "code_repo_security")],
        "observe": "P2-13 validation: no security keyword in query. Module context must drive routing to code_repo_security, not repository.",
    },
    {
        "id": "Q17", "query": "Show me my repos and their status",
        "expected_intent": "P2-13: Ambiguous repo query — should route to code_repo_security via SCS module context",
        "confidence": "Supported",
        "expected_tools": [("harness_list", "code_repo_security")],
        "observe": "P2-13 validation: 'status' is ambiguous (could mean code repo status or security status). SCS module context should prefer code_repo_security.",
    },
    # ─── Phase 3 Tier 1 Queries ───────────────────────────────────────────
    {
        "id": "Q20",
        "query": "Find a vulnerable component in my first code repository and suggest a safe version to upgrade to. Will upgrading it break anything?",
        "expected_intent": "P3-6: Component remediation — upgrade suggestions with dependency impact",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
        "observe": "Does it chain code_repo_security → scs_artifact_component (to find purl) → scs_component_remediation? "
            "Does the response include dependency_changes (P3-9 impact analysis)?",
    },
    {
        "id": "Q21",
        "query": "Show me the direct dependencies of my first code repository",
        "expected_intent": "P3-7: Repo-level dependency queries — repo_id as artifact_id",
        "confidence": "High",
        "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_artifact_component")],
        "observe": "Does it use repo_id as artifact_id with dependency_type=DIRECT? "
            "code_repo_security description explicitly guides this two-step flow.",
    },
    {
        "id": "Q22",
        "query": "Show me the full dependency tree for the zlib component in my first artifact",
        "expected_intent": "P3-8: Component dependency tree — direct and transitive dependencies",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_dependencies")],
        "observe": "Does it chain artifact_source → artifact_security → scs_artifact_component (to find purl) → scs_component_dependencies? "
            "Does the response show DIRECT vs INDIRECT relationships and relationship_path?",
    },
    {
        "id": "Q23",
        "query": "What would break if I upgrade the zlib component in my artifact? Show me the dependency impact.",
        "expected_intent": "P3-9: Dependency impact analysis — embedded in remediation response",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
        "observe": "Does it route to scs_component_remediation (not scs_artifact_remediation)? "
            "Does the LLM surface the dependency_changes from the response?",
    },
    {
        "id": "Q26",
        "query": "Show me the auto-PR configuration for my project",
        "expected_intent": "P3-12: Auto PR configuration management — view config",
        "confidence": "Supported",
        "expected_tools": [("harness_get", "scs_auto_pr_config")],
        "observe": "Does it call harness_get with resource_type=scs_auto_pr_config? No entity ID needed.",
    },
    # ─── Disambiguation Queries ────────────────────────────────────────
    {
        "id": "Q27",
        "query": "How do I fix a vulnerable component in my first artifact? What version should I upgrade to and will it break anything?",
        "expected_intent": "Disambiguation: scs_component_remediation (structured) vs scs_artifact_remediation (text-only)",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
        "observe": "KEY DISAMBIGUATION: Does it pick scs_component_remediation (upgrade suggestions + impact analysis) "
            "over scs_artifact_remediation (deprecated text-only advice)? "
            "'first artifact' forces the LLM to chain through sources → artifacts → components → remediation.",
    },
    {
        "id": "Q28",
        "query": "What does the zlib package in my first artifact depend on? Show me everything it pulls in — direct and transitive.",
        "expected_intent": "Disambiguation: scs_component_dependencies (tree) vs scs_artifact_component (flat list)",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_dependencies")],
        "observe": "KEY DISAMBIGUATION: 'dependency chain' and 'transitive' should route to scs_component_dependencies (tree), "
            "NOT scs_artifact_component (flat list of all components in artifact). "
            "scs_artifact_component lists components IN an artifact; scs_component_dependencies shows what a component DEPENDS ON.",
    },
    {
        "id": "Q29",
        "query": "I want to set up automatic pull requests to fix vulnerabilities in my project. How is it configured?",
        "expected_intent": "Disambiguation: scs_auto_pr_config (project config) vs scs_remediation_pr (manual PR creation)",
        "confidence": "Supported",
        "expected_tools": [("harness_get", "scs_auto_pr_config")],
        "observe": "KEY DISAMBIGUATION: 'automatic pull requests' and 'configured' should route to scs_auto_pr_config (project-level config), "
            "NOT scs_remediation_pr (create/list individual PRs). 'set up' and 'configured' are config keywords.",
    },
    {
        "id": "Q30",
        "query": "Check if my first artifact passes all the security compliance rules",
        "expected_intent": "Disambiguation: scs_compliance_result (SCS compliance) vs opa_policy (OPA governance)",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_compliance_result")],
        "observe": "KEY DISAMBIGUATION: 'compliance rules' in SCS context should route to scs_compliance_result, "
            "NOT opa_policy (governance toolset). Module context (SCS) should drive this.",
    },
    {
        "id": "Q31",
        "query": "Show me details about the security posture of my artifacts",
        "expected_intent": "Disambiguation: artifact_security (security overview) vs scs_artifact_source (source listing)",
        "confidence": "High",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security")],
        "observe": "KEY DISAMBIGUATION: 'security posture' of plural 'artifacts' justifies harness_list(artifact_security) to get overview of all. "
            "Tests whether LLM chains source listing → security listing for a broad posture view.",
    },
    # ─── P3-10: OPA Policy Management in SCS Context ──────────────────
    {
        "id": "Q32",
        "query": "List the OPA policies configured for my project so I can review the SBOM enforcement rules",
        "expected_intent": "P3-10: Cross-toolset routing — SCS user asking about OPA policies should route to governance toolset",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "policy")],
        "observe": "P3-10: 'OPA policies' + 'SBOM enforcement' should route to governance toolset's `policy` resource. "
            "LLM must NOT try to find an SCS-specific policy resource. Module routing context should guide it.",
    },
    {
        "id": "Q33",
        "query": "Show me all policy sets that enforce rules on my supply chain artifacts",
        "expected_intent": "P3-10: Cross-toolset routing — policy set listing in SCS context uses governance toolset",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "policy_set")],
        "observe": "P3-10: 'policy sets' + 'enforce' + 'supply chain artifacts' should route to governance's `policy_set` resource. "
            "Tests cross-toolset routing from SCS module to governance.",
    },
    # ─── P3-1: BOM Enforcement Violations ─────────────────────────────
    {
        "id": "Q34",
        "query": "Which components in my first artifact failed the policy check? Show me what was blocked and why.",
        "expected_intent": "P3-1: BOM enforcement violations — two-step flow from artifact overview to violation list",
        "confidence": "Medium",
        "expected_tools": [(
            "harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_bom_violation")],
        "observe": "P3-1 TWO-STEP: Does the LLM chain artifact_source → artifact_security (to get enforcement_id from violations.enforcementId) → scs_bom_violation? "
            "This is the core P3-1 flow. The LLM must extract enforcement_id from the artifact overview response. "
            "Note: LLM uses harness_list (not harness_get) for artifact_security since it filters by source_id/artifact_id.",
    },
    {
        "id": "Q35",
        "query": "Give me a high-level summary of the enforcement results for my first artifact — how many violations are there and what types?",
        "expected_intent": "P3-1: Enforcement summary — get operation for violation counts",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_get", "scs_bom_violation")],
        "observe": "P3-1 SUMMARY: Does the LLM use harness_get (not harness_list) for scs_bom_violation to get the enforcement summary? "
            "'overall enforcement status' + 'violation counts' + 'not individual violations' should signal the get/summary endpoint.",
    },
    {
        "id": "Q36",
        "query": "Are there any components in my artifact that are on the deny list? Show me the denied components and why they were blocked.",
        "expected_intent": "P3-1: Deny-list specific violation query",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_bom_violation")],
        "observe": "P3-1 DENY-LIST: Does the LLM route to scs_bom_violation for deny-list queries? "
            "'deny list' is a searchAlias. The response should include violationType and violationDetails fields.",
    },
    {
        "id": "Q37",
        "query": "What policy violations does my first artifact have from the BOM enforcement check?",
        "expected_intent": "P3-1 Disambiguation: scs_bom_violation (BOM enforcement) vs scs_compliance_result (CIS/OWASP compliance)",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_bom_violation")],
        "observe": "KEY DISAMBIGUATION: 'policy violations' + 'BOM enforcement' + 'not CIS compliance' should route to scs_bom_violation, "
            "NOT scs_compliance_result. Tests whether the LLM can disambiguate between the two compliance-related resources. "
            "scs_compliance_result handles CIS/OWASP checks; scs_bom_violation handles OPA policy enforcement violations.",
    },
    # ─── P3-11: Component Enrichment / OSS Risk Lookup ──────────────────
    {
        "id": "Q38",
        "query": "Is the zlib component in my first artifact still maintained? What's its risk level and is it end-of-life?",
        "expected_intent": "P3-11: OSS risk assessment — EOL status and risk score via scs_component_enrichment",
        "confidence": "Low",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_enrichment")],
        "observe": "P3-11: Does the LLM chain source → components (to find zlib purl) → scs_component_enrichment? "
            "Key test: 'end-of-life' and 'outdated' should route to scs_component_enrichment (OSS risk), NOT security_issue (STO CVEs). "
            "Response should include EOL status, outdated flag, and latest_version.",
    },
    {
        "id": "Q39",
        "query": "Check if any components in my first code repository are end-of-life or unmaintained. What's their risk level?",
        "expected_intent": "P3-11: Project-scoped OSS risk assessment — repo as artifact, scs_component_enrichment with artifact_id",
        "confidence": "Low",
        "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_enrichment")],
        "observe": "P3-11: Does it chain code_repo_security → scs_artifact_component (repo_id as artifact_id) → scs_component_enrichment? "
            "'OSS risk', 'unmaintained', 'end-of-life' are all search aliases for scs_component_enrichment. "
            "Bonus: does it pass artifact_id to scs_component_enrichment for richer project-scoped data?",
    },
    # ─── SBOM Drift: New Dependencies Between Consecutive Runs ────────
    {
        "id": "Q40",
        "query": "What new dependencies were introduced in the latest version of my first artifact source compared to the previous version?",
        "expected_intent": "SBOM drift: Use server-side drift calculation to find component changes between consecutive artifact versions",
        "confidence": "Low",
        "expected_tools": [
            ("harness_list", "scs_artifact_source"),
            ("harness_list", "artifact_security"),
            ("harness_execute", "scs_sbom_drift"),
        ],
        "observe": "SBOM DRIFT TEST: Does the LLM chain source → artifacts → harness_execute(scs_sbom_drift, action='calculate', orchestration_id=<id>, base='last_generated_sbom')? "
            "KEY: The LLM should use the drift API instead of manually fetching component lists. "
            "CORRECT if it calls harness_execute with scs_sbom_drift. PARTIAL if it falls back to scs_artifact_component manual diff. "
            "Bonus: does it follow up with harness_list(scs_component_drift, drift_id=...) for detailed diffs?",
    },
    # ─── P3-3: Pipeline SBOM Step Modification ────────────────────────
    {
        "id": "Q19",
        "query": "Show me the SBOM generation step in my first pipeline. What tool is it using — Syft or CycloneDX?",
        "expected_intent": "P3-3: Pipeline SBOM step inspection — cross-toolset routing from SCS to pipeline tools",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "pipeline"), ("harness_get", "pipeline")],
        "observe": "P3-3: Does the LLM use pipeline tools (not SCS tools) for SBOM step config? "
            "It should list pipelines → get pipeline YAML → parse and identify the SscaOrchestration step → report tool type (syft/cdxgen). "
            "Cross-toolset routing: SCS module user asking about pipeline config should route to pipelines toolset.",
    },
    # ─── P3-2: OSS Risk Summary & Filtering ──────────────────────────
    {
        "id": "Q41",
        "query": "What is the overall OSS risk in my project? How many artifacts have end-of-life or unmaintained components? Give me a project-level risk overview.",
        "expected_intent": "P3-2: Project-level OSS risk summary via scs_oss_risk_summary",
        "confidence": "High",
        "expected_tools": [("harness_get", "scs_oss_risk_summary")],
        "observe": "P3-2 PROJECT RISK: Does the LLM route directly to scs_oss_risk_summary? "
            "'project risk overview', 'OSS risk', 'end-of-life summary' are all searchAliases. "
            "Should NOT need artifact listing first — this is a project-scoped GET with no extra IDs. "
            "Response should include total_artifacts_scanned, aggregate counts, and per-artifact breakdown.",
    },
    {
        "id": "Q42",
        "query": "List all end-of-life components in my first artifact. Filter the SBOM components to show only those with DEFINITE_EOL or DERIVED_EOL risk.",
        "expected_intent": "P3-2: OSS risk filtering on artifact components via oss_risk_filter",
        "confidence": "Medium",
        "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_artifact_component")],
        "observe": "P3-2 OSS RISK FILTER: Does the LLM pass oss_risk_filter='DEFINITE_EOL,DERIVED_EOL' to scs_artifact_component? "
            "Key test: the body should contain oss_risk_filter array. "
            "CORRECT if oss_risk_filter is passed. PARTIAL if it lists components without the filter.",
    },
]

# ---------------------------------------------------------------------------
# Multi-Turn Conversations — V2
# ---------------------------------------------------------------------------
CONVERSATIONS = [
    {
        "id": "M01", "title": "Artifact Drill-Down Journey",
        "description": "List artifact sources → pick one → inspect SBOM",
        "turns": [
            {"turn": 1, "query": "List all my artifacts",
             "expected_tools": [("harness_list", "scs_artifact_source")],
             "observe": "Baseline list. Does it return source names/IDs?"},
            {"turn": 2, "query": "Tell me more about the first ECR artifact in that list",
             "expected_tools": [],
             "observe": "Can it resolve 'first ECR artifact' from Turn 1?"},
            {"turn": 3, "query": "What are its SBOM components?",
             "expected_tools": [("harness_list", "scs_artifact_component")],
             "observe": "Does it resolve 'its' to the artifact from Turn 2?"},
        ],
    },
    {
        "id": "M02", "title": "Code Repo Security Deep-Dive",
        "description": "List repos → security overview → CIS compliance",
        "turns": [
            {"turn": 1, "query": "List my code repositories",
             "expected_tools": [("harness_list", "code_repo_security")],
             "observe": "Does it list repos with IDs?"},
            {"turn": 2, "query": "What's the security overview of ProtectedPDF2Doc?",
             "expected_tools": [("harness_get", "code_repo_security")],
             "observe": "Can it resolve repo name to repo_id from Turn 1?"},
            {"turn": 3, "query": "Show me its CIS compliance results",
             "expected_tools": [("harness_list", "scs_compliance_result")],
             "observe": "Does it retain repo UUID? Does it pass standards=['CIS']?"},
        ],
    },
    {
        "id": "M03", "title": "Remediation Journey",
        "description": "User drives the remediation chain one turn at a time",
        "turns": [
            {"turn": 1, "query": "Show me the SBOM components for my latest ECR artifact",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component")],
             "observe": "Does it chain source list → component list?"},
            {"turn": 2, "query": "Which of those components have known vulnerabilities?",
             "expected_tools": [],
             "observe": "Can it reference SBOM data from Turn 1?"},
            {"turn": 3, "query": "How do I fix the zlib component? What version should I upgrade to?",
             "expected_tools": [("harness_get", "scs_component_remediation")],
             "observe": "scs_component_remediation preferred (structured upgrade suggestions). Does it extract the correct purl?"},
        ],
    },
    {
        "id": "M04", "title": "Refinement & Correction",
        "description": "Broad list → attempt type filter → attempt policy filter (both missing in v2)",
        "turns": [
            {"turn": 1, "query": "List all my artifacts",
             "expected_tools": [("harness_list", "scs_artifact_source")],
             "observe": "Baseline unfiltered list."},
            {"turn": 2, "query": "Actually, show me only the Docker image artifacts",
             "expected_tools": [],
             "observe": "V2 has no artifact_type filter. Creative workaround?"},
            {"turn": 3, "query": "Which of those have policy violations?",
             "expected_tools": [],
             "observe": "V2 has no policy_violation filter. Creative workaround?"},
        ],
    },
    {
        "id": "M05", "title": "Cross-Entity Exploration",
        "description": "Repo overview → switch to artifacts → attempt cross-entity comparison",
        "turns": [
            {"turn": 1, "query": "What's the security status of the ProtectedPDF2Doc repo?",
             "expected_tools": [("harness_list", "code_repo_security"), ("harness_get", "code_repo_security")],
             "observe": "Resolves repo name → repo_id → overview."},
            {"turn": 2, "query": "Now show me the artifacts in this project",
             "expected_tools": [("harness_list", "scs_artifact_source")],
             "observe": "Can it switch context from repos to artifacts?"},
            {"turn": 3, "query": "Compare the security posture of that repo with the first artifact",
             "expected_tools": [],
             "observe": "Cross-entity comparison not supported. Graceful decline?"},
        ],
    },
    # ─── Phase 3 Tier 1 Conversations ─────────────────────────────────────
    {
        "id": "M06", "title": "Dependency Investigation + Remediation Journey (P3-6/P3-7/P3-8/P3-9/P3-12)",
        "description": "Repo deps → dependency tree → remediation suggestion → impact analysis → auto-PR config",
        "turns": [
            {"turn": 1, "query": "Show me the direct dependencies of my first code repository",
             "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_artifact_component")],
             "observe": "P3-7: Does it use repo_id as artifact_id with dependency_type=DIRECT?"},
            {"turn": 2, "query": "Show me the full dependency tree for the first component in that list",
             "expected_tools": [("harness_get", "scs_component_dependencies")],
             "observe": "P3-8: Does it extract purl from Turn 1 and call scs_component_dependencies? Does it show DIRECT vs INDIRECT relationships?"},
            {"turn": 3, "query": "What version should I upgrade that component to? Will the upgrade break any of its dependencies?",
             "expected_tools": [("harness_get", "scs_component_remediation")],
             "observe": "P3-6/P3-9: Does it reuse purl from Turn 2 and call scs_component_remediation (NOT scs_artifact_remediation)? "
                 "Natural user query — user asks about upgrade version and dependency impact without knowing tool names."},
            {"turn": 4, "query": "What's the current auto-PR configuration for this project?",
             "expected_tools": [("harness_get", "scs_auto_pr_config")],
             "observe": "P3-12: Does it call scs_auto_pr_config? Context switch from component to project-level config."},
        ],
    },
    # ─── Error Recovery Conversations ─────────────────────────────────────
    {
        "id": "M07", "title": "Invalid Artifact ID Recovery (diagnosticHint self-correction)",
        "description": "Use a made-up artifact_id → get error → LLM should self-correct by listing sources first",
        "turns": [
            {"turn": 1, "query": "Show me the security details for artifact ID 'fake-artifact-12345'",
             "expected_tools": [("harness_get", "artifact_security")],
             "observe": "ERROR RECOVERY T1: LLM calls harness_get with fake artifact_id. Should get 404 or error. "
                 "Does the error response include diagnosticHint guidance?"},
            {"turn": 2, "query": "That didn't work. Can you find the correct artifact ID and try again?",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_get", "artifact_security")],
             "observe": "ERROR RECOVERY T2: KEY TEST — does the LLM self-correct by listing sources first, "
                 "then listing artifacts to find valid IDs, then retrying harness_get? "
                 "diagnosticHint says: 'use harness_list(resource_type=scs_artifact_source) to discover valid source IDs'."},
        ],
    },
    {
        "id": "M08", "title": "Remediation Scope Limitation Recovery (code-repo vs container image)",
        "description": "Request remediation for a container image component → 404 → LLM explains limitation → try code repo",
        "turns": [
            {"turn": 1, "query": "List my artifact sources and show me the first container image artifact",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security")],
             "observe": "Setup turn: establishes a container image artifact in context."},
            {"turn": 2, "query": "Get remediation advice for a component in that container image artifact",
             "expected_tools": [("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
             "observe": "ERROR RECOVERY T2: Remediation only works for code repo artifacts, not container images. "
                 "Should get 404. diagnosticHint says: 'remediation works for code repo artifacts only — not container images'."},
            {"turn": 3, "query": "That failed. Can you try with a code repository instead?",
             "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
             "observe": "ERROR RECOVERY T3: KEY TEST — does the LLM switch to code_repo_security, "
                 "use repo_id as artifact_id (P3-7), and retry remediation with a code repo artifact?"},
        ],
    },
    # ─── P3-10: OPA Policy Management Flow ────────────────────────────────
    {
        "id": "M09", "title": "OPA Policy Management in SCS Context (P3-10)",
        "description": "List existing policies → check compliance results → attempt to list policy sets for SBOM enforcement",
        "turns": [
            {"turn": 1, "query": "What OPA policies are currently configured in my project?",
             "expected_tools": [("harness_list", "policy")],
             "observe": "P3-10 T1: Cross-toolset routing — 'OPA policies' should route to governance `policy` resource, "
                 "not look for SCS-specific policy resource."},
            {"turn": 2, "query": "Now show me the compliance results for my first artifact to see if those policies are being enforced",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_compliance_result")],
             "observe": "P3-10 T2: Context switch from governance policies to SCS compliance results. "
                 "Tests whether LLM can chain artifact discovery → compliance results."},
            {"turn": 3, "query": "Show me the policy sets that control SBOM enforcement for this project",
             "expected_tools": [("harness_list", "policy_set")],
             "observe": "P3-10 T3: Cross-toolset routing again — 'policy sets' + 'SBOM enforcement' should route to governance `policy_set`."},
        ],
    },
    # ─── P3-3: Pipeline SBOM Step Modification Flow ─────────────────────
    {
        "id": "M10", "title": "Pipeline SBOM Step Inspection + Modification Plan (P3-3)",
        "description": "Repo security → find pipeline with SBOM step → inspect config → plan modification (cross-toolset: SCS ↔ pipeline)",
        "turns": [
            {"turn": 1, "query": "List my code repositories and show me the security overview of the first one",
             "expected_tools": [("harness_list", "code_repo_security"), ("harness_get", "code_repo_security")],
             "observe": "Setup: establishes a code repository in context for the pipeline discovery in Turn 2."},
            {"turn": 2, "query": "Find the pipeline that generates SBOMs for this project. Show me its SBOM generation step configuration.",
             "expected_tools": [("harness_list", "pipeline"), ("harness_get", "pipeline")],
             "observe": "P3-3 CROSS-TOOLSET: Does the LLM switch from SCS tools to pipeline tools? "
                 "It should list pipelines → get pipeline YAML → identify the SscaOrchestration step and report its tool type (syft/cdxgen)."},
            {"turn": 3, "query": "What would I need to change in that pipeline to switch the SBOM tool to CycloneDX (cdxgen) and add SBOM drift detection?",
             "expected_tools": [],
             "observe": "P3-3 PLANNING: LLM should reference the pipeline YAML from Turn 2 and explain the YAML changes needed "
                 "(tool.type: cdxgen, add sbom_drift section). It should NOT try to execute the update in a smoke test — "
                 "just validate it can articulate the correct modification plan. Bonus: mentions is_new_branch for safety."},
        ],
    },
    # ─── P3-1: BOM Enforcement Violation Investigation ────────────────
    {
        "id": "M12", "title": "BOM Enforcement Violation Investigation (P3-1)",
        "description": "Artifact overview → enforcement violations → enforcement summary → OPA policy cross-reference",
        "turns": [
            {"turn": 1, "query": "Show me the security overview of my first artifact",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security")],
             "observe": "P3-1 T1: Setup — establishes artifact context and surfaces enforcement_id in the violations section. "
                 "The LLM should present enforcement data including violations.enforcementId."},
            {"turn": 2, "query": "Which components failed the policy check? Show me the specific violations.",
             "expected_tools": [("harness_list", "scs_bom_violation")],
             "observe": "P3-1 T2: KEY TEST — does the LLM extract enforcement_id from Turn 1's artifact overview "
                 "and call harness_list(resource_type='scs_bom_violation', enforcement_id=<id>)? "
                 "Should show component names, violation types (DENY_LIST/ALLOW_LIST), and details."},
            {"turn": 3, "query": "Give me a summary of the violation counts — how many deny-list vs allow-list violations?",
             "expected_tools": [],
             "observe": "P3-1 T3: LLM may answer from T2 context (violation data already loaded) without a new tool call. "
                 "This is acceptable — the violation list from T2 contains enough data to summarize counts by type. "
                 "Bonus if it calls harness_get(scs_bom_violation) for the formal summary endpoint."},
            {"turn": 4, "query": "Show me the OPA policies that define these enforcement rules so I can review them",
             "expected_tools": [("harness_list", "policy")],
             "observe": "P3-1 T4: CROSS-TOOLSET — context switch from SCS bom_violation to governance policy. "
                 "Tests whether the LLM routes 'OPA policies' to the governance toolset after working in SCS context. "
                 "relatedResources on scs_bom_violation links to governance policy as sibling."},
        ],
    },
    {
        "id": "M13", "title": "BOM Violation → Remediation Chain (P3-1 + P3-6)",
        "description": "Discover violations → identify violating component → get remediation → check auto-PR config",
        "turns": [
            {"turn": 1, "query": "Show me all the policy enforcement violations for my first artifact",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security"), ("harness_list", "scs_bom_violation")],
             "observe": "P3-1 T1: Full two-step chain in single turn. Does the LLM discover artifact → get enforcement_id → list violations?"},
            {"turn": 2, "query": "For the first violated component, can you find its full details in the SBOM and suggest an upgrade version?",
             "expected_tools": [("harness_list", "scs_artifact_component"), ("harness_get", "scs_component_remediation")],
             "observe": "P3-1→P3-6 CHAIN: Does the LLM use the component name/purl from the violation in T1 to search "
                 "scs_artifact_component, then chain to scs_component_remediation for upgrade advice? "
                 "Tests cross-resource chaining from bom_violation → component → remediation."},
            {"turn": 3, "query": "Is there an auto-PR configuration that could automatically fix these violations?",
             "expected_tools": [("harness_get", "scs_auto_pr_config")],
             "observe": "P3-12: Context switch from component remediation to project-level auto-PR config. "
                 "Tests whether the LLM can pivot from per-component fixes to project-level automation."},
        ],
    },
    # ─── P3-11: OSS Risk Assessment Journey ─────────────────────────────
    {
        "id": "M14", "title": "Component OSS Risk Assessment Journey (P3-11)",
        "description": "List components → check OSS risk/EOL status → get remediation for outdated component",
        "turns": [
            {"turn": 1, "query": "Show me the SBOM components for my first artifact",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "scs_artifact_component")],
             "observe": "Setup: establishes component list with purls in context."},
            {"turn": 2, "query": "Is the zlib component from that list still actively maintained? What's its risk score and is it end-of-life?",
             "expected_tools": [("harness_get", "scs_component_enrichment")],
             "observe": "P3-11 KEY TEST: Does the LLM reuse the zlib purl from Turn 1 and route to scs_component_enrichment? "
                 "'maintained' + 'risk score' + 'end-of-life' should trigger enrichment, NOT remediation. "
                 "Response should include EOL status, is_outdated, latest_version."},
            {"turn": 3, "query": "That component looks outdated. What version should I upgrade to and will it break anything?",
             "expected_tools": [("harness_get", "scs_component_remediation")],
             "observe": "P3-11→P3-6 chain: Does the LLM reuse the purl from Turn 2 context and pivot to scs_component_remediation? "
                 "Natural follow-up — user sees outdated status from enrichment, asks for upgrade guidance."},
        ],
    },
    # ─── SBOM Drift: Server-Side Diff Between Consecutive Runs ───────
    {
        "id": "M15", "title": "SBOM Drift Between Consecutive Artifact Versions (Server-Side)",
        "description": "List artifacts → calculate drift server-side → get component diffs (tests efficient drift API flow vs manual diff)",
        "turns": [
            {"turn": 1, "query": "List the artifacts from my first artifact source, sorted by most recent. I want to compare the two latest versions.",
             "expected_tools": [("harness_list", "scs_artifact_source"), ("harness_list", "artifact_security")],
             "observe": "SBOM DRIFT T1: Does the LLM chain source list → artifact list? "
                 "The response must include orchestration.id fields — these are needed for the drift calculation in Turn 2."},
            {"turn": 2, "query": "What changed between the most recent artifact and its previous version? Calculate the diff for me.",
             "expected_tools": [("harness_execute", "scs_sbom_drift")],
             "observe": "SBOM DRIFT T2: KEY TEST — does the LLM call harness_execute(resource_type='scs_sbom_drift', action='calculate', "
                 "orchestration_id=<most_recent_orch_id>, base='last_generated_sbom')? "
                 "It should extract orchestration.id from Turn 1 artifacts. The response includes drift_id, total_drifts, and summary counts."},
            {"turn": 3, "query": "Show me the detailed component-level diffs — which packages were added, removed, or modified?",
             "expected_tools": [("harness_list", "scs_component_drift")],
             "observe": "SBOM DRIFT T3: Does the LLM use the drift_id from Turn 2 to call "
                 "harness_list(resource_type='scs_component_drift', drift_id=<id>)? "
                 "This is the drill-down step. Response should include status (added/modified/deleted), old_component, new_component."},
        ],
    },
    # ─── Cross-Capability: Security Posture → Policy → Pipeline ───────
    {
        "id": "M11", "title": "Cross-Capability Security Investigation (SCS + Governance + Pipeline)",
        "description": "Vulnerability discovery → policy enforcement check → pipeline SBOM config inspection (spans SCS, governance, pipeline toolsets)",
        "turns": [
            {"turn": 1, "query": "Show me the components with known vulnerabilities in my first code repository",
             "expected_tools": [("harness_list", "code_repo_security"), ("harness_list", "scs_artifact_component")],
             "observe": "SCS: Establishes vulnerable components in context. LLM should use repo_id as artifact_id (P3-7)."},
            {"turn": 2, "query": "What OPA policy sets are enforcing rules on this project's supply chain artifacts?",
             "expected_tools": [("harness_list", "policy_set")],
             "observe": "GOVERNANCE CROSS-TOOLSET: Context switch from SCS vulnerability data to governance policy sets. "
                 "Tests whether LLM routes to governance toolset for 'policy sets' query even after working in SCS context."},
            {"turn": 3, "query": "Now show me which pipeline handles SBOM generation for this project and what tool it uses",
             "expected_tools": [("harness_list", "pipeline"), ("harness_get", "pipeline")],
             "observe": "PIPELINE CROSS-TOOLSET: Second context switch — from governance back to pipeline tools. "
                 "Tests LLM's ability to maintain project context across 3 different toolsets in a single conversation."},
            {"turn": 4, "query": "Based on the vulnerabilities from earlier, get upgrade suggestions for the most critical component",
             "expected_tools": [("harness_get", "scs_component_remediation")],
             "observe": "SCS RETURN: Returns to SCS tools after 2 cross-toolset turns. "
                 "Tests whether LLM retains the vulnerable component purl from Turn 1 across the governance and pipeline detours."},
        ],
    },
    # ─── P3-2: OSS Risk Summary → Drill-Down → Remediation ──────────────
    {
        "id": "M16", "title": "Project OSS Risk Overview → Component Drill-Down (P3-2)",
        "description": "Get project risk summary → drill into riskiest artifact → get remediation for EOL component",
        "turns": [
            {"turn": 1, "query": "Give me a project-level OSS risk overview. How many of my artifacts have end-of-life or unmaintained components?",
             "expected_tools": [("harness_get", "scs_oss_risk_summary")],
             "observe": "P3-2 T1: Does the LLM route directly to scs_oss_risk_summary? "
                 "No artifact listing needed — this is a project-scoped GET. "
                 "Response should include total_artifacts_scanned, aggregate counts, and per-artifact breakdown."},
            {"turn": 2, "query": "Show me the EOL components in the artifact with the most risks from that summary. Filter to only DEFINITE_EOL and DERIVED_EOL.",
             "expected_tools": [("harness_list", "scs_artifact_component")],
             "observe": "P3-2 T2: Does the LLM extract artifact_id from T1's per-artifact breakdown (sorted by risk, first = most risks) "
                 "and call scs_artifact_component with oss_risk_filter='DEFINITE_EOL,DERIVED_EOL'? "
                 "Key test: oss_risk_filter should be passed in the request body."},
            {"turn": 3, "query": "For the first EOL component in that list, check its risk score and suggest an upgrade.",
             "expected_tools": [("harness_get", "scs_component_enrichment"), ("harness_get", "scs_component_remediation")],
             "observe": "P3-2→P3-11→P3-6 chain: Does the LLM reuse the purl from T2 to check enrichment (risk score) "
                 "and then chain to remediation (upgrade advice)? Tests full OSS risk triage flow."},
        ],
    },
]

# ---------------------------------------------------------------------------
# SSE Parsing (unchanged from v1)
# ---------------------------------------------------------------------------
def parse_sse_lines(raw_body: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    current_event = ""
    current_data_lines: list[str] = []
    for line in raw_body.splitlines():
        if line == "":
            if current_data_lines:
                data_str = "\n".join(current_data_lines)
                event_type = current_event or "message"
                parsed_data: Any = data_str
                try:
                    parsed_data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    pass
                events.append({"event": event_type, "data": parsed_data})
            current_event = ""
            current_data_lines = []
            continue
        if line.startswith(":"):
            continue
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current_data_lines.append(line[len("data:"):].strip())
    if current_data_lines:
        data_str = "\n".join(current_data_lines)
        parsed_data = data_str
        try:
            parsed_data = json.loads(data_str)
        except (json.JSONDecodeError, ValueError):
            pass
        events.append({"event": current_event or "message", "data": parsed_data})
    return events


# ---------------------------------------------------------------------------
# Tool Call Extraction — V2: extracts (tool_name, resource_type) tuples
# ---------------------------------------------------------------------------
def extract_tools_from_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    tools_called: list[ToolSpec] = []
    tool_params: dict[str, Any] = {}
    tool_results: list[dict[str, Any]] = []
    errors: list[str] = []
    token_usage: dict[str, int] = {}
    suggested_prompts: list[Any] = []
    thoughts_parts: list[str] = []
    final_answer_parts: list[str] = []

    for ev in events:
        event_type = ev.get("event", "")
        data = ev.get("data")
        if event_type == "assistant_tool_request":
            if isinstance(data, dict):
                for req in data.get("v", []):
                    name = req.get("name", "unknown")
                    args = req.get("arguments", {})
                    resource_type = args.get("resource_type", "")
                    tool_spec = (name, resource_type)
                    tools_called.append(tool_spec)
                    tool_params[_fmt_tool(tool_spec)] = args
        elif event_type == "assistant_tool_result":
            if isinstance(data, dict):
                for res in data.get("v", []):
                    content = res.get("content", "")
                    content_str = content if isinstance(content, str) else json.dumps(content)
                    content_len = len(content_str)
                    tool_results.append({
                        "name": res.get("name"), "is_error": res.get("is_error", False),
                        "content_length": content_len,
                        "content_preview": content_str[:1500],
                    })
        elif event_type == "assistant_thought":
            if isinstance(data, dict):
                v = data.get("v", "")
                if isinstance(v, str): thoughts_parts.append(v)
            elif isinstance(data, str): thoughts_parts.append(data)
        elif event_type == "assistant_message":
            if isinstance(data, dict):
                v = data.get("v", "")
                if isinstance(v, str): final_answer_parts.append(v)
            elif isinstance(data, str): final_answer_parts.append(data)
        elif event_type == "model_usage":
            if isinstance(data, dict):
                for _, usage in data.items():
                    if isinstance(usage, dict):
                        token_usage["prompt_tokens"] = token_usage.get("prompt_tokens", 0) + usage.get("prompt_tokens", 0)
                        token_usage["completion_tokens"] = token_usage.get("completion_tokens", 0) + usage.get("completion_tokens", 0)
                token_usage["total_tokens"] = token_usage.get("prompt_tokens", 0) + token_usage.get("completion_tokens", 0)
        elif event_type == "error":
            if isinstance(data, dict): errors.append(data.get("message", str(data)))
            elif isinstance(data, str): errors.append(data)
        elif event_type == "prompts":
            if isinstance(data, dict): suggested_prompts.append(data)
            elif isinstance(data, list): suggested_prompts.extend(data)

    seen: set = set()
    unique_tools: list[ToolSpec] = []
    for t in tools_called:
        if t not in seen:
            seen.add(t)
            unique_tools.append(t)
    return {
        "tools_called": unique_tools, "tool_params": tool_params, "tool_results": tool_results,
        "chain_depth": len(unique_tools), "final_answer": "".join(final_answer_parts),
        "final_answer_length": len("".join(final_answer_parts)), "errors": errors,
        "token_usage": token_usage, "suggested_prompts": suggested_prompts, "thoughts": "".join(thoughts_parts),
    }


# ---------------------------------------------------------------------------
# MCP Log Parsing — V2: Node.js JSON stderr + Go slog fallback
# ---------------------------------------------------------------------------
def read_mcp_log_delta(log_path: str, start_pos: int) -> tuple[list[dict], int]:
    entries: list[dict] = []
    new_pos = start_pos
    if not os.path.exists(log_path):
        return entries, new_pos
    try:
        with open(log_path, "r") as f:
            f.seek(start_pos)
            raw = f.read()
            new_pos = f.tell()
    except OSError:
        return entries, new_pos
    if not raw:
        return entries, new_pos
    for line in raw.strip().splitlines():
        try:
            entries.append(json.loads(line))
            continue
        except (json.JSONDecodeError, ValueError):
            pass
        entry: dict[str, str] = {}
        for match in re.finditer(r'(\w+)=(?:"([^"]*?)"|(\S+))', line):
            key = match.group(1)
            val = match.group(2) if match.group(2) is not None else match.group(3)
            entry[key] = val
        if entry:
            entries.append(entry)
    return entries, new_pos


def extract_tool_entries_from_log(log_entries: list[dict]) -> list[dict]:
    tool_entries = []
    for entry in log_entries:
        tool_name = entry.get("tool") or entry.get("toolName") or entry.get("name")
        if not tool_name:
            continue
        if not (tool_name.startswith("harness_") or tool_name.startswith("scs_")):
            continue
        tool_entries.append({
            "tool": tool_name,
            "resource_type": entry.get("resource_type") or entry.get("resourceType") or "",
            "elapsed_ms": _to_float(entry.get("elapsed_ms") or entry.get("duration") or entry.get("latency")),
            "response_bytes": _to_int(entry.get("response_bytes") or entry.get("size")),
            "is_error": entry.get("level") in ("ERROR", "error", "ERR") or entry.get("is_error") in ("true", True),
        })
    return tool_entries


def _to_float(val: Any) -> Optional[float]:
    if val is None: return None
    try: return float(val)
    except (ValueError, TypeError): return None

def _to_int(val: Any) -> Optional[int]:
    if val is None: return None
    try: return int(val)
    except (ValueError, TypeError): return None


# ---------------------------------------------------------------------------
# Scoring — V2: compares (tool_name, resource_type) tuples
# ---------------------------------------------------------------------------
def auto_score_tool_selection(expected_tools: list[ToolSpec], actual_tools: list[ToolSpec], confidence: str) -> str:
    if confidence == "N/A":
        return "GRACEFUL" if not actual_tools else "ATTEMPTED"
    if not expected_tools and not actual_tools:
        return "CORRECT"
    if not actual_tools:
        return "DECLINED"
    expected_set = set(expected_tools)
    actual_set = set(actual_tools)
    if expected_set == actual_set:
        return "CORRECT"
    elif expected_set.issubset(actual_set):
        return "CORRECT"
    elif expected_set & actual_set:
        return "PARTIAL"
    else:
        return "WRONG"


def _is_chain_complete(expected: list[ToolSpec], actual: list[ToolSpec]) -> bool:
    return set(expected).issubset(set(actual))


# ---------------------------------------------------------------------------
# Query Execution (unchanged logic, uses curl subprocess for SSE)
# ---------------------------------------------------------------------------
def send_query(query_text: str, genai_url: str, account_id: str, org_id: str, project_id: str,
               timeout: int = 600, conversation_id: Optional[str] = None,
               conversation_history: Optional[list[dict[str, Any]]] = None) -> tuple[list[dict[str, Any]], float]:
    if conversation_id is None:
        conversation_id = str(uuid.uuid4())
    payload = {
        "prompt": query_text, "stream": True,
        "conversation_id": conversation_id, "interaction_id": str(uuid.uuid4()),
        "metadata": {"accountId": account_id, "module": "SCS"},
        "harness_context": {"account_id": account_id, "org_id": org_id, "project_id": project_id},
        "conversation": conversation_history or [],
    }
    url = f"{genai_url}/chat/unified"
    start = time.monotonic()
    try:
        proc = subprocess.Popen(
            ["curl", "-sS", "--no-buffer", "-X", "POST", url,
             "-H", "Content-Type: application/json", "-H", "Accept: text/event-stream",
             "-d", json.dumps(payload), "--max-time", str(timeout)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        lines: list[str] = []
        last_event_type = ""
        ping_count = 0
        while True:
            raw_line = proc.stdout.readline()
            if not raw_line:
                break
            line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
            if line.startswith(": ping"):
                ping_count += 1
                if ping_count % 4 == 0:
                    print(f"    [{time.monotonic()-start:.0f}s] ... waiting ({ping_count} pings)", flush=True)
                continue
            lines.append(line)
            if line.startswith("event:"):
                last_event_type = line[len("event:"):].strip()
                print(f"    [{time.monotonic()-start:.1f}s] SSE event: {last_event_type}", flush=True)
            elif line.startswith("data:") and last_event_type in ("assistant_tool_request", "error"):
                print(f"             {line[:120]}", flush=True)
            if last_event_type == "done" and line == "":
                proc.terminate()
                break
        proc.wait(timeout=5)
        if proc.returncode and proc.returncode not in (0, -15):
            stderr_out = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
            return [{"event": "error", "data": {"message": f"curl error (rc={proc.returncode}): {stderr_out[:500]}"}}], time.monotonic() - start
        events = parse_sse_lines("\n".join(lines))
    except Exception as exc:
        return [{"event": "error", "data": {"message": str(exc)}}], time.monotonic() - start
    return events, time.monotonic() - start


# ---------------------------------------------------------------------------
# Single Query Runner
# ---------------------------------------------------------------------------
def _run_single_query(query_def: dict[str, Any], genai_url: str, account_id: str,
                      org_id: str, project_id: str, mcp_log_file: str,
                      skip_mcp_log: bool = False) -> dict[str, Any]:
    log_pos_before = 0 if skip_mcp_log else (os.path.getsize(mcp_log_file) if os.path.exists(mcp_log_file) else 0)
    events, duration_s = send_query(query_def["query"], genai_url, account_id, org_id, project_id)
    extracted = extract_tools_from_events(events)
    if skip_mcp_log:
        mcp_tool_entries = []
    else:
        mcp_log_entries_raw, _ = read_mcp_log_delta(mcp_log_file, log_pos_before)
        mcp_tool_entries = extract_tool_entries_from_log(mcp_log_entries_raw)
    tool_selection = auto_score_tool_selection(query_def["expected_tools"], extracted["tools_called"], query_def.get("confidence", "N/A"))
    result = {
        "id": query_def["id"], "query": query_def["query"],
        "expected_intent": query_def.get("expected_intent", ""), "confidence": query_def.get("confidence", ""),
        "expected_tools": [list(t) for t in query_def["expected_tools"]],
        "timestamp": datetime.now(timezone.utc).isoformat(), "duration_s": round(duration_s, 2),
        "events": _serialize_events(events),
        "extracted": {
            "tools_called": [list(t) for t in extracted["tools_called"]],
            "tool_params": extracted["tool_params"], "tool_results": extracted["tool_results"],
            "chain_depth": extracted["chain_depth"],
            "final_answer": extracted["final_answer"][:2000], "final_answer_length": extracted["final_answer_length"],
            "errors": extracted["errors"], "token_usage": extracted["token_usage"],
            "suggested_prompts": extracted["suggested_prompts"],
        },
        "mcp_log_entries": mcp_tool_entries,
        "scoring": {
            "tool_selection": tool_selection,
            "chain_complete": _is_chain_complete(query_def["expected_tools"], extracted["tools_called"]),
            "answer_score": None, "notable_observations": None,
        },
    }
    _print_query_summary(result, extracted)
    return result


def _serialize_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    serialized = []
    for ev in events:
        entry: dict[str, Any] = {"event": ev["event"]}
        data = ev.get("data")
        if isinstance(data, str) and len(data) > 1000:
            entry["data"] = data[:1000] + "... [truncated]"
        elif isinstance(data, dict):
            entry["data"] = {k: (v[:1000] + "... [truncated]" if isinstance(v, str) and len(v) > 1000 else v) for k, v in data.items()}
        else:
            entry["data"] = data
        serialized.append(entry)
    return serialized


def _print_query_summary(result: dict, extracted: dict) -> None:
    score = result["scoring"]["tool_selection"]
    label = {"CORRECT": "PASS", "PARTIAL": "PARTIAL", "WRONG": "FAIL", "DECLINED": "DECLINED", "GRACEFUL": "GRACEFUL", "ATTEMPTED": "ATTEMPTED"}.get(score, score)
    print(f"\n  Result: [{label}] tool_selection={score}")
    print(f"  Duration: {result['duration_s']}s")
    print(f"  Tools called: {_fmt_tools(extracted['tools_called'])}")
    print(f"  Chain complete: {result['scoring']['chain_complete']}")
    print(f"  Answer length: {extracted['final_answer_length']} chars")
    if extracted["token_usage"]:
        t = extracted["token_usage"]
        print(f"  Tokens: prompt={t.get('prompt_tokens','?')}, completion={t.get('completion_tokens','?')}, total={t.get('total_tokens','?')}")
    if extracted["errors"]:
        print(f"  Errors: {extracted['errors']}")
    preview = extracted["final_answer"][:200]
    if preview:
        print(f"  Answer preview: {preview}...")


# ---------------------------------------------------------------------------
# Conversation Runner
# ---------------------------------------------------------------------------
def run_conversation(conv_def: dict[str, Any], genai_url: str, account_id: str, org_id: str,
                     project_id: str, mcp_log_file: str, delay: float = INTER_QUERY_DELAY,
                     history_mode: str = HISTORY_MODE_ANSWER_ONLY) -> dict[str, Any]:
    conv_id = str(uuid.uuid4())
    history: list[dict[str, Any]] = []
    turn_results: list[dict[str, Any]] = []
    total_duration = 0.0
    all_tools: list[ToolSpec] = []
    all_errors: list[str] = []
    total_tokens: dict[str, int] = {}

    for turn_def in conv_def["turns"]:
        turn_num = turn_def["turn"]
        print(f"\n  --- Turn {turn_num}/{len(conv_def['turns'])}: {turn_def['query']}")
        log_pos_before = os.path.getsize(mcp_log_file) if os.path.exists(mcp_log_file) else 0
        events, duration_s = send_query(turn_def["query"], genai_url, account_id, org_id, project_id, conversation_id=conv_id, conversation_history=history)
        extracted = extract_tools_from_events(events)
        mcp_log_entries_raw, _ = read_mcp_log_delta(mcp_log_file, log_pos_before)
        mcp_tool_entries = extract_tool_entries_from_log(mcp_log_entries_raw)
        tool_selection = auto_score_tool_selection(turn_def["expected_tools"], extracted["tools_called"], "N/A" if not turn_def["expected_tools"] else "High")

        turn_results.append({
            "turn": turn_num, "query": turn_def["query"],
            "expected_tools": [list(t) for t in turn_def["expected_tools"]], "observe": turn_def["observe"],
            "duration_s": round(duration_s, 2),
            "tools_called": [list(t) for t in extracted["tools_called"]],
            "tool_params": extracted["tool_params"], "tool_results": extracted["tool_results"],
            "final_answer": extracted["final_answer"][:2000], "final_answer_length": extracted["final_answer_length"],
            "errors": extracted["errors"], "token_usage": extracted["token_usage"],
            "mcp_log_entries": mcp_tool_entries, "tool_selection": tool_selection,
            "chain_complete": _is_chain_complete(turn_def["expected_tools"], extracted["tools_called"]),
        })
        total_duration += duration_s
        all_tools.extend(extracted["tools_called"])
        all_errors.extend(extracted["errors"])
        for k, v in extracted["token_usage"].items():
            total_tokens[k] = total_tokens.get(k, 0) + v
        print(f"    [{tool_selection}] tools={_fmt_tools(extracted['tools_called'])} duration={duration_s:.1f}s answer_len={extracted['final_answer_length']}")
        if extracted["errors"]:
            print(f"    ERRORS: {extracted['errors']}")
        history.append({"role": "user", "message": {"type": "text", "data": turn_def["query"]}})
        text = extracted["final_answer"] or extracted["thoughts"]
        if text:
            if history_mode == HISTORY_MODE_TOOL_SUMMARY:
                tool_summary = build_tool_call_summary(extracted)
                answer_budget = MAX_HISTORY_CHARS - len(tool_summary)
                history_text = f"{text[:max(answer_budget, 0)]}{tool_summary}"
            else:
                history_text = text[:MAX_HISTORY_CHARS]
            history.append({"role": "assistant", "message": {"type": "text", "data": history_text}})
        if turn_num < len(conv_def["turns"]):
            time.sleep(delay)

    turns_correct = sum(1 for t in turn_results if t["tool_selection"] == "CORRECT")
    turns_with_tools = sum(1 for t in turn_results if t["expected_tools"])
    overall = "CORRECT" if turns_correct == turns_with_tools and turns_with_tools > 0 else "PARTIAL" if turns_correct > 0 else "WRONG"
    seen: set = set()
    unique_tools = [t for t in all_tools if t not in seen and not seen.add(t)]
    return {
        "id": conv_def["id"], "type": "conversation", "title": conv_def["title"],
        "description": conv_def["description"], "conversation_id": conv_id,
        "timestamp": datetime.now(timezone.utc).isoformat(), "duration_s": round(total_duration, 2),
        "num_turns": len(conv_def["turns"]), "turns": turn_results,
        "aggregate": {"all_tools_called": [list(t) for t in unique_tools], "total_chain_depth": len(unique_tools), "total_errors": all_errors, "total_token_usage": total_tokens},
        "scoring": {"overall": overall, "turns_correct": turns_correct, "turns_total": len(conv_def["turns"]), "turns_with_expected_tools": turns_with_tools, "context_retention": None, "answer_score": None, "notable_observations": None},
        "history_mode": history_mode,
    }


# ---------------------------------------------------------------------------
# Main Runner + Summary + Output
# ---------------------------------------------------------------------------
def _run_single_query_worker(args: tuple) -> dict[str, Any]:
    """Worker function for parallel single-turn query execution."""
    query_def, genai_url, account_id, org_id, project_id, mcp_log_file, idx, total = args
    print(f"\n{'='*70}\n[{idx}/{total}] {query_def['id']}: {query_def['query']}\n{'='*70}", flush=True)
    result = _run_single_query(query_def, genai_url, account_id, org_id, project_id, mcp_log_file, skip_mcp_log=True)
    return result


def _run_conversation_worker(args: tuple) -> dict[str, Any]:
    """Worker function for parallel multi-turn conversation execution."""
    conv_def, genai_url, account_id, org_id, project_id, mcp_log_file, delay, history_mode, idx, total = args
    print(f"\n{'='*70}\n[{idx}/{total}] {conv_def['id']}: {conv_def['title']}\n  {conv_def['description']}\n{'='*70}", flush=True)
    cr = run_conversation(conv_def, genai_url, account_id, org_id, project_id, mcp_log_file, delay, history_mode)
    s = cr["scoring"]
    print(f"\n  Conversation {conv_def['id']}: [{s['overall']}] turns_correct={s['turns_correct']}/{s['turns_total']} duration={cr['duration_s']}s", flush=True)
    return cr


def run_smoke_tests(genai_url: str = GENAI_URL, account_id: str = ACCOUNT_ID, org_id: str = ORG_ID,
                    project_id: str = PROJECT_ID, mcp_log_file: str = MCP_LOG_FILE,
                    query_ids: Optional[list[str]] = None, delay: float = INTER_QUERY_DELAY,
                    history_mode: str = HISTORY_MODE_ANSWER_ONLY,
                    concurrency: int = 1, skip_na: bool = False) -> dict[str, Any]:
    run_single = run_multi = True
    single_ids = multi_ids = None
    if query_ids:
        id_set = {qid.upper() for qid in query_ids}
        single_ids = {qid for qid in id_set if qid.startswith("Q")}
        multi_ids = {qid for qid in id_set if qid.startswith("M")}
        run_single, run_multi = bool(single_ids), bool(multi_ids)
        if not single_ids and not multi_ids:
            print(f"ERROR: No queries matched IDs: {query_ids}", file=sys.stderr)
            sys.exit(1)
    queries = [q for q in QUERIES if q["id"] in single_ids] if single_ids else QUERIES
    conversations = [c for c in CONVERSATIONS if c["id"] in multi_ids] if multi_ids else CONVERSATIONS

    if skip_na:
        before = len(queries)
        queries = [q for q in queries if q.get("confidence") != "N/A"]
        skipped = before - len(queries)
        if skipped:
            print(f"[skip-na] Skipping {skipped} N/A confidence queries")

    print(f"[pre-flight] Checking genai-service at {genai_url} ...")
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{genai_url}/docs", method="GET"), timeout=10) as r:
            print(f"[pre-flight] genai-service is {'UP' if r.status == 200 else f'WARNING: status {r.status}'}")
    except (urllib.error.URLError, OSError):
        print(f"[pre-flight] ERROR: Cannot connect to {genai_url}", file=sys.stderr)
        sys.exit(1)

    parallel = concurrency > 1
    if parallel:
        print(f"[parallel] Running with concurrency={concurrency} (MCP log per-query attribution disabled)")

    run_start = time.monotonic()
    run_timestamp = datetime.now(timezone.utc).isoformat()
    single_results: list[dict[str, Any]] = []
    conv_results: list[dict[str, Any]] = []

    if run_single and queries:
        print(f"\n{'#'*70}\n# SINGLE-TURN QUERIES ({len(queries)}){' [parallel]' if parallel else ''}\n{'#'*70}")
        if parallel:
            worker_args = [
                (qd, genai_url, account_id, org_id, project_id, mcp_log_file, idx, len(queries))
                for idx, qd in enumerate(queries, 1)
            ]
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = {executor.submit(_run_single_query_worker, a): a[0]["id"] for a in worker_args}
                for future in concurrent.futures.as_completed(futures):
                    qid = futures[future]
                    try:
                        single_results.append(future.result())
                    except Exception as exc:
                        print(f"  ERROR: {qid} raised {exc}", file=sys.stderr)
            single_results.sort(key=lambda r: r["id"])
        else:
            for idx, qd in enumerate(queries, 1):
                print(f"\n{'='*70}\n[{idx}/{len(queries)}] {qd['id']}: {qd['query']}\n{'='*70}")
                single_results.append(_run_single_query(qd, genai_url, account_id, org_id, project_id, mcp_log_file))
                if idx < len(queries):
                    print(f"\n  [delay] Waiting {delay}s..."); time.sleep(delay)

    if run_multi and conversations:
        print(f"\n{'#'*70}\n# MULTI-TURN CONVERSATIONS ({len(conversations)}){' [parallel]' if parallel else ''}\n{'#'*70}")
        if parallel:
            worker_args = [
                (cd, genai_url, account_id, org_id, project_id, mcp_log_file, delay, history_mode, idx, len(conversations))
                for idx, cd in enumerate(conversations, 1)
            ]
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = {executor.submit(_run_conversation_worker, a): a[0]["id"] for a in worker_args}
                for future in concurrent.futures.as_completed(futures):
                    cid = futures[future]
                    try:
                        conv_results.append(future.result())
                    except Exception as exc:
                        print(f"  ERROR: {cid} raised {exc}", file=sys.stderr)
            conv_results.sort(key=lambda r: r["id"])
        else:
            for idx, cd in enumerate(conversations, 1):
                print(f"\n{'='*70}\n[{idx}/{len(conversations)}] {cd['id']}: {cd['title']}\n  {cd['description']}\n{'='*70}")
                cr = run_conversation(cd, genai_url, account_id, org_id, project_id, mcp_log_file, delay, history_mode)
                conv_results.append(cr)
                s = cr["scoring"]
                print(f"\n  Conversation: [{s['overall']}] turns_correct={s['turns_correct']}/{s['turns_total']} duration={cr['duration_s']}s")
                if idx < len(conversations):
                    print(f"\n  [delay] Waiting {delay}s..."); time.sleep(delay)

    return _build_summary(single_results, conv_results, run_timestamp, time.monotonic() - run_start, account_id, org_id, project_id, history_mode)


def _build_summary(results, conv_results, run_timestamp, total_duration, account_id, org_id, project_id, history_mode=HISTORY_MODE_ANSWER_ONLY):
    def _count(score): return sum(1 for r in results if r["scoring"]["tool_selection"] == score)
    durations = [r["duration_s"] for r in results if r["duration_s"] > 0]
    chain_depths = [r["extracted"]["chain_depth"] for r in results]
    by_confidence: dict[str, dict[str, int]] = {}
    for r in results:
        tier = r["confidence"]
        if tier not in by_confidence:
            by_confidence[tier] = {"count": 0, "correct": 0, "partial": 0, "wrong": 0, "declined": 0, "graceful": 0, "attempted": 0}
        by_confidence[tier]["count"] += 1
        key = r["scoring"]["tool_selection"].lower()
        if key in by_confidence[tier]:
            by_confidence[tier][key] += 1

    conv_summary = {}
    if conv_results:
        conv_durations = [c["duration_s"] for c in conv_results if c["duration_s"] > 0]
        conv_summary = {
            "total_conversations": len(conv_results),
            "overall_correct": sum(1 for c in conv_results if c["scoring"]["overall"] == "CORRECT"),
            "overall_partial": sum(1 for c in conv_results if c["scoring"]["overall"] == "PARTIAL"),
            "overall_wrong": sum(1 for c in conv_results if c["scoring"]["overall"] == "WRONG"),
            "total_turns": sum(c["num_turns"] for c in conv_results),
            "turns_correct": sum(c["scoring"]["turns_correct"] for c in conv_results),
            "avg_duration_s": round(sum(conv_durations) / len(conv_durations), 2) if conv_durations else 0,
            "total_tokens": sum(c["aggregate"]["total_token_usage"].get("total_tokens", 0) for c in conv_results),
        }
    return {
        "run_metadata": {
            "timestamp": run_timestamp, "provider": "anthropic", "model": "claude-sonnet-4-20250514",
            "account_id": account_id, "org_id": org_id, "project_id": project_id,
            "mcp_server_version": "2.0.0", "mcp_server_type": "node", "mcp_server_repo": "harness-mcp-v2",
            "tool_model": "generic (harness_list, harness_get, harness_describe)",
            "history_mode": history_mode,
            "total_duration_s": round(total_duration, 2), "genai_url": GENAI_URL,
        },
        "results": results, "conversation_results": conv_results,
        "summary": {
            "total_queries": len(results), "tool_selection_correct": _count("CORRECT"),
            "tool_selection_partial": _count("PARTIAL"), "tool_selection_wrong": _count("WRONG"),
            "tool_selection_declined": _count("DECLINED"), "tool_selection_graceful": _count("GRACEFUL"),
            "tool_selection_attempted": _count("ATTEMPTED"),
            "avg_duration_s": round(sum(durations) / len(durations), 2) if durations else 0,
            "avg_chain_depth": round(sum(chain_depths) / len(chain_depths), 2) if chain_depths else 0,
            "total_tokens": sum(r["extracted"]["token_usage"].get("total_tokens", 0) for r in results),
            "errors_encountered": sum(1 for r in results if r["extracted"]["errors"]),
            "by_confidence": by_confidence,
        },
        "conversation_summary": conv_summary,
    }


def write_results(summary: dict[str, Any]) -> tuple[Path, Path]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results_path = OUTPUT_DIR / "smoke_test_results.json"
    summary_path = OUTPUT_DIR / "smoke_test_summary.json"
    with open(results_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    # Timestamped copy for historical comparison (flaky detection, trend analysis)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    ts_path = OUTPUT_DIR / f"smoke_test_results_{ts}.json"
    with open(ts_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    summary_only = {
        "run_metadata": summary["run_metadata"], "summary": summary["summary"],
        "scoring_table": [
            {"id": r["id"], "query": r["query"][:60], "confidence": r["confidence"],
             "expected_tools": r["expected_tools"], "actual_tools": r["extracted"]["tools_called"],
             "tool_selection": r["scoring"]["tool_selection"], "chain_complete": r["scoring"]["chain_complete"],
             "duration_s": r["duration_s"], "answer_length": r["extracted"]["final_answer_length"],
             "errors": r["extracted"]["errors"],
             **({"langfuse_scores": {k: v["value"] for k, v in r["scoring"]["langfuse_scores"].items()}}
                if r["scoring"].get("langfuse_scores") else {})}
            for r in summary["results"]
        ],
    }
    if summary.get("conversation_results"):
        summary_only["conversation_summary"] = summary.get("conversation_summary", {})
        summary_only["conversation_scoring_table"] = [
            {"id": c["id"], "title": c["title"], "num_turns": c["num_turns"],
             "overall": c["scoring"]["overall"], "turns_correct": c["scoring"]["turns_correct"],
             "turns_total": c["scoring"]["turns_total"], "duration_s": c["duration_s"],
             "all_tools": c["aggregate"]["all_tools_called"], "total_errors": c["aggregate"]["total_errors"],
             **({"langfuse_scores": {k: v["value"] for k, v in c["scoring"]["langfuse_scores"].items()}}
                if c["scoring"].get("langfuse_scores") else {})}
            for c in summary["conversation_results"]
        ]
    with open(summary_path, "w") as f:
        json.dump(summary_only, f, indent=2, default=str)
    return results_path, summary_path


def print_final_summary(summary: dict[str, Any]) -> None:
    s = summary["summary"]
    meta = summary["run_metadata"]
    print(f"\n{'='*70}\nSMOKE TEST SUMMARY (V2)\n{'='*70}")
    print(f"  Timestamp:     {meta['timestamp']}\n  Model:         {meta['model']}")
    print(f"  MCP Server:    {meta['mcp_server_repo']} ({meta['mcp_server_type']})")
    print(f"  Tool Model:    {meta['tool_model']}")
    print(f"  History Mode:  {meta.get('history_mode', 'answer_only')}")
    print(f"  Account:       {meta['account_id']}\n  Org/Project:   {meta['org_id']}/{meta['project_id']}")
    print(f"  Total time:    {meta['total_duration_s']}s\n")
    if summary["results"]:
        print(f"  SINGLE-TURN QUERIES\n  Queries run:     {s['total_queries']}")
        print(f"  Tool CORRECT:    {s['tool_selection_correct']}\n  Tool PARTIAL:    {s['tool_selection_partial']}")
        print(f"  Tool WRONG:      {s['tool_selection_wrong']}\n  Tool DECLINED:   {s['tool_selection_declined']}")
        print(f"  Tool GRACEFUL:   {s['tool_selection_graceful']}\n  Tool ATTEMPTED:  {s['tool_selection_attempted']}")
        print(f"  Avg duration:    {s['avg_duration_s']}s\n  Avg chain depth: {s['avg_chain_depth']}")
        print(f"  Total tokens:    {s['total_tokens']}\n  Errors:          {s['errors_encountered']}\n")
        print("  By Confidence Tier:")
        for tier, counts in s["by_confidence"].items():
            print(f"    {tier}: {counts}")
        has_langfuse = any(r["scoring"].get("langfuse_scores") for r in summary["results"])
        if has_langfuse:
            print(f"\n  {'ID':<5} {'Score':<12} {'Chain':<6} {'Time':<7} {'Traj':<6} {'Params':<7} {'AnsQ':<6} {'Tools Called'}")
            print(f"  {'--':<5} {'-----':<12} {'-----':<6} {'----':<7} {'----':<6} {'------':<7} {'----':<6} {'------------'}")
            for r in summary["results"]:
                tools_str = ", ".join(f"{t[0]}({t[1]})" if isinstance(t, list) and len(t) == 2 else str(t) for t in r["extracted"]["tools_called"]) or "(none)"
                chain = "Yes" if r["scoring"]["chain_complete"] else "No"
                lf = r["scoring"].get("langfuse_scores", {})
                traj = f"{lf['trajectory']['value']:.2f}" if lf.get("trajectory", {}).get("value") is not None else "-"
                params = f"{lf['parameters']['value']:.2f}" if lf.get("parameters", {}).get("value") is not None else "-"
                ansq = f"{lf['answer_quality']['value']:.2f}" if lf.get("answer_quality", {}).get("value") is not None else "-"
                print(f"  {r['id']:<5} {r['scoring']['tool_selection']:<12} {chain:<6} {r['duration_s']}s".ljust(35) + f" {traj:<6} {params:<7} {ansq:<6} {tools_str}")
        else:
            print(f"\n  {'ID':<5} {'Score':<12} {'Chain':<6} {'Time':<7} {'Tools Called'}")
            print(f"  {'--':<5} {'-----':<12} {'-----':<6} {'----':<7} {'------------'}")
            for r in summary["results"]:
                tools_str = ", ".join(f"{t[0]}({t[1]})" if isinstance(t, list) and len(t) == 2 else str(t) for t in r["extracted"]["tools_called"]) or "(none)"
                chain = "Yes" if r["scoring"]["chain_complete"] else "No"
                print(f"  {r['id']:<5} {r['scoring']['tool_selection']:<12} {chain:<6} {r['duration_s']}s".ljust(35) + f" {tools_str}")
        print()
    conv_results = summary.get("conversation_results", [])
    cs = summary.get("conversation_summary", {})
    if conv_results:
        print(f"  MULTI-TURN CONVERSATIONS\n  Conversations:   {cs.get('total_conversations', 0)}")
        print(f"  Overall CORRECT: {cs.get('overall_correct', 0)}\n  Overall PARTIAL: {cs.get('overall_partial', 0)}")
        print(f"  Total turns:     {cs.get('total_turns', 0)} ({cs.get('turns_correct', 0)} correct)")
        print(f"  Avg duration:    {cs.get('avg_duration_s', 0)}s\n  Total tokens:    {cs.get('total_tokens', 0)}\n")
        print(f"  {'ID':<5} {'Overall':<10} {'Turns':<12} {'Time':<9} {'Title'}")
        print(f"  {'--':<5} {'-------':<10} {'-----':<12} {'----':<9} {'-----'}")
        for c in conv_results:
            print(f"  {c['id']:<5} {c['scoring']['overall']:<10} {c['scoring']['turns_correct']}/{c['scoring']['turns_total']:<10} {c['duration_s']}s".ljust(40) + f" {c['title'][:40]}")
        print()
        for c in conv_results:
            print(f"  {c['id']}: {c['title']}")
            for t in c["turns"]:
                tools_str = ", ".join(f"{x[0]}({x[1]})" if isinstance(x, list) and len(x) == 2 else str(x) for x in t["tools_called"]) or "(none)"
                print(f"    T{t['turn']}: [{t['tool_selection']}] {t['query'][:50]}")
                print(f"         tools={tools_str} duration={t['duration_s']}s")
        print()


# ---------------------------------------------------------------------------
# Langfuse Scoring (post-run)
# ---------------------------------------------------------------------------
def _run_langfuse_scoring(lf_integration, summary: dict[str, Any]) -> None:
    """Score all results via Langfuse evaluators and attach scores to traces.

    Runs after the smoke test completes. Creates Langfuse traces for each
    query/conversation and attaches evaluator scores (trajectory, parameters,
    latency, answer quality, etc.).
    """
    results = summary.get("results", [])
    conv_results = summary.get("conversation_results", [])

    # Build a lookup from query_id -> query_def for expected_output info
    query_lookup = {q["id"]: q for q in QUERIES}
    conv_lookup = {c["id"]: c for c in CONVERSATIONS}

    # --- Score single-turn queries ---
    if results:
        print(f"\n  Scoring {len(results)} single-turn queries...")
        for r in results:
            query_def = query_lookup.get(r["id"], {})
            if not query_def:
                continue
            extracted = {
                "tools_called": [tuple(t) for t in r["extracted"]["tools_called"]],
                "tool_params": r["extracted"]["tool_params"],
                "tool_results": r["extracted"].get("tool_results", {}),
                "final_answer": r["extracted"]["final_answer"],
                "final_answer_length": r["extracted"]["final_answer_length"],
                "errors": r["extracted"]["errors"],
                "token_usage": r["extracted"]["token_usage"],
                "chain_depth": r["extracted"]["chain_depth"],
            }
            trace_id = lf_integration.create_trace(query_def, extracted, r["duration_s"])
            scores = lf_integration.score_single_query(query_def, extracted, r["duration_s"], trace_id=trace_id)

            # Attach Langfuse scores back into the result for JSON output
            r["scoring"]["langfuse_scores"] = scores

            score_summary = " | ".join(f"{k}={v['value']}" for k, v in scores.items() if v.get("value") is not None)
            print(f"    {r['id']}: {score_summary}")

    # --- Score multi-turn conversations ---
    if conv_results:
        print(f"\n  Scoring {len(conv_results)} multi-turn conversations...")
        for cr in conv_results:
            conv_def = conv_lookup.get(cr["id"], {})
            if not conv_def:
                continue
            turn_results = cr.get("turns", [])
            trace_id = lf_integration.create_conversation_trace(conv_def, turn_results, cr["duration_s"])
            scores = lf_integration.score_conversation(conv_def, turn_results, cr["duration_s"], trace_id=trace_id)

            # Attach Langfuse scores back into the result for JSON output
            cr["scoring"]["langfuse_scores"] = scores

            score_summary = " | ".join(f"{k}={v['value']}" for k, v in scores.items() if v.get("value") is not None)
            print(f"    {cr['id']}: {score_summary}")

    # --- Run-level aggregate evaluators ---
    from langfuse_evaluators import RUN_EVALUATORS
    query_confidence = {q["id"]: q.get("confidence", "N/A") or "N/A" for q in QUERIES}
    item_results = []
    for r in results:
        lf_scores = r["scoring"].get("langfuse_scores", {})
        if lf_scores:
            item_results.append({
                "query_id": r["id"],
                "confidence": query_confidence.get(r["id"], r.get("confidence") or "N/A"),
                "evaluations": lf_scores,
                "token_usage": r["extracted"].get("token_usage", {}),
            })
    # Include multi-turn conversation scores in aggregation.
    # When per-turn scores exist, use them exclusively (evaluations + token_usage)
    # to avoid double-counting. When no per-turn scores exist (judge disabled),
    # fall back to conversation-level aggregates.
    for cr in conv_results:
        lf_scores = cr["scoring"].get("langfuse_scores", {})
        conv_usage = cr.get("aggregate", {}).get("total_token_usage", {})
        turns = cr.get("turns", [])
        has_per_turn = any(t.get("langfuse_scores") for t in turns)

        if has_per_turn:
            # Per-turn entries carry evaluations for MQI and token_usage for
            # token_cost. No conv-level entry needed — per-turn token_usage
            # already sums to total, adding conv_usage would double-count.
            for turn in turns:
                turn_lf = turn.get("langfuse_scores", {})
                if turn_lf:
                    item_results.append({
                        "query_id": f"{cr['id']}-T{turn.get('turn', '?')}",
                        "confidence": "High",
                        "evaluations": turn_lf,
                        "token_usage": turn.get("token_usage", {}),
                    })
        elif lf_scores or conv_usage:
            # No per-turn scores — use conversation-level for everything
            item_results.append({
                "query_id": cr["id"],
                "confidence": "High",
                "evaluations": lf_scores or {},
                "token_usage": conv_usage,
            })
    if item_results:
        print(f"\n  Run-level aggregates ({len(item_results)} scored items):")
        for run_eval in RUN_EVALUATORS:
            try:
                agg = run_eval(item_results=item_results)
                if isinstance(agg, dict) and agg.get("value") is not None:
                    val = agg["value"]
                    val_str = f"{val:,.0f}" if agg["name"] == "token_cost" else f"{val:.3f}"
                    print(f"    {agg['name']}: {val_str} — {agg.get('comment', '')}")
                    summary.setdefault("run_aggregates", {})[agg["name"]] = {
                        "value": agg["value"], "comment": agg.get("comment", ""),
                    }
            except Exception as e:
                print(f"    {run_eval.__name__}: error — {e}")

    # Push run aggregates to Langfuse
    run_aggs = summary.get("run_aggregates", {})
    if run_aggs:
        lf_integration.push_run_aggregates(run_aggs)

    # --- Summary ---
    total_traces = len(results) + len(conv_results)
    # Multi-turn creates per-turn traces too (parent + N turns per conversation)
    per_turn_traces = sum(len(cr.get("turns", [])) for cr in conv_results)
    total_all = total_traces + per_turn_traces
    print(f"\n  [langfuse] Created {total_all} traces ({len(results)} single-turn + {len(conv_results)} conversation parents + {per_turn_traces} per-turn)")
    print(f"  [langfuse] Experiment run: {lf_integration.experiment_run_name}")
    print(f"  [langfuse] View results at: {os.getenv('LANGFUSE_HOST', 'https://langfuse-prod.harness.io')}")


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Phase 0.5: LLM Smoke Test for SCS MCP Tools (V2)")
    parser.add_argument("--url", default=GENAI_URL, help=f"genai-service base URL (default: {GENAI_URL})")
    parser.add_argument("--account-id", default=ACCOUNT_ID)
    parser.add_argument("--org-id", default=ORG_ID)
    parser.add_argument("--project-id", default=PROJECT_ID)
    parser.add_argument("--query-ids", default=None, help="Comma-separated IDs (e.g., Q01,Q05,M01,M03)")
    parser.add_argument("--delay", type=float, default=INTER_QUERY_DELAY)
    parser.add_argument("--history-mode", default=HISTORY_MODE_ANSWER_ONLY,
                        choices=[HISTORY_MODE_ANSWER_ONLY, HISTORY_MODE_TOOL_SUMMARY],
                        help="Multi-turn history strategy: 'answer_only' (Strategy A, default) or 'tool_summary' (Strategy B — enriches history with tool call summaries)")
    parser.add_argument("--mcp-log", default=MCP_LOG_FILE)
    parser.add_argument("--concurrency", type=int, default=1,
                        help="Number of queries to run in parallel (default: 1 = sequential). "
                             "Recommended: 3-5. MCP log per-query attribution is disabled in parallel mode.")
    parser.add_argument("--skip-na", action="store_true", default=False,
                        help="Skip queries with N/A confidence (unsupported features)")
    parser.add_argument("--langfuse", action="store_true", default=False,
                        help="Enable Langfuse integration: push traces and evaluator scores to Langfuse. "
                             "Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY env vars. "
                             "Optionally set LANGFUSE_HOST (default: https://langfuse-prod.harness.io)")
    parser.add_argument("--langfuse-judge", action="store_true", default=False,
                        help="Enable LLM-as-Judge answer quality evaluation (requires --langfuse). "
                             "Uses EVAL_JUDGE_MODEL (default: gpt-4.1-mini) and EVAL_JUDGE_PROVIDER (default: openai). "
                             "Adds ~$0.01/query in LLM costs.")
    parser.add_argument("--harness-judge", action="store_true", default=False,
                        help="Use Harness ai-evals LLM-as-Judge service for rubric-based multi-criteria scoring "
                             "(requires --langfuse --langfuse-judge). "
                             "Requires HARNESS_EVAL_API_URL and HARNESS_EVAL_API_TOKEN env vars. "
                             "Falls back to OpenAI if unavailable.")
    parser.add_argument("--no-fail-on-regression", action="store_true", default=False,
                        help="Do not exit with code 1 when regressions are detected. "
                             "Useful for local development. CI pipelines should omit this flag.")
    parser.add_argument("--deepeval", action="store_true", default=False,
                        help="Enable DeepEval G-Eval metrics (requires pip install deepeval). "
                             "Adds tool_correctness, answer_quality, and faithfulness scores "
                             "using chain-of-thought + token probability calibration. "
                             "Requires OPENAI_API_KEY. Optionally set DEEPEVAL_MODEL (default: gpt-4.1-mini).")
    parser.add_argument("--langfuse-sync-only", action="store_true", default=False,
                        help="Only sync datasets to Langfuse without running tests (requires --langfuse)")
    args = parser.parse_args()
    query_ids = [qid.strip() for qid in args.query_ids.split(",")] if args.query_ids else None

    print(f"{'='*70}\nPhase 0.5: SCS LLM Smoke Test (V2 — harness-mcp-v2)\n{'='*70}")
    print(f"  genai-service URL: {args.url}\n  Account:           {args.account_id}")
    print(f"  Org/Project:       {args.org_id}/{args.project_id}\n  MCP log:           {args.mcp_log}")
    print(f"  Query delay:       {args.delay}s")
    print(f"  History mode:      {args.history_mode}")
    print(f"  Concurrency:       {args.concurrency}{' (parallel)' if args.concurrency > 1 else ' (sequential)'}")
    print(f"  Skip N/A:          {args.skip_na}")
    judge_label = ""
    if args.langfuse_judge:
        judge_label = "  (+ Harness ai-evals judge)" if args.harness_judge else "  (+ LLM judge)"
    print(f"  Langfuse:          {args.langfuse}{judge_label}")
    print(f"  DeepEval:          {args.deepeval}")
    if query_ids:
        print(f"  Running IDs:       {query_ids}")
    else:
        print(f"  Running:           ALL ({len(QUERIES)} single-turn + {len(CONVERSATIONS)} multi-turn)")
    print()

    # --- Langfuse initialization (optional) ---
    lf_integration = None
    if args.langfuse:
        try:
            from langfuse_evaluators import LangfuseIntegration
            lf_integration = LangfuseIntegration(
                enable_judge=args.langfuse_judge,
                use_harness_judge=args.harness_judge,
            )
            print(f"  [langfuse] Experiment run: {lf_integration.experiment_run_name}")
            lf_integration.sync_dataset(QUERIES)
            lf_integration.sync_conversation_dataset(CONVERSATIONS)
            if args.langfuse_sync_only:
                print("\n  [langfuse] Dataset sync complete (--langfuse-sync-only). Exiting.")
                lf_integration.flush()
                return
        except ImportError as e:
            print(f"  [langfuse] WARNING: {e}. Continuing without Langfuse.", file=sys.stderr)
            lf_integration = None
        except Exception as e:
            print(f"  [langfuse] WARNING: Failed to initialize: {e}. Continuing without Langfuse.", file=sys.stderr)
            lf_integration = None

    summary = run_smoke_tests(args.url, args.account_id, args.org_id, args.project_id, args.mcp_log, query_ids, args.delay, args.history_mode,
                              concurrency=args.concurrency, skip_na=args.skip_na)

    # --- Langfuse scoring (post-run) ---
    if lf_integration and summary:
        print(f"\n{'#'*70}\n# LANGFUSE EVALUATION (experiment: {lf_integration.experiment_run_name})\n{'#'*70}")
        _run_langfuse_scoring(lf_integration, summary)
        lf_integration.flush()

    # --- DeepEval scoring (optional, independent of Langfuse) ---
    if args.deepeval and summary:
        try:
            from deepeval_evaluators import _check_deepeval, create_geval_metrics, run_deepeval_scoring, run_deepeval_aggregate
            if not _check_deepeval():
                print("\n  [deepeval] WARNING: deepeval package not installed. Run: pip install deepeval", file=sys.stderr)
            else:
                print(f"\n{'#'*70}\n# DEEPEVAL G-EVAL SCORING\n{'#'*70}")
                metrics = create_geval_metrics()
                query_lookup_de = {q["id"]: q for q in QUERIES}
                all_deepeval_scores = []
                for r in summary.get("results", []):
                    qdef = query_lookup_de.get(r["id"])
                    if not qdef:
                        continue
                    extracted = {
                        "tools_called": [tuple(t) for t in r["extracted"]["tools_called"]],
                        "tool_params": r["extracted"]["tool_params"],
                        "tool_results": r["extracted"].get("tool_results", {}),
                        "final_answer": r["extracted"]["final_answer"],
                    }
                    de_scores = run_deepeval_scoring(qdef, extracted, metrics)
                    r["scoring"]["deepeval_scores"] = de_scores
                    all_deepeval_scores.append(de_scores)
                    score_str = " | ".join(f"{k}={v['value']}" for k, v in de_scores.items() if v.get("value") is not None)
                    print(f"    {r['id']}: {score_str}")

                    # Push DeepEval scores to Langfuse traces (when both are active)
                    if lf_integration:
                        try:
                            trace_id = lf_integration._langfuse.create_trace_id(
                                seed=f"{lf_integration._experiment_run}-{r['id']}"
                            )
                            for metric_name, metric_data in de_scores.items():
                                if metric_data.get("value") is not None:
                                    lf_integration._langfuse.create_score(
                                        trace_id=trace_id,
                                        name=metric_name,
                                        value=metric_data["value"],
                                        comment=metric_data.get("comment", "")[:500],
                                    )
                        except Exception as lf_err:
                            print(f"      [deepeval→langfuse] {r['id']}: {lf_err}")

                if all_deepeval_scores:
                    aggs = run_deepeval_aggregate(all_deepeval_scores)
                    print(f"\n  DeepEval Aggregates ({len(all_deepeval_scores)} items):")
                    for name, data in aggs.items():
                        print(f"    {name}: {data['value']:.3f} — {data['comment']}")
                    summary.setdefault("deepeval_aggregates", {}).update(aggs)

                if lf_integration:
                    lf_integration.flush()
                    print(f"  [deepeval→langfuse] Pushed scores to Langfuse traces")
        except ImportError as e:
            print(f"\n  [deepeval] WARNING: {e}", file=sys.stderr)
        except Exception as e:
            print(f"\n  [deepeval] ERROR: {e}", file=sys.stderr)

    # --- Regression detection (compare against previous run BEFORE overwriting) ---
    has_regression = False
    prev_summary_path = OUTPUT_DIR / "smoke_test_summary.json"
    try:
        from langfuse_evaluators import detect_regressions
        regressions = detect_regressions(summary, str(prev_summary_path))
        if regressions and regressions[0].get("status") != "no_previous":
            print(f"\n{'#'*70}\n# REGRESSION CHECK (vs previous run)\n{'#'*70}")
            for r in regressions:
                if r.get("status") == "error":
                    print(f"  {r['metric']}: {r.get('comment', '')}")
                    continue
                icon = {"regression": "⚠️ ", "improvement": "✅ ", "stable": "   "}.get(r["status"], "   ")
                delta = f"{r['delta_pct']:+.1f}%"
                print(f"  {icon}{r['metric']:<30} {r['current']:<12} (was {r['previous']:<12}) {delta:<8} [{r['status']}]")
                if r["status"] == "regression":
                    has_regression = True
            if has_regression:
                print("\n  ⚠️  REGRESSIONS DETECTED — review changes before merging")
            else:
                print("\n  No regressions detected")
            summary["regression_check"] = regressions
            summary["has_regressions"] = has_regression
    except ImportError:
        pass
    except Exception as e:
        print(f"  [regression] Error: {e}")

    # --- Flaky query detection (compare across last N runs) ---
    try:
        from langfuse_evaluators import detect_flaky_queries
        flaky = detect_flaky_queries(summary, str(OUTPUT_DIR))
        if flaky:
            print(f"\n{'#'*70}\n# FLAKY QUERIES ({len(flaky)} detected)\n{'#'*70}")
            for fq in flaky:
                hist_str = " → ".join(fq["history"])
                print(f"  🔄 {fq['query_id']:<10} {hist_str}  ({fq['flip_count']} flips, outcomes: {fq['distinct_outcomes']})")
            summary["flaky_queries"] = flaky
        else:
            print(f"\n  No flaky queries detected")
    except ImportError:
        pass
    except Exception as e:
        print(f"  [flaky] Error: {e}")

    results_path, summary_path = write_results(summary)
    print_final_summary(summary)
    print(f"  Full results:  {results_path}\n  Summary:       {summary_path}\n")

    # Exit non-zero if regressions detected (for CI gating)
    if has_regression and not args.no_fail_on_regression:
        sys.exit(1)


if __name__ == "__main__":
    main()
