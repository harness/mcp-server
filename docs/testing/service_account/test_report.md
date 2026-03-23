# Test Report: Service Account (`service_account`)

| Field | Value |
|-------|-------|
| **Resource Type** | `service_account` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-sa-001 | Basic list of service accounts | `harness_list(resource_type="service_account")` | Returns paginated list of service accounts | ✅ Passed | Returns empty list (no service accounts in project scope); API responds correctly |  |
| TC-sa-002 | Pagination - page 0, size 5 | `harness_list(resource_type="service_account", page=0, size=5)` | Returns first 5 service accounts | ⬜ Pending | | |
| TC-sa-003 | Pagination - page 1 | `harness_list(resource_type="service_account", page=1, size=5)` | Returns second page of service accounts | ⬜ Pending | | |
| TC-sa-004 | Filter by search_term | `harness_list(resource_type="service_account", search_term="ci-bot")` | Returns service accounts matching "ci-bot" | ⬜ Pending | | |
| TC-sa-005 | Get service account by ID | `harness_get(resource_type="service_account", service_account_id="<valid_id>")` | Returns full service account details | ⬜ Pending | | |
| TC-sa-006 | Create service account | `harness_create(resource_type="service_account", body={identifier: "test_sa", name: "Test SA", email: "test-sa@harness.io"})` | Service account created | ⬜ Pending | | |
| TC-sa-007 | Create with description and tags | `harness_create(resource_type="service_account", body={identifier: "test_sa_full", name: "Full Test SA", email: "test-sa-full@harness.io", description: "Test service account", tags: {team: "platform"}})` | Service account created with all fields | ⬜ Pending | | |
| TC-sa-008 | Delete service account | `harness_delete(resource_type="service_account", service_account_id="test_sa")` | Service account deleted | ⬜ Pending | | |
| TC-sa-009 | Custom org and project | `harness_list(resource_type="service_account", org_id="custom_org", project_id="custom_project")` | Returns service accounts for specified scope | ⬜ Pending | | |
| TC-sa-010 | Get nonexistent service account | `harness_get(resource_type="service_account", service_account_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-sa-011 | Create without required fields | `harness_create(resource_type="service_account", body={identifier: "test_sa"})` | Returns validation error (missing name, email) | ⬜ Pending | | |
| TC-sa-012 | Create duplicate identifier | `harness_create(resource_type="service_account", body={identifier: "<existing_id>", name: "Dup", email: "dup@harness.io"})` | Returns conflict error | ⬜ Pending | | |
| TC-sa-013 | Delete nonexistent service account | `harness_delete(resource_type="service_account", service_account_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-sa-014 | Search with no matches | `harness_list(resource_type="service_account", search_term="zzz_nonexistent_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-sa-015 | Resource metadata | `harness_describe(resource_type="service_account")` | Returns full metadata including create body schema | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 15 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 14 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
