# Module: PLATFORM

## USER GROUPS

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** get_user_group_info, create_user_group, delete_user_group | **v2:** harness_list, harness_get, harness_create, harness_delete

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-001 | List at Project scope | ⚪ | 🟢 |
| UGR-002 | List at Org scope | ⚪ | 🟢 |
| UGR-003 | List at Account scope | ⚪ | 🟢 |

```
# UGR-001: Project scope
v2: "List all user groups in org AI_Devops project Sanity"

# UGR-002: Org scope
v2: "List all user groups at org level in AI_Devops"

# UGR-003: Account scope
v2: "List all user groups at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-004 | Page 1, size 5 | ⚪ | 🟢 |

```
# UGR-004
v2: "List first 5 user groups in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-005 | Get by ID | 🔵 | 🟢 |

```
# UGR-005
v1: "Get user group info for user_group_id"
v2: "Get user group info for user_group_id"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-006 | Create at Project scope | 🔵 | 🟢 |
| UGR-007 | Create at Org scope | 🔵 | 🟢 |
| UGR-008 | Create at Account scope | 🔵 | 🟢 |
| UGR-009 | Delete | 🔵 | 🟢 |

```
# UGR-006: Create at Project scope
v1: "Create a new user group named 'test_ug_crud' with identifier 'test_ug_crud' in AI_Devops/Sanity"
v2: "Create a new user group named 'test_ug_crud' with identifier 'test_ug_crud' in AI_Devops/Sanity"

# UGR-007: Create at Org scope
v1: "Create a new user group named 'test_ug_org' with identifier 'test_ug_org' at org level in AI_Devops"
v2: "Create a new user group named 'test_ug_org' with identifier 'test_ug_org' at org level in AI_Devops"

# UGR-008: Create at Account scope
v1: "Create a new user group named 'test_ug_acct' with identifier 'test_ug_acct' at account scope"
v2: "Create a new user group named 'test_ug_acct' with identifier 'test_ug_acct' at account scope"

# UGR-009
v1: "Delete user group test_ug_crud"
v2: "Delete user group test_ug_crud"
```
