# Module: PLATFORM

## DELEGATES

**Scope:** Account
**v1:** core_list_delegates | **v2:** harness_list, harness_diagnose

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
