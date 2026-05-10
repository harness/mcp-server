# Test Report: IDP Score (`idp_score`, `idp_score_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_score`, `idp_score_summary` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-idp_score-001 | List scorecard scores for an entity | `harness_list(resource_type="idp_score", filters={"entity_identifier":"default/Component/my-service"})` | Returns overall_score plus scorecard score items for the entity | ⬜ Pending | | |
| TC-idp_score-002 | List scorecard scores using top-level entity_identifier | `harness_list(resource_type="idp_score", entity_identifier="default/Component/my-service")` | Returns overall_score plus scorecard score items for the entity | ⬜ Pending | | |
| TC-idp_score-003 | List without entity_identifier | `harness_list(resource_type="idp_score")` | Error from IDP API or validation indicating entity_identifier is required | ⬜ Pending | | |
| TC-idp_score-004 | List scorecard scores for non-existent entity | `harness_list(resource_type="idp_score", filters={"entity_identifier":"default/Component/nonexistent"})` | Error: entity not found or empty/no scores depending on API behavior | ⬜ Pending | | |
| TC-idp_score_summary-001 | Get aggregate score summary for an entity | `harness_get(resource_type="idp_score_summary", resource_id="default/Component/my-service")` | Returns aggregate score summary for the entity | ⬜ Pending | | |
| TC-idp_score_summary-002 | Get aggregate score summary via params | `harness_get(resource_type="idp_score_summary", params={"entity_identifier":"default/Component/my-service"})` | Returns aggregate score summary for the entity | ⬜ Pending | | |
| TC-idp_score_summary-003 | Get summary without entity_identifier | `harness_get(resource_type="idp_score_summary")` | Error: entity_identifier is required | ⬜ Pending | | |
| TC-idp_score_summary-004 | Get summary for non-existent entity | `harness_get(resource_type="idp_score_summary", resource_id="default/Component/nonexistent")` | Error: entity not found or empty/no summary depending on API behavior | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 0 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 8 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
