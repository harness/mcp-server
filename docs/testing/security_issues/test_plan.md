# Module: STO (Security Testing Orchestration)

## SECURITY ISSUES

**Scope:** Project
**v1:** get_all_security_issues | **v2:** harness_list

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| STO-001 | List | 🔵 | 🟢 |
| STO-002 | Page 1, size 5 | 🔵 | 🟢 |
| STO-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# STO-001
v1: "List all security issues in AI_Devops/Sanity"
v2: "List all security issues in AI_Devops/Sanity"

# STO-002
v1: "List first 5 security issues in AI_Devops/Sanity"
v2: "List first 5 security issues in AI_Devops/Sanity"

# STO-003
v1: "List security issues page 2, size 5 in AI_Devops/Sanity"
v2: "List security issues page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| STO-004 | Filter by severity (Critical) | 🔵 | 🟢 |

```
# STO-004
v1: "List Critical security issues in AI_Devops/Sanity"
v2: "List Critical security issues in AI_Devops/Sanity"
```
