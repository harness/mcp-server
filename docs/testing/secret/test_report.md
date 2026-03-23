# Test Report: Secret (`secret`)

| Field | Value |
|-------|-------|
| **Resource Type** | `secret` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-sec-001 | List all secrets with defaults | `harness_list(resource_type="secret")` | Returns paginated list of secret metadata | ✅ Passed | Returns 10 secrets (metadata only — no values exposed) with deep links |  |
| TC-sec-002 | List secrets with pagination | `harness_list(resource_type="secret", page=0, size=5)` | Returns page 0 with up to 5 secrets | ⬜ Pending | | |
| TC-sec-003 | Filter by search_term | `harness_list(resource_type="secret", search_term="docker")` | Returns matching secrets | ⬜ Pending | | |
| TC-sec-004 | Filter by type SecretText | `harness_list(resource_type="secret", type="SecretText")` | Returns only SecretText secrets | ⬜ Pending | | |
| TC-sec-005 | Filter by type SecretFile | `harness_list(resource_type="secret", type="SecretFile")` | Returns only SecretFile secrets | ⬜ Pending | | |
| TC-sec-006 | Filter by type SSHKey | `harness_list(resource_type="secret", type="SSHKey")` | Returns only SSHKey secrets | ⬜ Pending | | |
| TC-sec-007 | Filter by type WinRmCredentials | `harness_list(resource_type="secret", type="WinRmCredentials")` | Returns only WinRmCredentials secrets | ⬜ Pending | | |
| TC-sec-008 | Filter by secret_identifier | `harness_list(resource_type="secret", secret_identifier="my_token")` | Returns matching secret | ⬜ Pending | | |
| TC-sec-009 | Filter by secret_name | `harness_list(resource_type="secret", secret_name="Docker Hub Token")` | Returns matching secret | ⬜ Pending | | |
| TC-sec-010 | Filter by secret_manager_identifiers | `harness_list(resource_type="secret", secret_manager_identifiers="harnessSecretManager,vaultManager")` | Returns secrets from specified managers | ⬜ Pending | | |
| TC-sec-011 | Filter by description | `harness_list(resource_type="secret", description="production")` | Returns matching secrets | ⬜ Pending | | |
| TC-sec-012 | Filter by tags | `harness_list(resource_type="secret", tags={"env": "prod"})` | Returns secrets with matching tags | ⬜ Pending | | |
| TC-sec-013 | Combined filters | `harness_list(resource_type="secret", type="SecretText", search_term="api", page=0, size=10)` | Returns filtered results | ⬜ Pending | | |
| TC-sec-014 | Get secret by identifier | `harness_get(resource_type="secret", secret_id="my_secret")` | Returns metadata only, no value | ⬜ Pending | | |
| TC-sec-015 | Get secret with scope overrides | `harness_get(resource_type="secret", secret_id="my_secret", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-sec-016 | List with different org_id | `harness_list(resource_type="secret", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-sec-017 | List with different project_id | `harness_list(resource_type="secret", org_id="default", project_id="other_project")` | Returns from specified project | ⬜ Pending | | |
| TC-sec-018 | Get non-existent secret | `harness_get(resource_type="secret", secret_id="nonexistent_sec_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-sec-019 | List with invalid type filter | `harness_list(resource_type="secret", type="InvalidType")` | Error or empty results | ⬜ Pending | | |
| TC-sec-020 | List with empty results | `harness_list(resource_type="secret", search_term="zzz_no_match_xyz")` | Empty items, total=0 | ⬜ Pending | | |
| TC-sec-021 | List with max pagination | `harness_list(resource_type="secret", page=0, size=100)` | Returns up to 100 secrets | ⬜ Pending | | |
| TC-sec-022 | Verify values NOT exposed | `harness_get(resource_type="secret", secret_id="my_secret")` | No secret value in response | ⬜ Pending | | |
| TC-sec-023 | Verify deep link in response | `harness_get(resource_type="secret", secret_id="my_secret")` | Response includes valid deep link | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 23 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 22 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
