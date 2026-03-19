#!/usr/bin/env python3
"""
Insert MCP v1 vs v2 prompt/tool parity block into docs/testing/*/test_report.md
if not already present. Run from repo root:

  python3 scripts/inject-mcp-parity-into-test-reports.py
"""

from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
TESTING = ROOT / "docs" / "testing"
MASTER = "MCP_PROMPT_PARITY_RUN_2026-03-19.md"
MARKER = "### MCP v1 vs v2 — Prompt parity run (2026-03-19)"

# One-line smoke comparison for each resource folder (table row: Check | v1 | v2 | Match)
ROWS: dict[str, tuple[str, str, str, str]] = {
    "connectors": (
        "List (project scope)",
        "`list_connectors`",
        "`harness_list` (`connector`)",
        "✅ v2 `total` **15** (aligns with v1 payload)",
    ),
    "secrets": (
        "List",
        "`list_secrets`",
        "`harness_list` (`secret`)",
        "✅ **10** = **10**",
    ),
    "templates": (
        "List",
        "`list_templates`",
        "`harness_list` (`template`)",
        "⚠️ v1 default page **5** vs v2 `total` **11** — match page sizes",
    ),
    "delegates": (
        "List",
        "*(no list in configured v1 MCP)*",
        "`harness_list` (`delegate`)",
        "✅ v2 **5** delegate groups",
    ),
    "dashboards": (
        "List",
        "`list_dashboards`",
        "`harness_list` (`dashboard`)",
        "✅ **44** = **44**",
    ),
    "users": (
        "List",
        "`get_all_users`",
        "`harness_list` (`user`)",
        "⚠️ Scope defaults differ — set `org_id` / `project_id` explicitly",
    ),
    "roles": (
        "List",
        "`list_available_roles`",
        "`harness_list` (`role`)",
        "⏭️ Not re-counted this run — see prior report",
    ),
    "user_groups": (
        "List",
        "*(no list tool in v1 MCP set)*",
        "`harness_list` (`user_group`)",
        "✅ v2 only (smoke)",
    ),
    "resource_groups": (
        "List",
        "*(no list tool in v1 MCP set)*",
        "`harness_list` (`resource_group`)",
        "✅ v2 only (smoke)",
    ),
    "role_assignments": (
        "List",
        "`list_role_assignments`",
        "`harness_list` (`role_assignment`)",
        "⏭️ Not re-run this session",
    ),
    "service_accounts": (
        "List",
        "*(get-by-id; no list in v1 MCP set)*",
        "`harness_list` (`service_account`)",
        "✅ v2 only (smoke)",
    ),
    "audit": (
        "List / filter",
        "`list_user_audits`",
        "`harness_list` (`audit_event`)",
        "✅ High volume — use filters per test plan",
    ),
    "services": (
        "List",
        "*(no v1 list in MCP set)*",
        "`harness_list` (`service`)",
        "✅ v2 `total` **14**",
    ),
    "environments": (
        "List",
        "*(no v1 list in MCP set)*",
        "`harness_list` (`environment`)",
        "✅ v2 `total` **9**",
    ),
    "infrastructure": (
        "List + env filter",
        "*(v1 not in Cursor MCP config)*",
        "`harness_list` (`infrastructure`, `environment_id=aws_sam`)",
        "✅ v2 `total` **3**",
    ),
    "pipeline_tests": (
        "List",
        "`list_pipelines`",
        "`harness_list` (`pipeline`)",
        "✅ **259** = **259**",
    ),
    "executions": (
        "List",
        "`list_executions`",
        "`harness_list` (`execution`)",
        "✅ **3** = **3**",
    ),
    "triggers": (
        "List for pipeline",
        "`list_triggers` + `target_identifier`",
        "`harness_list` (`trigger`) + `filters.pipeline_id`",
        "✅ **0** for `custom_stage_pipeline` both",
    ),
    "input_sets": (
        "List for pipeline",
        "`list_input_sets` + `pipeline_identifier`",
        "`harness_list` (`input_set`) + `filters.pipeline_id`",
        "✅ **0** for `custom_stage_pipeline` both",
    ),
    "repositories": (
        "List",
        "`list_repositories`",
        "`harness_list` (`repository`)",
        "✅ **1** (`r1`)",
    ),
    "pull_requests": (
        "List",
        "`list_pull_requests` + `repo_id`",
        "`harness_list` (`pull_request`) + `filters.repo_id`",
        "✅ **[]** for `r1` both",
    ),
    "idp_entities": (
        "List",
        "`list_entities` *(needs `scope_level`)*",
        "`harness_list` (`idp_entity`)",
        "⚠️ v1 param missing this run; v2 catalog paginated",
    ),
    "idp_workflows": (
        "List",
        "*(varies by v1 build)*",
        "`harness_list` (`idp_workflow`)",
        "⏭️ Not run this session",
    ),
    "scorecards": (
        "List",
        "`list_scorecards`",
        "`harness_list` (`scorecard`)",
        "✅ v2 `total` **180** (paginate)",
    ),
    "scorecard_checks": (
        "List",
        "`list_scorecard_checks`",
        "`harness_list` (`scorecard_check`)",
        "⚠️ Different payload shapes — compare fields, not raw counts",
    ),
    "security_issues": (
        "List",
        "`get_all_security_issues`",
        "`harness_list` (`security_issue`)",
        "✅ Often **0** in empty project",
    ),
    "security_exemptions": (
        "List",
        "STO v1 tools",
        "`harness_list` (`security_exemption`)",
        "⏭️ License / scope dependent",
    ),
    "feature_flags": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "`harness_list` (`feature_flag` / FME)",
        "✅ v2 only unless v1 extended",
    ),
    "artifact_registry": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "`harness_list` (`registry` / `artifact`)",
        "✅ v2 only",
    ),
    "chaos_engineering": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "`harness_list` (`chaos_*`)",
        "⏭️ License",
    ),
    "gitops": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "`harness_list` (`gitops_*`)",
        "⏭️ License",
    ),
    "srm": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "SRM resource types",
        "⏭️ License",
    ),
    "ccm": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "`harness_list` (`cost_*`)",
        "⏭️ License",
    ),
    "sei": (
        "List",
        "*(not in v1 Cursor MCP list)*",
        "`harness_list` (`sei_*`)",
        "⏭️ License",
    ),
}


def build_block(folder: str) -> str:
    check, v1, v2, match = ROWS.get(
        folder,
        (
            "List smoke",
            "See v1 `test_plan.md`",
            "`harness_list`",
            "See master log",
        ),
    )
    return f"""{MARKER}

**Date:** 2026-03-19 · **Master log:** [`{MASTER}`](../{MASTER})

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| {check} | {v1} | {v2} | {match} |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._
"""


def main() -> None:
    for report in sorted(TESTING.glob("*/test_report.md")):
        folder = report.parent.name
        text = report.read_text(encoding="utf-8")
        if MARKER in text:
            continue
        if "---\n\n### Summary" not in text:
            # Fallback: insert before first ### Summary
            if "\n### Summary" in text:
                insert = text.index("\n### Summary")
                new_text = text[:insert] + "\n" + build_block(folder) + text[insert:]
            else:
                print(f"skip (no Summary section): {report}")
                continue
        else:
            new_text = text.replace(
                "---\n\n### Summary",
                "---\n\n" + build_block(folder) + "\n### Summary",
                1,
            )
        report.write_text(new_text, encoding="utf-8")
        print(f"updated {report.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
