# Module: IDP (Internal Developer Portal)

## IDP WORKFLOWS

**Scope:** Account
**v1:** list_entities (kind=workflow), execute_workflow | **v2:** harness_list, harness_execute

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| WFL-001 | List | 🔵 | 🟢 |
| WFL-002 | Page 1, size 5 | 🔵 | 🟢 |
| WFL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# WFL-001
v1: "List all IDP workflows"
v2: "List all IDP workflows"

# WFL-002
v1: "List first 5 IDP workflows"
v2: "List first 5 IDP workflows"

# WFL-003
v1: "List IDP workflows page 2, size 5"
v2: "List IDP workflows page 2, size 5"
```

### Execute

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| WFL-004 | Execute workflow | 🔵 | 🟢 |

```
# WFL-004
v1: "Execute IDP workflow react-app with inputs {project_name: 'test'}"
v2: "Execute IDP workflow react-app with inputs {project_name: 'test'}"
```
