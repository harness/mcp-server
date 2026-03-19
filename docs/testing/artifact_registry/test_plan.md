# Module: REGISTRY

## ARTIFACT REGISTRY

**Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-001 | List | ⚪ | 🟢 |
| REG-002 | Page 1, size 5 | ⚪ | 🟢 |

```
# REG-001
v2: "List all registries in AI_Devops/Sanity"

# REG-002
v2: "List first 5 registries in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-003 | Get by ID | ⚪ | 🟢 |

```
# REG-003
v2: "Get registry details for registry_id"
```
