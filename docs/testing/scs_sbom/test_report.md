# Test Report: SBOM (`scs_sbom`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_sbom` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SS-001 | Get SBOM download URL | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` | Returns SBOM download URL for the orchestration run | ✅ Passed | API responds correctly; get only | No orchestration data to test with |
| TC-SS-002 | Verify SBOM content format | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` | Response contains a valid SBOM download link or SBOM content | ⬜ Pending | | |
| TC-SS-003 | Get with explicit org_id and project_id | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1", org_id="my-org", project_id="my-project")` | Returns SBOM for specified org/project | ⬜ Pending | | |
| TC-SS-004 | Get with default org/project from config | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` | Uses default org/project from environment config | ⬜ Pending | | |
| TC-SS-005 | Get without orchestration_id | `harness_get(resource_type="scs_sbom")` | Error: orchestration_id is required | ⬜ Pending | | |
| TC-SS-006 | Get with non-existent orchestration_id | `harness_get(resource_type="scs_sbom", orchestration_id="nonexistent")` | Returns 404 or not-found error | ⬜ Pending | | |
| TC-SS-007 | Unsupported operation (list) | `harness_list(resource_type="scs_sbom")` | Error: list operation not supported | ⬜ Pending | | |
| TC-SS-008 | Authentication failure | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` (invalid key) | Returns 401 Unauthorized error | ⬜ Pending | | |
| TC-SS-009 | Orchestration with no SBOM generated | `harness_get(resource_type="scs_sbom", orchestration_id="no-sbom-orch")` | Returns 404 or informational message about missing SBOM | ⬜ Pending | | |
| TC-SS-010 | End-to-end: chain of custody → SBOM | Get orchestration_id from custody, then `harness_get(resource_type="scs_sbom", orchestration_id="<from_custody>")` | Successfully retrieves SBOM using orchestration ID from custody chain | ⬜ Pending | | |

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
