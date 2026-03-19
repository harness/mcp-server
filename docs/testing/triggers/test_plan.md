# Module: CD/CI

## TRIGGERS

**Scope:** Project (scoped to pipeline)
**v1:** list_triggers | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TRG-001 | List | 🔵 | 🟢 |
| TRG-002 | Page 1, size 5 | 🔵 | 🟢 |
| TRG-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# TRG-001
v1: "List triggers for pipeline custom_stage_pipeline"
v2: "List triggers for pipeline custom_stage_pipeline"

# TRG-002
v1: "List first 5 triggers for pipeline custom_stage_pipeline"
v2: "List first 5 triggers for pipeline custom_stage_pipeline"

# TRG-003
v1: "List triggers page 2, size 5 for pipeline custom_stage_pipeline"
v2: "List triggers page 2, size 5 for pipeline custom_stage_pipeline"
```

### Get / CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TRG-004 | Get by ID | ⚪ | 🟢 |
| TRG-005 | Create | ⚪ | 🟢 |
| TRG-006 | Update | ⚪ | 🟢 |
| TRG-007 | Delete | ⚪ | 🟢 |

```
# TRG-004
v2: "Get trigger details for trigger_id in pipeline custom_stage_pipeline"

# TRG-005
v2: "Create a webhook trigger named 'test_trigger_crud' for pipeline custom_stage_pipeline"

# TRG-006
v2: "Update trigger test_trigger_crud to be disabled"

# TRG-007
v2: "Delete trigger test_trigger_crud from pipeline custom_stage_pipeline"
```
