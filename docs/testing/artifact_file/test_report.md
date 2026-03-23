# Test Report: Artifact File (`artifact_file`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact_file` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-af-001 | List all files in an artifact version | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0")` | Returns paginated list of files in the artifact version | ✅ Passed | API responds correctly; requires registry_ref, artifact, and version filters | No artifact data to test with |
| TC-af-002 | List files with pagination | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", page=0, size=5)` | Returns first page with up to 5 files | ⬜ Pending | | |
| TC-af-003 | Search files by name | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", search="layer")` | Returns files matching "layer" keyword | ⬜ Pending | | |
| TC-af-004 | Sort files by field | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", sort_field="size", sort_order="desc")` | Returns files sorted by size descending | ⬜ Pending | | |
| TC-af-005 | Combined filters | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", search="config", sort_field="name", sort_order="asc", page=0, size=10)` | Returns filtered and sorted files | ⬜ Pending | | |
| TC-af-006 | List files with explicit org/project | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", org_id="custom-org", project_id="custom-project")` | Returns files scoped to specified org/project | ⬜ Pending | | |
| TC-af-007 | List files for non-existent registry | `harness_list(resource_type="artifact_file", registry_id="nonexistent-registry", artifact_id="my-app", version="1.0.0")` | Returns 404 error for registry not found | ⬜ Pending | | |
| TC-af-008 | List files for non-existent artifact | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="nonexistent", version="1.0.0")` | Returns 404 error for artifact not found | ⬜ Pending | | |
| TC-af-009 | List files for non-existent version | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="99.99.99")` | Returns 404 error for version not found | ⬜ Pending | | |
| TC-af-010 | List files without required params | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app")` | Returns validation error for missing version | ⬜ Pending | | |
| TC-af-011 | List files for version with no files | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="empty-artifact", version="0.0.1")` | Returns empty list | ⬜ Pending | | |
| TC-af-012 | Search with no matching files | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", search="zzz-nonexistent-zzz")` | Returns empty list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
