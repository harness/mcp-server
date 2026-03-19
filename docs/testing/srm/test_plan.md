# Module: SRM - Service Reliability Management (Requires License)

## SRM

**Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get
**Note:** Requires SRM license. Not available in default test account.

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SRM-001 | List Monitored Services | ⚪ | 🟢 |
| SRM-002 | List SLOs | ⚪ | 🟢 |

```
# SRM-001
v2: "List all monitored services in {org}/{project}"

# SRM-002
v2: "List all SLOs in {org}/{project}"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SRM-003 | Get Monitored Service | ⚪ | 🟢 |
| SRM-004 | Get SLO | ⚪ | 🟢 |

```
# SRM-003
v2: "Get monitored service details for {service_id}"

# SRM-004
v2: "Get SLO details for {slo_id}"
```
