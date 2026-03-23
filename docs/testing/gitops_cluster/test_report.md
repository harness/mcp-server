# Test Report: GitOps Cluster (`gitops_cluster`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_cluster` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_cluster-001 | List clusters for an agent | `harness_list(resource_type="gitops_cluster", agent_id="my_agent")` | Returns list of Kubernetes clusters | ✅ Passed | Returns empty list in AI_Devops/Sanity; 44 clusters on default/gitops2 |  |
| TC-gitops_cluster-002 | List with custom org/project | `harness_list(resource_type="gitops_cluster", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns clusters for specified project | ⬜ Pending | | |
| TC-gitops_cluster-003 | Get cluster by agent_id and cluster_id | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="my_cluster")` | Returns full cluster details | ⬜ Pending | | |
| TC-gitops_cluster-004 | Verify deep link in response | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="my_cluster")` | Response includes deep link URL | ⬜ Pending | | |
| TC-gitops_cluster-005 | List without agent_id | `harness_list(resource_type="gitops_cluster")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_cluster-006 | Get with missing agent_id | `harness_get(resource_type="gitops_cluster", cluster_id="my_cluster")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_cluster-007 | Get with missing cluster_id | `harness_get(resource_type="gitops_cluster", agent_id="my_agent")` | Error: cluster_id is required | ⬜ Pending | | |
| TC-gitops_cluster-008 | Get non-existent cluster | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="nonexistent")` | Error: cluster not found (404) | ⬜ Pending | | |
| TC-gitops_cluster-009 | List for agent with no clusters | `harness_list(resource_type="gitops_cluster", agent_id="empty_agent")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_cluster-010 | Get cluster with URL-encoded ID | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="https://kubernetes.default.svc")` | Returns in-cluster details | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
