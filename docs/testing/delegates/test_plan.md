# Module: PLATFORM

## DELEGATES

**Scope:** Account (supports org/project scoping)
**v1:** core_list_delegates | **v2:** harness_list, harness_diagnose

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DEL-005 | List at Account scope | 🔵 | 🟢 |
| DEL-006 | List at Org scope | 🔵 | 🟢 |
| DEL-007 | List at Project scope | 🔵 | 🟢 |

```
# DEL-005
v1: "List all delegates in the account"
v2: "List all delegates in the account" (no org_id or project_id)

# DEL-006
v1: "List delegates at org level in AI_Devops"
v2: harness_list(resource_type=delegate, org_id=AI_Devops)

# DEL-007
v1: "List delegates in org AI_Devops project Sanity"
v2: harness_list(resource_type=delegate, org_id=AI_Devops, project_id=Sanity)
```

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DEL-001 | List | 🔵 | 🟢 |
| DEL-002 | Page 1, size 5 | 🔵 | 🟢 |
| DEL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# DEL-001
v1: "List all delegates in the account"
v2: "List all delegates in the account"

# DEL-002
v1: "List first 5 delegates"
v2: "List first 5 delegates"

# DEL-003
v1: "List delegates page 2, size 5"
v2: "List delegates page 2, size 5"
```

### Diagnose (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DEL-004 | Diagnose delegate health | ⚪ | 🟢 |

```
# DEL-004
v2: "Check health of delegate helm-delegate"
```
