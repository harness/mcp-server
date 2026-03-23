# Test Report: Chaos Infrastructure (`chaos_infrastructure`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_infrastructure` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ci-001 | List infrastructures with defaults | `harness_list(resource_type="chaos_infrastructure")` | Returns list of Active Linux infrastructures (default status=Active) | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-ci-002 | List with status=Active | `harness_list(resource_type="chaos_infrastructure", status="Active")` | Returns only active infrastructures | ⬜ Pending | | |
| TC-ci-003 | List with status=All | `harness_list(resource_type="chaos_infrastructure", status="All")` | Returns all infrastructures regardless of status | ⬜ Pending | | |
| TC-ci-004 | List with explicit org and project | `harness_list(resource_type="chaos_infrastructure", org_id="myorg", project_id="myproject")` | Returns infrastructures scoped to specified org/project | ⬜ Pending | | |
| TC-ci-005 | List with wrong project | `harness_list(resource_type="chaos_infrastructure", project_id="wrongproject")` | Returns empty list or error | ⬜ Pending | | |
| TC-ci-006 | List when no infrastructures exist | `harness_list(resource_type="chaos_infrastructure")` | Returns empty infras array with totalNoOfInfras=0 | ⬜ Pending | | |
| TC-ci-007 | Attempt get (not supported) | `harness_get(resource_type="chaos_infrastructure", infra_id="<id>")` | Returns error indicating get is not supported | ⬜ Pending | | |
| TC-ci-008 | Invalid status value | `harness_list(resource_type="chaos_infrastructure", status="InvalidStatus")` | Returns error or ignores invalid filter | ⬜ Pending | | |
| TC-ci-009 | Verify response structure | `harness_list(resource_type="chaos_infrastructure")` | Response contains items array and total count from totalNoOfInfras | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 8 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
