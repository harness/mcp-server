# Test Report: Artifact (`artifact`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-art-001 | List all artifacts in a registry | `harness_list(resource_type="artifact", registry_id="my-docker-registry")` | Returns paginated list of artifacts in the registry | ✅ Passed | Returns artifacts from registry (empty — no artifacts uploaded) | Requires registry_ref filter |
| TC-art-002 | List artifacts with pagination | `harness_list(resource_type="artifact", registry_id="my-docker-registry", page=0, size=5)` | Returns first page with up to 5 artifacts | ⬜ Pending | | |
| TC-art-003 | Search artifacts by name | `harness_list(resource_type="artifact", registry_id="my-docker-registry", search="my-app")` | Returns artifacts matching "my-app" keyword | ⬜ Pending | | |
| TC-art-004 | List artifacts page 2 | `harness_list(resource_type="artifact", registry_id="my-docker-registry", page=1, size=10)` | Returns second page of artifacts | ⬜ Pending | | |
| TC-art-005 | Search with no results | `harness_list(resource_type="artifact", registry_id="my-docker-registry", search="zzz-nonexistent-zzz")` | Returns empty list | ⬜ Pending | | |
| TC-art-006 | List artifacts with explicit org/project | `harness_list(resource_type="artifact", registry_id="my-docker-registry", org_id="custom-org", project_id="custom-project")` | Returns artifacts scoped to specified org/project | ⬜ Pending | | |
| TC-art-007 | List artifacts for non-existent registry | `harness_list(resource_type="artifact", registry_id="nonexistent-registry")` | Returns 404 error for registry not found | ⬜ Pending | | |
| TC-art-008 | List artifacts without registry_id | `harness_list(resource_type="artifact")` | Returns validation error for missing required registry_id | ⬜ Pending | | |
| TC-art-009 | Verify deep link in list results | `harness_list(resource_type="artifact", registry_id="my-docker-registry")` | Response items include valid Harness UI deep links | ⬜ Pending | | |
| TC-art-010 | List artifacts in empty registry | `harness_list(resource_type="artifact", registry_id="empty-registry")` | Returns empty list with total=0 | ⬜ Pending | | |

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
