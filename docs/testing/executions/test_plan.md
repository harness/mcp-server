# Module: CD/CI

## EXECUTIONS

**Scope:** Project
**v1:** list_executions, get_execution, fetch_execution_url | **v2:** harness_list, harness_get, harness_execute(retry, interrupt), harness_diagnose

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-001 | List | 🔵 | 🟢 |
| EXE-002 | Page 1, size 5 | 🔵 | 🟢 |
| EXE-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# EXE-001
v1: "List recent pipeline executions in AI_Devops/Sanity"
v2: "List recent pipeline executions in AI_Devops/Sanity"

# EXE-002
v1: "List first 5 executions in AI_Devops/Sanity"
v2: "List first 5 executions in AI_Devops/Sanity"

# EXE-003
v1: "List executions page 2, size 5 in AI_Devops/Sanity"
v2: "List executions page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-004 | Filter by status (Failed) | 🔵 | 🟢 |
| EXE-005 | Filter by pipeline | 🔵 | 🟢 |

```
# EXE-004
v1: "List failed executions in AI_Devops/Sanity"
v2: "List failed executions in AI_Devops/Sanity"

# EXE-005
v1: "List executions for pipeline custom_stage_pipeline"
v2: "List executions for pipeline custom_stage_pipeline"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-006 | Get by ID | 🔵 | 🟢 |

```
# EXE-006
v1: "Get execution details for lvKPVrKzRee2ZEIhGh0bIQ"
v2: "Get execution details for lvKPVrKzRee2ZEIhGh0bIQ"
```

### Actions (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-007 | Diagnose failure | ⚪ | 🟢 |
| EXE-008 | Interrupt (abort) | ⚪ | 🟢 |
| EXE-009 | Retry | ⚪ | 🟢 |

```
# EXE-007
v2: "Diagnose why execution lvKPVrKzRee2ZEIhGh0bIQ failed"

# EXE-008
v2: "Abort the currently running execution"

# EXE-009
v2: "Retry failed execution lvKPVrKzRee2ZEIhGh0bIQ"
```
