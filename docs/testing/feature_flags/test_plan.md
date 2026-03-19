# Module: FEATURE FLAGS

## FEATURE FLAGS

**Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get, harness_create, harness_delete, harness_execute(toggle)

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-001 | List | ⚪ | 🟢 |
| FF-002 | Page 1, size 5 | ⚪ | 🟢 |
| FF-003 | Page 2, size 5 | ⚪ | 🟢 |

```
# FF-001
v2: "List all feature flags in AI_Devops/Sanity"

# FF-002
v2: "List first 5 feature flags in AI_Devops/Sanity"

# FF-003
v2: "List feature flags page 2, size 5 in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-004 | Get by ID | ⚪ | 🟢 |

```
# FF-004
v2: "Get feature flag details for My_Test_Flag"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-005 | Create | ⚪ | 🟢 |
| FF-006 | Delete | ⚪ | 🟢 |

```
# FF-005
v2: "Create a boolean feature flag named 'test_flag_crud' with identifier 'test_flag_crud'"

# FF-006
v2: "Delete feature flag test_flag_crud"
```

### Actions

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-007 | Toggle | ⚪ | 🟢 |

```
# FF-007
v2: "Toggle feature flag My_Test_Flag to on in environment test_plan_env"
```
