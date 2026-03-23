# Test Plan: Global Freeze (`global_freeze`)

| Field | Value |
|-------|-------|
| **Resource Type** | `global_freeze` |
| **Display Name** | Global Freeze |
| **Toolset** | freeze |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | manage |
| **Identifier Fields** | (none — singleton resource) |
| **Filter Fields** | (none) |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gfrz-001 | Get | Get current global freeze status | `harness_get(resource_type="global_freeze")` | Returns global freeze configuration including status (enabled/disabled) and YAML |
| TC-gfrz-002 | Get | Get global freeze with scope overrides | `harness_get(resource_type="global_freeze", org_id="other_org", project_id="other_project")` | Returns global freeze from specified org/project scope |
| TC-gfrz-003 | Execute | Enable global freeze | `harness_execute(resource_type="global_freeze", action="manage", yaml="freeze:\n  name: Global Freeze\n  identifier: _GLOBAL_\n  status: Enabled\n  orgIdentifier: default\n  projectIdentifier: my_project")` | Global freeze enabled successfully |
| TC-gfrz-004 | Execute | Disable global freeze | `harness_execute(resource_type="global_freeze", action="manage", yaml="freeze:\n  name: Global Freeze\n  identifier: _GLOBAL_\n  status: Disabled\n  orgIdentifier: default\n  projectIdentifier: my_project")` | Global freeze disabled successfully |
| TC-gfrz-005 | Execute | Manage global freeze with missing yaml | `harness_execute(resource_type="global_freeze", action="manage")` | Error: body must include yaml (global freeze YAML string with 'freeze:' root) |
| TC-gfrz-006 | Execute | Manage global freeze with invalid yaml | `harness_execute(resource_type="global_freeze", action="manage", yaml="invalid: not_a_freeze")` | Error: invalid freeze YAML structure |
| TC-gfrz-007 | Scope | Get global freeze with different org_id | `harness_get(resource_type="global_freeze", org_id="custom_org")` | Returns global freeze from specified org |
| TC-gfrz-008 | Scope | Get global freeze with different project_id | `harness_get(resource_type="global_freeze", org_id="default", project_id="other_project")` | Returns global freeze from specified project |
| TC-gfrz-009 | Error | Execute invalid action | `harness_execute(resource_type="global_freeze", action="invalid_action")` | Error: unknown action for global_freeze |
| TC-gfrz-010 | Edge | Get global freeze when none is configured | `harness_get(resource_type="global_freeze")` | Returns default global freeze state (likely disabled) |

## Notes
- Global freeze is a singleton resource — there is no list or delete operation.
- The only supported operation is `get` (to retrieve current status) and `manage` execute action (to enable/disable).
- The `manage` action uses `Content-Type: application/yaml` — the body is a raw YAML string with a `freeze:` root.
- The global freeze applies across the entire project scope.
- No `identifierFields` are needed since it's a singleton.
- No deep link template is defined for global freeze.
