# Module: PLATFORM

## USERS

**Scope:** Account (can filter by project)
**v1:** get_all_users, get_user_info, invite_users | **v2:** harness_list, harness_get

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-001 | List at Account scope | 🔵 | 🟢 |
| USR-002 | List at Project scope | 🔵 | 🟢 |

```
# USR-001
v1: "List all users in the account"
v2: "List all users in the account"

# USR-002
v1: "List all users in project Sanity"
v2: "List all users in project Sanity"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-003 | Page 1, size 5 | 🔵 | 🟢 |
| USR-004 | Page 2, size 5 | 🔵 | 🟢 |

```
# USR-003
v1: "List first 5 users"
v2: "List first 5 users"

# USR-004
v1: "List users page 2, size 5"
v2: "List users page 2, size 5"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-005 | Get by ID | 🔵 | 🟢 |

```
# USR-005
v1: "Get user info for user_id"
v2: "Get user info for user_id"
```

### Actions

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-006 | Invite user | 🔵 | 🟢 |

```
# USR-006
v1: "Invite user test@example.com to project Sanity"
v2: "Invite user test@example.com to project Sanity"
```
