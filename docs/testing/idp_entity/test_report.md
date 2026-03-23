# Test Report: IDP Entity (`idp_entity`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_entity` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-idp_entity-001 | List all IDP entities with defaults | `harness_list(resource_type="idp_entity")` | Returns paginated list of catalog entities | ✅ Passed | Returns 3 IDP entities (APIs, components) with kind, type, owner, deep links |  |
| TC-idp_entity-002 | List with pagination | `harness_list(resource_type="idp_entity", page=1, size=5)` | Returns second page with 5 items | ⬜ Pending | | |
| TC-idp_entity-003 | Filter by kind=component | `harness_list(resource_type="idp_entity", kind="component")` | Returns only component entities | ⬜ Pending | | |
| TC-idp_entity-004 | Filter by kind=api | `harness_list(resource_type="idp_entity", kind="api")` | Returns only API entities | ⬜ Pending | | |
| TC-idp_entity-005 | Filter by kind=user | `harness_list(resource_type="idp_entity", kind="user")` | Returns only user entities | ⬜ Pending | | |
| TC-idp_entity-006 | Filter by kind=group | `harness_list(resource_type="idp_entity", kind="group")` | Returns only group entities | ⬜ Pending | | |
| TC-idp_entity-007 | Filter by kind=workflow | `harness_list(resource_type="idp_entity", kind="workflow")` | Returns only workflow entities | ⬜ Pending | | |
| TC-idp_entity-008 | Filter by search term | `harness_list(resource_type="idp_entity", search="my-service")` | Returns entities matching search keyword | ⬜ Pending | | |
| TC-idp_entity-009 | Filter by kind + search combined | `harness_list(resource_type="idp_entity", kind="component", search="frontend")` | Returns components matching "frontend" | ⬜ Pending | | |
| TC-idp_entity-010 | Get entity by entity_id and kind | `harness_get(resource_type="idp_entity", entity_id="my-service", kind="component")` | Returns full entity details | ⬜ Pending | | |
| TC-idp_entity-011 | Get entity with custom namespace | `harness_get(resource_type="idp_entity", entity_id="my-service", kind="component", namespace="custom-ns")` | Returns entity with specified namespace | ⬜ Pending | | |
| TC-idp_entity-012 | Get entity with org scope | `harness_get(resource_type="idp_entity", entity_id="my-service", kind="component", org_id="my_org")` | Returns entity scoped to org | ⬜ Pending | | |
| TC-idp_entity-013 | Get with missing entity_id | `harness_get(resource_type="idp_entity", kind="component")` | Error: entity_id is required | ⬜ Pending | | |
| TC-idp_entity-014 | Get non-existent entity | `harness_get(resource_type="idp_entity", entity_id="nonexistent", kind="component")` | Error: entity not found (404) | ⬜ Pending | | |
| TC-idp_entity-015 | List with invalid kind enum | `harness_list(resource_type="idp_entity", kind="invalidkind")` | Error: invalid kind value | ⬜ Pending | | |
| TC-idp_entity-016 | List with size=0 | `harness_list(resource_type="idp_entity", size=0)` | Error or empty result | ⬜ Pending | | |
| TC-idp_entity-017 | List with very large page number | `harness_list(resource_type="idp_entity", page=9999)` | Returns empty list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 17 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 16 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
