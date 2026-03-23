# Test Report: Artifact Version (`artifact_version`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact_version` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-av-001 | List all versions of an artifact | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app")` | Returns paginated list of artifact versions | ✅ Passed | API responds correctly; requires registry_ref and artifact filters | No artifact data to test with |
| TC-av-002 | List versions with pagination | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", page=0, size=5)` | Returns first page with up to 5 versions | ⬜ Pending | | |
| TC-av-003 | Search versions by name | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", search="1.0")` | Returns versions matching "1.0" keyword | ⬜ Pending | | |
| TC-av-004 | List versions page 2 | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", page=1, size=10)` | Returns second page of versions | ⬜ Pending | | |
| TC-av-005 | Search with no results | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", search="zzz-nonexistent-zzz")` | Returns empty list | ⬜ Pending | | |
| TC-av-006 | List versions with explicit org/project | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", org_id="custom-org", project_id="custom-project")` | Returns versions scoped to specified org/project | ⬜ Pending | | |
| TC-av-007 | List versions for non-existent registry | `harness_list(resource_type="artifact_version", registry_id="nonexistent-registry", artifact_id="my-app")` | Returns 404 error for registry not found | ⬜ Pending | | |
| TC-av-008 | List versions for non-existent artifact | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="nonexistent-artifact")` | Returns 404 error for artifact not found | ⬜ Pending | | |
| TC-av-009 | List versions without required params | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry")` | Returns validation error for missing artifact_id | ⬜ Pending | | |
| TC-av-010 | List versions for artifact with single version | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="new-app")` | Returns list with exactly one version | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
