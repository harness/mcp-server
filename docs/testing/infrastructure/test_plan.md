# Module: CD/CI

## INFRASTRUCTURE

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_infrastructure, get_infrastructure | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete
**Note:** Requires `environment_id` filter for list operations

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-001 | List at Project scope (+ env) | 🔵 | 🟢 |
| INF-002 | List at Org scope (+ env) | 🔵 | 🟢 |

```
# INF-001
v1: "List all infrastructure definitions in environment aws_sam in AI_Devops/Sanity"
v2: "List all infrastructure definitions in environment aws_sam in AI_Devops/Sanity"

# INF-002
v1: "List all infrastructure at org level in AI_Devops for environment aws_sam"
v2: "List all infrastructure at org level in AI_Devops for environment aws_sam"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-003 | Page 1, size 5 | 🔵 | 🟢 |
| INF-004 | Page 2, size 5 | 🔵 | 🟢 |

```
# INF-003
v1: "List first 5 infrastructure definitions in environment aws_sam"
v2: "List first 5 infrastructure definitions in environment aws_sam"

# INF-004
v1: "List infrastructure page 2, size 5 in environment aws_sam"
v2: "List infrastructure page 2, size 5 in environment aws_sam"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-005 | Get by ID | 🔵 | 🟢 |

```
# INF-005
v1: "Get infrastructure details for azure_fu in environment aws_sam"
v2: "Get infrastructure details for azure_fu in environment aws_sam"
```

### CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-006 | Create | ⚪ | 🟢 |
| INF-007 | Update | ⚪ | 🟢 |
| INF-008 | Delete | ⚪ | 🟢 |

```
# INF-006
v2: "Create a new Kubernetes infrastructure named 'test_infra_crud' in environment preprod"

# INF-007
v2: "Update infrastructure test_infra_crud description to 'Updated via MCP test'"

# INF-008
v2: "Delete infrastructure test_infra_crud from environment preprod"
```
