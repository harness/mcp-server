# Test Report: FME Workspace (`fme_workspace`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_workspace` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-fme_workspace-001 | List all workspaces with defaults | `harness_list(resource_type="fme_workspace")` | Returns list of FME workspaces | ❌ Failed | HTTP 401 Unauthorized — FME/Split.io API not accessible on this account |  |
| TC-fme_workspace-002 | List with custom size | `harness_list(resource_type="fme_workspace", size=5)` | Returns up to 5 workspaces | ⬜ Pending | | |
| TC-fme_workspace-003 | List with offset pagination | `harness_list(resource_type="fme_workspace", offset=20)` | Returns workspaces starting at offset 20 | ⬜ Pending | | |
| TC-fme_workspace-004 | List with offset and size | `harness_list(resource_type="fme_workspace", offset=10, size=5)` | Returns 5 workspaces starting at offset 10 | ⬜ Pending | | |
| TC-fme_workspace-005 | List with max size | `harness_list(resource_type="fme_workspace", size=1000)` | Returns up to 1000 workspaces | ⬜ Pending | | |
| TC-fme_workspace-006 | Attempt get operation (unsupported) | `harness_get(resource_type="fme_workspace", workspace_id="my_workspace")` | Error: get operation not supported | ⬜ Pending | | |
| TC-fme_workspace-007 | List with offset beyond data | `harness_list(resource_type="fme_workspace", offset=999999)` | Returns empty list | ⬜ Pending | | |
| TC-fme_workspace-008 | List with offset=0 | `harness_list(resource_type="fme_workspace", offset=0)` | Returns first page of workspaces | ⬜ Pending | | |
| TC-fme_workspace-009 | List with size=1 | `harness_list(resource_type="fme_workspace", size=1)` | Returns exactly 1 workspace | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 0 |
| ❌ Failed | 1 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 8 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
