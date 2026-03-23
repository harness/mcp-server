# Test Plan: Chaos Probe (`chaos_probe`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_probe` |
| **Display Name** | Chaos Probe |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | probe_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cp-001 | List | List chaos probes with defaults | `harness_list(resource_type="chaos_probe")` | Returns paginated list of chaos probes with totalNoOfProbes count |
| TC-cp-002 | List | List with pagination - page 0 | `harness_list(resource_type="chaos_probe", page=0, limit=5)` | Returns first 5 probes |
| TC-cp-003 | List | List with pagination - page 1 | `harness_list(resource_type="chaos_probe", page=1, limit=5)` | Returns next 5 probes |
| TC-cp-004 | List | List with explicit org and project | `harness_list(resource_type="chaos_probe", org_id="myorg", project_id="myproject")` | Returns probes scoped to specified org/project |
| TC-cp-005 | Get | Get probe by ID | `harness_get(resource_type="chaos_probe", probe_id="<valid_id>")` | Returns probe details |
| TC-cp-006 | Get | Get probe with invalid ID | `harness_get(resource_type="chaos_probe", probe_id="nonexistent")` | Returns appropriate error |
| TC-cp-007 | Get | Get probe missing required ID | `harness_get(resource_type="chaos_probe")` | Returns validation error for missing probe_id |
| TC-cp-008 | Scope | List with wrong project | `harness_list(resource_type="chaos_probe", project_id="wrongproject")` | Returns empty list or error |
| TC-cp-009 | Edge | List when no probes exist | `harness_list(resource_type="chaos_probe")` | Returns empty items array with total=0 |
| TC-cp-010 | Error | Attempt create (not supported) | `harness_create(resource_type="chaos_probe", body={...})` | Returns error indicating create is not supported |

## Notes
- Chaos API uses `organizationIdentifier` instead of `orgIdentifier` (scopeParams override)
- List response uses custom extractor: `{ totalNoOfProbes, data: [...] }`
- GET endpoint: `/gateway/chaos/manager/api/rest/v2/probes/{probeId}`
- List endpoint: `/gateway/chaos/manager/api/rest/v2/probes`
