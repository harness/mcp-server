# Test Report: Service (`service`)

| Field | Value |
|-------|-------|
| **Resource Type** | `service` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-svc-001 | List all services with defaults | `harness_list(resource_type="service")` | Returns paginated list of services with items array and total count | ✅ Passed | Returns 17 services with name, identifier, timestamps, deep links |  |
| TC-svc-002 | List services with pagination | `harness_list(resource_type="service", page=1, size=5)` | Returns page 1 with up to 5 services | ⬜ Pending | | |
| TC-svc-003 | Filter services by search_term | `harness_list(resource_type="service", search_term="nginx")` | Returns only services matching "nginx" | ⬜ Pending | | |
| TC-svc-004 | Sort services by name ascending | `harness_list(resource_type="service", sort="name", order="asc")` | Returns services sorted alphabetically by name | ⬜ Pending | | |
| TC-svc-005 | Sort services by identifier descending | `harness_list(resource_type="service", sort="identifier", order="desc")` | Returns services sorted by identifier in reverse order | ⬜ Pending | | |
| TC-svc-006 | Combined filters: search + sort + pagination | `harness_list(resource_type="service", search_term="api", sort="name", order="asc", page=0, size=10)` | Returns filtered, sorted, paginated results | ⬜ Pending | | |
| TC-svc-007 | Get service by identifier | `harness_get(resource_type="service", service_id="my_service")` | Returns full service details | ⬜ Pending | | |
| TC-svc-008 | Get service with scope overrides | `harness_get(resource_type="service", service_id="my_service", org_id="other_org", project_id="other_project")` | Returns service from specified org/project | ⬜ Pending | | |
| TC-svc-009 | Create service with required fields only | `harness_create(resource_type="service", identifier="test_svc", name="Test Service")` | Service created successfully | ⬜ Pending | | |
| TC-svc-010 | Create service with all fields | `harness_create(resource_type="service", identifier="full_svc", name="Full Service", description="A fully configured service", tags={"env": "test"}, yaml="...")` | Service created with all fields | ⬜ Pending | | |
| TC-svc-011 | Create service with invalid data (missing name) | `harness_create(resource_type="service", identifier="bad_svc")` | Error: name is required | ⬜ Pending | | |
| TC-svc-012 | Create service with duplicate identifier | `harness_create(resource_type="service", identifier="existing_svc", name="Duplicate")` | Error: duplicate identifier | ⬜ Pending | | |
| TC-svc-013 | Update service name and description | `harness_update(resource_type="service", service_id="my_service", name="Updated Name", description="Updated description")` | Service updated successfully | ⬜ Pending | | |
| TC-svc-014 | Update service with tags | `harness_update(resource_type="service", service_id="my_service", name="My Service", tags={"team": "platform"})` | Tags updated successfully | ⬜ Pending | | |
| TC-svc-015 | Update service with invalid data (missing name) | `harness_update(resource_type="service", service_id="my_service")` | Error: name is required | ⬜ Pending | | |
| TC-svc-016 | Delete service by identifier | `harness_delete(resource_type="service", service_id="my_service")` | Service deleted successfully | ⬜ Pending | | |
| TC-svc-017 | List services with different org_id | `harness_list(resource_type="service", org_id="custom_org")` | Returns services from specified org | ⬜ Pending | | |
| TC-svc-018 | List services with different project_id | `harness_list(resource_type="service", org_id="default", project_id="another_project")` | Returns services from specified project | ⬜ Pending | | |
| TC-svc-019 | Get non-existent service | `harness_get(resource_type="service", service_id="nonexistent_svc_xyz")` | Error: service not found (404) | ⬜ Pending | | |
| TC-svc-020 | Delete non-existent service | `harness_delete(resource_type="service", service_id="nonexistent_svc_xyz")` | Error: service not found (404) | ⬜ Pending | | |
| TC-svc-021 | List services with empty results | `harness_list(resource_type="service", search_term="zzz_no_match_xyz")` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-svc-022 | Create service with special characters in name | `harness_create(resource_type="service", identifier="svc_special", name="Service (Test) #1")` | Service created successfully | ⬜ Pending | | |
| TC-svc-023 | List services with max pagination | `harness_list(resource_type="service", page=0, size=100)` | Returns up to 100 services | ⬜ Pending | | |
| TC-svc-024 | Verify deep link in get response | `harness_get(resource_type="service", service_id="my_service")` | Response includes valid Harness UI deep link | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 24 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 23 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
