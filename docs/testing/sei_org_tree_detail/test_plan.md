# Test Plan: SEI Org Tree Detail (`sei_org_tree_detail`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_org_tree_detail` |
| **Display Name** | SEI Org Tree Detail |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | get, list |
| **Execute Actions** | None |
| **Identifier Fields** | org_tree_id |
| **Filter Fields** | aspect |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/configuration/org-trees`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SOTD-001 | Get | Get efficiency profile for org tree | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="efficiency_profile")` | Returns efficiency profile for the org tree |
| TC-SOTD-002 | Get | Get productivity profile | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="productivity_profile")` | Returns productivity profile for the org tree |
| TC-SOTD-003 | Get | Get business alignment profile | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="business_alignment_profile")` | Returns business alignment profile |
| TC-SOTD-004 | Get | Get org tree integrations | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="integrations")` | Returns integrations configured for the org tree |
| TC-SOTD-005 | Get | Get org tree teams | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="teams")` | Returns teams under the org tree |
| TC-SOTD-006 | List | List org tree integrations | `harness_list(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="integrations")` | Returns list of integrations |
| TC-SOTD-007 | List | List org tree teams | `harness_list(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="teams")` | Returns list of teams under the org tree |
| TC-SOTD-008 | Get / Filter | Default aspect (efficiency_profile) | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1")` | Defaults to efficiency_profile aspect |
| TC-SOTD-009 | Scope | Verify account-level scope | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="teams")` | Works without org/project identifiers |
| TC-SOTD-010 | Error | Missing org_tree_id | `harness_get(resource_type="sei_org_tree_detail", aspect="efficiency_profile")` | Error: org_tree_id is required |
| TC-SOTD-011 | Error | Invalid aspect value | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="invalid")` | Falls back to teams or returns error |
| TC-SOTD-012 | Error | Non-existent org_tree_id | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="nonexistent", aspect="teams")` | Returns 404 or appropriate error |
| TC-SOTD-013 | Deep Link | Verify deep link in response | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="efficiency_profile")` | Response includes deep link to org-trees configuration |

## Notes
- `sei_org_tree_detail` supports both `get` and `list` operations with a dynamic path builder.
- Path builder resolves: `efficiency_profile`, `productivity_profile`, `businessAlignmentProfile` (note camelCase), `integrations`, `teams`.
- Path format: `GET /gateway/sei/api/v2/org-trees/{orgTreeId}/{aspect}`.
- `org_tree_id` is mandatory — the path builder throws if missing.
- The `business_alignment_profile` aspect maps to `businessAlignmentProfile` in the URL path.
