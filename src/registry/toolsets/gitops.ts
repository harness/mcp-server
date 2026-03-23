import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const gitopsToolset: ToolsetDefinition = {
  name: "gitops",
  displayName: "GitOps",
  description:
    "Harness GitOps — agents, applications, clusters, and repositories",
  resources: [
    {
      resourceType: "gitops_agent",
      displayName: "GitOps Agent",
      description: "GitOps agent (Argo CD instance). Supports list and get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter GitOps agents by name or keyword" },
        { name: "type", description: "Agent type filter", enum: ["MANAGED_ARGO_PROVIDER", "HOSTED_ARGO_PROVIDER"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/agents/{agentIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents",
          queryParams: {
            search_term: "searchTerm",
            type: "type",
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List GitOps agents",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "Get GitOps agent details",
        },
      },
    },
    {
      resourceType: "gitops_application",
      displayName: "GitOps Application",
      description:
        "GitOps application managed by an agent. List returns all apps in project (no agent required). Get/sync require agent_id.",
      toolset: "gitops",
      scope: "project",
      diagnosticHint: "Use harness_diagnose with resource_type='gitops_application', agent_id, and resource_id (app name) to analyze sync failures, health issues, and unhealthy K8s resources. Combines app status, resource tree, and recent events.",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "search_term", description: "Filter GitOps applications by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/applications",
          bodyBuilder: (input) => ({
            pageIndex: typeof input.page === "number" ? input.page : 0,
            pageSize: typeof input.size === "number" ? input.size : 20,
            searchTerm: input.search_term ?? "",
            metadataOnly: true,
          }),
          responseExtractor: passthrough,
          description: "List all GitOps applications in the project",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get GitOps application details (requires agent_id)",
        },
      },
      executeActions: {
        sync: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/sync",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          actionDescription: "Sync a GitOps application",
          bodySchema: {
            description: "Sync options",
            fields: [
              { name: "prune", type: "boolean", required: false, description: "Prune resources not in git" },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate sync without executing" },
              { name: "revision", type: "string", required: false, description: "Target revision to sync to" },
            ],
          },
        },
      },
    },
    {
      resourceType: "gitops_cluster",
      displayName: "GitOps Cluster",
      description:
        "Kubernetes cluster registered with GitOps. List returns all clusters in project (no agent required). Get requires agent_id.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "cluster_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter clusters by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/clusters",
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/clusters",
          bodyBuilder: (input) => ({
            pageIndex: typeof input.page === "number" ? input.page : 0,
            pageSize: typeof input.size === "number" ? input.size : 20,
            searchTerm: input.search_term ?? "",
          }),
          responseExtractor: passthrough,
          description: "List all GitOps clusters in the project",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/clusters/{clusterIdentifier}",
          pathParams: {
            agent_id: "agentIdentifier",
            cluster_id: "clusterIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps cluster details (requires agent_id)",
        },
      },
    },
    {
      resourceType: "gitops_repository",
      displayName: "GitOps Repository",
      description:
        "Git repository registered with GitOps. List returns all repositories in project (no agent required). Get requires agent_id.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "repo_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter repositories by name or URL" },
        { name: "repo_creds_id", description: "Filter by repository credentials ID" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/repositories",
          bodyBuilder: (input) => ({
            pageIndex: typeof input.page === "number" ? input.page : 0,
            pageSize: typeof input.size === "number" ? input.size : 20,
            searchTerm: input.search_term ?? "",
            repoCredsId: input.repo_creds_id ?? "",
          }),
          responseExtractor: passthrough,
          description: "List all GitOps repositories in the project",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repositories/{repoIdentifier}",
          pathParams: {
            agent_id: "agentIdentifier",
            repo_id: "repoIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository details (requires agent_id)",
        },
      },
    },
    {
      resourceType: "gitops_applicationset",
      displayName: "GitOps ApplicationSet",
      description: "GitOps ApplicationSet for templated application generation. Supports list and get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "appset_name"],
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applicationsets",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description: "List GitOps ApplicationSets",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applicationsets/{appsetName}",
          pathParams: {
            agent_id: "agentIdentifier",
            appset_name: "appsetName",
          },
          responseExtractor: passthrough,
          description: "Get GitOps ApplicationSet details",
        },
      },
    },
    {
      resourceType: "gitops_repo_credential",
      displayName: "GitOps Repository Credential",
      description: "Repository credentials for GitOps agent. Supports list and get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "credential_id"],
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repocreds",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description: "List GitOps repository credentials",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repocreds/{credentialId}",
          pathParams: {
            agent_id: "agentIdentifier",
            credential_id: "credentialId",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository credential details",
        },
      },
    },
    {
      resourceType: "gitops_app_event",
      displayName: "GitOps App Event",
      description: "Events for a GitOps application. Supports list.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "agent_id", description: "GitOps agent identifier", required: true },
        { name: "app_name", description: "GitOps application name", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/events",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "List events for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_pod_log",
      displayName: "GitOps Pod Log",
      description: "Pod logs for a GitOps application. Supports get with pod_name, namespace, container, tail_lines.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "pod_name", description: "Pod name filter" },
        { name: "namespace", description: "Kubernetes namespace filter" },
        { name: "container", description: "Container name filter" },
        { name: "tail_lines", description: "Number of log lines to tail", type: "number" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/logs",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            pod_name: "podName",
            namespace: "namespace",
            container: "container",
            tail_lines: "tailLines",
          },
          responseExtractor: passthrough,
          description: "Get pod logs for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_managed_resource",
      displayName: "GitOps Managed Resource",
      description: "Managed Kubernetes resources for a GitOps application. Supports list.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "agent_id", description: "GitOps agent identifier", required: true },
        { name: "app_name", description: "GitOps application name", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/managed-resources",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "List managed resources for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_resource_action",
      displayName: "GitOps Resource Action",
      description: "Available actions for a specific resource in a GitOps application. Supports list with namespace, resource_name, kind.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "namespace", description: "Kubernetes namespace filter" },
        { name: "resource_name", description: "Resource name filter" },
        { name: "kind", description: "Kubernetes resource kind filter" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource/actions",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            namespace: "namespace",
            resource_name: "resourceName",
            kind: "kind",
          },
          responseExtractor: passthrough,
          description: "List available actions for a resource in a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_dashboard",
      displayName: "GitOps Dashboard",
      description: "GitOps dashboard overview with summary metrics. Supports get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: [],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops",
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/dashboard/overview",
          responseExtractor: passthrough,
          description: "Get GitOps dashboard overview with summary metrics",
        },
      },
    },
    {
      resourceType: "gitops_app_resource_tree",
      displayName: "GitOps App Resource Tree",
      description: "Kubernetes resource tree for a GitOps application. Supports get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource-tree",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get the Kubernetes resource tree for a GitOps application",
        },
      },
    },
  ],
};
