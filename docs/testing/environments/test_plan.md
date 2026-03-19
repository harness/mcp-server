# Module: CD/CI

## ENVIRONMENTS

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_environments, get_environment | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-001 | List at Project scope | 🔵 | 🟢 |
| ENV-002 | List at Org scope | 🔵 | 🟢 |
| ENV-003 | List at Account scope | 🔵 | 🟢 |

```
# ENV-001
v1: "List all environments in org AI_Devops project Sanity"
v2: "List all environments in org AI_Devops project Sanity"

# ENV-002
v1: "List all environments at org level in AI_Devops"
v2: "List all environments at org level in AI_Devops"

# ENV-003
v1: "List all environments at account scope"
v2: "List all environments at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-004 | Page 1, size 5 | 🔵 | 🟢 |
| ENV-005 | Page 2, size 5 | 🔵 | 🟢 |

```
# ENV-004
v1: "List first 5 environments in AI_Devops/Sanity"
v2: "List first 5 environments in AI_Devops/Sanity"

# ENV-005
v1: "List environments page 2, size 5 in AI_Devops/Sanity"
v2: "List environments page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-006 | Filter by type (Production) | 🔵 | 🟢 |

```
# ENV-006
v1: "List all Production environments in AI_Devops/Sanity"
v2: "List all Production environments in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-007 | Get by ID | 🔵 | 🟢 |

```
# ENV-007
v1: "Get environment details for preprod"
v2: "Get environment details for preprod"
```

### CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-008 | Create | ⚪ | 🟢 |
| ENV-009 | Update | ⚪ | 🟢 |
| ENV-010 | Delete | ⚪ | 🟢 |

```
# ENV-008
v2: "Create a new PreProduction environment named 'test_env_crud' with identifier 'test_env_crud'"

# ENV-009
v2: "Update environment test_env_crud description to 'Updated via MCP test'"

# ENV-010
v2: "Delete environment test_env_crud"
```

### Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| ENV-011 | Verify openInHarness URL after create | 🟢 |
