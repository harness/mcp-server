# Test Plan: Cost Commitment (`cost_commitment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_commitment` |
| **Display Name** | Cost Commitment |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | aspect, cloud_account_id |
| **Filter Fields** | aspect, cloud_account_id |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cco-001 | Get | Get commitment coverage | `harness_get(resource_type="cost_commitment", aspect="coverage")` | Returns compute coverage data for RI/savings plans |
| TC-cco-002 | Get | Get commitment savings | `harness_get(resource_type="cost_commitment", aspect="savings")` | Returns savings data from commitments |
| TC-cco-003 | Get | Get commitment utilisation | `harness_get(resource_type="cost_commitment", aspect="utilisation")` | Returns commitment utilisation data |
| TC-cco-004 | Get | Get commitment analysis | `harness_get(resource_type="cost_commitment", aspect="analysis")` | Returns spend analysis data (v2 endpoint) |
| TC-cco-005 | Get | Get estimated savings | `harness_get(resource_type="cost_commitment", aspect="estimated_savings", cloud_account_id="<cloud_account_id>")` | Returns estimated savings for specified cloud account |
| TC-cco-006 | Get | Get default (coverage) with no aspect | `harness_get(resource_type="cost_commitment")` | Returns coverage data (default aspect) |
| TC-cco-007 | Error | Estimated savings without cloud_account_id | `harness_get(resource_type="cost_commitment", aspect="estimated_savings")` | Returns error — cloud_account_id is required for estimated_savings |
| TC-cco-008 | Error | Invalid aspect value | `harness_get(resource_type="cost_commitment", aspect="invalid")` | Falls back to coverage endpoint or returns error |
| TC-cco-009 | Deep Link | Verify deep link in response | `harness_get(resource_type="cost_commitment", aspect="coverage")` | Response includes deep link to `/ng/account/{accountId}/ce/commitment-orchestration` |
| TC-cco-010 | Edge | Coverage when no commitments exist | `harness_get(resource_type="cost_commitment", aspect="coverage")` | Returns empty or zero-value coverage |
| TC-cco-011 | Error | Attempt list operation (not supported) | `harness_list(resource_type="cost_commitment")` | Returns error indicating list is not supported |
| TC-cco-012 | Edge | Estimated savings with invalid cloud_account_id | `harness_get(resource_type="cost_commitment", aspect="estimated_savings", cloud_account_id="nonexistent")` | Returns error from Lightwing API |

## Notes
- Uses Lightwing API — path is dynamically built via `pathBuilder` based on `aspect`:
  - `coverage`: POST `/lw/co/api/accounts/{accountId}/v1/detail/compute_coverage`
  - `savings`: POST `/lw/co/api/accounts/{accountId}/v1/detail/savings`
  - `utilisation`: POST `/lw/co/api/accounts/{accountId}/v1/detail/commitment_utilisation`
  - `analysis`: POST `/lw/co/api/accounts/{accountId}/v2/spend/detail`
  - `estimated_savings`: POST `/lw/co/api/accounts/{accountId}/v2/setup/{cloudAccountId}/estimated_savings`
- `cloud_account_id` is **required** only when `aspect=estimated_savings`
- Default aspect is `coverage` when omitted
- Body: passes `input.body ?? {}` — allows custom body for advanced filtering
- Deep link: `/ng/account/{accountId}/ce/commitment-orchestration`
- Replaces 5 separate commitment tools from the official server (coverage, savings, utilisation, analysis, estimated_savings)
