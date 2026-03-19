# Module: PLATFORM

## CONNECTORS

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_connectors, get_connector_details, list_connector_catalogue, create_connector, update_connector, delete_connector | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete, harness_execute(test_connection)

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-001 | List at Project scope | 🔵 | 🟢 |
| CON-002 | List at Org scope | 🔵 | 🟢 |
| CON-003 | List at Account scope | 🔵 | 🟢 |

```
# CON-001: Project scope
v1: "List all connectors in org AI_Devops project Sanity"
v2: "List all connectors in org AI_Devops project Sanity"

# CON-002: Org scope
v1: "List all connectors in org AI_Devops (no project)"
v2: "List all connectors at org level in AI_Devops"

# CON-003: Account scope
v1: "List all connectors at account level"
v2: "List all connectors at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-004 | Page 1, size 5 | 🔵 | 🟢 |
| CON-005 | Page 2, size 5 | 🔵 | 🟢 |

```
# CON-004
v1: "List first 5 connectors in AI_Devops/Sanity"
v2: "List first 5 connectors in AI_Devops/Sanity"

# CON-005
v1: "List connectors page 2, size 5 in AI_Devops/Sanity"
v2: "List connectors page 2, size 5 in AI_Devops/Sanity"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-006 | Filter by type (Github) | 🔵 | 🟢 |

```
# CON-006
v1: "List all Github connectors in AI_Devops/Sanity"
v2: "List all Github connectors in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-007 | Get by ID | 🔵 | 🟢 |

```
# CON-007
v1: "Get connector details for nginx_github_connector"
v2: "Get connector details for nginx_github_connector"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-008 | Create | 🔵 | 🟢 |
| CON-009 | Update | 🔵 | 🟢 |
| CON-010 | Delete | 🔵 | 🟢 |
| CON-011 | Test Connection | ⚪ | 🟢 |

```
# CON-008
v1: "Create a new Github connector named 'test_connector_crud' with URL https://github.com"
v2: "Create a new Github connector named 'test_connector_crud' with URL https://github.com"

# CON-009
v1: "Update connector test_connector_crud description to 'Updated via MCP test'"
v2: "Update connector test_connector_crud description to 'Updated via MCP test'"

# CON-010
v1: "Delete connector test_connector_crud"
v2: "Delete connector test_connector_crud"

# CON-011
v2: "Test connection for connector nginx_github_connector"
```

### Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| CON-012 | Verify openInHarness URL after create | 🟢 |
| CON-013 | Verify openInHarness URL after get | 🟢 |

```
# CON-012: After creating connector, verify the openInHarness URL opens correct page (no 404)
# CON-013: After getting connector, verify the openInHarness URL opens correct page
```
