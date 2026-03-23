# Test Report: IDP Tech Doc (`idp_tech_doc`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_tech_doc` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-idp_tech_doc-001 | Search TechDocs with query | `harness_list(resource_type="idp_tech_doc", query="getting started")` | Returns matching TechDocs results | ✅ Passed | Returns empty list (no tech docs); API responds correctly |  |
| TC-idp_tech_doc-002 | Search with specific keyword | `harness_list(resource_type="idp_tech_doc", query="deployment")` | Returns docs matching "deployment" | ⬜ Pending | | |
| TC-idp_tech_doc-003 | Search with multi-word query | `harness_list(resource_type="idp_tech_doc", query="api reference guide")` | Returns docs matching the multi-word query | ⬜ Pending | | |
| TC-idp_tech_doc-004 | Search with no results expected | `harness_list(resource_type="idp_tech_doc", query="xyznonexistent123")` | Returns empty result set | ⬜ Pending | | |
| TC-idp_tech_doc-005 | Search without query param | `harness_list(resource_type="idp_tech_doc")` | Returns results or error depending on required param | ⬜ Pending | | |
| TC-idp_tech_doc-006 | Attempt get operation (unsupported) | `harness_get(resource_type="idp_tech_doc")` | Error: get operation not supported | ⬜ Pending | | |
| TC-idp_tech_doc-007 | Search with empty query | `harness_list(resource_type="idp_tech_doc", query="")` | Returns results or validation error | ⬜ Pending | | |
| TC-idp_tech_doc-008 | Search with special characters | `harness_list(resource_type="idp_tech_doc", query="C++ templates")` | Handles special characters gracefully | ⬜ Pending | | |

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
