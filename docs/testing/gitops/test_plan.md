# Module: GITOPS (Requires License)

## GITOPS

**Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get, harness_execute(sync), harness_diagnose
**Note:** Requires GitOps license. Not available in default test account.

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| GIT-001 | List Agents | ⚪ | 🟢 |
| GIT-002 | List Applications | ⚪ | 🟢 |
| GIT-003 | List Clusters | ⚪ | 🟢 |
| GIT-004 | List Repositories | ⚪ | 🟢 |

```
# GIT-001
v2: "List all GitOps agents in {org}/{project}"

# GIT-002
v2: "List all GitOps applications in {org}/{project}"

# GIT-003
v2: "List all GitOps clusters in {org}/{project}"

# GIT-004
v2: "List all GitOps repositories in {org}/{project}"
```

### Get / Execute

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| GIT-005 | Get Application | ⚪ | 🟢 |
| GIT-006 | Sync Application | ⚪ | 🟢 |

```
# GIT-005
v2: "Get GitOps application details for {app_id}"

# GIT-006
v2: "Sync GitOps application {app_id}"
```
