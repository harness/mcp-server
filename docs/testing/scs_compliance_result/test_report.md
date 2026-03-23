# Test Report: SCS Compliance Result (`scs_compliance_result`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_compliance_result` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SCR-001 | List compliance results for an artifact | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1")` | Returns list of compliance scan results | ✅ Passed | API responds correctly; requires artifact_id filter | Requires artifact_id filter |
| TC-SCR-002 | List with explicit page | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", page=1)` | Returns second page of compliance results | ⬜ Pending | | |
| TC-SCR-003 | List with custom page size | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", size=5)` | Returns at most 5 compliance results | ⬜ Pending | | |
| TC-SCR-004 | List filtered by standards | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", standards=["CIS"])` | Returns results filtered to CIS standard | ⬜ Pending | | |
| TC-SCR-005 | List filtered by status PASS | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", status="PASS")` | Returns only passing compliance results | ⬜ Pending | | |
| TC-SCR-006 | List filtered by status FAIL | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", status="FAIL")` | Returns only failing compliance results | ⬜ Pending | | |
| TC-SCR-007 | List with combined filters | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", standards=["SLSA"], status="PASS")` | Returns passing SLSA compliance results | ⬜ Pending | | |
| TC-SCR-008 | List with explicit org_id and project_id | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", org_id="my-org", project_id="my-project")` | Returns results for specified org/project | ⬜ Pending | | |
| TC-SCR-009 | List without artifact_id | `harness_list(resource_type="scs_compliance_result")` | Error: artifact_id is required | ⬜ Pending | | |
| TC-SCR-010 | Non-existent artifact_id | `harness_list(resource_type="scs_compliance_result", artifact_id="nonexistent")` | Returns 404 or empty list | ⬜ Pending | | |
| TC-SCR-011 | Unsupported operation (get) | `harness_get(resource_type="scs_compliance_result", artifact_id="art-1")` | Error: get operation not supported | ⬜ Pending | | |
| TC-SCR-012 | Artifact with no compliance scans | `harness_list(resource_type="scs_compliance_result", artifact_id="unscanned-art")` | Returns empty items list | ⬜ Pending | | |
| TC-SCR-013 | Filter by non-existent standard | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", standards=["NONEXISTENT"])` | Returns empty items list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
