# Module: STO (Security Testing Orchestration)

## SECURITY EXEMPTIONS

**Scope:** Project
**v1:** sto_global_exemptions, exemptions_reject_and_approve, sto_exemptions_promote_and_approve | **v2:** harness_list, harness_execute

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXM-001 | List | 🔵 | 🟢 |
| EXM-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# EXM-001
v1: "List all security exemptions in AI_Devops/Sanity"
v2: "List all security exemptions in AI_Devops/Sanity"

# EXM-002
v1: "List first 5 security exemptions with status Pending"
v2: "List first 5 security exemptions with status Pending"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXM-003 | Filter by status (Approved) | 🔵 | 🟢 |

```
# EXM-003
v1: "List Approved security exemptions in AI_Devops/Sanity"
v2: "List Approved security exemptions in AI_Devops/Sanity"
```

### Actions

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXM-004 | Approve | 🔵 | 🟢 |
| EXM-005 | Reject | 🔵 | 🟢 |

```
# EXM-004
v1: "Approve security exemption exemption_id"
v2: "Approve security exemption exemption_id"

# EXM-005
v1: "Reject security exemption exemption_id"
v2: "Reject security exemption exemption_id"
```
