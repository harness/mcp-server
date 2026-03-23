# Test Plan: Secret (`secret`)

| Field | Value |
|-------|-------|
| **Resource Type** | `secret` |
| **Display Name** | Secret |
| **Toolset** | secrets |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | secret_id |
| **Filter Fields** | search_term, type, secret_identifier, secret_name, secret_manager_identifiers, description, tags |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-sec-001 | List | List all secrets with defaults | `harness_list(resource_type="secret")` | Returns paginated list of secret metadata (values never exposed) |
| TC-sec-002 | List | List secrets with pagination | `harness_list(resource_type="secret", page=0, size=5)` | Returns page 0 with up to 5 secrets |
| TC-sec-003 | List | Filter secrets by search_term | `harness_list(resource_type="secret", search_term="docker")` | Returns secrets matching "docker" in name or keyword |
| TC-sec-004 | List | Filter secrets by type SecretText | `harness_list(resource_type="secret", type="SecretText")` | Returns only SecretText type secrets |
| TC-sec-005 | List | Filter secrets by type SecretFile | `harness_list(resource_type="secret", type="SecretFile")` | Returns only SecretFile type secrets |
| TC-sec-006 | List | Filter secrets by type SSHKey | `harness_list(resource_type="secret", type="SSHKey")` | Returns only SSHKey type secrets |
| TC-sec-007 | List | Filter secrets by type WinRmCredentials | `harness_list(resource_type="secret", type="WinRmCredentials")` | Returns only WinRmCredentials type secrets |
| TC-sec-008 | List | Filter secrets by secret_identifier | `harness_list(resource_type="secret", secret_identifier="my_token")` | Returns secret with matching identifier |
| TC-sec-009 | List | Filter secrets by secret_name | `harness_list(resource_type="secret", secret_name="Docker Hub Token")` | Returns secret with matching name |
| TC-sec-010 | List | Filter by secret_manager_identifiers | `harness_list(resource_type="secret", secret_manager_identifiers="harnessSecretManager,vaultManager")` | Returns secrets from specified secret managers |
| TC-sec-011 | List | Filter secrets by description | `harness_list(resource_type="secret", description="production")` | Returns secrets with matching description |
| TC-sec-012 | List | Filter secrets by tags | `harness_list(resource_type="secret", tags={"env": "prod"})` | Returns secrets with matching tags |
| TC-sec-013 | List | Combined filters: type + search + pagination | `harness_list(resource_type="secret", type="SecretText", search_term="api", page=0, size=10)` | Returns filtered, paginated secrets |
| TC-sec-014 | Get | Get secret by identifier | `harness_get(resource_type="secret", secret_id="my_secret")` | Returns secret metadata (name, type, scope) — value never exposed |
| TC-sec-015 | Get | Get secret with scope overrides | `harness_get(resource_type="secret", secret_id="my_secret", org_id="other_org", project_id="other_project")` | Returns secret metadata from specified org/project |
| TC-sec-016 | Scope | List secrets with different org_id | `harness_list(resource_type="secret", org_id="custom_org")` | Returns secrets from specified org |
| TC-sec-017 | Scope | List secrets with different project_id | `harness_list(resource_type="secret", org_id="default", project_id="other_project")` | Returns secrets from specified project |
| TC-sec-018 | Error | Get non-existent secret | `harness_get(resource_type="secret", secret_id="nonexistent_sec_xyz")` | Error: secret not found (404) |
| TC-sec-019 | Error | List with invalid type filter | `harness_list(resource_type="secret", type="InvalidType")` | Error or empty results: invalid secret type |
| TC-sec-020 | Edge | List secrets with empty results | `harness_list(resource_type="secret", search_term="zzz_no_match_xyz")` | Returns empty items array with total=0 |
| TC-sec-021 | Edge | List secrets with max pagination | `harness_list(resource_type="secret", page=0, size=100)` | Returns up to 100 secrets |
| TC-sec-022 | Edge | Verify secret values are NOT exposed | `harness_get(resource_type="secret", secret_id="my_secret")` | Response contains metadata only — no secret value, encrypted value, or decryption key |
| TC-sec-023 | Deep Link | Verify deep link in get response | `harness_get(resource_type="secret", secret_id="my_secret")` | Response includes valid Harness UI deep link |

## Notes
- Secrets are **read-only** — only `list` and `get` operations are supported. No create, update, or delete.
- Secret values are **NEVER** returned — only metadata (name, type, scope, identifier).
- The list endpoint is a POST with a filter body (not a standard GET).
- The `type` filter maps to `secretTypes` array in the API body.
- The `secret_manager_identifiers` filter accepts comma-separated values.
- The `tags` filter accepts a JSON object of key-value pairs.
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/secrets/{secretIdentifier}`
