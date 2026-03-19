# MCP V1 & V2 Resource-Wise Test Cases

Each resource has its own subdirectory containing:
- **`test_plan.md`** — Test cases with prompts, v1/v2 flags, and hierarchy
- **`test_report.md`** — Test results; includes **MCP v1 vs v2 prompt/tool parity** (smoke row) after each revalidation run
- **[`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](MCP_PROMPT_PARITY_RUN_2026-03-19.md)** — Cross-resource master log of v1 named tools vs v2 `harness_list` (QA smoke pass)

**Account:** `px7xd_BFRCi-pfWPYXVjvw` | **Org:** `AI_Devops` | **Project:** `Sanity`

---

## PLATFORM Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 1 | Connectors | [test_plan](connectors/test_plan.md) | [test_report](connectors/test_report.md) | CON-001 → CON-013 |
| 2 | Secrets | [test_plan](secrets/test_plan.md) | [test_report](secrets/test_report.md) | SEC-001 → SEC-007 |
| 3 | Templates | [test_plan](templates/test_plan.md) | [test_report](templates/test_report.md) | TPL-001 → TPL-005 |
| 4 | Delegates | [test_plan](delegates/test_plan.md) | [test_report](delegates/test_report.md) | DEL-001 → DEL-004 |
| 5 | Dashboards | [test_plan](dashboards/test_plan.md) | [test_report](dashboards/test_report.md) | DSH-001 → DSH-004 |
| 6 | Users | [test_plan](users/test_plan.md) | [test_report](users/test_report.md) | USR-001 → USR-006 |
| 7 | Roles | [test_plan](roles/test_plan.md) | [test_report](roles/test_report.md) | ROL-001 → ROL-006 |
| 8 | User Groups | [test_plan](user_groups/test_plan.md) | [test_report](user_groups/test_report.md) | UGR-001 → UGR-009 |
| 9 | Resource Groups | [test_plan](resource_groups/test_plan.md) | [test_report](resource_groups/test_report.md) | RGR-001 → RGR-008 |
| 10 | Role Assignments | [test_plan](role_assignments/test_plan.md) | [test_report](role_assignments/test_report.md) | RAS-001 → RAS-003 |
| 11 | Service Accounts | [test_plan](service_accounts/test_plan.md) | [test_report](service_accounts/test_report.md) | SAC-001 → SAC-009 |
| 12 | Audit | [test_plan](audit/test_plan.md) | [test_report](audit/test_report.md) | AUD-001 → AUD-005 |

## CD/CI Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 13 | Services | [test_plan](services/test_plan.md) | [test_report](services/test_report.md) | SVC-001 → SVC-010 |
| 14 | Environments | [test_plan](environments/test_plan.md) | [test_report](environments/test_report.md) | ENV-001 → ENV-011 |
| 15 | Infrastructure | [test_plan](infrastructure/test_plan.md) | [test_report](infrastructure/test_report.md) | INF-001 → INF-008 |
| 16 | Pipelines | [test_plan](pipeline_tests/test_plan.md) | [test_report](pipeline_tests/test_report.md) | PIP-001 → PIP-012 |
| 17 | Executions | [test_plan](executions/test_plan.md) | [test_report](executions/test_report.md) | EXE-001 → EXE-009 |
| 18 | Triggers | [test_plan](triggers/test_plan.md) | [test_report](triggers/test_report.md) | TRG-001 → TRG-007 |
| 19 | Input Sets | [test_plan](input_sets/test_plan.md) | [test_report](input_sets/test_report.md) | INS-001 → INS-005 |

## CODE Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 20 | Repositories | [test_plan](repositories/test_plan.md) | [test_report](repositories/test_report.md) | REP-001 → REP-004 |
| 21 | Pull Requests | [test_plan](pull_requests/test_plan.md) | [test_report](pull_requests/test_report.md) | PR-001 → PR-007 |

## IDP Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 22 | IDP Entities | [test_plan](idp_entities/test_plan.md) | [test_report](idp_entities/test_report.md) | IDP-001 → IDP-005 |
| 23 | IDP Workflows | [test_plan](idp_workflows/test_plan.md) | [test_report](idp_workflows/test_report.md) | WFL-001 → WFL-004 |
| 24 | Scorecards | [test_plan](scorecards/test_plan.md) | [test_report](scorecards/test_report.md) | SCR-001 → SCR-003 |
| 25 | Scorecard Checks | [test_plan](scorecard_checks/test_plan.md) | [test_report](scorecard_checks/test_report.md) | CHK-001 → CHK-004 |

## STO Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 26 | Security Issues | [test_plan](security_issues/test_plan.md) | [test_report](security_issues/test_report.md) | STO-001 → STO-004 |
| 27 | Security Exemptions | [test_plan](security_exemptions/test_plan.md) | [test_report](security_exemptions/test_report.md) | EXM-001 → EXM-005 |

## Feature Flags Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 28 | Feature Flags | [test_plan](feature_flags/test_plan.md) | [test_report](feature_flags/test_report.md) | FF-001 → FF-007 |

## Registry Module

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 29 | Artifact Registry | [test_plan](artifact_registry/test_plan.md) | [test_report](artifact_registry/test_report.md) | REG-001 → REG-003 |

## Unlicensed Modules (Require License)

| # | Resource | Test Plan | Test Report | Tests |
|---|----------|-----------|-------------|-------|
| 30 | Chaos Engineering | [test_plan](chaos_engineering/test_plan.md) | [test_report](chaos_engineering/test_report.md) | CHS-001 → CHS-005 |
| 31 | GitOps | [test_plan](gitops/test_plan.md) | [test_report](gitops/test_report.md) | GIT-001 → GIT-006 |
| 32 | SRM | [test_plan](srm/test_plan.md) | [test_report](srm/test_report.md) | SRM-001 → SRM-004 |
| 33 | CCM | [test_plan](ccm/test_plan.md) | [test_report](ccm/test_report.md) | CCM-001 → CCM-005 |
| 34 | SEI | [test_plan](sei/test_plan.md) | [test_report](sei/test_report.md) | SEI-001 → SEI-003 |

---

## Legend

- 🔵 = Available in MCP v1
- 🟢 = Available in MCP v2
- ⚪ = Not available
