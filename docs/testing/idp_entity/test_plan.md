# Test Plan: IDP Entity (`idp_entity`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_entity` |
| **Display Name** | IDP Entity |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | entity_id, kind |
| **Filter Fields** | kind, search, namespace |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-idp_entity-001 | List | List all IDP entities with defaults | `harness_list(resource_type="idp_entity")` | Returns paginated list of catalog entities |
| TC-idp_entity-002 | List | List with pagination | `harness_list(resource_type="idp_entity", page=1, size=5)` | Returns second page with 5 items |
| TC-idp_entity-003 | List | Filter by kind=component | `harness_list(resource_type="idp_entity", kind="component")` | Returns only component entities |
| TC-idp_entity-004 | List | Filter by kind=api | `harness_list(resource_type="idp_entity", kind="api")` | Returns only API entities |
| TC-idp_entity-005 | List | Filter by kind=user | `harness_list(resource_type="idp_entity", kind="user")` | Returns only user entities |
| TC-idp_entity-006 | List | Filter by kind=group | `harness_list(resource_type="idp_entity", kind="group")` | Returns only group entities |
| TC-idp_entity-007 | List | Filter by kind=workflow | `harness_list(resource_type="idp_entity", kind="workflow")` | Returns only workflow entities |
| TC-idp_entity-008 | List | Filter by search term | `harness_list(resource_type="idp_entity", search="my-service")` | Returns entities matching search keyword |
| TC-idp_entity-009 | List | Filter by kind + search combined | `harness_list(resource_type="idp_entity", kind="component", search="frontend")` | Returns components matching "frontend" |
| TC-idp_entity-010 | Get | Get entity by entity_id and kind | `harness_get(resource_type="idp_entity", entity_id="my-service", kind="component")` | Returns full entity details |
| TC-idp_entity-011 | Get | Get entity with custom namespace | `harness_get(resource_type="idp_entity", entity_id="my-service", kind="component", namespace="custom-ns")` | Returns entity with specified namespace |
| TC-idp_entity-012 | Get | Get entity with org scope | `harness_get(resource_type="idp_entity", entity_id="my-service", kind="component", org_id="my_org")` | Returns entity scoped to org |
| TC-idp_entity-013 | Error | Get with missing entity_id | `harness_get(resource_type="idp_entity", kind="component")` | Error: entity_id is required |
| TC-idp_entity-014 | Error | Get non-existent entity | `harness_get(resource_type="idp_entity", entity_id="nonexistent", kind="component")` | Error: entity not found (404) |
| TC-idp_entity-015 | Error | List with invalid kind enum | `harness_list(resource_type="idp_entity", kind="invalidkind")` | Error: invalid kind value |
| TC-idp_entity-016 | Edge | List with size=0 | `harness_list(resource_type="idp_entity", size=0)` | Error or empty result |
| TC-idp_entity-017 | Edge | List with very large page number | `harness_list(resource_type="idp_entity", page=9999)` | Returns empty list |

## Notes
- Scope is account-level; org_id and project_id are optional and affect the entity's scope path
- The `kind` field supports enum values: api, component, environment, environmentblueprint, group, resource, user, workflow
- The get operation builds a path using scope/kind/namespace/entityId pattern
- Default namespace is the computed scope string (e.g., "account" or "account.orgId")
