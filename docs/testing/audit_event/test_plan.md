# Test Plan: Audit Event (`audit_event`)

| Field | Value |
|-------|-------|
| **Resource Type** | `audit_event` |
| **Display Name** | Audit Event |
| **Toolset** | audit |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | audit_id |
| **Filter Fields** | resource_type, action, start_time, end_time, search_term, module |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-aud-001 | List | List audit events with defaults | `harness_list(resource_type="audit_event")` | Returns paginated list of audit events (default 7-day window) |
| TC-aud-002 | List | List audit events with pagination | `harness_list(resource_type="audit_event", page=1, size=5)` | Returns page 1 with up to 5 audit events |
| TC-aud-003 | List | List audit events filtered by resource_type PIPELINE | `harness_list(resource_type="audit_event", filters={resource_type: "PIPELINE"})` | Returns only pipeline-related audit events |
| TC-aud-004 | List | List audit events filtered by resource_type CONNECTOR | `harness_list(resource_type="audit_event", filters={resource_type: "CONNECTOR"})` | Returns only connector-related audit events |
| TC-aud-005 | List | List audit events filtered by resource_type SERVICE | `harness_list(resource_type="audit_event", filters={resource_type: "SERVICE"})` | Returns only service-related audit events |
| TC-aud-006 | List | List audit events filtered by resource_type SECRET | `harness_list(resource_type="audit_event", filters={resource_type: "SECRET"})` | Returns only secret-related audit events |
| TC-aud-007 | List | List audit events filtered by action CREATE | `harness_list(resource_type="audit_event", filters={action: "CREATE"})` | Returns only create action events |
| TC-aud-008 | List | List audit events filtered by action UPDATE | `harness_list(resource_type="audit_event", filters={action: "UPDATE"})` | Returns only update action events |
| TC-aud-009 | List | List audit events filtered by action DELETE | `harness_list(resource_type="audit_event", filters={action: "DELETE"})` | Returns only delete action events |
| TC-aud-010 | List | List audit events filtered by action LOGIN | `harness_list(resource_type="audit_event", filters={action: "LOGIN"})` | Returns only login events |
| TC-aud-011 | List | List audit events with custom time range | `harness_list(resource_type="audit_event", filters={start_time: "2025-07-10T00:00:00Z", end_time: "2025-07-17T23:59:59Z"})` | Returns events within the specified ISO 8601 time window |
| TC-aud-012 | List | List audit events with start_time only | `harness_list(resource_type="audit_event", filters={start_time: "2025-07-15T00:00:00Z"})` | Returns events from start_time to now |
| TC-aud-013 | List | List audit events with search_term | `harness_list(resource_type="audit_event", filters={search_term: "deploy"})` | Returns audit events matching "deploy" keyword |
| TC-aud-014 | List | List audit events filtered by module | `harness_list(resource_type="audit_event", filters={module: "CD"})` | Returns audit events for CD module |
| TC-aud-015 | List | List audit events with combined filters | `harness_list(resource_type="audit_event", filters={resource_type: "PIPELINE", action: "CREATE", module: "CD"}, page=0, size=10)` | Returns pipeline creation events for CD module |
| TC-aud-016 | List | List audit events with all filters | `harness_list(resource_type="audit_event", filters={resource_type: "CONNECTOR", action: "UPDATE", start_time: "2025-07-01T00:00:00Z", end_time: "2025-07-31T23:59:59Z", search_term: "github", module: "CI"})` | Returns fully filtered audit events |
| TC-aud-017 | Get | Get audit event YAML diff by ID | `harness_get(resource_type="audit_event", resource_id="audit_abc123")` | Returns YAML diff for the audit event |
| TC-aud-018 | Get | Get audit event for a create action | `harness_get(resource_type="audit_event", resource_id="audit_create_event")` | Returns YAML showing created resource |
| TC-aud-019 | Get | Get audit event for an update action | `harness_get(resource_type="audit_event", resource_id="audit_update_event")` | Returns YAML diff showing before/after changes |
| TC-aud-020 | Error | Get audit event with invalid ID | `harness_get(resource_type="audit_event", resource_id="nonexistent_audit")` | Error: Audit event not found (404) |
| TC-aud-021 | Error | List audit events with invalid resource_type filter | `harness_list(resource_type="audit_event", filters={resource_type: "INVALID_TYPE"})` | Error or empty results |
| TC-aud-022 | Error | List audit events with invalid action filter | `harness_list(resource_type="audit_event", filters={action: "INVALID_ACTION"})` | Error or empty results |
| TC-aud-023 | Error | List audit events with malformed start_time | `harness_list(resource_type="audit_event", filters={start_time: "not-a-date"})` | Falls back to default 7-day window (NaN handling) |
| TC-aud-024 | Edge | List audit events with empty results | `harness_list(resource_type="audit_event", filters={resource_type: "CHAOS_EXPERIMENT", action: "DELETE"})` | Returns empty items array with total=0 |
| TC-aud-025 | Edge | List audit events with max pagination | `harness_list(resource_type="audit_event", page=0, size=100)` | Returns up to 100 audit events |
| TC-aud-026 | Edge | Verify default time window | `harness_list(resource_type="audit_event")` | Request uses 7-day default window (endTime=now, startTime=7 days ago) |
| TC-aud-027 | List | List DEPLOYMENT_FREEZE resource type events | `harness_list(resource_type="audit_event", filters={resource_type: "DEPLOYMENT_FREEZE"})` | Returns deployment freeze audit events |
| TC-aud-028 | List | List audit events for ROLE_ASSIGNMENT actions | `harness_list(resource_type="audit_event", filters={action: "ROLE_ASSIGNMENT_CREATED"})` | Returns role assignment creation events |

## Notes
- Audit events are account-scoped — no org/project parameters in query
- Default time window is 7 days (from now minus 7 days to now)
- `start_time` and `end_time` accept ISO 8601 format and are converted to Unix milliseconds
- Invalid date strings fall back to defaults (NaN handling in `parseIsoToMs`)
- The `get` operation returns YAML diff for the audit event (before/after)
- Uses POST `/audit/api/audits/list` for listing with body filters
- Uses GET `/audit/api/auditYaml?auditId={id}` for getting YAML diff
- `resource_type` filter supports 30+ Harness entity types (ORGANIZATION, PROJECT, PIPELINE, CONNECTOR, SERVICE, etc.)
- `action` filter supports 30+ action types (CREATE, UPDATE, DELETE, LOGIN, START, END, ABORT, etc.)
