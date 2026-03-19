# Module: CODE

## CODE REPOSITORIES

**Scope:** Project
**v1:** list_repositories, get_repository | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REP-001 | List | 🔵 | 🟢 |
| REP-002 | Page 1, size 5 | 🔵 | 🟢 |
| REP-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# REP-001
v1: "List all repositories in AI_Devops/Sanity"
v2: "List all repositories in AI_Devops/Sanity"

# REP-002
v1: "List first 5 repositories in AI_Devops/Sanity"
v2: "List first 5 repositories in AI_Devops/Sanity"

# REP-003
v1: "List repositories page 2, size 5 in AI_Devops/Sanity"
v2: "List repositories page 2, size 5 in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REP-004 | Get by ID | 🔵 | 🟢 |

```
# REP-004
v1: "Get repository details for repo_name"
v2: "Get repository details for repo_name"
```
