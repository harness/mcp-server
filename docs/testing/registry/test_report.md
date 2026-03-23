# Test Report: Registry (`registry`)

| Field | Value |
|-------|-------|
| **Resource Type** | `registry` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-reg-001 | List all registries | `harness_list(resource_type="registry")` | Returns paginated list of artifact registries | ✅ Passed | Returns 2 registries (test232213, test-mcp) with type=VIRTUAL, deep links |  |
| TC-reg-002 | List registries with pagination | `harness_list(resource_type="registry", page=0, size=5)` | Returns first page with up to 5 registries | ⬜ Pending | | |
| TC-reg-003 | Search registries by name | `harness_list(resource_type="registry", search="docker")` | Returns registries matching "docker" keyword | ⬜ Pending | | |
| TC-reg-004 | Filter by type (UPSTREAM) | `harness_list(resource_type="registry", type="UPSTREAM")` | Returns only upstream proxy registries | ⬜ Pending | | |
| TC-reg-005 | Filter by type (VIRTUAL) | `harness_list(resource_type="registry", type="VIRTUAL")` | Returns only virtual registries | ⬜ Pending | | |
| TC-reg-006 | Filter by package_type (DOCKER) | `harness_list(resource_type="registry", package_type="DOCKER")` | Returns only Docker registries | ⬜ Pending | | |
| TC-reg-007 | Filter by package_type (NPM) | `harness_list(resource_type="registry", package_type="NPM")` | Returns only NPM registries | ⬜ Pending | | |
| TC-reg-008 | Filter by package_type (MAVEN) | `harness_list(resource_type="registry", package_type="MAVEN")` | Returns only Maven registries | ⬜ Pending | | |
| TC-reg-009 | Filter by package_type (PYTHON) | `harness_list(resource_type="registry", package_type="PYTHON")` | Returns only Python/PyPI registries | ⬜ Pending | | |
| TC-reg-010 | Filter by package_type (HELM) | `harness_list(resource_type="registry", package_type="HELM")` | Returns only Helm chart registries | ⬜ Pending | | |
| TC-reg-011 | Combined filters | `harness_list(resource_type="registry", type="UPSTREAM", package_type="DOCKER", search="proxy", page=0, size=10)` | Returns filtered registries matching all criteria | ⬜ Pending | | |
| TC-reg-012 | Get registry by ID | `harness_get(resource_type="registry", registry_id="my-docker-registry")` | Returns full registry details including type, package type, config | ⬜ Pending | | |
| TC-reg-013 | List registries with explicit org/project | `harness_list(resource_type="registry", org_id="custom-org", project_id="custom-project")` | Returns registries scoped to specified org/project | ⬜ Pending | | |
| TC-reg-014 | Get non-existent registry | `harness_get(resource_type="registry", registry_id="nonexistent-registry")` | Returns 404 error | ⬜ Pending | | |
| TC-reg-015 | List with invalid type filter | `harness_list(resource_type="registry", type="INVALID")` | Returns validation error or empty results | ⬜ Pending | | |
| TC-reg-016 | List with invalid package_type | `harness_list(resource_type="registry", package_type="INVALID")` | Returns validation error or empty results | ⬜ Pending | | |
| TC-reg-017 | Verify deep link in response | `harness_get(resource_type="registry", registry_id="my-docker-registry")` | Response includes valid Harness UI deep link | ⬜ Pending | | |
| TC-reg-018 | List with zero results | `harness_list(resource_type="registry", search="zzz-nonexistent-zzz")` | Returns empty list with total=0 | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 18 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 17 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
