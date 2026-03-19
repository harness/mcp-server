# Module: CCM - Cloud Cost Management (Requires License)

## CCM

**Scope:** Account
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get
**Note:** Requires CCM license. Not available in default test account.

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CCM-001 | List Perspectives | ⚪ | 🟢 |
| CCM-002 | List Budgets | ⚪ | 🟢 |
| CCM-003 | List Anomalies | ⚪ | 🟢 |
| CCM-004 | List Recommendations | ⚪ | 🟢 |

```
# CCM-001
v2: "List all cost perspectives"

# CCM-002
v2: "List all cost budgets"

# CCM-003
v2: "List all cost anomalies"

# CCM-004
v2: "List all cost recommendations"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CCM-005 | Get Perspective | ⚪ | 🟢 |

```
# CCM-005
v2: "Get cost perspective details for {perspective_id}"
```
