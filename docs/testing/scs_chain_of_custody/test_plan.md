# Test Plan: SCS Chain of Custody (`scs_chain_of_custody`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_chain_of_custody` |
| **Display Name** | SCS Chain of Custody |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | artifact_id |
| **Filter Fields** | _(none)_ |
| **Deep Link** | Yes (`/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SCC-001 | Get | Get chain of custody for an artifact | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Returns chain of custody events for the artifact |
| TC-SCC-002 | Get | Verify event history structure | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Response contains timestamped events tracking artifact lifecycle |
| TC-SCC-003 | Scope | Get with explicit org_id and project_id | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1", org_id="my-org", project_id="my-project")` | Returns custody chain for specified org/project |
| TC-SCC-004 | Scope | Get with default org/project from config | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Uses default org/project from environment config |
| TC-SCC-005 | Error | Get without artifact_id | `harness_get(resource_type="scs_chain_of_custody")` | Error: artifact_id is required |
| TC-SCC-006 | Error | Get with non-existent artifact_id | `harness_get(resource_type="scs_chain_of_custody", artifact_id="nonexistent")` | Returns 404 or not-found error |
| TC-SCC-007 | Error | Unsupported operation (list) | `harness_list(resource_type="scs_chain_of_custody")` | Error: list operation not supported |
| TC-SCC-008 | Error | Authentication failure | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` (invalid key) | Returns 401 Unauthorized error |
| TC-SCC-009 | Edge | Artifact with empty custody chain | `harness_get(resource_type="scs_chain_of_custody", artifact_id="new-art")` | Returns empty or minimal event list |
| TC-SCC-010 | Deep Link | Verify deep link in response | `harness_get(resource_type="scs_chain_of_custody", artifact_id="art-1")` | Response includes deep link to artifact in supply chain view |

## Notes
- `scs_chain_of_custody` only supports `get` via `GET /ssca-manager/v2/orgs/{org}/projects/{project}/artifacts/{artifact}/chain-of-custody`.
- Note: This uses the **v2** API endpoint (unlike most SCS endpoints which use v1).
- Path params: `org_id` → `org`, `project_id` → `project`, `artifact_id` → `artifact`.
- The response contains the orchestration IDs needed for SBOM downloads (`scs_sbom` resource).
- Chain of custody tracks the full lifecycle events of an artifact through the supply chain.
