# Test Plan: Delegate (`delegate`)

| Field | Value |
|-------|-------|
| **Resource Type** | `delegate` |
| **Display Name** | Delegate |
| **Toolset** | delegates |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | delegate_id |
| **Filter Fields** | all, status, delegate_name, delegate_type, description, host_name, delegate_group_identifier, delegate_instance_filter, auto_upgrade, version_status |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-del-001 | List | List all delegates with defaults | `harness_list(resource_type="delegate")` | Returns list of delegates in the account |
| TC-del-002 | List | List all delegates including inactive | `harness_list(resource_type="delegate", filters={all: true})` | Returns all delegates including disconnected/disabled |
| TC-del-003 | List | List delegates filtered by CONNECTED status | `harness_list(resource_type="delegate", filters={status: "CONNECTED"})` | Returns only connected delegates |
| TC-del-004 | List | List delegates filtered by DISCONNECTED status | `harness_list(resource_type="delegate", filters={status: "DISCONNECTED"})` | Returns only disconnected delegates |
| TC-del-005 | List | List delegates filtered by delegate_name | `harness_list(resource_type="delegate", filters={delegate_name: "k8s-delegate"})` | Returns delegates matching the specified name |
| TC-del-006 | List | List delegates filtered by delegate_type | `harness_list(resource_type="delegate", filters={delegate_type: "KUBERNETES"})` | Returns only Kubernetes delegates |
| TC-del-007 | List | List delegates filtered by host_name | `harness_list(resource_type="delegate", filters={host_name: "worker-node-1"})` | Returns delegates on the specified host |
| TC-del-008 | List | List delegates filtered by delegate_group_identifier | `harness_list(resource_type="delegate", filters={delegate_group_identifier: "my-delegate-group"})` | Returns delegates in the specified group |
| TC-del-009 | List | List delegates filtered by description | `harness_list(resource_type="delegate", filters={description: "production"})` | Returns delegates with "production" in description |
| TC-del-010 | List | List delegates with combined filters | `harness_list(resource_type="delegate", filters={status: "CONNECTED", delegate_name: "prod"})` | Returns connected delegates matching name filter |
| TC-del-011 | List | List delegates with org/project scope | `harness_list(resource_type="delegate", org_id="default", project_id="my_project")` | Returns delegates scoped to the specified org/project |
| TC-del-012 | List | List delegates filtered by auto_upgrade | `harness_list(resource_type="delegate", filters={auto_upgrade: "ON"})` | Returns delegates with auto-upgrade enabled |
| TC-del-013 | List | List delegates filtered by version_status | `harness_list(resource_type="delegate", filters={version_status: "OUTDATED"})` | Returns delegates with outdated versions |
| TC-del-014 | Error | List delegates with invalid status | `harness_list(resource_type="delegate", filters={status: "INVALID_STATUS"})` | Error or empty results for invalid status |
| TC-del-015 | Edge | List delegates with empty results | `harness_list(resource_type="delegate", filters={delegate_name: "zzz_nonexistent_zzz"})` | Returns empty items array |
| TC-del-016 | Edge | List delegates filtered by ENABLED status | `harness_list(resource_type="delegate", filters={status: "ENABLED"})` | Returns only enabled delegates |
| TC-del-017 | Edge | List delegates filtered by delegate_instance_filter | `harness_list(resource_type="delegate", filters={delegate_instance_filter: "instance-1"})` | Returns delegates matching instance filter |

## Notes
- Delegates are account-scoped but can optionally be filtered by org_id/project_id
- Only supports `list` operation (no get, create, update, delete via this resource type)
- Uses POST method with body filters for status, name, type, etc.
- Status enum: CONNECTED, DISCONNECTED, ENABLED, WAITING_FOR_APPROVAL, DISABLED, DELETED
- All filter fields are passed in the request body as camelCase equivalents
- The `all` filter includes delegates in all states when set to true
