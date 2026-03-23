# Test Plan: SCS Artifact Remediation (`scs_artifact_remediation`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_artifact_remediation` |
| **Display Name** | SCS Artifact Remediation |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | artifact_id |
| **Filter Fields** | _(none — uses purl, target_version query params)_ |
| **Deep Link** | Yes (`/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SAR-001 | Get | Get remediation advice with purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20")` | Returns remediation advice for the component |
| TC-SAR-002 | Get / Query | Get with target_version | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20", target_version="4.17.21")` | Returns remediation advice targeting specific version |
| TC-SAR-003 | Get / Query | Get with Maven purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:maven/org.apache.commons/commons-lang3@3.12.0")` | Returns remediation for Maven component |
| TC-SAR-004 | Get / Query | Get with Python purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:pypi/requests@2.28.0")` | Returns remediation for Python component |
| TC-SAR-005 | Scope | Get with explicit org_id and project_id | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20", org_id="my-org", project_id="my-project")` | Returns remediation for specified org/project |
| TC-SAR-006 | Error | Get without artifact_id | `harness_get(resource_type="scs_artifact_remediation", purl="pkg:npm/lodash@4.17.20")` | Error: artifact_id is required |
| TC-SAR-007 | Error | Get without purl | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1")` | Error or empty remediation (purl needed) |
| TC-SAR-008 | Error | Get with invalid purl format | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="invalid-purl")` | Error: invalid purl format |
| TC-SAR-009 | Error | Non-existent artifact_id | `harness_get(resource_type="scs_artifact_remediation", artifact_id="nonexistent", purl="pkg:npm/lodash@4.17.20")` | Returns 404 or not-found error |
| TC-SAR-010 | Error | Unsupported operation (list) | `harness_list(resource_type="scs_artifact_remediation")` | Error: list operation not supported |
| TC-SAR-011 | Edge | Component with no known remediation | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/unknown-pkg@0.0.1")` | Returns empty remediation or informational message |
| TC-SAR-012 | Deep Link | Verify deep link in response | `harness_get(resource_type="scs_artifact_remediation", artifact_id="art-1", purl="pkg:npm/lodash@4.17.20")` | Response includes deep link to artifact view |

## Notes
- `scs_artifact_remediation` only supports `get` via `GET /ssca-manager/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation`.
- Path params: `org_id` → `org`, `project_id` → `project`, `artifact_id` → `artifact`.
- Query params: `purl` (package URL), `target_version` (optional recommended version).
- The `purl` (Package URL) follows the purl-spec format: `pkg:{type}/{namespace}/{name}@{version}`.
- This endpoint provides remediation advice for vulnerable components identified in SBOMs.
