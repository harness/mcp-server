# Test Plan: PR Check (`pr_check`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_check` |
| **Display Name** | PR Check |
| **Toolset** | pull-requests |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, pr_number |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-prk-001 | List | List status checks on a PR | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=1)` | Returns list of status checks with name, status, and details |
| TC-prk-002 | List | List checks on PR with no checks | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=2)` | Returns empty list |
| TC-prk-003 | List | List checks on PR with passing checks | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=3)` | Returns checks all showing success/passing status |
| TC-prk-004 | List | List checks on PR with failing checks | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=4)` | Returns checks showing failure status |
| TC-prk-005 | List | List checks on PR with mixed statuses | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=5)` | Returns checks with various statuses (pass, fail, pending) |
| TC-prk-006 | Scope | List checks with explicit org/project | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=1, org_id="custom-org", project_id="custom-project")` | Returns checks scoped to specified org/project |
| TC-prk-007 | Error | List checks for non-existent PR | `harness_list(resource_type="pr_check", repo_id="my-repo", pr_number=99999)` | Returns 404 error for PR not found |
| TC-prk-008 | Error | List checks for non-existent repo | `harness_list(resource_type="pr_check", repo_id="nonexistent-repo", pr_number=1)` | Returns 404 error for repository not found |

## Notes
- `pr_check` is a read-only resource — only supports the `list` operation
- Requires both `repo_id` and `pr_number` as parent identifiers
- Status checks are typically created by CI/CD integrations, not by users
- No filter fields — returns all checks for the PR
- Check statuses typically include: pending, running, success, failure, error
