# Module: PLATFORM

## ROLE ASSIGNMENTS

**Scope:** Project
**v1:** list_role_assignments, create_role_assignment | **v2:** harness_list, harness_create

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RAS-001 | List | 🔵 | 🟢 |
| RAS-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# RAS-001
v1: "List all role assignments in AI_Devops/Sanity"
v2: "List all role assignments in AI_Devops/Sanity"

# RAS-002
v1: "List first 5 role assignments"
v2: "List first 5 role assignments"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RAS-003 | Create | 🔵 | 🟢 |

```
# RAS-003
v1: "Create a role assignment for user_id with role _account_admin and resource group _all_resources"
v2: "Create a role assignment for user_id with role _account_admin and resource group _all_resources"
```
