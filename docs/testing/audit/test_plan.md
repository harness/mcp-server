# Module: PLATFORM

## AUDIT

**Scope:** Account / Org / Project
**v1:** list_user_audits, get_audit_yaml | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| AUD-001 | List | 🔵 | 🟢 |
| AUD-002 | Page 1, size 5 | 🔵 | 🟢 |
| AUD-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# AUD-001
v1: "List audit events"
v2: "List audit events"

# AUD-002
v1: "List first 5 audit events"
v2: "List first 5 audit events"

# AUD-003
v1: "List audit events page 2, size 5"
v2: "List audit events page 2, size 5"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| AUD-004 | Filter by action (CREATE) | 🔵 | 🟢 |

```
# AUD-004
v1: "List CREATE audit events"
v2: "List CREATE audit events"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| AUD-005 | Get YAML diff | 🔵 | 🟢 |

```
# AUD-005
v1: "Get YAML diff for audit event audit_id"
v2: "Get YAML diff for audit event audit_id"
```
