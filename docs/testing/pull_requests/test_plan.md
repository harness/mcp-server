# Module: CODE

## PULL REQUESTS

**Scope:** Project (scoped to repository)
**v1:** list_pull_requests, get_pull_request, get_pull_request_activities, get_pull_request_checks, create_pull_request | **v2:** harness_list, harness_get, harness_create

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-001 | List | 🔵 | 🟢 |
| PR-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# PR-001
v1: "List all pull requests in repository repo_name"
v2: "List all pull requests in repository repo_name"

# PR-002
v1: "List first 5 pull requests in repository repo_name"
v2: "List first 5 pull requests in repository repo_name"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-003 | Filter by state (open) | 🔵 | 🟢 |

```
# PR-003
v1: "List open pull requests in repository repo_name"
v2: "List open pull requests in repository repo_name"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-004 | Get by ID | 🔵 | 🟢 |
| PR-005 | Get Activities | 🔵 | 🟢 |
| PR-006 | Get Checks | 🔵 | 🟢 |

```
# PR-004
v1: "Get pull request #1 in repository repo_name"
v2: "Get pull request #1 in repository repo_name"

# PR-005
v1: "Get activities for pull request #1 in repository repo_name"
v2: "Get activities for pull request #1 in repository repo_name"

# PR-006
v1: "Get status checks for pull request #1 in repository repo_name"
v2: "Get status checks for pull request #1 in repository repo_name"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-007 | Create | 🔵 | 🟢 |

```
# PR-007
v1: "Create a pull request from branch feature to main in repository repo_name"
v2: "Create a pull request from branch feature to main in repository repo_name"
```
