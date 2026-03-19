# Module: CD/CI

## PIPELINES

**Scope:** Project
**v1:** list_pipelines, get_pipeline, get_pipeline_summary | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete, harness_execute(run), harness_diagnose

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-001 | List | 🔵 | 🟢 |
| PIP-002 | Page 1, size 5 | 🔵 | 🟢 |
| PIP-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# PIP-001
v1: "List all pipelines in AI_Devops/Sanity"
v2: "List all pipelines in AI_Devops/Sanity"

# PIP-002
v1: "List first 5 pipelines in AI_Devops/Sanity"
v2: "List first 5 pipelines in AI_Devops/Sanity"

# PIP-003
v1: "List pipelines page 2, size 5 in AI_Devops/Sanity"
v2: "List pipelines page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-004 | Filter by search term | 🔵 | 🟢 |

```
# PIP-004
v1: "List pipelines containing 'deploy' in AI_Devops/Sanity"
v2: "List pipelines containing 'deploy' in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-005 | Get by ID | 🔵 | 🟢 |
| PIP-006 | Get Summary | 🔵 | 🟢 |

```
# PIP-005
v1: "Get pipeline custom_stage_pipeline"
v2: "Get pipeline custom_stage_pipeline"

# PIP-006
v1: "Get pipeline summary for custom_stage_pipeline"
v2: "Get pipeline summary for custom_stage_pipeline"
```

### CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-007 | Create | ⚪ | 🟢 |
| PIP-008 | Update | ⚪ | 🟢 |
| PIP-009 | Delete | ⚪ | 🟢 |

```
# PIP-007
v2: "Create a new pipeline named 'test_pipeline_crud' with a simple shell script stage"

# PIP-008
v2: "Update pipeline test_pipeline_crud description to 'Updated via MCP test'"

# PIP-009
v2: "Delete pipeline test_pipeline_crud"
```

### Execute / Diagnose

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-010 | Run pipeline | 🔵 | 🟢 |
| PIP-011 | Diagnose failure | ⚪ | 🟢 |

```
# PIP-010
v1: "Run pipeline wait_pipeline_10min_v8"
v2: "Run pipeline wait_pipeline_10min_v8"

# PIP-011
v2: "Diagnose why pipeline custom_stage_pipeline failed"
```

### Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| PIP-012 | Verify openInHarness URL after create | 🟢 |
