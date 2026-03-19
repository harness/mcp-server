# Module: CHAOS ENGINEERING (Requires License)

## CHAOS ENGINEERING

**Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get, harness_execute(run)
**Note:** Requires Chaos Engineering license. Not available in default test account.

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CHS-001 | List Experiments | ⚪ | 🟢 |
| CHS-002 | List Hubs | ⚪ | 🟢 |
| CHS-003 | List Infrastructure | ⚪ | 🟢 |

```
# CHS-001
v2: "List all chaos experiments in {org}/{project}"

# CHS-002
v2: "List all chaos hubs in {org}/{project}"

# CHS-003
v2: "List all chaos infrastructure in {org}/{project}"
```

### Get / Execute

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CHS-004 | Get Experiment | ⚪ | 🟢 |
| CHS-005 | Run Experiment | ⚪ | 🟢 |

```
# CHS-004
v2: "Get chaos experiment details for {experiment_id}"

# CHS-005
v2: "Run chaos experiment {experiment_id}"
```
