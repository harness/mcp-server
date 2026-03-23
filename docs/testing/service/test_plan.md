# Test Plan: Service (`service`)

| Field | Value |
|-------|-------|
| **Resource Type** | `service` |
| **Display Name** | Service |
| **Toolset** | services |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | service_id |
| **Filter Fields** | search_term, sort, order |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-svc-001 | List | List all services with defaults | `harness_list(resource_type="service")` | Returns paginated list of services with items array and total count |
| TC-svc-002 | List | List services with pagination | `harness_list(resource_type="service", page=1, size=5)` | Returns page 1 with up to 5 services |
| TC-svc-003 | List | Filter services by search_term | `harness_list(resource_type="service", search_term="nginx")` | Returns only services matching "nginx" in name or keyword |
| TC-svc-004 | List | Sort services by name ascending | `harness_list(resource_type="service", sort="name", order="asc")` | Returns services sorted alphabetically by name |
| TC-svc-005 | List | Sort services by identifier descending | `harness_list(resource_type="service", sort="identifier", order="desc")` | Returns services sorted by identifier in reverse order |
| TC-svc-006 | List | Combined filters: search + sort + pagination | `harness_list(resource_type="service", search_term="api", sort="name", order="asc", page=0, size=10)` | Returns filtered, sorted, paginated results |
| TC-svc-007 | Get | Get service by identifier | `harness_get(resource_type="service", service_id="my_service")` | Returns full service details including name, description, tags |
| TC-svc-008 | Get | Get service with scope overrides | `harness_get(resource_type="service", service_id="my_service", org_id="other_org", project_id="other_project")` | Returns service from specified org/project scope |
| TC-svc-009 | Create | Create service with required fields only | `harness_create(resource_type="service", identifier="test_svc", name="Test Service")` | Service created successfully with identifier and name |
| TC-svc-010 | Create | Create service with all fields | `harness_create(resource_type="service", identifier="full_svc", name="Full Service", description="A fully configured service", tags={"env": "test"}, yaml="service:\n  name: Full Service\n  identifier: full_svc")` | Service created with all fields populated |
| TC-svc-011 | Create | Create service with invalid data (missing name) | `harness_create(resource_type="service", identifier="bad_svc")` | Error: name is required |
| TC-svc-012 | Create | Create service with duplicate identifier | `harness_create(resource_type="service", identifier="existing_svc", name="Duplicate")` | Error: service with this identifier already exists |
| TC-svc-013 | Update | Update service name and description | `harness_update(resource_type="service", service_id="my_service", name="Updated Name", description="Updated description")` | Service updated with new name and description |
| TC-svc-014 | Update | Update service with tags | `harness_update(resource_type="service", service_id="my_service", name="My Service", tags={"team": "platform"})` | Service tags updated successfully |
| TC-svc-015 | Update | Update service with invalid data (missing name) | `harness_update(resource_type="service", service_id="my_service")` | Error: name is required for update |
| TC-svc-016 | Delete | Delete service by identifier | `harness_delete(resource_type="service", service_id="my_service")` | Service deleted successfully |
| TC-svc-017 | Scope | List services with different org_id | `harness_list(resource_type="service", org_id="custom_org")` | Returns services from the specified organization |
| TC-svc-018 | Scope | List services with different project_id | `harness_list(resource_type="service", org_id="default", project_id="another_project")` | Returns services from the specified project |
| TC-svc-019 | Error | Get non-existent service | `harness_get(resource_type="service", service_id="nonexistent_svc_xyz")` | Error: service not found (404) |
| TC-svc-020 | Error | Delete non-existent service | `harness_delete(resource_type="service", service_id="nonexistent_svc_xyz")` | Error: service not found (404) |
| TC-svc-021 | Edge | List services with empty results | `harness_list(resource_type="service", search_term="zzz_no_match_xyz")` | Returns empty items array with total=0 |
| TC-svc-022 | Edge | Create service with special characters in name | `harness_create(resource_type="service", identifier="svc_special", name="Service (Test) #1")` | Service created; identifier must be valid, name can contain special chars |
| TC-svc-023 | Edge | List services with max pagination | `harness_list(resource_type="service", page=0, size=100)` | Returns up to 100 services in one page |
| TC-svc-024 | Deep Link | Verify deep link in get response | `harness_get(resource_type="service", service_id="my_service")` | Response includes a valid Harness UI deep link URL |

## Notes
- Service scope is project-level; both org_id and project_id are required (defaults from config if omitted).
- The create body is wrapped under a `service` key by the bodyBuilder.
- Update auto-injects `identifier` from `service_id` if not provided in the body.
- The `yaml` field on create accepts full service YAML for advanced config (manifests, artifacts, etc.).
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/services/{serviceIdentifier}`
