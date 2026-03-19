# Module: PLATFORM

## TEMPLATES

**Scope:** Project
**v1:** list_templates | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TPL-001 | List | 🔵 | 🟢 |
| TPL-002 | Page 1, size 5 | 🔵 | 🟢 |
| TPL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# TPL-001
v1: "List all templates in AI_Devops/Sanity"
v2: "List all templates in AI_Devops/Sanity"

# TPL-002
v1: "List first 5 templates in AI_Devops/Sanity"
v2: "List first 5 templates in AI_Devops/Sanity"

# TPL-003
v1: "List templates page 2, size 5 in AI_Devops/Sanity"
v2: "List templates page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TPL-004 | Filter by type (Pipeline) | 🔵 | 🟢 |

```
# TPL-004
v1: "List Pipeline templates in AI_Devops/Sanity"
v2: "List Pipeline templates in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TPL-005 | Get by ID | ⚪ | 🟢 |

```
# TPL-005
v2: "Get template native_helm_deployment"
```
