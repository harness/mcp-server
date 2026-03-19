# Module: IDP (Internal Developer Portal)

## SCORECARD CHECKS

**Scope:** Account
**v1:** list_scorecard_checks, get_scorecard_check, get_scorecard_check_stats | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CHK-001 | List | 🔵 | 🟢 |
| CHK-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# CHK-001
v1: "List all scorecard checks"
v2: "List all scorecard checks"

# CHK-002
v1: "List first 5 scorecard checks"
v2: "List first 5 scorecard checks"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CHK-003 | Get by ID | 🔵 | 🟢 |
| CHK-004 | Get Stats | 🔵 | 🟢 |

```
# CHK-003
v1: "Get scorecard check details for check_id"
v2: "Get scorecard check details for check_id"

# CHK-004
v1: "Get stats for scorecard check check_id"
v2: "Get stats for scorecard check check_id"
```
