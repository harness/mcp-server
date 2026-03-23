# Test Report: SEI Business Alignment (`sei_business_alignment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_business_alignment` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SBA-001 | List business alignment profiles | `harness_list(resource_type="sei_business_alignment")` | Returns list of BA profiles | ✅ Passed | Returns 13 BA profiles (tested on SEI account) | Tested on SEI-enabled account |
| TC-SBA-002 | Get feature metrics (default aspect) | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns feature_metrics data | ⬜ Pending | | |
| TC-SBA-003 | Get with aspect=feature_metrics | `harness_get(resource_type="sei_business_alignment", aspect="feature_metrics", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns feature metrics data | ⬜ Pending | | |
| TC-SBA-004 | Get with aspect=feature_summary | `harness_get(resource_type="sei_business_alignment", aspect="feature_summary", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns feature summary data | ⬜ Pending | | |
| TC-SBA-005 | Get with aspect=drilldown | `harness_get(resource_type="sei_business_alignment", aspect="drilldown", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns drilldown data | ⬜ Pending | | |
| TC-SBA-006 | Get with only profile_id | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns metrics without team filter | ⬜ Pending | | |
| TC-SBA-007 | Verify account-level scope | `harness_list(resource_type="sei_business_alignment")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SBA-008 | Get without profile_id | `harness_get(resource_type="sei_business_alignment", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Error or incomplete data | ⬜ Pending | | |
| TC-SBA-009 | Invalid aspect value | `harness_get(resource_type="sei_business_alignment", aspect="invalid", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to feature_metrics or error | ⬜ Pending | | |
| TC-SBA-010 | Invalid date range | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", team_ref_id="team-1", date_start="2025-12-01", date_end="2025-01-01")` | Error or empty result | ⬜ Pending | | |
| TC-SBA-011 | Empty profiles list | `harness_list(resource_type="sei_business_alignment")` | Returns empty list if no profiles configured | ⬜ Pending | | |
| TC-SBA-012 | Verify deep link in list response | `harness_list(resource_type="sei_business_alignment")` | Response includes deep link to BA insights | ⬜ Pending | | |
| TC-SBA-013 | Verify deep link in get response | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to BA insights | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
