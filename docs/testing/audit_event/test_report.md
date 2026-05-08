# Test Report: Audit Event (`audit_event`)

| Field | Value |
|-------|-------|
| **Resource Type** | `audit_event` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-aud-001 | List audit events with defaults | `harness_list(resource_type="audit_event")` | Returns paginated list of audit events (default 7-day window) | ✅ Passed | Returns 13,871 audit events with auditId, module, timestamps, deep links |  |
| TC-aud-002 | List audit events with pagination | `harness_list(resource_type="audit_event", page=1, size=5)` | Returns page 1 with up to 5 audit events | ⬜ Pending | | |
| TC-aud-003 | List audit events filtered by resource_type PIPELINE | `harness_list(resource_type="audit_event", filters={resource_type: "PIPELINE"})` | Returns only pipeline-related audit events | ⬜ Pending | | |
| TC-aud-004 | List audit events filtered by resource_type CONNECTOR | `harness_list(resource_type="audit_event", filters={resource_type: "CONNECTOR"})` | Returns only connector-related audit events | ⬜ Pending | | |
| TC-aud-005 | List audit events filtered by resource_type SERVICE | `harness_list(resource_type="audit_event", filters={resource_type: "SERVICE"})` | Returns only service-related audit events | ⬜ Pending | | |
| TC-aud-006 | List audit events filtered by resource_type SECRET | `harness_list(resource_type="audit_event", filters={resource_type: "SECRET"})` | Returns only secret-related audit events | ⬜ Pending | | |
| TC-aud-007 | List audit events filtered by action CREATE | `harness_list(resource_type="audit_event", filters={action: "CREATE"})` | Returns only create action events | ⬜ Pending | | |
| TC-aud-008 | List audit events filtered by action UPDATE | `harness_list(resource_type="audit_event", filters={action: "UPDATE"})` | Returns only update action events | ⬜ Pending | | |
| TC-aud-009 | List audit events filtered by action DELETE | `harness_list(resource_type="audit_event", filters={action: "DELETE"})` | Returns only delete action events | ⬜ Pending | | |
| TC-aud-010 | List audit events filtered by action LOGIN | `harness_list(resource_type="audit_event", filters={action: "LOGIN"})` | Returns only login events | ⬜ Pending | | |
| TC-aud-011 | List audit events with custom time range | `harness_list(resource_type="audit_event", filters={start_time: "2025-07-10T00:00:00Z", end_time: "2025-07-17T23:59:59Z"})` | Returns events within the specified ISO 8601 time window | ⬜ Pending | | |
| TC-aud-012 | List audit events with start_time only | `harness_list(resource_type="audit_event", filters={start_time: "2025-07-15T00:00:00Z"})` | Returns events from start_time to now | ⬜ Pending | | |
| TC-aud-013 | List audit events with search_term | `harness_list(resource_type="audit_event", filters={search_term: "deploy"})` | Returns audit events matching "deploy" keyword | ⬜ Pending | | |
| TC-aud-014 | List audit events filtered by module | `harness_list(resource_type="audit_event", filters={module: "CD"})` | Returns audit events for CD module | ⬜ Pending | | |
| TC-aud-015 | List audit events with combined filters | `harness_list(resource_type="audit_event", filters={resource_type: "PIPELINE", action: "CREATE", module: "CD"}, page=0, size=10)` | Returns pipeline creation events for CD module | ⬜ Pending | | |
| TC-aud-016 | List audit events with all filters | `harness_list(resource_type="audit_event", filters={resource_type: "CONNECTOR", action: "UPDATE", start_time: "2025-07-01T00:00:00Z", end_time: "2025-07-31T23:59:59Z", search_term: "github", module: "CI"})` | Returns fully filtered audit events | ⬜ Pending | | |
| TC-aud-017 | Get audit event YAML diff by ID | `harness_get(resource_type="audit_event", resource_id="audit_abc123")` | Returns YAML diff for the audit event | ⬜ Pending | | |
| TC-aud-018 | Get audit event for a create action | `harness_get(resource_type="audit_event", resource_id="audit_create_event")` | Returns YAML showing created resource | ⬜ Pending | | |
| TC-aud-019 | Get audit event for an update action | `harness_get(resource_type="audit_event", resource_id="audit_update_event")` | Returns YAML diff showing before/after changes | ⬜ Pending | | |
| TC-aud-020 | Get audit event with invalid ID | `harness_get(resource_type="audit_event", resource_id="nonexistent_audit")` | Error: Audit event not found (404) | ⬜ Pending | | |
| TC-aud-021 | List audit events with invalid resource_type filter | `harness_list(resource_type="audit_event", filters={resource_type: "INVALID_TYPE"})` | Error or empty results | ⬜ Pending | | |
| TC-aud-022 | List audit events with invalid action filter | `harness_list(resource_type="audit_event", filters={action: "INVALID_ACTION"})` | Error or empty results | ⬜ Pending | | |
| TC-aud-023 | List audit events with malformed start_time | `harness_list(resource_type="audit_event", filters={start_time: "not-a-date"})` | Falls back to default 7-day window (NaN handling) | ⬜ Pending | | |
| TC-aud-024 | List audit events with empty results | `harness_list(resource_type="audit_event", filters={resource_type: "CHAOS_EXPERIMENT", action: "DELETE"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-aud-025 | List audit events with max pagination | `harness_list(resource_type="audit_event", page=0, size=100)` | Returns up to 100 audit events | ⬜ Pending | | |
| TC-aud-026 | Verify default time window | `harness_list(resource_type="audit_event")` | Request uses 7-day default window (endTime=now, startTime=7 days ago) | ⬜ Pending | | |
| TC-aud-027 | List DEPLOYMENT_FREEZE resource type events | `harness_list(resource_type="audit_event", filters={resource_type: "DEPLOYMENT_FREEZE"})` | Returns deployment freeze audit events | ⬜ Pending | | |
| TC-aud-028 | List audit events for ROLE_ASSIGNMENT actions | `harness_list(resource_type="audit_event", filters={action: "ROLE_ASSIGNMENT_CREATED"})` | Returns role assignment creation events | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 28 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 27 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
