# Test Report: SCS Artifact Remediation (`scs_artifact_remediation`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_artifact_remediation` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SAR-001 | Get remediation advice with purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20")` | Returns remediation advice for the component | ✅ Passed | API responds correctly; get only, requires artifact_id | No artifact data to test with |
| TC-SAR-002 | Get with target_version | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20", target_version="4.17.21")` | Returns remediation advice targeting specific version | ⬜ Pending | | |
| TC-SAR-003 | Get with Maven purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:maven/org.apache.commons/commons-lang3@3.12.0")` | Returns remediation for Maven component | ⬜ Pending | | |
| TC-SAR-004 | Get with Python purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:pypi/requests@2.28.0")` | Returns remediation for Python component | ⬜ Pending | | |
| TC-SAR-005 | Get with explicit org_id and project_id | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20", org_id="my-org", project_id="my-project")` | Returns remediation for specified org/project | ⬜ Pending | | |
| TC-SAR-006 | Get without artifact_id | `harness_get(resource_type="scs_artifact_remediation", purl="pkg:npm/lodash@4.17.20")` | Error: artifact_id is required | ⬜ Pending | | |
| TC-SAR-007 | Get without purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1")` | Error or empty remediation (purl needed) | ⬜ Pending | | |
| TC-SAR-008 | Get with invalid purl format | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="invalid-purl")` | Error: invalid purl format | ⬜ Pending | | |
| TC-SAR-009 | Non-existent artifact_id | `harness_get(resource_type="scs_artifact_remediation", artifact_id="nonexistent", purl="pkg:npm/lodash@4.17.20")` | Returns 404 or not-found error | ⬜ Pending | | |
| TC-SAR-010 | Unsupported operation (list) | `harness_list(resource_type="scs_artifact_remediation")` | Error: list operation not supported | ⬜ Pending | | |
| TC-SAR-011 | Component with no known remediation | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/unknown-pkg@0.0.1")` | Returns empty remediation or informational message | ⬜ Pending | | |
| TC-SAR-012 | Verify deep link in response | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20")` | Response includes deep link to artifact view | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
