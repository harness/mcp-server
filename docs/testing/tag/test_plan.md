# Test Plan: Tag (`tag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `tag` |
| **Display Name** | Tag |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, tag_name |
| **Filter Fields** | query, sort, order |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-tag-001 | List | List all tags in a repo | `harness_list(resource_type="tag", repo_id="my-repo")` | Returns paginated list of tags with target commit info |
| TC-tag-002 | List | List tags with pagination | `harness_list(resource_type="tag", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 tags |
| TC-tag-003 | List | Search tags by name | `harness_list(resource_type="tag", repo_id="my-repo", query="v1")` | Returns tags matching "v1" keyword |
| TC-tag-004 | List | Sort tags | `harness_list(resource_type="tag", repo_id="my-repo", sort="name")` | Returns tags sorted by name |
| TC-tag-005 | List | Sort tags descending | `harness_list(resource_type="tag", repo_id="my-repo", sort="name", order="desc")` | Returns tags sorted by name in descending order |
| TC-tag-006 | List | Combined filters | `harness_list(resource_type="tag", repo_id="my-repo", query="release", sort="name", order="asc", page=0, limit=10)` | Returns filtered, sorted tags with pagination |
| TC-tag-007 | Create | Create a lightweight tag | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.0.0", "target": "abc123def"})` | Creates lightweight tag pointing to specified commit |
| TC-tag-008 | Create | Create an annotated tag | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v2.0.0", "target": "def456abc", "message": "Release v2.0.0"})` | Creates annotated tag with message |
| TC-tag-009 | Delete | Delete a tag | `harness_delete(resource_type="tag", repo_id="my-repo", tag_name="v0.1.0")` | Deletes the tag successfully |
| TC-tag-010 | Scope | List tags with explicit org/project | `harness_list(resource_type="tag", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns tags scoped to specified org/project |
| TC-tag-011 | Error | Create tag with missing name | `harness_create(resource_type="tag", repo_id="my-repo", body={"target": "abc123"})` | Returns validation error for missing name |
| TC-tag-012 | Error | Create tag with missing target | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.0.0"})` | Returns validation error for missing target |
| TC-tag-013 | Error | Create duplicate tag | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.0.0", "target": "abc123"})` | Returns conflict error for existing tag name |
| TC-tag-014 | Error | Delete non-existent tag | `harness_delete(resource_type="tag", repo_id="my-repo", tag_name="nonexistent-tag")` | Returns 404 error |
| TC-tag-015 | Edge | Tag with semantic version format | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.2.3-beta.1", "target": "abc123"})` | Handles semver-style tag names correctly |

## Notes
- Tag is a child resource of repository; `repo_id` is always required
- No `get` operation — use `list` with `query` filter to find specific tags
- Create requires `name` and `target` (commit SHA); `message` makes it an annotated tag
- Tag names may contain dots, hyphens, and slashes
