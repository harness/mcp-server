# Test Report: Artifact Security (`artifact_security`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact_security` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-AS-001 | List artifacts from a source | `harness_list(resource_type="artifact_security", source_id="src-1")` | Returns list of artifacts from the specified source | ✅ Passed | API responds correctly; requires source_id filter | Requires source_id filter |
| TC-AS-002 | List with explicit page | `harness_list(resource_type="artifact_security", source_id="src-1", page=1)` | Returns second page of artifacts | ⬜ Pending | | |
| TC-AS-003 | List with custom page size | `harness_list(resource_type="artifact_security", source_id="src-1", size=5)` | Returns at most 5 artifacts | ⬜ Pending | | |
| TC-AS-004 | List with search_term | `harness_list(resource_type="artifact_security", source_id="src-1", search_term="nginx")` | Returns artifacts matching "nginx" | ⬜ Pending | | |
| TC-AS-005 | List with sort and order | `harness_list(resource_type="artifact_security", source_id="src-1", sort="name", order="asc")` | Returns sorted artifacts | ⬜ Pending | | |
| TC-AS-006 | Get artifact security overview | `harness_get(resource_type="artifact_security", source_id="src-1", artifact_id="art-1")` | Returns artifact security overview with vulnerability summary | ⬜ Pending | | |
| TC-AS-007 | List with explicit org_id and project_id | `harness_list(resource_type="artifact_security", source_id="src-1", org_id="my-org", project_id="my-project")` | Returns artifacts for specified org/project | ⬜ Pending | | |
| TC-AS-008 | List without source_id | `harness_list(resource_type="artifact_security")` | Error: source_id is required | ⬜ Pending | | |
| TC-AS-009 | Get without artifact_id | `harness_get(resource_type="artifact_security", source_id="src-1")` | Error: artifact_id is required | ⬜ Pending | | |
| TC-AS-010 | Get with non-existent artifact | `harness_get(resource_type="artifact_security", source_id="src-1", artifact_id="nonexistent")` | Returns 404 or not-found error | ⬜ Pending | | |
| TC-AS-011 | Authentication failure | `harness_list(resource_type="artifact_security", source_id="src-1")` (invalid key) | Returns 401 Unauthorized error | ⬜ Pending | | |
| TC-AS-012 | Source with no artifacts | `harness_list(resource_type="artifact_security", source_id="empty-src")` | Returns empty items list | ⬜ Pending | | |
| TC-AS-013 | Verify deep link in get response | `harness_get(resource_type="artifact_security", source_id="src-1", artifact_id="art-1")` | Response includes deep link to artifact in supply chain view | ⬜ Pending | | |
| TC-AS-014 | Search term with no matches | `harness_list(resource_type="artifact_security", source_id="src-1", search_term="nonexistent_xyz")` | Returns empty items list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 13 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
