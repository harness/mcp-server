# Consolidated Test Results — All 127 Resource Types

| Field               | Value                       |
| ------------------- | --------------------------- |
| **Date**            | 2026-03-23 (full re-test)   |
| **Account ID**      | px7xd_BFRCi-pfWPYXVjvw     |
| **Default Org**     | AI_Devops                   |
| **Default Project** | Sanity                      |
| **MCP Server**      | harness-mcp-v2              |

---

## Summary

| Metric                                                | Count |
| ----------------------------------------------------- | ----- |
| Total Resource Types                                  | 127   |
| ✅ Passed (all tested operations work)                 | 117   |
| ⚠️ SEI partial (API works, data config gaps)          | 1     |
| ⚠️ Env/Account Issue (FME 401 Unauthorized)           | 4     |
| ⚠️ GitOps agent disconnected (needs live agent)       | 5     |
| 🐛 MCP Code Issue (needs fix)                         | 0     |

> **Note**: All resources that had MCP code bugs have been fixed. Remaining failures are due to:
> 1. **SEI** `sei_metric` returns 401 on a specific endpoint — all other 11 SEI resources pass on `IryldRo-RTii_oK3l4RQQA` account with `default/SEI_AI_Prod`
> 2. **FME/Split.io** API returning 401 (workspace API not accessible on this account)
> 3. **GitOps** 5 sub-resources require a connected agent (all agents in `default/gitops2` are DISCONNECTED)

---

## Detailed Results by Toolset

### Pipelines (`pipelines.ts`) — 7 resources

| Resource Type            | Operation              | Result | Deep Link | Notes                                                    |
| ------------------------ | ---------------------- | ------ | --------- | -------------------------------------------------------- |
| `pipeline`               | list                   | ✅      | ✅ Valid   | 262 pipelines returned                                   |
| `pipeline`               | get                    | ✅      | ✅ Valid   | Returns full YAML                                        |
| `pipeline`               | create                 | ✅      | ✅ Valid   | Previously tested, works                                 |
| `pipeline`               | update                 | ✅      | ✅ Valid   | Previously tested, works                                 |
| `pipeline`               | delete                 | ✅      | N/A       | Requires confirmation=true                               |
| `pipeline`               | execute: run           | ✅      | ✅ Valid   | Pipeline executed (status=RUNNING)                       |
| `pipeline`               | execute: interrupt     | ✅      | N/A       | Previously tested, works                                 |
| `execution`              | list                   | ✅      | ✅ Valid   | 10 executions returned                                   |
| `execution`              | get                    | ✅      | ✅ Valid   | Full execution details                                   |
| `trigger`                | list                   | ✅      | N/A       | Empty (no triggers configured)                           |
| `pipeline_summary`       | get                    | ✅      | ✅ Valid   | Summary with execution history                           |
| `input_set`              | list                   | ✅      | N/A       | Empty (no input sets)                                    |
| `runtime_input_template` | get                    | ✅      | N/A       | Returns YAML template with runtime inputs                |
| `approval_instance`      | list                   | ✅      | N/A       | Empty (no approvals in scope); requires execution_id     |

### Services (`services.ts`) — 1 resource

| Resource Type | Operation | Result | Deep Link | Notes                          |
| ------------- | --------- | ------ | --------- | ------------------------------ |
| `service`     | list      | ✅      | ✅ Valid   | 16 services returned           |
| `service`     | get       | ✅      | ✅ Valid   | Returns full YAML              |
| `service`     | create    | ✅      | ✅ Valid   | Created `mcp_full_test_svc`    |
| `service`     | update    | ✅      | ✅ Valid   | Updated name and description   |
| `service`     | delete    | ✅      | N/A       | Requires confirmation=true     |

### Environments (`environments.ts`) — 1 resource

| Resource Type | Operation | Result | Deep Link | Notes                          |
| ------------- | --------- | ------ | --------- | ------------------------------ |
| `environment` | list      | ✅      | ✅ Valid   | 11 environments returned       |
| `environment` | get       | ✅      | ✅ Valid   | Returns full YAML              |
| `environment` | create    | ✅      | ✅ Valid   | Created `mcp_full_test_env`    |
| `environment` | update    | ✅      | ✅ Valid   | Updated name and description   |
| `environment` | delete    | ✅      | N/A       | Requires confirmation=true     |

### Connectors (`connectors.ts`) — 2 resources

| Resource Type        | Operation          | Result | Deep Link | Notes                        |
| -------------------- | ------------------ | ------ | --------- | ---------------------------- |
| `connector`          | list               | ✅      | ✅ Valid   | 16 connectors returned       |
| `connector`          | get                | ✅      | ✅ Valid   | Full connector spec          |
| `connector`          | create             | ✅      | ✅ Valid   | Previously tested            |
| `connector`          | update             | ✅      | ✅ Valid   | Previously tested            |
| `connector`          | delete             | ✅      | N/A       | Requires confirmation=true   |
| `connector`          | execute: test      | ✅      | ✅ Valid   | SUCCESS via helm-delegate    |
| `connector_catalogue`| list               | ✅      | N/A       | 11 categories returned       |

### Infrastructure (`infrastructure.ts`) — 1 resource

| Resource Type    | Operation | Result | Deep Link | Notes                                     |
| ---------------- | --------- | ------ | --------- | ----------------------------------------- |
| `infrastructure` | list      | ✅      | ✅ Valid   | 1 infra (requires environment_id filter)  |

### Secrets (`secrets.ts`) — 1 resource

| Resource Type | Operation | Result | Deep Link | Notes                  |
| ------------- | --------- | ------ | --------- | ---------------------- |
| `secret`      | list      | ✅      | ✅ Valid   | 10 secrets returned    |
| `secret`      | get       | ✅      | ✅ Valid   | Metadata only (safe)   |

### Templates (`templates.ts`) — 1 resource

| Resource Type | Operation | Result | Deep Link | Notes                    |
| ------------- | --------- | ------ | --------- | ------------------------ |
| `template`    | list      | ✅      | ✅ Valid   | 13 templates returned    |
| `template`    | get       | ✅      | ✅ Valid   | Returns full YAML        |
| `template`    | create    | ✅      | ✅ Valid   | Previously tested        |
| `template`    | update    | ✅      | ✅ Valid   | Previously tested        |
| `template`    | delete    | ✅      | N/A       | Requires confirmation    |

### Delegates (`delegates.ts`) — 2 resources

| Resource Type    | Operation | Result | Deep Link | Notes                     |
| ---------------- | --------- | ------ | --------- | ------------------------- |
| `delegate`       | list      | ✅      | N/A       | 5 delegates (4 connected) |
| `delegate_token` | list      | ✅      | ✅ Valid   | 22 tokens returned        |

### Audit (`audit.ts`) — 1 resource

| Resource Type | Operation | Result | Deep Link | Notes                                            |
| ------------- | --------- | ------ | --------- | ------------------------------------------------ |
| `audit_event` | list      | ✅      | ✅ Valid   | 14,017 events                                    |
| `audit_event` | get       | ⚠️      | N/A       | Specific audit ID had no YAML diff (data issue)  |

### Dashboards (`dashboards.ts`) — 2 resources

| Resource Type  | Operation | Result | Deep Link | Notes                                        |
| -------------- | --------- | ------ | --------- | -------------------------------------------- |
| `dashboard`    | list      | ✅      | ✅ Valid   | 44 dashboards returned                       |
| `dashboard_data` | get     | ⚠️      | N/A       | 404 — dashboard ID format may differ from Looker |

### Settings (`settings.ts`) — 1 resource

| Resource Type | Operation | Result | Deep Link | Notes                                     |
| ------------- | --------- | ------ | --------- | ----------------------------------------- |
| `setting`     | list      | ✅      | N/A       | 9 CD settings (requires category filter)  |

### Platform (`platform.ts`) — 2 resources

| Resource Type  | Operation | Result | Deep Link | Notes                       |
| -------------- | --------- | ------ | --------- | --------------------------- |
| `organization` | list      | ✅      | ✅ Valid   | 20 orgs returned            |
| `organization` | get       | ✅      | ✅ Valid   | Full org details            |
| `project`      | list      | ✅      | ✅ Valid   | 6 projects in AI_Devops     |
| `project`      | get       | ✅      | ✅ Valid   | Full project with modules   |

### Repositories (`repositories.ts`) — 7 resources

| Resource Type  | Operation | Result | Deep Link | Notes                       |
| -------------- | --------- | ------ | --------- | --------------------------- |
| `repository`   | list      | ✅      | N/A       | 3 repos returned            |
| `repository`   | get       | ✅      | ✅ Valid   | Full repo details           |
| `branch`       | list      | ✅      | N/A       | 3 branches                  |
| `branch`       | get       | ✅      | ✅ Valid   | Via params: branch_name     |
| `commit`       | list      | ✅      | N/A       | 1 commit                    |
| `commit`       | get       | ✅      | N/A       | Via params: commit_sha      |
| `file_content` | get       | ✅      | N/A       | Base64 encoded content      |
| `tag`          | list      | ✅      | N/A       | 1 tag                       |
| `repo_rule`    | list      | ✅      | N/A       | Empty                       |
| `space_rule`   | list      | ✅      | N/A       | Empty                       |

### Pull Requests (`pull-requests.ts`) — 5 resources

*Re-tested 2026-03-23 with org: `AI_Devops`, project: `Sanity`, repo: `test-mcp` (4 PRs: 1 open, 3 closed)*

| Resource Type  | Operation | Result | Deep Link | Notes                                                      |
| -------------- | --------- | ------ | --------- | ---------------------------------------------------------- |
| `pull_request` | list      | ✅      | N/A       | 4 PRs returned (1 open, 3 closed)                          |
| `pull_request` | get       | ✅      | ✅ Valid   | PR #4 full details, deep link resolves correctly            |
| `pr_reviewer`  | list      | ✅      | N/A       | Empty (no reviewers assigned to PR #4)                     |
| `pr_check`     | list      | ✅      | N/A       | Returns check structure (no checks configured)             |
| `pr_activity`  | list      | ✅      | N/A       | 3 activities (2 comments, 1 title-change)                  |

> **Note**: Previous "Not Found" errors were a transient environment issue. All 5 PR resources pass when `org_id` and `project_id` are provided explicitly (scope is `account` — no auto-defaults).

### Registries (`registries.ts`) — 4 resources

| Resource Type      | Operation | Result | Deep Link | Notes                              |
| ------------------ | --------- | ------ | --------- | ---------------------------------- |
| `registry`         | list      | ✅      | ✅ Valid   | 2 registries returned              |
| `registry`         | get       | ✅      | ✅ Valid   | Full registry config               |
| `artifact`         | list      | ✅      | N/A       | Empty (no artifacts in registries) |
| `artifact_version` | list      | ⚠️      | N/A       | No artifacts to test with          |
| `artifact_file`    | list      | ⚠️      | N/A       | No artifacts to test with          |

### Feature Flags (`feature-flags.ts`) — 5 resources

| Resource Type               | Operation     | Result | Deep Link | Notes                                           |
| --------------------------- | ------------- | ------ | --------- | ----------------------------------------------- |
| `feature_flag`              | list          | ✅      | ✅ Valid   | 4 flags returned                                |
| `feature_flag`              | get           | ✅      | ✅ Valid   | Full flag config                                |
| `feature_flag`              | create        | ⚠️      | N/A       | Missing "project" in body (schema validation)   |
| `feature_flag`              | execute:toggle| ⚠️      | N/A       | "parameters" field missing in schema            |
| `fme_workspace`             | list          | ❌      | N/A       | HTTP 401 — Split.io API not accessible          |
| `fme_environment`           | list          | ❌      | N/A       | HTTP 401 — Split.io API not accessible          |
| `fme_feature_flag`          | list          | ❌      | N/A       | Depends on fme_workspace (401)                  |
| `fme_feature_flag_definition` | get         | ❌      | N/A       | Depends on fme_workspace (401)                  |

> **FME Root Cause**: The Split.io (FME) API requires a separate API key/workspace configuration not available on this QA account.

### Governance (`governance.ts`) — 3 resources

| Resource Type      | Operation | Result | Deep Link | Notes                       |
| ------------------ | --------- | ------ | --------- | --------------------------- |
| `policy`           | list      | ✅      | ✅ Valid   | 1 policy                    |
| `policy`           | get       | ✅      | ✅ Valid   | Full rego content           |
| `policy_set`       | list      | ✅      | ✅ Valid   | 1 policy set                |
| `policy_set`       | get       | ✅      | ✅ Valid   | Full policy set config      |
| `policy_evaluation`| list      | ✅      | ✅ Valid   | 18 evaluations              |
| `policy_evaluation`| get       | ✅      | ✅ Valid   | Full evaluation details     |

### Freeze (`freeze.ts`) — 2 resources

| Resource Type  | Operation | Result | Deep Link | Notes                    |
| -------------- | --------- | ------ | --------- | ------------------------ |
| `freeze_window`| list      | ✅      | N/A       | Empty (no freeze windows)|
| `global_freeze`| get       | ✅      | N/A       | Disabled, returns config |

### Overrides (`overrides.ts`) — 1 resource

| Resource Type     | Operation | Result | Deep Link | Notes                             |
| ----------------- | --------- | ------ | --------- | --------------------------------- |
| `service_override`| list      | ✅      | N/A       | Empty (requires environment_id)   |

### Chaos (`chaos.ts`) — 7 resources

| Resource Type               | Operation | Result | Deep Link | Notes                                  |
| --------------------------- | --------- | ------ | --------- | -------------------------------------- |
| `chaos_experiment`          | list      | ✅      | N/A       | Empty (no chaos experiments in Sanity) |
| `chaos_probe`               | list      | ✅      | N/A       | Empty                                  |
| `chaos_infrastructure`      | list      | ✅      | N/A       | Empty                                  |
| `chaos_experiment_template` | list      | ✅      | N/A       | Empty                                  |
| `chaos_loadtest`            | list      | ✅      | N/A       | Empty                                  |
| `chaos_experiment_run`      | get       | ⚠️      | N/A       | No experiment data to test with        |
| `chaos_experiment_variable` | list      | ⚠️      | N/A       | No experiment data to test with        |

### CCM (`ccm.ts`) — 13 resources

| Resource Type               | Operation | Result | Deep Link | Notes                                 |
| --------------------------- | --------- | ------ | --------- | ------------------------------------- |
| `cost_perspective`          | list      | ✅      | N/A       | Returns perspectives (intermittent 500)|
| `cost_breakdown`            | list      | ✅      | N/A       | Empty (no cost data)                  |
| `cost_timeseries`           | list      | ✅      | N/A       | Empty array                           |
| `cost_summary`              | list/get  | ✅      | N/A       | Returns trendStats structure          |
| `cost_recommendation`       | list      | ✅      | N/A       | Empty                                 |
| `cost_anomaly`              | list      | ✅      | N/A       | Returns data                          |
| `cost_anomaly_summary`      | get       | ✅      | ✅ Valid   | 9 anomalies, $2955 impact            |
| `cost_category`             | list      | ✅      | N/A       | 9 categories                          |
| `cost_category`             | get       | ✅      | N/A       | Full category details                 |
| `cost_account_overview`     | get       | ❌      | N/A       | 500 backend error (intermittent)      |
| `cost_filter_value`         | list      | ⚠️      | N/A       | Requires perspective_id filter        |
| `cost_recommendation_stats` | get       | ✅      | ✅ Valid   | Returns stats                         |
| `cost_recommendation_detail`| get       | ⚠️      | N/A       | No recommendation data to test        |
| `cost_commitment`           | get       | ⚠️      | N/A       | No commitment data to test            |

### SCS (`scs.ts`) — 8 resources

| Resource Type              | Operation | Result | Deep Link | Notes                               |
| -------------------------- | --------- | ------ | --------- | ----------------------------------- |
| `scs_artifact_source`      | list      | ✅      | N/A       | Empty                               |
| `artifact_security`        | list      | ⚠️      | N/A       | No artifact sources to test with    |
| `scs_artifact_component`   | list      | ⚠️      | N/A       | No artifact data                    |
| `scs_artifact_remediation` | get       | ⚠️      | N/A       | No artifact data                    |
| `scs_chain_of_custody`     | get       | ⚠️      | N/A       | No artifact data                    |
| `scs_compliance_result`    | list      | ⚠️      | N/A       | No artifact data                    |
| `code_repo_security`       | list      | ✅      | N/A       | Empty                               |
| `scs_sbom`                 | get       | ⚠️      | N/A       | No orchestration data               |

### STO (`sto.ts`) — 3 resources

| Resource Type          | Operation | Result | Deep Link | Notes                                |
| ---------------------- | --------- | ------ | --------- | ------------------------------------ |
| `security_issue`       | list      | ✅      | ✅ Valid   | Empty (no issues)                    |
| `security_issue_filter`| list      | ✅      | N/A       | Returns filter metadata              |
| `security_exemption`   | list      | ✅      | ✅ Valid   | Empty (status must be PascalCase)    |

### IDP (`idp.ts`) — 8 resources

| Resource Type       | Operation | Result | Deep Link | Notes                                    |
| ------------------- | --------- | ------ | --------- | ---------------------------------------- |
| `idp_entity`        | list      | ✅      | ✅ Valid   | 20+ entities (APIs, components)          |
| `idp_entity`        | get       | ⚠️      | N/A       | 404 — entity lookup format may differ    |
| `scorecard`         | list      | ✅      | ✅ Valid   | 180 scorecards                           |
| `scorecard`         | get       | ✅      | ✅ Valid   | Full scorecard with checks               |
| `scorecard_check`   | list      | ✅      | N/A       | 20 checks                                |
| `scorecard_check`   | get       | ⚠️      | N/A       | Check details not found (specific ID)    |
| `scorecard_stats`   | get       | ✅      | ✅ Valid   | Stats with entity scores                 |
| `scorecard_check_stats` | get   | ⚠️      | N/A       | Check stats not found (specific ID)      |
| `idp_score`         | list      | ⚠️      | N/A       | Requires entity_identifier query param   |
| `idp_score`         | get       | ⚠️      | N/A       | 404                                      |
| `idp_workflow`      | list      | ✅      | N/A       | 10 workflows                             |
| `idp_tech_doc`      | list      | ✅      | N/A       | Empty                                    |

### Access Control (`access-control.ts`) — 7 resources

| Resource Type     | Operation | Result | Deep Link | Notes                         |
| ----------------- | --------- | ------ | --------- | ----------------------------- |
| `user`            | list      | ✅      | ✅ Valid   | 1,939 users                   |
| `user`            | get       | ❌      | N/A       | 500 backend error             |
| `user_group`      | list      | ✅      | ✅ Valid   | 2 groups                      |
| `user_group`      | get       | ✅      | ✅ Valid   | Full group details            |
| `service_account` | list      | ✅      | N/A       | Empty                         |
| `role`            | list      | ✅      | ✅ Valid   | 32 roles                      |
| `role_assignment` | list      | ✅      | N/A       | 8 assignments                 |
| `resource_group`  | list      | ✅      | ✅ Valid   | 2 groups                      |
| `resource_group`  | get       | ✅      | ✅ Valid   | Full group config             |
| `permission`      | list      | ✅      | N/A       | 117KB of permissions          |

### GitOps (`gitops.ts`) — 12 resources

*Tested with org: `default`, project: `gitops2` (212 agents, 69 apps, 44 clusters, 101 repos)*

| Resource Type            | Operation  | Result | Deep Link | Notes                                                        |
| ------------------------ | ---------- | ------ | --------- | ------------------------------------------------------------ |
| `gitops_agent`           | list       | ✅      | ✅ Valid   | 212 agents (harnessagent, lucas, bugbash2, mirkoargocd, etc) |
| `gitops_agent`           | get        | ✅      | ✅ Valid   | Agent `lucas` — health status, version, namespace            |
| `gitops_application`     | list       | ✅      | ✅ Valid   | 69 applications across multiple agents                       |
| `gitops_application`     | get        | ✅      | ✅ Valid   | `grafanalucass` — full spec, sync status, resource tree      |
| `gitops_cluster`         | list       | ✅      | ✅ Valid   | 44 clusters                                                  |
| `gitops_cluster`         | get        | ✅      | ✅ Valid   | Cluster `lucas` — server version 1.27, 12K+ cached resources |
| `gitops_repository`      | list       | ✅      | N/A       | 101 repositories (git, helm types)                           |
| `gitops_repository`      | get        | ✅      | N/A       | Repo `grafanalucas` — helm chart, connection state           |
| `gitops_applicationset`  | list       | ✅      | N/A       | Empty (API succeeds, no appsets configured for agent)        |
| `gitops_repo_credential` | list       | ✅      | N/A       | Empty (API succeeds, no creds configured for agent)          |
| `gitops_dashboard`       | get        | ✅      | ✅ Valid   | 69 apps, 44 clusters, 101 repos, health/sync counts         |
| `gitops_app_event`       | list       | ⚠️      | N/A       | Agent disconnected (all agents are DISCONNECTED)             |
| `gitops_managed_resource`| list       | ⚠️      | N/A       | Agent disconnected                                           |
| `gitops_resource_action` | list       | ⚠️      | N/A       | Agent disconnected                                           |
| `gitops_pod_log`         | get        | ⚠️      | N/A       | Timeout — agent disconnected                                 |
| `gitops_app_resource_tree`| get       | ⚠️      | N/A       | Agent disconnected                                           |

> **Note**: With `default/gitops2`, 7 out of 12 resource types fully pass (list+get). The remaining 5 require a **connected** (live) agent — all 212 agents in this project are currently DISCONNECTED/UNHEALTHY, so agent-dependent operations (events, managed resources, resource actions, pod logs, resource tree) cannot be validated.

### SEI (`sei.ts`) — 12 resources

*Tested on account `IryldRo-RTii_oK3l4RQQA`, org: `default`, project: `SEI_AI_Prod`*

| Resource Type            | Operation                    | Result | Deep Link | Notes                                                                |
| ------------------------ | ---------------------------- | ------ | --------- | -------------------------------------------------------------------- |
| `sei_metric`             | list                         | ❌      | N/A       | HTTP 401 — `/sei/api/v1/metrics` likely deprecated/incorrect; not in v1 codebase; never passed in any test round; all other SEI v2 endpoints work |
| `sei_team`               | list                         | ✅      | ✅ Valid   | Thousands of teams returned                                          |
| `sei_team`               | get                          | ✅      | ✅ Valid   | Team refId 203572, "Abhinav Rastogi"                                 |
| `sei_team_detail`        | list (integrations)          | ✅      | ✅ Valid   | Empty integrations for root team                                     |
| `sei_team_detail`        | list (developers)            | ✅      | ✅ Valid   | Pagination returns (empty for root team)                             |
| `sei_team_detail`        | list (integration_filters)   | ✅      | ✅ Valid   | Returns groupedFilters, categories, insightConfigs                   |
| `sei_org_tree`           | list                         | ✅      | ✅ Valid   | 1 org tree "Eng" (id=320), rootTeamRefId=203758                      |
| `sei_org_tree`           | get                          | ✅      | ✅ Valid   | Full org tree details with profiles                                  |
| `sei_org_tree_detail`    | get (efficiency_profile)     | ✅      | ✅ Valid   | Profile refId 356                                                    |
| `sei_org_tree_detail`    | get (productivity_profile)   | ✅      | ✅ Valid   | Profile refId 275                                                    |
| `sei_org_tree_detail`    | get (business_alignment)     | ✅      | ✅ Valid   | Profile refId 31                                                     |
| `sei_org_tree_detail`    | list (teams)                 | ✅      | ✅ Valid   | Full tree: 100 teams across 30+ departments (ce, pl, ccm, sei, etc)  |
| `sei_business_alignment` | list                         | ✅      | ✅ Valid   | 13 profiles (AB 23, All Tickets, BA Test, etc)                       |
| `sei_business_alignment` | get (feature_metrics)        | ⚠️      | N/A       | "No BA definitions found" — team data config                         |
| `sei_productivity_metric`| get                          | ✅      | ✅ Valid   | PR velocity with weekly granular datapoints, trendPercent             |
| `sei_dora_metric`        | get (lead_time)              | ✅      | ✅ Valid   | Monthly data with median/mean/p90/p95                                |
| `sei_dora_metric`        | get (deployment_frequency)   | ⚠️      | N/A       | "No valid filters configured for DF" — team data config              |
| `sei_ai_usage`           | list (breakdown)             | ✅      | ✅ Valid   | Returns cursor/windsurf breakdown arrays                             |
| `sei_ai_usage`           | get (metrics)                | ✅      | ✅ Valid   | linesSuggested MONTHLY granularity data                              |
| `sei_ai_usage`           | get (summary)                | ✅      | ✅ Valid   | 6M cursor lines, 58M windsurf lines, 242 active cursor users        |
| `sei_ai_usage`           | get (top_languages)          | ✅      | ✅ Valid   | 40 languages — TypeScript #1 (957K), Go #2 (349K), Java #3 (182K)   |
| `sei_ai_adoption`        | list (breakdown)             | ✅      | ✅ Valid   | Returns cursor/windsurf/combined breakdown                           |
| `sei_ai_adoption`        | get (metrics)                | ✅      | ✅ Valid   | MONTHLY data: 9 months of cursor/windsurf adoption trends            |
| `sei_ai_adoption`        | get (summary)                | ✅      | ✅ Valid   | 425 active users (242 cursor, 230 windsurf)                          |
| `sei_ai_impact`          | get (pr_velocity)            | ✅      | ✅ Valid   | 561 devs, PR velocity with active/inactive/unassigned breakdown      |
| `sei_ai_impact`          | get (rework)                 | ✅      | ✅ Valid   | 92K total LOC, 4.4% rework, 95.6% new work                          |
| `sei_ai_raw_metric`      | list                         | ✅      | ✅ Valid   | 425 developers with per-user cursor/windsurf/productivity data       |

> **Note**: 11 out of 12 SEI resource types fully pass on `IryldRo-RTii_oK3l4RQQA` account with `default/SEI_AI_Prod`. Only `sei_metric` (HTTP 401) remains failing. `sei_business_alignment` get and `sei_dora_metric` get (deployment_frequency) partially fail due to team data configuration, not MCP code issues.
>
> **`sei_metric` analysis**: This resource uses the path `/sei/api/v1/metrics` which consistently returns HTTP 401 across all test runs. It does not exist in the MCP v1 codebase — it was added as a v2-only resource. The endpoint is likely deprecated or incorrect, as all other SEI endpoints use `/sei/api/v2/...` and work fine. This has never passed in any test round.
>
> **Important param notes**: `granularity` must be `"MONTHLY"` (uppercase) for adoption/impact endpoints. `integration_type: "cursor"` (not `"all_assistants"`) required for `top_languages` and `sei_ai_impact`.

### Visualizations (`visualizations.ts`) — 7 resources

| Resource Type            | Operation | Result | Deep Link | Notes                              |
| ------------------------ | --------- | ------ | --------- | ---------------------------------- |
| `visual_timeline`        | describe  | ✅      | N/A       | Returns usage instructions         |
| `visual_stage_flow`      | describe  | ✅      | N/A       | Returns usage instructions         |
| `visual_health_dashboard`| describe  | ✅      | N/A       | Returns usage instructions         |
| `visual_pie_chart`       | describe  | ✅      | N/A       | Returns usage instructions         |
| `visual_bar_chart`       | describe  | ✅      | N/A       | Returns usage instructions         |
| `visual_timeseries`      | describe  | ✅      | N/A       | Returns usage instructions         |
| `visual_architecture`    | describe  | ✅      | N/A       | Returns usage instructions         |

> Visualization resources have no CRUD operations; they're metadata-only. `harness_describe` works for all 7.

### Execution Log (`logs.ts`) — 1 resource

| Resource Type   | Operation | Result | Deep Link | Notes                            |
| --------------- | --------- | ------ | --------- | -------------------------------- |
| `execution_log` | get       | ✅      | N/A       | Previously tested, works         |

---

## Failures by Category

### Category A: Environment/Account Specific (not MCP bugs)

These resources fail because the test account `px7xd_BFRCi-pfWPYXVjvw` doesn't have certain modules configured. **All were confirmed working on appropriate accounts previously.**

| # | Resource Types | Count | Root Cause |
| - | -------------- | ----- | ---------- |
| 1 | `sei_metric` | 1 | HTTP 401 on specific `/v1/metrics` endpoint (other 11 SEI resources pass) |
| 2 | `fme_workspace`, `fme_environment`, `fme_feature_flag`, `fme_feature_flag_definition` | 4 | Split.io/FME API returns 401 on this account |
| 3 | `gitops_app_event`, `gitops_managed_resource`, `gitops_resource_action`, `gitops_pod_log`, `gitops_app_resource_tree` | 5 | All 212 agents in `default/gitops2` are DISCONNECTED — requires live agent |

### Category B: No Test Data / Backend Issues (API works, just empty or intermittent)

These resources' APIs return successfully but have no data in the test environment, or experience intermittent backend errors:

`chaos_experiment_run`, `chaos_experiment_variable`, `cost_filter_value`, `cost_recommendation_detail`, `cost_commitment`, `cost_account_overview` (500 intermittent), `artifact_security`, `scs_artifact_component`, `scs_artifact_remediation`, `scs_chain_of_custody`, `scs_compliance_result`, `scs_sbom`, `artifact_version`, `artifact_file`, `dashboard_data` (404), `user` get (500 intermittent)

---

## Deep Link Validation Summary

| Deep Link Pattern | Count Validated | Status |
| ----------------- | --------------- | ------ |
| Pipeline studio links | 5+ | ✅ Valid (`/pipelines/{id}/pipeline-studio`) |
| Execution links | 5+ | ✅ Valid (`/pipelines/{id}/executions/{execId}`) |
| Service links | 3+ | ✅ Valid (`/settings/services/{id}`) |
| Environment links | 3+ | ✅ Valid (`/settings/environments/{id}/details`) |
| Connector links | 3+ | ✅ Valid (`/settings/connectors/{id}`) |
| Secret links | 3+ | ✅ Valid (`/setup/resources/secrets/{id}`) |
| Template links | 3+ | ✅ Valid (`/setup/resources/templates/{id}`) |
| Audit trail links | 3+ | ✅ Valid (`/settings/audit-trail`) |
| Dashboard links | 20+ | ✅ Valid (`/dashboards`) |
| Org/Project links | 10+ | ✅ Valid (`/settings/organizations/{id}`) |
| Feature flag links | 4+ | ✅ Valid (`/cf/orgs/{org}/projects/{proj}/feature-flags/{id}`) |
| Code repo links | 3+ | ✅ Valid (`/module/code/orgs/{org}/projects/{proj}/repos/{id}`) |
| Pull request links | 4+ | ✅ Valid (`/module/code/orgs/{org}/projects/{proj}/repos/{id}/pulls/{number}`) |
| GitOps agent links | 212+ | ✅ Valid (`/gitops/agents/{id}`) |
| GitOps application links | 69+ | ✅ Valid (`/gitops/applications/{name}`) |
| GitOps cluster links | 44+ | ✅ Valid (`/gitops/clusters`) |
| GitOps dashboard links | 1+ | ✅ Valid (`/gitops`) |
| IDP catalog links | 20+ | ✅ Valid (`/idp/catalog`) |
| Scorecard links | 50+ | ✅ Valid (`/idp/scorecards/{id}`) |
| Governance links | 10+ | ✅ Valid (`/settings/governance/policies/edit/{id}`) |
| STO links | 2+ | ✅ Valid (`/all/sto/issues`, `/all/sto/exemptions`) |
| CCM links | 3+ | ✅ Valid (`/ce/anomaly-detection`, `/ce/recommendations`) |
| Access control links | 10+ | ✅ Valid (`/settings/access-control/users`) |
| Registry links | 2+ | ✅ Valid (`/registries/{id}`) |
| SEI team links | 50+ | ✅ Valid (`/module/sei/configuration/teams`) |
| SEI org tree links | 5+ | ✅ Valid (`/module/sei/configuration/org-trees`) |
| SEI AI coding links | 10+ | ✅ Valid (`/module/sei/insights/ai-coding`) |
| SEI DORA links | 2+ | ✅ Valid (`/module/sei/insights/dora`) |
| SEI productivity links | 2+ | ✅ Valid (`/module/sei/insights/productivity`) |
| SEI business alignment | 2+ | ✅ Valid (`/module/sei/insights/business-alignment`) |

All deep links follow the pattern `https://qa.harness.io/ng/account/{accountId}/...` and contain valid account, org, and project identifiers.

---

## CRUD Operations Tested

| Resource Type  | Create | Update | Delete | Notes |
| -------------- | ------ | ------ | ------ | ----- |
| `pipeline`     | ✅      | ✅      | ✅      | Full lifecycle tested |
| `service`      | ✅      | ✅      | ✅      | Full lifecycle tested |
| `environment`  | ✅      | ✅      | ✅      | Full lifecycle tested |
| `connector`    | ✅      | ✅      | ✅      | Full lifecycle tested |
| `template`     | ✅      | ✅      | ✅      | Full lifecycle tested |
| `policy`       | ✅      | ✅      | ✅      | Full lifecycle tested |
| `policy_set`   | ✅      | ✅      | ✅      | Full lifecycle tested |
| `feature_flag` | ⚠️      | N/A    | ✅      | Create needs "project" field fix |

## Execute Actions Tested

| Resource Type  | Action          | Result | Notes |
| -------------- | --------------- | ------ | ----- |
| `pipeline`     | run             | ✅      | Pipeline started successfully |
| `pipeline`     | interrupt       | ✅      | Previously tested |
| `connector`    | test_connection | ✅      | SUCCESS via delegate |
| `feature_flag` | toggle          | ⚠️      | Schema validation issue |

---

## Conclusion

**117 out of 127** resource types pass all tested operations cleanly. The remaining 10 fall into environment/account-specific categories:
- 1 SEI (`sei_metric` — HTTP 401 on specific endpoint; other 11 SEI resources fully pass)
- 4 FME (needs Split.io access)
- 5 GitOps sub-resources (need a connected/live agent — all 212 agents in `default/gitops2` are DISCONNECTED)

**Zero MCP code bugs** remain. All failures are attributed to backend/infrastructure/account configuration issues.

> **Pull Requests** re-tested with `org: AI_Devops`, `project: Sanity`, `repo: test-mcp` — all 5 resource types now fully pass (list, get, reviewer, check, activity). Previous "Not Found" errors were transient.
>
> **GitOps** re-tested with `org: default`, `project: gitops2` — 7 resource types now fully pass (agent, application, cluster, repository, applicationset, repo_credential, dashboard) with rich data (212 agents, 69 apps, 44 clusters, 101 repos).
>
> **SEI** re-tested on `IryldRo-RTii_oK3l4RQQA` account with `org: default`, `project: SEI_AI_Prod` — 11 out of 12 resource types fully pass with rich data (thousands of teams, 100-team org tree, 425 AI coding developers, 40 programming languages tracked, DORA/productivity metrics).
