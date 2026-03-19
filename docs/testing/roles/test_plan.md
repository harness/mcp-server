# Module: PLATFORM

## ROLES

**Scope:** Account / Org / Project
**v1:** list_available_roles, get_role_info, create_role, delete_role | **v2:** harness_list, harness_get, harness_create, harness_delete

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ROL-001 | List | 🔵 | 🟢 |
| ROL-002 | Page 1, size 5 | 🔵 | 🟢 |
| ROL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# ROL-001
v1: "List all roles"
v2: "List all roles"

# ROL-002
v1: "List first 5 roles"
v2: "List first 5 roles"

# ROL-003
v1: "List roles page 2, size 5"
v2: "List roles page 2, size 5"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ROL-004 | Get by ID | 🔵 | 🟢 |

```
# ROL-004
v1: "Get role details for role_id"
v2: "Get role details for role_id"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ROL-005 | Create | 🔵 | 🟢 |
| ROL-006 | Delete | 🔵 | 🟢 |

```
# ROL-005
v1: "Create a new role named 'test_role_crud' with identifier 'test_role_crud'"
v2: "Create a new role named 'test_role_crud' with identifier 'test_role_crud'"

# ROL-006
v1: "Delete role test_role_crud"
v2: "Delete role test_role_crud"
```
