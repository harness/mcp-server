# Module: CD/CI

## INPUT SETS

**Scope:** Project (scoped to pipeline)
**v1:** list_input_sets, get_input_set | **v2:** harness_list, harness_get, harness_create, harness_delete

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INS-001 | List | 🔵 | 🟢 |
| INS-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# INS-001
v1: "List input sets for pipeline custom_stage_pipeline"
v2: "List input sets for pipeline custom_stage_pipeline"

# INS-002
v1: "List first 5 input sets for pipeline custom_stage_pipeline"
v2: "List first 5 input sets for pipeline custom_stage_pipeline"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INS-003 | Get by ID | 🔵 | 🟢 |

```
# INS-003
v1: "Get input set details for input_set_id in pipeline custom_stage_pipeline"
v2: "Get input set details for input_set_id in pipeline custom_stage_pipeline"
```

### CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INS-004 | Create | ⚪ | 🟢 |
| INS-005 | Delete | ⚪ | 🟢 |

```
# INS-004
v2: "Create an input set named 'test_inputset_crud' for pipeline custom_stage_pipeline"

# INS-005
v2: "Delete input set test_inputset_crud from pipeline custom_stage_pipeline"
```
