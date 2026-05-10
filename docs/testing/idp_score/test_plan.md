# Test Plan: IDP Score (`idp_score`, `idp_score_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_score`, `idp_score_summary` |
| **Display Name** | IDP Score, IDP Score Summary |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | `idp_score`: list; `idp_score_summary`: get |
| **Execute Actions** | None |
| **Identifier Fields** | entity_identifier |
| **Filter Fields** | entity_identifier |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-idp_score-001 | List | List scorecard scores for an entity | `harness_list(resource_type="idp_score", filters={"entity_identifier":"default/Component/my-service"})` | Returns overall_score plus scorecard score items for the entity |
| TC-idp_score-002 | List | List scorecard scores using top-level entity_identifier | `harness_list(resource_type="idp_score", entity_identifier="default/Component/my-service")` | Returns overall_score plus scorecard score items for the entity |
| TC-idp_score-003 | Error | List without entity_identifier | `harness_list(resource_type="idp_score")` | Error from IDP API or validation indicating entity_identifier is required |
| TC-idp_score-004 | Error | List scorecard scores for non-existent entity | `harness_list(resource_type="idp_score", filters={"entity_identifier":"default/Component/nonexistent"})` | Error: entity not found or empty/no scores depending on API behavior |
| TC-idp_score_summary-001 | Get | Get aggregate score summary for an entity | `harness_get(resource_type="idp_score_summary", resource_id="default/Component/my-service")` | Returns aggregate score summary for the entity |
| TC-idp_score_summary-002 | Get | Get aggregate score summary via params | `harness_get(resource_type="idp_score_summary", params={"entity_identifier":"default/Component/my-service"})` | Returns aggregate score summary for the entity |
| TC-idp_score_summary-003 | Error | Get summary without entity_identifier | `harness_get(resource_type="idp_score_summary")` | Error: entity_identifier is required |
| TC-idp_score_summary-004 | Error | Get summary for non-existent entity | `harness_get(resource_type="idp_score_summary", resource_id="default/Component/nonexistent")` | Error: entity not found or empty/no summary depending on API behavior |

## Notes
- Account-scoped resource
- API paths: GET `/v1/scores` (`idp_score` list), GET `/v1/scores/summary` (`idp_score_summary` get)
- `idp_score` requires `entity_identifier` and does not expose pagination
- `idp_score_summary` requires `entity_identifier`
- No deep link template defined
