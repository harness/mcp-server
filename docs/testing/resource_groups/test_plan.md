# Module: PLATFORM

## RESOURCE GROUPS

**Scope:** Multi-Scope (Account / Org / Project)
**v1:** create_resource_group, delete_resource_group | **v2:** harness_list, harness_get, harness_create, harness_delete

---

### Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RGR-001 | List at Project scope | ⚪ | 🟢 |
| RGR-002 | List at Org scope | ⚪ | 🟢 |
| RGR-003 | List at Account scope | ⚪ | 🟢 |

```
# RGR-001: Project scope
v2: "List all resource groups in org AI_Devops project Sanity"

# RGR-002: Org scope
v2: "List all resource groups at org level in AI_Devops"

# RGR-003: Account scope
v2: "List all resource groups at account scope"
```

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RGR-004 | Page 1, size 5 | ⚪ | 🟢 |

```
# RGR-004
v2: "List first 5 resource groups in AI_Devops/Sanity"
```

### CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RGR-005 | Create at Project scope | 🔵 | 🟢 |
| RGR-006 | Create at Org scope | 🔵 | 🟢 |
| RGR-007 | Create at Account scope | 🔵 | 🟢 |
| RGR-008 | Delete | 🔵 | 🟢 |

```
# RGR-005: Create at Project scope
v1: "Create a resource group named 'test_rg_crud' with identifier 'test_rg_crud' in AI_Devops/Sanity"
v2: "Create a resource group named 'test_rg_crud' with identifier 'test_rg_crud' in AI_Devops/Sanity"

# RGR-006: Create at Org scope
v1: "Create a resource group named 'test_rg_org' with identifier 'test_rg_org' at org level in AI_Devops"
v2: "Create a resource group named 'test_rg_org' with identifier 'test_rg_org' at org level in AI_Devops"

# RGR-007: Create at Account scope
v1: "Create a resource group named 'test_rg_acct' with identifier 'test_rg_acct' at account scope"
v2: "Create a resource group named 'test_rg_acct' with identifier 'test_rg_acct' at account scope"

# RGR-008
v1: "Delete resource group test_rg_crud"
v2: "Delete resource group test_rg_crud"
```
