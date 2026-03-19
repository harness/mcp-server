# Module: PLATFORM

## SECRETS

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_secrets, get_secret | **v2:** harness_list, harness_get
**Note:** Read-only in both v1 and v2. Values are never exposed.

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-001 | List at Project scope | 🔵 | 🟢 |
| SEC-002 | List at Org scope | 🔵 | 🟢 |
| SEC-003 | List at Account scope | 🔵 | 🟢 |

```
# SEC-001
v1: "List all secrets in org AI_Devops project Sanity"
v2: "List all secrets in org AI_Devops project Sanity"

# SEC-002
v1: "List all secrets at org level in AI_Devops"
v2: "List all secrets at org level in AI_Devops"

# SEC-003
v1: "List all secrets at account level"
v2: "List all secrets at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-004 | Page 1, size 5 | 🔵 | 🟢 |
| SEC-005 | Page 2, size 5 | 🔵 | 🟢 |

```
# SEC-004
v1: "List first 5 secrets in AI_Devops/Sanity"
v2: "List first 5 secrets in AI_Devops/Sanity"

# SEC-005
v1: "List secrets page 2, size 5 in AI_Devops/Sanity"
v2: "List secrets page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-006 | Filter by type (SecretText) | 🔵 | 🟢 |

```
# SEC-006
v1: "List all SecretText type secrets in AI_Devops/Sanity"
v2: "List all SecretText type secrets in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-007 | Get by ID | 🔵 | 🟢 |

```
# SEC-007
v1: "Get secret details for hello"
v2: "Get secret details for hello"
```

### CRUD

N/A — Secrets are **read-only** in both v1 and v2.
