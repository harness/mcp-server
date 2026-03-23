# Test Plan: SEI Metric (`sei_metric`)


| Field                 | Value                                  |
| --------------------- | -------------------------------------- |
| **Resource Type**     | `sei_metric`                           |
| **Display Name**      | SEI Metric                             |
| **Toolset**           | sei                                    |
| **Scope**             | account                                |
| **Operations**        | list                                   |
| **Execute Actions**   | None                                   |
| **Identifier Fields** | *(none)*                               |
| **Filter Fields**     | *(none — uses page/size query params)* |
| **Deep Link**         | No                                     |


## Test Cases


| Test ID   | Category          | Description                     | Prompt                                                     | Expected Result                                            |
| --------- | ----------------- | ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| TC-SM-001 | List              | List SEI metrics with defaults  | `harness_list(resource_type="sei_metric")`                 | Returns list of SEI metrics with default pagination        |
| TC-SM-002 | List / Pagination | List with explicit page         | `harness_list(resource_type="sei_metric", page=1)`         | Returns second page of metrics                             |
| TC-SM-003 | List / Pagination | List with custom page size      | `harness_list(resource_type="sei_metric", size=5)`         | Returns at most 5 metrics                                  |
| TC-SM-004 | List / Pagination | List page beyond available data | `harness_list(resource_type="sei_metric", page=9999)`      | Returns empty list or appropriate message                  |
| TC-SM-005 | Scope             | Verify account-level scope      | `harness_list(resource_type="sei_metric")`                 | Metrics returned at account level; no org/project required |
| TC-SM-006 | Error             | Invalid resource type           | `harness_list(resource_type="sei_metrics")`                | Error: unknown resource type                               |
| TC-SM-007 | Error             | Unsupported operation (get)     | `harness_get(resource_type="sei_metric", id="some_id")`    | Error: get operation not supported for sei_metric          |
| TC-SM-008 | Error             | Missing API key / auth failure  | `harness_list(resource_type="sei_metric")` (no auth)       | Returns 401 Unauthorized error                             |
| TC-SM-009 | Edge              | Empty account with no metrics   | `harness_list(resource_type="sei_metric")`                 | Returns empty items list                                   |
| TC-SM-010 | List / Pagination | Page 0, size 1                  | `harness_list(resource_type="sei_metric", page=0, size=1)` | Returns exactly 1 metric                                   |


## Notes

- `sei_metric` only supports the `list` operation via `GET /sei/api/v1/metrics`.
- The endpoint uses standard `page` and `size` query params for pagination.
- This is an account-scoped resource — no org or project identifiers are needed.
- Response uses the passthrough extractor (raw API response).

