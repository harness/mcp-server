# Test Plan: SBOM (`scs_sbom`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_sbom` |
| **Display Name** | SBOM |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | orchestration_id |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SS-001 | Get | Get SBOM download URL | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` | Returns SBOM download URL for the orchestration run |
| TC-SS-002 | Get | Verify SBOM content format | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` | Response contains a valid SBOM download link or SBOM content |
| TC-SS-003 | Scope | Get with explicit org_id and project_id | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1", org_id="my-org", project_id="my-project")` | Returns SBOM for specified org/project |
| TC-SS-004 | Scope | Get with default org/project from config | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` | Uses default org/project from environment config |
| TC-SS-005 | Error | Get without orchestration_id | `harness_get(resource_type="scs_sbom")` | Error: orchestration_id is required |
| TC-SS-006 | Error | Get with non-existent orchestration_id | `harness_get(resource_type="scs_sbom", orchestration_id="nonexistent")` | Returns 404 or not-found error |
| TC-SS-007 | Error | Unsupported operation (list) | `harness_list(resource_type="scs_sbom")` | Error: list operation not supported |
| TC-SS-008 | Error | Authentication failure | `harness_get(resource_type="scs_sbom", orchestration_id="orch-1")` (invalid key) | Returns 401 Unauthorized error |
| TC-SS-009 | Edge | Orchestration with no SBOM generated | `harness_get(resource_type="scs_sbom", orchestration_id="no-sbom-orch")` | Returns 404 or informational message about missing SBOM |
| TC-SS-010 | Get | End-to-end: chain of custody → SBOM | Get orchestration_id from `scs_chain_of_custody`, then `harness_get(resource_type="scs_sbom", orchestration_id="<from_custody>")` | Successfully retrieves SBOM using orchestration ID from custody chain |

## Notes
- `scs_sbom` only supports `get` via `GET /ssca-manager/v1/org/{org}/project/{project}/orchestration/{orchestrationId}/sbom-download`.
- **API inconsistency**: This endpoint uses singular `org` and `project` in the path (not `orgs`/`projects` like other SCS endpoints).
- Path params: `org_id` → `org`, `project_id` → `project`, `orchestration_id` → `orchestrationId`.
- The `orchestration_id` is typically obtained from the chain of custody response (`scs_chain_of_custody`).
- The response is the SBOM download URL or the SBOM content itself.
