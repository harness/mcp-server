# MCP v1 vs v2 Comprehensive Testing Plan

**Version:** 3.0  
**Last Updated:** March 18, 2026  
**Author:** QA Team

---

## 1. Overview

This document provides a **comprehensive module-wise and resource-wise testing plan** for validating MCP v2 against MCP v1. 

### Test Hierarchy (per resource):
1. **Module** - Group by Harness module
2. **Resource** - Specific resource type
3. **Scope** - Account/Org/Project level testing
4. **Pagination** - Page 1, Page 2 tests
5. **Filtering** - Type, status, search filters
6. **CRUD** - Create, Update, Delete operations
7. **Deep Links** - Verify openInHarness URLs

---

## 2. Test Environment

| Parameter | Value |
|-----------|-------|
| **Environment** | QA |
| **Base URL** | https://qa.harness.io |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Default Org** | AI_Devops |
| **Default Project** | Sanity |

---

## 3. License Requirements

### 3.1 Modules Available in Test Account (px7xd_BFRCi-pfWPYXVjvw)

| Module | Status | Resources |
|--------|--------|-----------|
| **CD/CI** | ✅ Enabled | pipeline, execution, service, environment, infrastructure, trigger, input_set |
| **Platform** | ✅ Enabled | connector, secret, template, delegate, dashboard, audit, user, role, user_group, resource_group |
| **Code** | ✅ Enabled | repository, pull_request, branch, commit |
| **IDP** | ✅ Enabled | idp_entity, idp_workflow, scorecard, scorecard_check |
| **STO** | ✅ Enabled | security_issue, security_exemption |
| **Feature Flags** | ✅ Enabled | feature_flag |
| **Registry** | ✅ Enabled | registry |

### 3.2 Modules NOT Available in Test Account (Test with Different Account)

| Module | Status | Resources |
|--------|--------|-----------|
| **Chaos Engineering** | ❌ Not Licensed | chaos_experiment, chaos_hub, chaos_infrastructure |
| **GitOps** | ❌ Not Licensed | gitops_agent, gitops_application, gitops_cluster, gitops_repository |
| **SRM** | ❌ Not Licensed | monitored_service, slo |
| **CCM** | ❌ Not Licensed | cost_perspective, cost_budget, cost_anomaly, cost_recommendation |
| **SEI** | ❌ Not Licensed | sei_* (all SEI resources) |

---

## 4. Testing Methodology

### 4.1 Test Hierarchy Per Resource

```
Module
└── Resource
    ├── 1. Scope Testing (Account → Org → Project)
    ├── 2. Pagination (Page 1, Page 2)
    ├── 3. Filtering (type, status, search)
    ├── 4. Get by ID
    ├── 5. CRUD (Create → Update → Delete)
    └── 6. Deep Links (verify openInHarness URL)
```

### 4.2 Legend
- 🔵 v1 Tool Available
- 🟢 v2 Tool Available  
- ⚪ Not Available in that version

---

# 5. MODULE: PLATFORM

**v1 tools:** list_connectors, get_connector_details, list_connector_catalogue, create_connector, update_connector, delete_connector, list_secrets, get_secret, list_templates, core_list_delegates, list_dashboards, get_dashboard_data, get_all_users, get_user_info, invite_users, list_available_roles, get_role_info, create_role, delete_role, get_user_group_info, create_user_group, delete_user_group, create_resource_group, delete_resource_group, list_role_assignments, create_role_assignment, get_service_account, create_service_account, delete_service_account, list_user_audits, get_audit_yaml, list_available_permissions

---

## 5.1 CONNECTORS

**Module:** Platform | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_connectors, get_connector_details, list_connector_catalogue, create_connector, update_connector, delete_connector | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete, harness_execute(test_connection)

### 5.1.1 Scope Testing

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

### 5.1.2 Pagination

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

### 5.1.3 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-006 | Filter by type (Github) | 🔵 | 🟢 |

```
# CON-006
v1: "List all Github connectors in AI_Devops/Sanity"
v2: "List all Github connectors in AI_Devops/Sanity"
```

### 5.1.4 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CON-007 | Get by ID | 🔵 | 🟢 |

```
# CON-007
v1: "Get connector details for nginx_github_connector"
v2: "Get connector details for nginx_github_connector"
```

### 5.1.5 CRUD

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

### 5.1.6 Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| CON-012 | Verify openInHarness URL after create | 🟢 |
| CON-013 | Verify openInHarness URL after get | 🟢 |

```
# CON-012: After creating connector, verify the openInHarness URL opens correct page (no 404)
# CON-013: After getting connector, verify the openInHarness URL opens correct page
```

---

## 5.2 SECRETS

**Module:** Platform | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_secrets, get_secret | **v2:** harness_list, harness_get
**Note:** Read-only in both v1 and v2. Values are never exposed.

### 5.2.1 Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-001 | List at Project scope | 🔵 | 🟢 |
| SEC-002 | List at Org scope | 🔵 | 🟢 |
| SEC-003 | List at Account scope | 🔵 | 🟢 |

```
# SEC-001
v1: "List all secrets in org AI_Devops project Sanity"
v2: "List all secrets in org AI_Devops project Sanity"

# SEC-002
v1: "List all secrets at org level in AI_Devops"
v2: "List all secrets at org level in AI_Devops"

# SEC-003
v1: "List all secrets at account level"
v2: "List all secrets at account scope"
```

### 5.2.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-004 | Page 1, size 5 | 🔵 | 🟢 |
| SEC-005 | Page 2, size 5 | 🔵 | 🟢 |

```
# SEC-004
v1: "List first 5 secrets in AI_Devops/Sanity"
v2: "List first 5 secrets in AI_Devops/Sanity"

# SEC-005
v1: "List secrets page 2, size 5 in AI_Devops/Sanity"
v2: "List secrets page 2, size 5 in AI_Devops/Sanity"
```

### 5.2.3 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-006 | Filter by type (SecretText) | 🔵 | 🟢 |

```
# SEC-006
v1: "List all SecretText type secrets in AI_Devops/Sanity"
v2: "List all SecretText type secrets in AI_Devops/Sanity"
```

### 5.2.4 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEC-007 | Get by ID | 🔵 | 🟢 |

```
# SEC-007
v1: "Get secret details for hello"
v2: "Get secret details for hello"
```

### 5.2.5 CRUD

N/A — Secrets are **read-only** in both v1 and v2.

---

## 5.3 TEMPLATES

**Module:** Platform | **Scope:** Project
**v1:** list_templates | **v2:** harness_list, harness_get

### 5.3.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TPL-001 | List | 🔵 | 🟢 |
| TPL-002 | Page 1, size 5 | 🔵 | 🟢 |
| TPL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# TPL-001
v1: "List all templates in AI_Devops/Sanity"
v2: "List all templates in AI_Devops/Sanity"

# TPL-002
v1: "List first 5 templates in AI_Devops/Sanity"
v2: "List first 5 templates in AI_Devops/Sanity"

# TPL-003
v1: "List templates page 2, size 5 in AI_Devops/Sanity"
v2: "List templates page 2, size 5 in AI_Devops/Sanity"
```

### 5.3.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TPL-004 | Filter by type (Pipeline) | 🔵 | 🟢 |

```
# TPL-004
v1: "List Pipeline templates in AI_Devops/Sanity"
v2: "List Pipeline templates in AI_Devops/Sanity"
```

### 5.3.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TPL-005 | Get by ID | ⚪ | 🟢 |

```
# TPL-005
v2: "Get template native_helm_deployment"
```

---

## 5.4 DELEGATES

**Module:** Platform | **Scope:** Account
**v1:** core_list_delegates | **v2:** harness_list, harness_diagnose

### 5.4.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DEL-001 | List | 🔵 | 🟢 |
| DEL-002 | Page 1, size 5 | 🔵 | 🟢 |
| DEL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# DEL-001
v1: "List all delegates in the account"
v2: "List all delegates in the account"

# DEL-002
v1: "List first 5 delegates"
v2: "List first 5 delegates"

# DEL-003
v1: "List delegates page 2, size 5"
v2: "List delegates page 2, size 5"
```

### 5.4.2 Diagnose (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DEL-004 | Diagnose delegate health | ⚪ | 🟢 |

```
# DEL-004
v2: "Check health of delegate helm-delegate"
```

---

## 5.5 DASHBOARDS

**Module:** Platform | **Scope:** Account
**v1:** list_dashboards, get_dashboard_data | **v2:** harness_list, harness_get

### 5.5.1 Pagination

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

### 5.5.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| DSH-004 | Get dashboard data | 🔵 | 🟢 |

```
# DSH-004
v1: "Get data from dashboard 33257"
v2: "Get data from dashboard 33257"
```

---

## 5.6 USERS

**Module:** Platform | **Scope:** Account (can filter by project)
**v1:** get_all_users, get_user_info, invite_users | **v2:** harness_list, harness_get

### 5.6.1 Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-001 | List at Account scope | 🔵 | 🟢 |
| USR-002 | List at Project scope | 🔵 | 🟢 |

```
# USR-001
v1: "List all users in the account"
v2: "List all users in the account"

# USR-002
v1: "List all users in project Sanity"
v2: "List all users in project Sanity"
```

### 5.6.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-003 | Page 1, size 5 | 🔵 | 🟢 |
| USR-004 | Page 2, size 5 | 🔵 | 🟢 |

```
# USR-003
v1: "List first 5 users"
v2: "List first 5 users"

# USR-004
v1: "List users page 2, size 5"
v2: "List users page 2, size 5"
```

### 5.6.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-005 | Get by ID | 🔵 | 🟢 |

```
# USR-005
v1: "Get user info for user_id"
v2: "Get user info for user_id"
```

### 5.6.4 Actions

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| USR-006 | Invite user | 🔵 | 🟢 |

```
# USR-006
v1: "Invite user test@example.com to project Sanity"
v2: "Invite user test@example.com to project Sanity"
```

---

## 5.7 ROLES

**Module:** Platform | **Scope:** Account / Org / Project
**v1:** list_available_roles, get_role_info, create_role, delete_role | **v2:** harness_list, harness_get, harness_create, harness_delete

### 5.7.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ROL-001 | List | 🔵 | 🟢 |
| ROL-002 | Page 1, size 5 | 🔵 | 🟢 |
| ROL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# ROL-001
v1: "List all roles"
v2: "List all roles"

# ROL-002
v1: "List first 5 roles"
v2: "List first 5 roles"

# ROL-003
v1: "List roles page 2, size 5"
v2: "List roles page 2, size 5"
```

### 5.7.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ROL-004 | Get by ID | 🔵 | 🟢 |

```
# ROL-004
v1: "Get role details for role_id"
v2: "Get role details for role_id"
```

### 5.7.3 CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ROL-005 | Create | 🔵 | 🟢 |
| ROL-006 | Delete | 🔵 | 🟢 |

```
# ROL-005
v1: "Create a new role named 'test_role_crud' with identifier 'test_role_crud'"
v2: "Create a new role named 'test_role_crud' with identifier 'test_role_crud'"

# ROL-006
v1: "Delete role test_role_crud"
v2: "Delete role test_role_crud"
```

---

## 5.8 USER GROUPS

**Module:** Platform | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** get_user_group_info, create_user_group, delete_user_group | **v2:** harness_list, harness_get, harness_create, harness_delete

### 5.8.1 Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-001 | List at Project scope | ⚪ | 🟢 |
| UGR-002 | List at Org scope | ⚪ | 🟢 |
| UGR-003 | List at Account scope | ⚪ | 🟢 |

```
# UGR-001: Project scope
v2: "List all user groups in org AI_Devops project Sanity"

# UGR-002: Org scope
v2: "List all user groups at org level in AI_Devops"

# UGR-003: Account scope
v2: "List all user groups at account scope"
```

### 5.8.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-004 | Page 1, size 5 | ⚪ | 🟢 |

```
# UGR-004
v2: "List first 5 user groups in AI_Devops/Sanity"
```

### 5.8.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-005 | Get by ID | 🔵 | 🟢 |

```
# UGR-005
v1: "Get user group info for user_group_id"
v2: "Get user group info for user_group_id"
```

### 5.8.4 CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| UGR-006 | Create at Project scope | 🔵 | 🟢 |
| UGR-007 | Create at Org scope | 🔵 | 🟢 |
| UGR-008 | Create at Account scope | 🔵 | 🟢 |
| UGR-009 | Delete | 🔵 | 🟢 |

```
# UGR-006: Create at Project scope
v1: "Create a new user group named 'test_ug_crud' with identifier 'test_ug_crud' in AI_Devops/Sanity"
v2: "Create a new user group named 'test_ug_crud' with identifier 'test_ug_crud' in AI_Devops/Sanity"

# UGR-007: Create at Org scope
v1: "Create a new user group named 'test_ug_org' with identifier 'test_ug_org' at org level in AI_Devops"
v2: "Create a new user group named 'test_ug_org' with identifier 'test_ug_org' at org level in AI_Devops"

# UGR-008: Create at Account scope
v1: "Create a new user group named 'test_ug_acct' with identifier 'test_ug_acct' at account scope"
v2: "Create a new user group named 'test_ug_acct' with identifier 'test_ug_acct' at account scope"

# UGR-009
v1: "Delete user group test_ug_crud"
v2: "Delete user group test_ug_crud"
```

---

## 5.9 RESOURCE GROUPS

**Module:** Platform | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** create_resource_group, delete_resource_group | **v2:** harness_list, harness_get, harness_create, harness_delete

### 5.9.1 Scope Testing

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

### 5.9.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RGR-004 | Page 1, size 5 | ⚪ | 🟢 |

```
# RGR-004
v2: "List first 5 resource groups in AI_Devops/Sanity"
```

### 5.9.3 CRUD

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

---

## 5.10 ROLE ASSIGNMENTS

**Module:** Platform | **Scope:** Project
**v1:** list_role_assignments, create_role_assignment | **v2:** harness_list, harness_create

### 5.10.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RAS-001 | List | 🔵 | 🟢 |
| RAS-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# RAS-001
v1: "List all role assignments in AI_Devops/Sanity"
v2: "List all role assignments in AI_Devops/Sanity"

# RAS-002
v1: "List first 5 role assignments"
v2: "List first 5 role assignments"
```

### 5.10.2 CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| RAS-003 | Create | 🔵 | 🟢 |

```
# RAS-003
v1: "Create a role assignment for user_id with role _account_admin and resource group _all_resources"
v2: "Create a role assignment for user_id with role _account_admin and resource group _all_resources"
```

---

## 5.11 SERVICE ACCOUNTS

**Module:** Platform | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** get_service_account, create_service_account, delete_service_account | **v2:** harness_list, harness_get, harness_create, harness_delete

### 5.11.1 Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-001 | List at Project scope | ⚪ | 🟢 |
| SAC-002 | List at Org scope | ⚪ | 🟢 |
| SAC-003 | List at Account scope | ⚪ | 🟢 |

```
# SAC-001: Project scope
v2: "List all service accounts in org AI_Devops project Sanity"

# SAC-002: Org scope
v2: "List all service accounts at org level in AI_Devops"

# SAC-003: Account scope
v2: "List all service accounts at account scope"
```

### 5.11.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-004 | Page 1, size 5 | ⚪ | 🟢 |

```
# SAC-004
v2: "List first 5 service accounts in AI_Devops/Sanity"
```

### 5.11.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-005 | Get by ID | 🔵 | 🟢 |

```
# SAC-005
v1: "Get service account info for sa_id"
v2: "Get service account info for sa_id"
```

### 5.11.4 CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SAC-006 | Create at Project scope | 🔵 | 🟢 |
| SAC-007 | Create at Org scope | 🔵 | 🟢 |
| SAC-008 | Create at Account scope | 🔵 | 🟢 |
| SAC-009 | Delete | 🔵 | 🟢 |

```
# SAC-006: Create at Project scope
v1: "Create service account named 'test_sa_crud' with identifier 'test_sa_crud' and email 'test@harness.io' in AI_Devops/Sanity"
v2: "Create service account named 'test_sa_crud' with identifier 'test_sa_crud' and email 'test@harness.io' in AI_Devops/Sanity"

# SAC-007: Create at Org scope
v1: "Create service account named 'test_sa_org' with identifier 'test_sa_org' and email 'test_org@harness.io' at org level in AI_Devops"
v2: "Create service account named 'test_sa_org' with identifier 'test_sa_org' and email 'test_org@harness.io' at org level in AI_Devops"

# SAC-008: Create at Account scope
v1: "Create service account named 'test_sa_acct' with identifier 'test_sa_acct' and email 'test_acct@harness.io' at account scope"
v2: "Create service account named 'test_sa_acct' with identifier 'test_sa_acct' and email 'test_acct@harness.io' at account scope"

# SAC-009
v1: "Delete service account test_sa_crud"
v2: "Delete service account test_sa_crud"
```

---

## 5.12 AUDIT

**Module:** Platform | **Scope:** Account / Org / Project
**v1:** list_user_audits, get_audit_yaml | **v2:** harness_list, harness_get

### 5.12.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| AUD-001 | List | 🔵 | 🟢 |
| AUD-002 | Page 1, size 5 | 🔵 | 🟢 |
| AUD-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# AUD-001
v1: "List audit events"
v2: "List audit events"

# AUD-002
v1: "List first 5 audit events"
v2: "List first 5 audit events"

# AUD-003
v1: "List audit events page 2, size 5"
v2: "List audit events page 2, size 5"
```

### 5.12.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| AUD-004 | Filter by action (CREATE) | 🔵 | 🟢 |

```
# AUD-004
v1: "List CREATE audit events"
v2: "List CREATE audit events"
```

### 5.12.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| AUD-005 | Get YAML diff | 🔵 | 🟢 |

```
# AUD-005
v1: "Get YAML diff for audit event audit_id"
v2: "Get YAML diff for audit event audit_id"
```

---

# 5. MODULE: CD/CI

**v1 tools:** list_pipelines, get_pipeline, get_pipeline_summary, list_executions, get_execution, fetch_execution_url, list_triggers, list_input_sets, get_input_set, list_services, get_service, list_environments, get_environment, list_infrastructure, get_infrastructure

---

## 5.13 SERVICES

**Module:** CD/CI | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_services, get_service | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete

### 5.13.1 Scope Testing

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

### 5.13.2 Pagination

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

### 5.13.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SVC-006 | Get by ID | 🔵 | 🟢 |

```
# SVC-006
v1: "Get service details for k8s_multi_resource_service"
v2: "Get service details for k8s_multi_resource_service"
```

### 5.13.4 CRUD (v2 only)

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

### 5.13.5 Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| SVC-010 | Verify openInHarness URL after create | 🟢 |

```
# SVC-010: After creating service, verify the openInHarness URL opens correct page
```

---

## 5.14 ENVIRONMENTS

**Module:** CD/CI | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_environments, get_environment | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete

### 5.14.1 Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-001 | List at Project scope | 🔵 | 🟢 |
| ENV-002 | List at Org scope | 🔵 | 🟢 |
| ENV-003 | List at Account scope | 🔵 | 🟢 |

```
# ENV-001
v1: "List all environments in org AI_Devops project Sanity"
v2: "List all environments in org AI_Devops project Sanity"

# ENV-002
v1: "List all environments at org level in AI_Devops"
v2: "List all environments at org level in AI_Devops"

# ENV-003
v1: "List all environments at account scope"
v2: "List all environments at account scope"
```

### 5.14.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-004 | Page 1, size 5 | 🔵 | 🟢 |
| ENV-005 | Page 2, size 5 | 🔵 | 🟢 |

```
# ENV-004
v1: "List first 5 environments in AI_Devops/Sanity"
v2: "List first 5 environments in AI_Devops/Sanity"

# ENV-005
v1: "List environments page 2, size 5 in AI_Devops/Sanity"
v2: "List environments page 2, size 5 in AI_Devops/Sanity"
```

### 5.14.3 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-006 | Filter by type (Production) | 🔵 | 🟢 |

```
# ENV-006
v1: "List all Production environments in AI_Devops/Sanity"
v2: "List all Production environments in AI_Devops/Sanity"
```

### 5.14.4 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-007 | Get by ID | 🔵 | 🟢 |

```
# ENV-007
v1: "Get environment details for preprod"
v2: "Get environment details for preprod"
```

### 5.14.5 CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| ENV-008 | Create | ⚪ | 🟢 |
| ENV-009 | Update | ⚪ | 🟢 |
| ENV-010 | Delete | ⚪ | 🟢 |

```
# ENV-008
v2: "Create a new PreProduction environment named 'test_env_crud' with identifier 'test_env_crud'"

# ENV-009
v2: "Update environment test_env_crud description to 'Updated via MCP test'"

# ENV-010
v2: "Delete environment test_env_crud"
```

### 5.14.6 Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| ENV-011 | Verify openInHarness URL after create | 🟢 |

---

## 5.15 INFRASTRUCTURE

**Module:** CD/CI | **Scope:** Multi-Scope (Account / Org / Project)
**v1:** list_infrastructure, get_infrastructure | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete
**Note:** Requires `environment_id` filter for list operations

### 5.15.1 Scope Testing

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-001 | List at Project scope (+ env) | � | 🟢 |
| INF-002 | List at Org scope (+ env) | 🔵 | 🟢 |

```
# INF-001
v1: "List all infrastructure definitions in environment aws_sam in AI_Devops/Sanity"
v2: "List all infrastructure definitions in environment aws_sam in AI_Devops/Sanity"

# INF-002
v1: "List all infrastructure at org level in AI_Devops for environment aws_sam"
v2: "List all infrastructure at org level in AI_Devops for environment aws_sam"
```

### 5.15.2 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-003 | Page 1, size 5 | 🔵 | 🟢 |
| INF-004 | Page 2, size 5 | 🔵 | 🟢 |

```
# INF-003
v1: "List first 5 infrastructure definitions in environment aws_sam"
v2: "List first 5 infrastructure definitions in environment aws_sam"

# INF-004
v1: "List infrastructure page 2, size 5 in environment aws_sam"
v2: "List infrastructure page 2, size 5 in environment aws_sam"
```

### 5.15.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-005 | Get by ID | 🔵 | 🟢 |

```
# INF-005
v1: "Get infrastructure details for azure_fu in environment aws_sam"
v2: "Get infrastructure details for azure_fu in environment aws_sam"
```

### 5.15.4 CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INF-006 | Create | ⚪ | 🟢 |
| INF-007 | Update | ⚪ | 🟢 |
| INF-008 | Delete | ⚪ | 🟢 |

```
# INF-006
v2: "Create a new Kubernetes infrastructure named 'test_infra_crud' in environment preprod"

# INF-007
v2: "Update infrastructure test_infra_crud description to 'Updated via MCP test'"

# INF-008
v2: "Delete infrastructure test_infra_crud from environment preprod"
```

## 5.16 PIPELINES

**Module:** CD/CI | **Scope:** Project
**v1:** list_pipelines, get_pipeline, get_pipeline_summary | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete, harness_execute(run), harness_diagnose

### 5.16.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-001 | List | 🔵 | 🟢 |
| PIP-002 | Page 1, size 5 | 🔵 | 🟢 |
| PIP-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# PIP-001
v1: "List all pipelines in AI_Devops/Sanity"
v2: "List all pipelines in AI_Devops/Sanity"

# PIP-002
v1: "List first 5 pipelines in AI_Devops/Sanity"
v2: "List first 5 pipelines in AI_Devops/Sanity"

# PIP-003
v1: "List pipelines page 2, size 5 in AI_Devops/Sanity"
v2: "List pipelines page 2, size 5 in AI_Devops/Sanity"
```

### 5.16.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-004 | Filter by search term | 🔵 | 🟢 |

```
# PIP-004
v1: "List pipelines containing 'deploy' in AI_Devops/Sanity"
v2: "List pipelines containing 'deploy' in AI_Devops/Sanity"
```

### 5.16.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-005 | Get by ID | 🔵 | 🟢 |
| PIP-006 | Get Summary | 🔵 | 🟢 |

```
# PIP-005
v1: "Get pipeline custom_stage_pipeline"
v2: "Get pipeline custom_stage_pipeline"

# PIP-006
v1: "Get pipeline summary for custom_stage_pipeline"
v2: "Get pipeline summary for custom_stage_pipeline"
```

### 5.16.4 CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-007 | Create | ⚪ | 🟢 |
| PIP-008 | Update | ⚪ | 🟢 |
| PIP-009 | Delete | ⚪ | 🟢 |

```
# PIP-007
v2: "Create a new pipeline named 'test_pipeline_crud' with a simple shell script stage"

# PIP-008
v2: "Update pipeline test_pipeline_crud description to 'Updated via MCP test'"

# PIP-009
v2: "Delete pipeline test_pipeline_crud"
```

### 5.16.5 Execute / Diagnose

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PIP-010 | Run pipeline | 🔵 | 🟢 |
| PIP-011 | Diagnose failure | ⚪ | 🟢 |

```
# PIP-010
v1: "Run pipeline wait_pipeline_10min_v8"
v2: "Run pipeline wait_pipeline_10min_v8"

# PIP-011
v2: "Diagnose why pipeline custom_stage_pipeline failed"
```

### 5.16.6 Deep Links

| Test ID | Test | v2 |
|---------|------|----|
| PIP-012 | Verify openInHarness URL after create | 🟢 |

---

## 5.17 EXECUTIONS

**Module:** CD/CI | **Scope:** Project
**v1:** list_executions, get_execution, fetch_execution_url | **v2:** harness_list, harness_get, harness_execute(retry, interrupt), harness_diagnose

### 5.17.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-001 | List | 🔵 | 🟢 |
| EXE-002 | Page 1, size 5 | � | 🟢 |
| EXE-003 | Page 2, size 5 | � | 🟢 |

```
# EXE-001
v1: "List recent pipeline executions in AI_Devops/Sanity"
v2: "List recent pipeline executions in AI_Devops/Sanity"

# EXE-002
v1: "List first 5 executions in AI_Devops/Sanity"
v2: "List first 5 executions in AI_Devops/Sanity"

# EXE-003
v1: "List executions page 2, size 5 in AI_Devops/Sanity"
v2: "List executions page 2, size 5 in AI_Devops/Sanity"
```

### 5.17.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-004 | Filter by status (Failed) | 🔵 | 🟢 |
| EXE-005 | Filter by pipeline | 🔵 | 🟢 |

```
# EXE-004
v1: "List failed executions in AI_Devops/Sanity"
v2: "List failed executions in AI_Devops/Sanity"

# EXE-005
v1: "List executions for pipeline custom_stage_pipeline"
v2: "List executions for pipeline custom_stage_pipeline"
```

### 5.17.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-006 | Get by ID | 🔵 | 🟢 |

```
# EXE-006
v1: "Get execution details for lvKPVrKzRee2ZEIhGh0bIQ"
v2: "Get execution details for lvKPVrKzRee2ZEIhGh0bIQ"
```

### 5.17.4 Actions (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXE-007 | Diagnose failure | ⚪ | 🟢 |
| EXE-008 | Interrupt (abort) | ⚪ | 🟢 |
| EXE-009 | Retry | ⚪ | 🟢 |

```
# EXE-007
v2: "Diagnose why execution lvKPVrKzRee2ZEIhGh0bIQ failed"

# EXE-008
v2: "Abort the currently running execution"

# EXE-009
v2: "Retry failed execution lvKPVrKzRee2ZEIhGh0bIQ"
```

---

## 5.18 TRIGGERS

**Module:** CD/CI | **Scope:** Project (scoped to pipeline)
**v1:** list_triggers | **v2:** harness_list, harness_get, harness_create, harness_update, harness_delete

### 5.18.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TRG-001 | List | 🔵 | 🟢 |
| TRG-002 | Page 1, size 5 | 🔵 | 🟢 |
| TRG-003 | Page 2, size 5 | � | 🟢 |

```
# TRG-001
v1: "List triggers for pipeline custom_stage_pipeline"
v2: "List triggers for pipeline custom_stage_pipeline"

# TRG-002
v1: "List first 5 triggers for pipeline custom_stage_pipeline"
v2: "List first 5 triggers for pipeline custom_stage_pipeline"

# TRG-003
v1: "List triggers page 2, size 5 for pipeline custom_stage_pipeline"
v2: "List triggers page 2, size 5 for pipeline custom_stage_pipeline"
```

### 5.18.2 Get / CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| TRG-004 | Get by ID | ⚪ | 🟢 |
| TRG-005 | Create | ⚪ | 🟢 |
| TRG-006 | Update | ⚪ | 🟢 |
| TRG-007 | Delete | ⚪ | 🟢 |

```
# TRG-004
v2: "Get trigger details for trigger_id in pipeline custom_stage_pipeline"

# TRG-005
v2: "Create a webhook trigger named 'test_trigger_crud' for pipeline custom_stage_pipeline"

# TRG-006
v2: "Update trigger test_trigger_crud to be disabled"

# TRG-007
v2: "Delete trigger test_trigger_crud from pipeline custom_stage_pipeline"
```

---

## 5.19 INPUT SETS

**Module:** CD/CI | **Scope:** Project (scoped to pipeline)
**v1:** list_input_sets, get_input_set | **v2:** harness_list, harness_get, harness_create, harness_delete

### 5.19.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INS-001 | List | 🔵 | 🟢 |
| INS-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# INS-001
v1: "List input sets for pipeline custom_stage_pipeline"
v2: "List input sets for pipeline custom_stage_pipeline"

# INS-002
v1: "List first 5 input sets for pipeline custom_stage_pipeline"
v2: "List first 5 input sets for pipeline custom_stage_pipeline"
```

### 5.19.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INS-003 | Get by ID | 🔵 | 🟢 |

```
# INS-003
v1: "Get input set details for input_set_id in pipeline custom_stage_pipeline"
v2: "Get input set details for input_set_id in pipeline custom_stage_pipeline"
```

### 5.19.3 CRUD (v2 only)

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| INS-004 | Create | ⚪ | 🟢 |
| INS-005 | Delete | ⚪ | 🟢 |

```
# INS-004
v2: "Create an input set named 'test_inputset_crud' for pipeline custom_stage_pipeline"

# INS-005
v2: "Delete input set test_inputset_crud from pipeline custom_stage_pipeline"
```

---

# 5. MODULE: CODE

**v1 tools:** list_repositories, get_repository, list_pull_requests, get_pull_request, get_pull_request_activities, get_pull_request_checks, create_pull_request

---

## 5.20 CODE REPOSITORIES

**Module:** Code | **Scope:** Project
**v1:** list_repositories, get_repository | **v2:** harness_list, harness_get

### 5.20.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REP-001 | List | 🔵 | 🟢 |
| REP-002 | Page 1, size 5 | 🔵 | 🟢 |
| REP-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# REP-001
v1: "List all repositories in AI_Devops/Sanity"
v2: "List all repositories in AI_Devops/Sanity"

# REP-002
v1: "List first 5 repositories in AI_Devops/Sanity"
v2: "List first 5 repositories in AI_Devops/Sanity"

# REP-003
v1: "List repositories page 2, size 5 in AI_Devops/Sanity"
v2: "List repositories page 2, size 5 in AI_Devops/Sanity"
```

### 5.20.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REP-004 | Get by ID | 🔵 | 🟢 |

```
# REP-004
v1: "Get repository details for repo_name"
v2: "Get repository details for repo_name"
```

---

## 5.21 PULL REQUESTS

**Module:** Code | **Scope:** Project (scoped to repository)
**v1:** list_pull_requests, get_pull_request, get_pull_request_activities, get_pull_request_checks, create_pull_request | **v2:** harness_list, harness_get, harness_create

### 5.21.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-001 | List | 🔵 | 🟢 |
| PR-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# PR-001
v1: "List all pull requests in repository repo_name"
v2: "List all pull requests in repository repo_name"

# PR-002
v1: "List first 5 pull requests in repository repo_name"
v2: "List first 5 pull requests in repository repo_name"
```

### 5.21.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-003 | Filter by state (open) | 🔵 | 🟢 |

```
# PR-003
v1: "List open pull requests in repository repo_name"
v2: "List open pull requests in repository repo_name"
```

### 5.21.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-004 | Get by ID | 🔵 | 🟢 |
| PR-005 | Get Activities | 🔵 | 🟢 |
| PR-006 | Get Checks | 🔵 | 🟢 |

```
# PR-004
v1: "Get pull request #1 in repository repo_name"
v2: "Get pull request #1 in repository repo_name"

# PR-005
v1: "Get activities for pull request #1 in repository repo_name"
v2: "Get activities for pull request #1 in repository repo_name"

# PR-006
v1: "Get status checks for pull request #1 in repository repo_name"
v2: "Get status checks for pull request #1 in repository repo_name"
```

### 5.21.4 CRUD

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| PR-007 | Create | 🔵 | 🟢 |

```
# PR-007
v1: "Create a pull request from branch feature to main in repository repo_name"
v2: "Create a pull request from branch feature to main in repository repo_name"
```

---

# 5. MODULE: IDP (Internal Developer Portal)

**v1 tools:** list_entities, get_entity, execute_workflow, list_scorecards, get_scorecard, get_scorecard_check, get_scorecard_check_stats, get_scorecard_stats, get_scores, get_score_summary, list_scorecard_checks, search_tech_docs

---

## 5.22 IDP ENTITIES

**Module:** IDP | **Scope:** Account
**v1:** list_entities, get_entity | **v2:** harness_list, harness_get

### 5.22.1 Pagination

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

### 5.22.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| IDP-004 | Filter by kind (component) | 🔵 | 🟢 |

```
# IDP-004
v1: "List all component entities in IDP"
v2: "List all component entities in IDP"
```

### 5.22.3 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| IDP-005 | Get by ID | 🔵 | 🟢 |

```
# IDP-005
v1: "Get IDP entity details for entity_id"
v2: "Get IDP entity details for entity_id"
```

---

## 5.23 IDP WORKFLOWS

**Module:** IDP | **Scope:** Account
**v1:** list_entities (kind=workflow), execute_workflow | **v2:** harness_list, harness_execute

### 5.23.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| WFL-001 | List | 🔵 | 🟢 |
| WFL-002 | Page 1, size 5 | 🔵 | 🟢 |
| WFL-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# WFL-001
v1: "List all IDP workflows"
v2: "List all IDP workflows"

# WFL-002
v1: "List first 5 IDP workflows"
v2: "List first 5 IDP workflows"

# WFL-003
v1: "List IDP workflows page 2, size 5"
v2: "List IDP workflows page 2, size 5"
```

### 5.23.2 Execute

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| WFL-004 | Execute workflow | 🔵 | 🟢 |

```
# WFL-004
v1: "Execute IDP workflow react-app with inputs {project_name: 'test'}"
v2: "Execute IDP workflow react-app with inputs {project_name: 'test'}"
```

---

## 5.24 SCORECARDS

**Module:** IDP | **Scope:** Account
**v1:** list_scorecards, get_scorecard, get_scorecard_stats | **v2:** harness_list, harness_get

### 5.24.1 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SCR-001 | List | 🔵 | 🟢 |
| SCR-002 | Get by ID | 🔵 | 🟢 |
| SCR-003 | Get Stats | 🔵 | 🟢 |

```
# SCR-001
v1: "List all scorecards"
v2: "List all scorecards"

# SCR-002
v1: "Get scorecard details for scorecard_id"
v2: "Get scorecard details for scorecard_id"

# SCR-003
v1: "Get stats for scorecard scorecard_id"
v2: "Get stats for scorecard scorecard_id"
```

---

## 5.25 SCORECARD CHECKS

**Module:** IDP | **Scope:** Account
**v1:** list_scorecard_checks, get_scorecard_check, get_scorecard_check_stats | **v2:** harness_list, harness_get

### 5.25.1 Pagination

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

### 5.25.2 Get

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

---

# 5. MODULE: STO (Security Testing Orchestration)

**v1 tools:** get_all_security_issues, sto_global_exemptions, exemptions_reject_and_approve, sto_exemptions_promote_and_approve

---

## 5.26 SECURITY ISSUES

**Module:** STO | **Scope:** Project
**v1:** get_all_security_issues | **v2:** harness_list

### 5.26.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| STO-001 | List | 🔵 | 🟢 |
| STO-002 | Page 1, size 5 | 🔵 | 🟢 |
| STO-003 | Page 2, size 5 | 🔵 | 🟢 |

```
# STO-001
v1: "List all security issues in AI_Devops/Sanity"
v2: "List all security issues in AI_Devops/Sanity"

# STO-002
v1: "List first 5 security issues in AI_Devops/Sanity"
v2: "List first 5 security issues in AI_Devops/Sanity"

# STO-003
v1: "List security issues page 2, size 5 in AI_Devops/Sanity"
v2: "List security issues page 2, size 5 in AI_Devops/Sanity"
```

### 5.26.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| STO-004 | Filter by severity (Critical) | 🔵 | 🟢 |

```
# STO-004
v1: "List Critical security issues in AI_Devops/Sanity"
v2: "List Critical security issues in AI_Devops/Sanity"
```

---

## 5.27 SECURITY EXEMPTIONS

**Module:** STO | **Scope:** Project
**v1:** sto_global_exemptions, exemptions_reject_and_approve, sto_exemptions_promote_and_approve | **v2:** harness_list, harness_execute

### 5.27.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXM-001 | List | 🔵 | 🟢 |
| EXM-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# EXM-001
v1: "List all security exemptions in AI_Devops/Sanity"
v2: "List all security exemptions in AI_Devops/Sanity"

# EXM-002
v1: "List first 5 security exemptions with status Pending"
v2: "List first 5 security exemptions with status Pending"
```

### 5.27.2 Filtering

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXM-003 | Filter by status (Approved) | 🔵 | 🟢 |

```
# EXM-003
v1: "List Approved security exemptions in AI_Devops/Sanity"
v2: "List Approved security exemptions in AI_Devops/Sanity"
```

### 5.27.3 Actions

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| EXM-004 | Approve | 🔵 | 🟢 |
| EXM-005 | Reject | 🔵 | 🟢 |

```
# EXM-004
v1: "Approve security exemption exemption_id"
v2: "Approve security exemption exemption_id"

# EXM-005
v1: "Reject security exemption exemption_id"
v2: "Reject security exemption exemption_id"
```

---

# 5. MODULE: FEATURE FLAGS

**v1 tools:** None (v2 only)

---

## 5.28 FEATURE FLAGS

**Module:** Feature Flags | **Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get, harness_execute(toggle)

### 5.28.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-001 | List | ⚪ | 🟢 |
| FF-002 | Page 1, size 5 | ⚪ | 🟢 |
| FF-003 | Page 2, size 5 | ⚪ | 🟢 |

```
# FF-001
v2: "List all feature flags in AI_Devops/Sanity"

# FF-002
v2: "List first 5 feature flags in AI_Devops/Sanity"

# FF-003
v2: "List feature flags page 2, size 5 in AI_Devops/Sanity"
```

### 5.28.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-004 | Get by ID | ⚪ | 🟢 |

```
# FF-004
v2: "Get feature flag details for My_Test_Flag"
```

### 5.28.3 Actions

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| FF-005 | Toggle | ⚪ | 🟢 |

```
# FF-005
v2: "Toggle feature flag My_Test_Flag to on"
```

---

# 5. MODULE: REGISTRY

**v1 tools:** None (v2 only)

---

## 5.29 ARTIFACT REGISTRY

**Module:** Registry | **Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get

### 5.29.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-001 | List | ⚪ | 🟢 |
| REG-002 | Page 1, size 5 | ⚪ |  |

```
# REG-001
v2: "List all registries in AI_Devops/Sanity"

# REG-002
v2: "List first 5 registries in AI_Devops/Sanity"
```

### 5.29.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-003 | Get by ID | ⚪ | 🟢 |

```
# REG-003
v2: "Get registry details for registry_id"
```

---

# 5. MODULE: UNLICENSED (Test with Different Account)

**Note:** These modules are not licensed in the default test account (px7xd_BFRCi-pfWPYXVjvw). Test with an account that has these modules enabled.
**v1 tools:** None (v2 only)

---

## 5.30 CHAOS ENGINEERING - Requires License

**Module:** Chaos | **Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get, harness_execute(run)

### 5.30.1 Pagination

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

### 5.30.2 Get / Execute

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

---

## 5.31 GITOPS - Requires License

**Module:** GitOps | **Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get, harness_execute(sync), harness_diagnose

### 5.31.1 Pagination

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

### 5.31.2 Get / Execute

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

---

## 5.32 SRM - Service Reliability Management - Requires License

**Module:** SRM | **Scope:** Project
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get

### 5.32.1 Pagination

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

### 5.32.2 Get

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

---

## 5.33 CCM - Cloud Cost Management - Requires License

**Module:** CCM | **Scope:** Account
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get

### 5.33.1 Pagination

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

### 5.33.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| CCM-005 | Get Perspective | ⚪ | 🟢 |

```
# CCM-005
v2: "Get cost perspective details for {perspective_id}"
```

---

## 5.34 SEI - Software Engineering Insights - Requires License

**Module:** SEI | **Scope:** Account
**v1:** ⚪ (not available) | **v2:** harness_list, harness_get

### 5.34.1 Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEI-001 | List Collections | ⚪ | 🟢 |
| SEI-002 | List Insights | ⚪ | 🟢 |

```
# SEI-001
v2: "List all SEI collections"

# SEI-002
v2: "List all SEI insights"
```

### 5.34.2 Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| SEI-003 | Get Collection | ⚪ | 🟢 |

```
# SEI-003
v2: "Get SEI collection details for {collection_id}"
```

---

## 6. CRUD Lifecycle & Persistence Validation

### 6.1 Create → Verify → Update → Verify → Delete → Verify

Full lifecycle testing ensures resources are actually persisted (not just returning success), scoped correctly, and modifiable. Each CRUD test follows this pattern:

| Step | Action | Validation |
|------|--------|------------|
| 1. Create | `harness_create(resource_type, body)` | Response includes identifier, no errors |
| 2. Verify Create | `harness_get(resource_type, resource_id)` | Resource exists and matches create payload |
| 3. Verify Scope | `harness_list(resource_type)` | Resource appears in project-scoped list |
| 4. Update | `harness_update(resource_type, resource_id, body)` | Response includes updated fields |
| 5. Verify Update | `harness_get(resource_type, resource_id)` | Fields reflect the update |
| 6. Delete | `harness_delete(resource_type, resource_id)` | Success response |
| 7. Verify Delete | `harness_get(resource_type, resource_id)` | Returns "not found" error |

### 6.2 CRUD Test Cases by Resource

| Test ID | Resource | Create Body | Update Field | Expected Scope |
|---------|----------|-------------|--------------|----------------|
| CRUD-001 | Environment | `{identifier, name, type: "PreProduction"}` | Change name, add tags | Project |
| CRUD-002 | Service | `{identifier, name, description}` | Change description | Project |
| CRUD-003 | Pipeline | `{yamlPipeline: "..."}` | Update stage name | Project |
| CRUD-004 | Connector | `{identifier, name, type, spec}` | Change description | Project |

**Sample Test (Environment):**
```
1. Create: harness_create(resource_type="environment", body={identifier: "crud_test", name: "CRUD Test", type: "PreProduction"})
2. Verify: harness_get(resource_type="environment", resource_id="crud_test")  → should exist
3. List:   harness_list(resource_type="environment")  → "crud_test" should appear
4. Update: harness_update(resource_type="environment", resource_id="crud_test", body={name: "CRUD Test Updated", type: "PreProduction"})
5. Verify: harness_get(resource_type="environment", resource_id="crud_test")  → name should be updated
6. Delete: harness_delete(resource_type="environment", resource_id="crud_test")
7. Verify: harness_get(resource_type="environment", resource_id="crud_test")  → should return "not found"
```

### 6.3 Scope Persistence Validation (Critical)

**Bug Found:** Create API can return HTTP 200 success but place the resource in the wrong scope (e.g., account instead of project) if `orgIdentifier`/`projectIdentifier` are missing from the request body. The resource then won't appear in project-scoped list queries.

| Test ID | Test Case | Validation | Expected Result |
|---------|-----------|------------|-----------------|
| SCP-001 | Create env at project scope | GET the created env and check `orgIdentifier`/`projectIdentifier` in response | Both fields present, match target org/project |
| SCP-002 | Create env without org/project in body | Verify where resource lands | Resource should NOT be created at account scope |
| SCP-003 | List after create | List resources in the target project | Newly created resource appears in the list |
| SCP-004 | Create service at project scope | Same as SCP-001 for service | `orgIdentifier`/`projectIdentifier` present |
| SCP-005 | Create pipeline at project scope | Same as SCP-001 for pipeline | `orgIdentifier`/`projectIdentifier` present |

**Curl Validation (independent of MCP):**
```bash
# Correct: org/project in body → project scope
curl -X POST '.../ng/api/environmentsV2?accountIdentifier=ACC&orgIdentifier=ORG&projectIdentifier=PROJ' \
  -d '{"identifier":"test","name":"Test","type":"PreProduction","orgIdentifier":"ORG","projectIdentifier":"PROJ"}'
# Response should show orgIdentifier and projectIdentifier in the environment object

# Incorrect: org/project only in query params → account scope (silent failure)
curl -X POST '.../ng/api/environmentsV2?accountIdentifier=ACC&orgIdentifier=ORG&projectIdentifier=PROJ' \
  -d '{"identifier":"test","name":"Test","type":"PreProduction"}'
# Response returns 200 SUCCESS but environment is created at account scope!
# orgId and projectId will be empty in governance metadata
```

### 6.4 Deep Link Validation

| Test ID | Test Case | Validation |
|---------|-----------|------------|
| DLP-001 | Create resource and check `openInHarness` URL | URL should contain actual identifier, not `{placeholder}` |
| DLP-002 | Open the `openInHarness` link in browser | Page should load without 404 |
| DLP-003 | Verify deep links for nested responses | For service/environment creates where response is `{service: {identifier: "..."}}`, identifier should still resolve |

### 6.5 Deep Link 404 Verification Tests

For each resource type, verify the `openInHarness` URL loads correctly in the browser without 404 errors.

| Test ID | Resource | Expected URL Pattern | Validation |
|---------|----------|---------------------|------------|
| DLP-404-001 | Environment | `/settings/environments/{id}/details` | Opens environment details page |
| DLP-404-002 | Service | `/settings/services/{id}` | Opens service page |
| DLP-404-003 | Connector | `/settings/connectors/{id}` | Opens connector page |
| DLP-404-004 | Pipeline | `/pipelines/{id}/pipeline-studio?storeType=...` | Opens pipeline studio |
| DLP-404-005 | Secret | `/settings/secrets/{id}/details` | Opens secret details page |
| DLP-404-006 | Template | `/settings/templates/{id}/...` | Opens template page |
| DLP-404-007 | User Group | `/settings/access-control/user-groups/{id}` | Opens user group page |
| DLP-404-008 | Role | `/settings/access-control/roles/{id}` | Opens role page |

**Test Procedure:**
```
1. Create or Get a resource using MCP v2
2. Extract the `openInHarness` URL from the response
3. Open the URL in a browser
4. Verify: Page loads without 404 error
5. Verify: Correct resource is displayed (identifier matches)
```

**Common 404 Causes:**
- Missing `/settings/` prefix in URL path
- Missing `/details` suffix where required
- Using `/setup/` instead of `/settings/`
- Placeholder `{identifier}` not replaced with actual value
- Resource created at wrong scope (account vs project)

**Curl Verification (Independent of MCP):**
```bash
# After creating a resource, verify the deep link manually
# Example for environment:
curl -s 'https://qa.harness.io/ng/api/environmentsV2/YOUR_ENV_ID?accountIdentifier=ACC&orgIdentifier=ORG&projectIdentifier=PROJ' \
  -H 'x-api-key: YOUR_TOKEN' | jq '.data.openInHarness // "No deep link in response"'

# Then open the URL in browser and verify no 404
```

**Known Correct URL Patterns (as of March 2026):**
| Resource | URL Pattern |
|----------|-------------|
| Environment | `/ng/account/{acc}/all/orgs/{org}/projects/{proj}/settings/environments/{id}/details` |
| Service | `/ng/account/{acc}/all/orgs/{org}/projects/{proj}/settings/services/{id}` |
| Connector | `/ng/account/{acc}/all/orgs/{org}/projects/{proj}/settings/connectors/{id}` |
| Pipeline | `/ng/account/{acc}/all/orgs/{org}/projects/{proj}/pipelines/{id}/pipeline-studio?storeType=INLINE` |

---

## 7. Scope-Based Testing

### 7.1 Account Scope Resources

Resources that operate at account level:
- Users
- Roles
- Delegates
- Dashboards

**Test:** Verify these resources return account-wide data by default.

### 7.2 Project Scope Resources

Resources that require org/project context:
- Connectors, Secrets, Services, Environments, Infrastructure
- Pipelines, Executions, Templates
- User Groups, Resource Groups, Role Assignments, Service Accounts

**Test:** Verify these resources filter by the specified org/project.

### 7.3 Dynamic Scoping

Account-scoped resources that support optional org/project filtering:
- Users (can filter by project membership)

**Test:** Verify that when org_id/project_id are explicitly provided, the results are filtered accordingly.

---

## 8. Pagination Testing

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| PAG-001 | List with default page size | Returns default number of items |
| PAG-002 | List with custom page size | Returns specified number of items |
| PAG-003 | List page 2 | Returns next set of items |
| PAG-004 | Verify total count | Total count matches across pages |

**Sample Test:**
```
v2: "List first 5 pipelines"
v2: "List next 5 pipelines (page 2)"
```

---

## 9. Filter Testing

| Test ID | Test Case | Resource | Filter |
|---------|-----------|----------|--------|
| FLT-001 | Filter by search term | Pipelines | `search_term="deploy"` |
| FLT-002 | Filter by status | Executions | `status="Failed"` |
| FLT-003 | Filter by type | Connectors | `type="Github"` |
| FLT-004 | Filter by environment | Infrastructure | `environment_id="preprod"` |

---

## 10. Error Handling Testing

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| ERR-001 | Get non-existent resource | Appropriate error message |
| ERR-002 | List with invalid filter | Validation error |
| ERR-003 | Missing required parameter | Clear error indicating missing param |
| ERR-004 | Invalid scope | Scope validation error |

---

## 11. Test Execution Checklist

### Pre-Test Setup
- [ ] Verify MCP v1 server is running
- [ ] Verify MCP v2 server is running
- [ ] Confirm test account credentials
- [ ] Verify test data exists in target project

### Test Execution
- [ ] Execute all List operation tests
- [ ] Execute all Get operation tests
- [ ] Execute CRUD lifecycle tests (Create → GET verify → List verify → Update → GET verify → Delete → GET verify)
- [ ] Execute scope persistence validation (SCP-001 through SCP-005)
- [ ] Execute deep link validation (DLP-001 through DLP-003)
- [ ] Execute Execute action tests
- [ ] Execute Diagnose tests
- [ ] Execute pagination tests
- [ ] Execute filter tests
- [ ] Execute error handling tests

### Post-Test
- [ ] Document any discrepancies
- [ ] File bugs for failures
- [ ] Update comparison report

---

## 12. Known Differences

| Resource | Difference | Reason |
|----------|------------|--------|
| Templates | v1 uses REST-style API, v2 uses NG filter-style | Different API paradigms, both valid |
| Infrastructure | Requires `environment_id` filter | API design - infrastructures belong to environments |
| Dashboards | Requires module tags for filtering | API design - dashboards are module-specific |
| **Env/Svc/Connector Create** | API returns 200 SUCCESS but creates at account scope if `orgIdentifier`/`projectIdentifier` missing from body | Harness API quirk — query params alone are insufficient for scoping. Fix: inject org/project into request body for POST/PUT |
| **Deep Links (Create)** | `openInHarness` URL had `{placeholder}` instead of actual identifier for nested responses | Response structure is `{service: {identifier: "..."}}` — deep link resolver must search nested objects |

---

## 13. Appendix: Quick Reference

### v2 Tool Mapping

| Operation | v2 Tool |
|-----------|---------|
| List resources | `harness_list` |
| Get single resource | `harness_get` |
| Create resource | `harness_create` |
| Update resource | `harness_update` |
| Delete resource | `harness_delete` |
| Execute action | `harness_execute` |
| Diagnose issues | `harness_diagnose` |
| Search across types | `harness_search` |
| Project status | `harness_status` |
| Describe resources | `harness_describe` |

### Resource Type Identifiers

| Resource | `resource_type` value |
|----------|----------------------|
| Connector | `connector` |
| Secret | `secret` |
| Service | `service` |
| Environment | `environment` |
| Infrastructure | `infrastructure` |
| Pipeline | `pipeline` |
| Execution | `execution` |
| Template | `template` |
| Delegate | `delegate` |
| Dashboard | `dashboard` |
| User | `user` |
| Role | `role` |
| User Group | `user_group` |
| Resource Group | `resource_group` |
| Role Assignment | `role_assignment` |
| Service Account | `service_account` |
