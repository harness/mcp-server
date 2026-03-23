# Test Plan: SEI Org Tree (`sei_org_tree`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_org_tree` |
| **Display Name** | SEI Org Tree |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | org_tree_id |
| **Filter Fields** | _(none)_ |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/configuration/org-trees`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SOT-001 | List | List all org trees | `harness_list(resource_type="sei_org_tree")` | Returns list of SEI organizational trees |
| TC-SOT-002 | Get | Get a specific org tree | `harness_get(resource_type="sei_org_tree", org_tree_id="tree-1")` | Returns org tree details |
| TC-SOT-003 | Scope | Verify account-level scope | `harness_list(resource_type="sei_org_tree")` | Works without org/project identifiers |
| TC-SOT-004 | Error | Get with non-existent org_tree_id | `harness_get(resource_type="sei_org_tree", org_tree_id="nonexistent")` | Returns 404 or not-found error |
| TC-SOT-005 | Error | Get without org_tree_id | `harness_get(resource_type="sei_org_tree")` | Error: missing required identifier org_tree_id |
| TC-SOT-006 | Error | Unsupported operation (create) | `harness_create(resource_type="sei_org_tree", name="new-tree")` | Error: create operation not supported |
| TC-SOT-007 | Edge | Empty account with no org trees | `harness_list(resource_type="sei_org_tree")` | Returns empty items list |
| TC-SOT-008 | Deep Link | Verify deep link in list response | `harness_list(resource_type="sei_org_tree")` | Response includes deep link to org-trees configuration |
| TC-SOT-009 | Deep Link | Verify deep link in get response | `harness_get(resource_type="sei_org_tree", org_tree_id="tree-1")` | Response includes deep link to org-trees configuration |
| TC-SOT-010 | Get | Get org tree and verify structure | `harness_get(resource_type="sei_org_tree", org_tree_id="tree-1")` | Response contains tree structure with teams/nodes |

## Notes
- `sei_org_tree` supports `list` via `GET /gateway/sei/api/v2/org-trees` and `get` via `GET /gateway/sei/api/v2/org-trees/{orgTreeId}`.
- The `get` operation uses path param mapping: `org_tree_id` → `orgTreeId`.
- Both operations use passthrough response extractor.
