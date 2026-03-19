# Module: CD/CI

## SERVICES

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_services, get_service | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SVC-001 | List at Project scope | 🔵 | 🟢 |
| SVC-002 | List at Org scope | 🔵 | 🟢 |
| SVC-003 | List at Account scope | 🔵 | 🟢 |

```
# SVC-001
v1: "List all services in org AI_Devops project Sanity"
v2: "List all services in org AI_Devops project Sanity"

# SVC-002
v1: "List all services at org level in AI_Devops"
v2: "List all services at org level in AI_Devops"

# SVC-003
v1: "List all services at account scope"
v2: "List all services at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SVC-004 | Page 1, size 5 | 🔵 | 🟢 |
| SVC-005 | Page 2, size 5 | 🔵 | 🟢 |

```
# SVC-004
v1: "List first 5 services in AI_Devops/Sanity"
v2: "List first 5 services in AI_Devops/Sanity"

# SVC-005
v1: "List services page 2, size 5 in AI_Devops/Sanity"
v2: "List services page 2, size 5 in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SVC-006 | Get by ID | 🔵 | 🟢 |

```
# SVC-006
v1: "Get service details for k8s_multi_resource_service"
v2: "Get service details for k8s_multi_resource_service"
```

### CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SVC-007 | Create | ⚪ | 🟢 |
| SVC-008 | Update | ⚪ | 🟢 |
| SVC-009 | Delete | ⚪ | 🟢 |

```
# SVC-007
v2: "Create a new service named 'test_service_crud' with identifier 'test_service_crud'"

# SVC-008
v2: "Update service test_service_crud description to 'Updated via MCP test'"

# SVC-009
v2: "Delete service test_service_crud"
```

### Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| SVC-010 | Verify openInHarness URL after create | 🟢 |

```
# SVC-010: After creating service, verify the openInHarness URL opens correct page
```
