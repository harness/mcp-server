# Test Plan: IDP Tech Doc (`idp_tech_doc`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_tech_doc` |
| **Display Name** | IDP Tech Doc |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | (none) |
| **Filter Fields** | query |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-idp_tech_doc-001 | List | Search TechDocs with query | `harness_list(resource_type="idp_tech_doc", query="getting started")` | Returns matching TechDocs results |
| TC-idp_tech_doc-002 | List | Search with specific keyword | `harness_list(resource_type="idp_tech_doc", query="deployment")` | Returns docs matching "deployment" |
| TC-idp_tech_doc-003 | List | Search with multi-word query | `harness_list(resource_type="idp_tech_doc", query="api reference guide")` | Returns docs matching the multi-word query |
| TC-idp_tech_doc-004 | List | Search with no results expected | `harness_list(resource_type="idp_tech_doc", query="xyznonexistent123")` | Returns empty result set |
| TC-idp_tech_doc-005 | List | Search without query param | `harness_list(resource_type="idp_tech_doc")` | Returns results or error depending on required param |
| TC-idp_tech_doc-006 | Error | Attempt get operation (unsupported) | `harness_get(resource_type="idp_tech_doc")` | Error: get operation not supported |
| TC-idp_tech_doc-007 | Edge | Search with empty query | `harness_list(resource_type="idp_tech_doc", query="")` | Returns results or validation error |
| TC-idp_tech_doc-008 | Edge | Search with special characters | `harness_list(resource_type="idp_tech_doc", query="C++ templates")` | Handles special characters gracefully |

## Notes
- Only supports list (search) operation; no get operation
- No identifier fields — this is a search-only resource
- API path: GET `/v1/techdocs/search` with `query` mapped to `term` query param
- Account-scoped resource
