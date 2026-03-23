# Test Report: IDP Workflow (`idp_workflow`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_workflow` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-idp_workflow-001 | List all workflows with defaults | `harness_list(resource_type="idp_workflow")` | Returns list of IDP workflows (default scope_level=ACCOUNT) | ✅ Passed | Returns 10 IDP workflows (scaffolder templates) with kind, type, tags |  |
| TC-idp_workflow-002 | List with scope_level=ACCOUNT | `harness_list(resource_type="idp_workflow", scope_level="ACCOUNT")` | Returns account-scoped workflows | ⬜ Pending | | |
| TC-idp_workflow-003 | List with scope_level=ORG | `harness_list(resource_type="idp_workflow", scope_level="ORG")` | Returns org-scoped workflows | ⬜ Pending | | |
| TC-idp_workflow-004 | List with scope_level=PROJECT | `harness_list(resource_type="idp_workflow", scope_level="PROJECT")` | Returns project-scoped workflows | ⬜ Pending | | |
| TC-idp_workflow-005 | List with scope_level=ALL | `harness_list(resource_type="idp_workflow", scope_level="ALL")` | Returns workflows at all scope levels | ⬜ Pending | | |
| TC-idp_workflow-006 | Execute a workflow | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow", body={"inputs": {"key": "value"}})` | Returns workflow execution result | ⬜ Pending | | |
| TC-idp_workflow-007 | Execute workflow without inputs | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow")` | Returns workflow execution result with empty inputs | ⬜ Pending | | |
| TC-idp_workflow-008 | Execute workflow with complex inputs | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow", body={"inputs": {"name": "my-app", "language": "typescript", "owner": "team-a"}})` | Returns successful execution | ⬜ Pending | | |
| TC-idp_workflow-009 | Execute with missing workflow_id | `harness_execute(resource_type="idp_workflow", action="execute")` | Error: workflow_id is required | ⬜ Pending | | |
| TC-idp_workflow-010 | Execute non-existent workflow | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="nonexistent")` | Error: workflow not found (404) | ⬜ Pending | | |
| TC-idp_workflow-011 | List with invalid scope_level | `harness_list(resource_type="idp_workflow", scope_level="INVALID")` | Error: invalid scope_level value | ⬜ Pending | | |
| TC-idp_workflow-012 | Attempt get operation (unsupported) | `harness_get(resource_type="idp_workflow", workflow_id="my_workflow")` | Error: get operation not supported | ⬜ Pending | | |
| TC-idp_workflow-013 | Execute with empty body | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow", body={})` | Executes with empty inputs | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
