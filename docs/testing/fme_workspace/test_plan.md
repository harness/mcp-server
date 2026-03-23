# Test Plan: FME Workspace (`fme_workspace`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_workspace` |
| **Display Name** | FME Workspace |
| **Toolset** | feature-flags |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | workspace_id |
| **Filter Fields** | offset |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_workspace-001 | List | List all workspaces with defaults | `harness_list(resource_type="fme_workspace")` | Returns list of FME workspaces |
| TC-fme_workspace-002 | List | List with custom size | `harness_list(resource_type="fme_workspace", size=5)` | Returns up to 5 workspaces |
| TC-fme_workspace-003 | List | List with offset pagination | `harness_list(resource_type="fme_workspace", offset=20)` | Returns workspaces starting at offset 20 |
| TC-fme_workspace-004 | List | List with offset and size | `harness_list(resource_type="fme_workspace", offset=10, size=5)` | Returns 5 workspaces starting at offset 10 |
| TC-fme_workspace-005 | List | List with max size | `harness_list(resource_type="fme_workspace", size=1000)` | Returns up to 1000 workspaces |
| TC-fme_workspace-006 | Error | Attempt get operation (unsupported) | `harness_get(resource_type="fme_workspace", workspace_id="my_workspace")` | Error: get operation not supported |
| TC-fme_workspace-007 | Edge | List with offset beyond data | `harness_list(resource_type="fme_workspace", offset=999999)` | Returns empty list |
| TC-fme_workspace-008 | Edge | List with offset=0 | `harness_list(resource_type="fme_workspace", offset=0)` | Returns first page of workspaces |
| TC-fme_workspace-009 | Edge | List with size=1 | `harness_list(resource_type="fme_workspace", size=1)` | Returns exactly 1 workspace |

## Notes
- Uses FME (Split.io) API at `https://api.split.io` via `baseUrlOverride: "fme"`
- Account-scoped; does not inject orgIdentifier/projectIdentifier
- Uses offset-based pagination (not page-based): `offset` and `size` params
- API path: GET `/internal/api/v2/workspaces`
- Max size is 1000
