# Test Report: IDP Score (`idp_score`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_score` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-idp_score-001 | List all entity scores with defaults | `harness_list(resource_type="idp_score")` | Returns paginated list of entity scores | ✅ Passed | Returns entity scores (requires entity_identifier filter) | Requires entity_identifier filter |
| TC-idp_score-002 | List with pagination page 0 | `harness_list(resource_type="idp_score", page=0, size=5)` | Returns first page with up to 5 scores | ⬜ Pending | | |
| TC-idp_score-003 | List with pagination page 1 | `harness_list(resource_type="idp_score", page=1, size=5)` | Returns second page of scores | ⬜ Pending | | |
| TC-idp_score-004 | List with large page size | `harness_list(resource_type="idp_score", size=100)` | Returns up to 100 scores | ⬜ Pending | | |
| TC-idp_score-005 | Get score by entity_id | `harness_get(resource_type="idp_score", entity_id="my-service")` | Returns score summary for the entity | ⬜ Pending | | |
| TC-idp_score-006 | Verify score response structure | `harness_get(resource_type="idp_score", entity_id="my-service")` | Response contains score summary fields | ⬜ Pending | | |
| TC-idp_score-007 | Get with missing entity_id | `harness_get(resource_type="idp_score")` | Error: entity_id is required | ⬜ Pending | | |
| TC-idp_score-008 | Get non-existent entity score | `harness_get(resource_type="idp_score", entity_id="nonexistent")` | Error: entity not found (404) | ⬜ Pending | | |
| TC-idp_score-009 | List with page beyond data | `harness_list(resource_type="idp_score", page=9999)` | Returns empty list | ⬜ Pending | | |
| TC-idp_score-010 | List with size=1 | `harness_list(resource_type="idp_score", size=1)` | Returns exactly 1 score | ⬜ Pending | | |

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
