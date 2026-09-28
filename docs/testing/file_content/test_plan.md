# Test Plan: File Content (`file_content`)

| Field | Value |
|-------|-------|
| **Resource Type** | `file_content` |
| **Display Name** | File Content |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | blame |
| **Identifier Fields** | repo_id, path |
| **Filter Fields** | git_ref, include_directories |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fc-001 | Get | Get file content at root | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md")` | Returns file content for README.md |
| TC-fc-002 | Get | Get file content in subdirectory | `harness_get(resource_type="file_content", repo_id="my-repo", path="src/index.ts")` | Returns file content for src/index.ts |
| TC-fc-003 | Get | Get directory listing | `harness_get(resource_type="file_content", repo_id="my-repo", path="src")` | Returns directory listing for src/ |
| TC-fc-004 | Get | Get root directory listing | `harness_get(resource_type="file_content", repo_id="my-repo", path="")` | Returns root directory listing |
| TC-fc-005 | Get | Get file at specific branch | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", git_ref="develop")` | Returns file content from develop branch |
| TC-fc-006 | Get | Get file at specific commit SHA | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", git_ref="abc123def")` | Returns file content at the specified commit |
| TC-fc-007 | Get | Get file with include_commit flag | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", include_commit="true")` | Returns file content along with last commit info |
| TC-fc-008 | Execute | Git blame for a file | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="src/index.ts")` | Returns git blame information for each line |
| TC-fc-009 | Execute | Git blame with line range | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="src/index.ts", line_from="10", line_to="20")` | Returns git blame for lines 10–20 only |
| TC-fc-010 | Execute | Git blame at specific ref | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="src/index.ts", git_ref="main")` | Returns git blame on main branch |
| TC-fc-011 | Scope | Get file with explicit org/project | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", org_id="custom-org", project_id="custom-project")` | Returns file content scoped to specified org/project |
| TC-fc-012 | Error | Get non-existent file | `harness_get(resource_type="file_content", repo_id="my-repo", path="nonexistent/file.txt")` | Returns 404 error |
| TC-fc-013 | Error | Get file from non-existent repo | `harness_get(resource_type="file_content", repo_id="nonexistent-repo", path="README.md")` | Returns 404 error for repository |
| TC-fc-014 | Error | Blame on non-existent file | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="nonexistent.txt")` | Returns 404 error |
| TC-fc-015 | Edge | Get binary file content | `harness_get(resource_type="file_content", repo_id="my-repo", path="image.png")` | Handles binary file appropriately |
| TC-fc-016 | List | List file paths at default branch | `harness_list(resource_type="file_content", repo_id="my-repo")` | Returns file paths; git_ref omitted so Code uses the default branch |
| TC-fc-017 | List | List files and directories | `harness_list(resource_type="file_content", repo_id="my-repo", filters={include_directories: true})` | Returns files and directories |
| TC-fc-018 | URL | Get from Code file UI URL | `harness_get(url=".../repos/my-repo/files/main/~/src/index.ts")` | Extracts file_content, repo_id, git_ref=main, path=src/index.ts |

## Notes
- `file_content` supports `list` (all paths at a ref) and `get` (file or directory content)
- Identifier fields are `repo_id` and `path` (`path` is optional on get — empty/omitted lists the repo root)
- Query params on get: `git_ref` (omit = default branch), `include_commit`, `flatten_directories`
- Query params on list: `git_ref`, `include_directories`
- Execute action `blame` supports optional `line_from`/`line_to` and `git_ref`
- Nested paths keep slashes (`src/index.ts`); do not prefix with `/`
- Path can point to either a file (returns content) or directory (returns listing)
