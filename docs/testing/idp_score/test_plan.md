# Test Plan: IDP Score (`idp_score`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_score` |
| **Display Name** | IDP Score |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | entity_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-idp_score-001 | List | List all entity scores with defaults | `harness_list(resource_type="idp_score")` | Returns paginated list of entity scores |
| TC-idp_score-002 | List | List with pagination page 0 | `harness_list(resource_type="idp_score", page=0, size=5)` | Returns first page with up to 5 scores |
| TC-idp_score-003 | List | List with pagination page 1 | `harness_list(resource_type="idp_score", page=1, size=5)` | Returns second page of scores |
| TC-idp_score-004 | List | List with large page size | `harness_list(resource_type="idp_score", size=100)` | Returns up to 100 scores |
| TC-idp_score-005 | Get | Get score by entity_id | `harness_get(resource_type="idp_score", entity_id="my-service")` | Returns score summary for the entity |
| TC-idp_score-006 | Get | Verify score response structure | `harness_get(resource_type="idp_score", entity_id="my-service")` | Response contains score summary fields |
| TC-idp_score-007 | Error | Get with missing entity_id | `harness_get(resource_type="idp_score")` | Error: entity_id is required |
| TC-idp_score-008 | Error | Get non-existent entity score | `harness_get(resource_type="idp_score", entity_id="nonexistent")` | Error: entity not found (404) |
| TC-idp_score-009 | Edge | List with page beyond data | `harness_list(resource_type="idp_score", page=9999)` | Returns empty list |
| TC-idp_score-010 | Edge | List with size=1 | `harness_list(resource_type="idp_score", size=1)` | Returns exactly 1 score |

## Notes
- Account-scoped resource
- API paths: GET `/v1/scores` (list), GET `/v1/scores/{entityId}` (get)
- No filter fields; only pagination params supported for list
- No deep link template defined
