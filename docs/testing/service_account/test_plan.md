# Test Plan: Service Account (`service_account`)

| Field | Value |
|-------|-------|
| **Resource Type** | `service_account` |
| **Display Name** | Service Account |
| **Toolset** | access_control |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | service_account_id |
| **Filter Fields** | search_term |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-sa-001 | List | Basic list of service accounts | `harness_list(resource_type="service_account")` | Returns paginated list of service accounts |
| TC-sa-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="service_account", page=0, size=5)` | Returns first 5 service accounts |
| TC-sa-003 | List | Pagination - page 1 | `harness_list(resource_type="service_account", page=1, size=5)` | Returns second page of service accounts |
| TC-sa-004 | List | Filter by search_term | `harness_list(resource_type="service_account", search_term="ci-bot")` | Returns service accounts matching "ci-bot" |
| TC-sa-005 | Get | Get service account by ID | `harness_get(resource_type="service_account", service_account_id="<valid_id>")` | Returns full service account details |
| TC-sa-006 | Create | Create service account | `harness_create(resource_type="service_account", body={identifier: "test_sa", name: "Test SA", email: "test-sa@harness.io"})` | Service account created |
| TC-sa-007 | Create | Create with description and tags | `harness_create(resource_type="service_account", body={identifier: "test_sa_full", name: "Full Test SA", email: "test-sa-full@harness.io", description: "Test service account", tags: {team: "platform"}})` | Service account created with all fields |
| TC-sa-008 | Delete | Delete service account | `harness_delete(resource_type="service_account", service_account_id="test_sa")` | Service account deleted |
| TC-sa-009 | Scope | Custom org and project | `harness_list(resource_type="service_account", org_id="custom_org", project_id="custom_project")` | Returns service accounts for specified scope |
| TC-sa-010 | Error | Get nonexistent service account | `harness_get(resource_type="service_account", service_account_id="nonexistent")` | Returns not found error |
| TC-sa-011 | Error | Create without required fields | `harness_create(resource_type="service_account", body={identifier: "test_sa"})` | Returns validation error (missing name, email) |
| TC-sa-012 | Error | Create duplicate identifier | `harness_create(resource_type="service_account", body={identifier: "<existing_id>", name: "Dup", email: "dup@harness.io"})` | Returns conflict error |
| TC-sa-013 | Error | Delete nonexistent service account | `harness_delete(resource_type="service_account", service_account_id="nonexistent")` | Returns not found error |
| TC-sa-014 | Edge | Search with no matches | `harness_list(resource_type="service_account", search_term="zzz_nonexistent_zzz")` | Returns empty list |
| TC-sa-015 | Describe | Resource metadata | `harness_describe(resource_type="service_account")` | Returns full metadata including create body schema |

## Notes
- List endpoint: GET `/ng/api/serviceaccount` with searchTerm query param
- Get endpoint: GET `/ng/api/serviceaccount/{serviceAccountIdentifier}`
- Create body: identifier (required), name (required), email (required), description (optional), tags (optional object)
- Delete endpoint: DELETE `/ng/api/serviceaccount/{serviceAccountIdentifier}`
- Deep link: `/ng/account/{accountId}/settings/access-control/service-accounts/{serviceAccountIdentifier}`
