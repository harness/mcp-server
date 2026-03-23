# Test Plan: Freeze Window (`freeze_window`)

| Field | Value |
|-------|-------|
| **Resource Type** | `freeze_window` |
| **Display Name** | Freeze Window |
| **Toolset** | freeze |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | toggle_status |
| **Identifier Fields** | freeze_id |
| **Filter Fields** | freeze_status, search_term, start_time, end_time |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-frz-001 | List | List all freeze windows with defaults | `harness_list(resource_type="freeze_window")` | Returns paginated list of freeze windows with items array and total count |
| TC-frz-002 | List | List freeze windows with pagination | `harness_list(resource_type="freeze_window", page=0, size=5)` | Returns page 0 with up to 5 freeze windows |
| TC-frz-003 | List | Filter by freeze_status Enabled | `harness_list(resource_type="freeze_window", freeze_status="Enabled")` | Returns only enabled freeze windows |
| TC-frz-004 | List | Filter by freeze_status Disabled | `harness_list(resource_type="freeze_window", freeze_status="Disabled")` | Returns only disabled freeze windows |
| TC-frz-005 | List | Filter by search_term | `harness_list(resource_type="freeze_window", search_term="maintenance")` | Returns freeze windows matching "maintenance" |
| TC-frz-006 | List | Filter by start_time and end_time | `harness_list(resource_type="freeze_window", start_time="1700000000000", end_time="1700100000000")` | Returns freeze windows within the specified time range |
| TC-frz-007 | List | Combined filters: status + search + pagination | `harness_list(resource_type="freeze_window", freeze_status="Enabled", search_term="release", page=0, size=10)` | Returns filtered, paginated freeze windows |
| TC-frz-008 | Get | Get freeze window by identifier | `harness_get(resource_type="freeze_window", freeze_id="my_freeze")` | Returns full freeze window details including YAML, status, windows |
| TC-frz-009 | Get | Get freeze window with scope overrides | `harness_get(resource_type="freeze_window", freeze_id="my_freeze", org_id="other_org", project_id="other_project")` | Returns freeze window from specified org/project |
| TC-frz-010 | Create | Create freeze window with YAML | `harness_create(resource_type="freeze_window", yaml="freeze:\n  name: Weekend Freeze\n  identifier: weekend_freeze\n  status: Disabled\n  windows:\n    - timeZone: UTC\n      startTime: '2025-01-01 00:00'\n      endTime: '2025-01-02 00:00'")` | Freeze window created from YAML |
| TC-frz-011 | Create | Create freeze window with missing yaml | `harness_create(resource_type="freeze_window")` | Error: body must include yaml (freeze YAML string with 'freeze:' root) |
| TC-frz-012 | Create | Create freeze window with invalid YAML | `harness_create(resource_type="freeze_window", yaml="invalid: not_a_freeze")` | Error: invalid freeze YAML structure |
| TC-frz-013 | Update | Update freeze window YAML | `harness_update(resource_type="freeze_window", freeze_id="my_freeze", yaml="freeze:\n  name: Updated Freeze\n  identifier: my_freeze\n  status: Enabled\n  windows:\n    - timeZone: UTC\n      startTime: '2025-06-01 00:00'\n      endTime: '2025-06-02 00:00'")` | Freeze window updated with new YAML |
| TC-frz-014 | Update | Update freeze window with missing yaml | `harness_update(resource_type="freeze_window", freeze_id="my_freeze")` | Error: body must include yaml |
| TC-frz-015 | Delete | Delete freeze window by identifier | `harness_delete(resource_type="freeze_window", freeze_id="my_freeze")` | Freeze window deleted successfully |
| TC-frz-016 | Execute | Toggle freeze status to Enabled | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Enabled", freeze_ids=["freeze_1", "freeze_2"])` | Freeze windows enabled successfully |
| TC-frz-017 | Execute | Toggle freeze status to Disabled | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Disabled", freeze_ids=["freeze_1"])` | Freeze window disabled successfully |
| TC-frz-018 | Execute | Toggle status with empty freeze_ids | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Enabled", freeze_ids=[])` | Error: freeze_ids must be a non-empty array |
| TC-frz-019 | Execute | Toggle status with missing freeze_ids | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Enabled")` | Error: body must include freeze_ids |
| TC-frz-020 | Scope | List freeze windows with different org_id | `harness_list(resource_type="freeze_window", org_id="custom_org")` | Returns freeze windows from specified org |
| TC-frz-021 | Scope | List freeze windows with different project_id | `harness_list(resource_type="freeze_window", org_id="default", project_id="other_project")` | Returns freeze windows from specified project |
| TC-frz-022 | Error | Get non-existent freeze window | `harness_get(resource_type="freeze_window", freeze_id="nonexistent_frz_xyz")` | Error: freeze window not found (404) |
| TC-frz-023 | Error | Delete non-existent freeze window | `harness_delete(resource_type="freeze_window", freeze_id="nonexistent_frz_xyz")` | Error: freeze window not found (404) |
| TC-frz-024 | Edge | List freeze windows with empty results | `harness_list(resource_type="freeze_window", search_term="zzz_no_match_xyz")` | Returns empty items array with total=0 |
| TC-frz-025 | Edge | List freeze windows with max pagination | `harness_list(resource_type="freeze_window", page=0, size=100)` | Returns up to 100 freeze windows |
| TC-frz-026 | Deep Link | Verify deep link in get response | `harness_get(resource_type="freeze_window", freeze_id="my_freeze")` | Response includes valid Harness UI deep link with freeze window studio URL |

## Notes
- Freeze window list uses a POST endpoint with a filter body, not a standard GET.
- The list response uses `totalItems` instead of the standard `totalElements`.
- Create and update endpoints use `Content-Type: application/yaml` — the body is a raw YAML string.
- The `toggle_status` execute action accepts `status` as a query param and `freeze_ids` as the body (JSON array of identifiers).
- Valid freeze_status filter values: `Enabled`, `Disabled`.
- `start_time` and `end_time` filters accept epoch milliseconds.
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/freeze-windows/studio/window/{freezeIdentifier}/?sectionId=OVERVIEW`
