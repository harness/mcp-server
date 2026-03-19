# Module: PLATFORM

## SERVICE ACCOUNTS

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** get_service_account, create_service_account, delete_service_account | **v2:** harness_list, harness_get, harness_create, harness_delete

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-001 | List at Project scope | ⚪ | 🟢 |
| SAC-002 | List at Org scope | ⚪ | 🟢 |
| SAC-003 | List at Account scope | ⚪ | 🟢 |

```
# SAC-001: Project scope
v2: "List all service accounts in org AI_Devops project Sanity"

# SAC-002: Org scope
v2: "List all service accounts at org level in AI_Devops"

# SAC-003: Account scope
v2: "List all service accounts at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-004 | Page 1, size 5 | ⚪ | 🟢 |

```
# SAC-004
v2: "List first 5 service accounts in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-005 | Get by ID | 🔵 | 🟢 |

```
# SAC-005
v1: "Get service account info for sa_id"
v2: "Get service account info for sa_id"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-006 | Create at Project scope | 🔵 | 🟢 |
| SAC-007 | Create at Org scope | 🔵 | 🟢 |
| SAC-008 | Create at Account scope | 🔵 | 🟢 |
| SAC-009 | Delete | 🔵 | 🟢 |

```
# SAC-006: Create at Project scope
v1: "Create service account named 'test_sa_crud' with identifier 'test_sa_crud' and email 'test@harness.io' in AI_Devops/Sanity"
v2: "Create service account named 'test_sa_crud' with identifier 'test_sa_crud' and email 'test@harness.io' in AI_Devops/Sanity"

# SAC-007: Create at Org scope
v1: "Create service account named 'test_sa_org' with identifier 'test_sa_org' and email 'test_org@harness.io' at org level in AI_Devops"
v2: "Create service account named 'test_sa_org' with identifier 'test_sa_org' and email 'test_org@harness.io' at org level in AI_Devops"

# SAC-008: Create at Account scope
v1: "Create service account named 'test_sa_acct' with identifier 'test_sa_acct' and email 'test_acct@harness.io' at account scope"
v2: "Create service account named 'test_sa_acct' with identifier 'test_sa_acct' and email 'test_acct@harness.io' at account scope"

# SAC-009
v1: "Delete service account test_sa_crud"
v2: "Delete service account test_sa_crud"
```
