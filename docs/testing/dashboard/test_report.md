# Test Report: Dashboard (`dashboard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `dashboard` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-dash-001 | List all dashboards with defaults | `harness_list(resource_type="dashboard")` | Returns paginated list of dashboards | ✅ Passed | Returns 44 dashboards with title, type, description, deep links |  |
| TC-dash-002 | List dashboards with pagination | `harness_list(resource_type="dashboard", page=1, size=5)` | Returns page 1 with up to 5 dashboards | ⬜ Pending | | |
| TC-dash-003 | List dashboards filtered by search_term | `harness_list(resource_type="dashboard", filters={search_term: "deployment"})` | Returns dashboards matching "deployment" keyword | ⬜ Pending | | |
| TC-dash-004 | List dashboards filtered by folder_id | `harness_list(resource_type="dashboard", filters={folder_id: "folder_123"})` | Returns dashboards in the specified folder | ⬜ Pending | | |
| TC-dash-005 | List dashboards filtered by tags | `harness_list(resource_type="dashboard", filters={tags: "CD=true"})` | Returns dashboards with CD tag | ⬜ Pending | | |
| TC-dash-006 | List dashboards with combined filters | `harness_list(resource_type="dashboard", filters={search_term: "build", folder_id: "ci_folder"}, page=0, size=10)` | Returns filtered dashboards with pagination | ⬜ Pending | | |
| TC-dash-007 | List dashboards with multiple tag filters | `harness_list(resource_type="dashboard", filters={tags: "CD=true&CI=true"})` | Returns dashboards with both CD and CI tags | ⬜ Pending | | |
| TC-dash-008 | List dashboards with invalid folder_id | `harness_list(resource_type="dashboard", filters={folder_id: "nonexistent_folder"})` | Returns empty results or error | ⬜ Pending | | |
| TC-dash-009 | List dashboards with empty results | `harness_list(resource_type="dashboard", filters={search_term: "zzz_nonexistent_zzz"})` | Returns empty items array | ⬜ Pending | | |
| TC-dash-010 | List dashboards with max pagination | `harness_list(resource_type="dashboard", page=0, size=100)` | Returns up to 100 dashboards | ⬜ Pending | | |
| TC-dash-011 | Verify default tags parameter | `harness_list(resource_type="dashboard")` | Request includes default tag filters for all modules | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 11 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 10 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
