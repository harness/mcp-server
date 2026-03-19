# Module: IDP (Internal Developer Portal)

## IDP ENTITIES

**Scope:** Account
**v1:** list_entities, get_entity | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| IDP-001 | List | 🔵 | 🟢 |
| IDP-002 | Page 1, size 5 | 🔵 | 🟢 |
| IDP-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# IDP-001
v1: "List all IDP entities"
v2: "List all IDP entities"

# IDP-002
v1: "List first 5 IDP entities"
v2: "List first 5 IDP entities"

# IDP-003
v1: "List IDP entities page 2, size 5"
v2: "List IDP entities page 2, size 5"
```

### Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| IDP-004 | Filter by kind (component) | 🔵 | 🟢 |

```
# IDP-004
v1: "List all component entities in IDP"
v2: "List all component entities in IDP"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| IDP-005 | Get by ID | 🔵 | 🟢 |

```
# IDP-005
v1: "Get IDP entity details for entity_id"
v2: "Get IDP entity details for entity_id"
```
