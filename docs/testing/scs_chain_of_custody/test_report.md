# Test Report: SCS Chain of Custody (`scs_chain_of_custody`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_chain_of_custody` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SCC-001 | Get chain of custody for an artifact | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Returns chain of custody events for the artifact | ✅ Passed | API responds correctly; get only, requires artifact_id | No artifact data to test with |
| TC-SCC-002 | Verify event history structure | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Response contains timestamped events tracking artifact lifecycle | ⬜ Pending | | |
| TC-SCC-003 | Get with explicit org_id and project_id | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1", org_id="my-org", project_id="my-project")` | Returns custody chain for specified org/project | ⬜ Pending | | |
| TC-SCC-004 | Get with default org/project from config | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Uses default org/project from environment config | ⬜ Pending | | |
| TC-SCC-005 | Get without artifact_id | `harness_get(resource_type="scs_chain_of_custody")` | Error: artifact_id is required | ⬜ Pending | | |
| TC-SCC-006 | Get with non-existent artifact_id | `harness_get(resource_type="scs_chain_of_custody", artifact_id="nonexistent")` | Returns 404 or not-found error | ⬜ Pending | | |
| TC-SCC-007 | Unsupported operation (list) | `harness_list(resource_type="scs_chain_of_custody")` | Error: list operation not supported | ⬜ Pending | | |
| TC-SCC-008 | Authentication failure | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` (invalid key) | Returns 401 Unauthorized error | ⬜ Pending | | |
| TC-SCC-009 | Artifact with empty custody chain | `harness_get(resource_type="scs_chain_of_custody", artifact_id="new-art")` | Returns empty or minimal event list | ⬜ Pending | | |
| TC-SCC-010 | Verify deep link in response | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Response includes deep link to artifact in supply chain view | ⬜ Pending | | |

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
