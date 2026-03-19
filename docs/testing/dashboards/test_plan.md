# Module: PLATFORM

## DASHBOARDS

**Scope:** Account
**v1:** list_dashboards, get_dashboard_data | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DSH-001 | List | 🔵 | 🟢 |
| DSH-002 | Page 1, size 5 | 🔵 | 🟢 |
| DSH-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# DSH-001
v1: "List all dashboards"
v2: "List all dashboards"

# DSH-002
v1: "List first 5 dashboards"
v2: "List first 5 dashboards"

# DSH-003
v1: "List dashboards page 2, size 5"
v2: "List dashboards page 2, size 5"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DSH-004 | Get dashboard data | 🔵 | 🟢 |

```
# DSH-004
v1: "Get data from dashboard 33257"
v2: "Get data from dashboard 33257"
```
