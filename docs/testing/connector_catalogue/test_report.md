# Test Report: Connector Catalogue (`connector_catalogue`)

| Field | Value |
|-------|-------|
| **Resource Type** | `connector_catalogue` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ccat-001 | List all available connector types | `harness_list(resource_type="connector_catalogue")` | Returns catalogue of all available connector types | ✅ Passed | Returns 11 connector categories (CLOUD_PROVIDER, SECRET_MANAGER, CODE_REPO, etc.) |  |
| TC-ccat-002 | List connector catalogue with default scope | `harness_list(resource_type="connector_catalogue")` | Returns account-level catalogue (no org/project required) | ⬜ Pending | | |
| TC-ccat-003 | List connector catalogue with explicit org_id | `harness_list(resource_type="connector_catalogue", org_id="default")` | Returns catalogue (scope ignored, account-level resource) | ⬜ Pending | | |
| TC-ccat-004 | Verify catalogue contains known types | `harness_list(resource_type="connector_catalogue")` | Catalogue includes Github, DockerRegistry, K8sCluster, Aws, Gcp, Azure | ⬜ Pending | | |
| TC-ccat-005 | Verify catalogue structure | `harness_list(resource_type="connector_catalogue")` | Response contains categorized connector types with metadata | ⬜ Pending | | |
| TC-ccat-006 | List catalogue with invalid account credentials | `harness_list(resource_type="connector_catalogue")` (with invalid API key) | Error: Unauthorized (401) | ⬜ Pending | | |
| TC-ccat-007 | Verify catalogue includes all categories | `harness_list(resource_type="connector_catalogue")` | Contains CLOUD_PROVIDER, SECRET_MANAGER, CODE_REPO, MONITORING, etc. | ⬜ Pending | | |
| TC-ccat-008 | Repeated calls return consistent results | `harness_list(resource_type="connector_catalogue")` called twice | Both calls return identical catalogue data | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
