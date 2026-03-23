# Test Report: Cost Perspective (`cost_perspective`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_perspective` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cpv-001 | List perspectives with defaults | `harness_list(resource_type="cost_perspective")` | Returns paginated list of cost perspectives | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-cpv-002 | List with pagination | `harness_list(resource_type="cost_perspective", page=0, size=5)` | Returns first 5 perspectives | ⬜ Pending | | |
| TC-cpv-003 | List with search filter | `harness_list(resource_type="cost_perspective", search="production")` | Returns perspectives matching "production" name filter | ⬜ Pending | | |
| TC-cpv-004 | List with sort_type=NAME | `harness_list(resource_type="cost_perspective", sort_type="NAME")` | Returns perspectives sorted by name | ⬜ Pending | | |
| TC-cpv-005 | List with sort_type=COST | `harness_list(resource_type="cost_perspective", sort_type="COST", sort_order="DESCENDING")` | Returns perspectives sorted by cost descending | ⬜ Pending | | |
| TC-cpv-006 | List with sort_type=LAST_EDIT | `harness_list(resource_type="cost_perspective", sort_type="LAST_EDIT")` | Returns perspectives sorted by last edit time | ⬜ Pending | | |
| TC-cpv-007 | List with cloud_filter=AWS | `harness_list(resource_type="cost_perspective", cloud_filter="AWS")` | Returns only AWS perspectives | ⬜ Pending | | |
| TC-cpv-008 | List with cloud_filter=GCP | `harness_list(resource_type="cost_perspective", cloud_filter="GCP")` | Returns only GCP perspectives | ⬜ Pending | | |
| TC-cpv-009 | List with cloud_filter=AZURE | `harness_list(resource_type="cost_perspective", cloud_filter="AZURE")` | Returns only Azure perspectives | ⬜ Pending | | |
| TC-cpv-010 | List with cloud_filter=CLUSTER | `harness_list(resource_type="cost_perspective", cloud_filter="CLUSTER")` | Returns only cluster perspectives | ⬜ Pending | | |
| TC-cpv-011 | List with combined filters | `harness_list(resource_type="cost_perspective", search="prod", cloud_filter="AWS", sort_type="COST", sort_order="DESCENDING")` | Returns AWS perspectives matching "prod", sorted by cost desc | ⬜ Pending | | |
| TC-cpv-012 | Get perspective by ID | `harness_get(resource_type="cost_perspective", perspective_id="<valid_id>")` | Returns full perspective details | ⬜ Pending | | |
| TC-cpv-013 | Get perspective with invalid ID | `harness_get(resource_type="cost_perspective", perspective_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-cpv-014 | Create perspective with name | `harness_create(resource_type="cost_perspective", body={name: "Test Perspective"})` | Creates perspective, returns details with uuid | ⬜ Pending | | |
| TC-cpv-015 | Create perspective with full config | `harness_create(resource_type="cost_perspective", body={name: "Full Perspective", viewVisualization: {...}, viewRules: [...], viewTimeRange: {...}})` | Creates perspective with all configuration | ⬜ Pending | | |
| TC-cpv-016 | Update perspective name | `harness_update(resource_type="cost_perspective", body={uuid: "<id>", name: "Updated Name"})` | Updates perspective name | ⬜ Pending | | |
| TC-cpv-017 | Delete perspective by ID | `harness_delete(resource_type="cost_perspective", perspective_id="<valid_id>")` | Deletes perspective, returns success | ⬜ Pending | | |
| TC-cpv-018 | Delete perspective with invalid ID | `harness_delete(resource_type="cost_perspective", perspective_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-cpv-019 | Get missing perspective_id | `harness_get(resource_type="cost_perspective")` | Returns validation error for missing perspective_id | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 19 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 18 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
