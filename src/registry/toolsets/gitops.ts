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
      listFilterFields: ["search_term", "type"],
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
        "GitOps application managed by an agent. Supports list, get, and sync action.",
      toolset: "gitops",
      scope: "project",
      diagnosticHint: "Use harness_diagnose with resource_type='gitops_application', agent_id, and resource_id (app name) to analyze sync failures, health issues, and unhealthy K8s resources. Combines app status, resource tree, and recent events.",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: ["search_term"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications",
          pathParams: { agent_id: "agentIdentifier" },
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List GitOps applications for an agent",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get GitOps application details",
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
        },
      },
    },
    {
      resourceType: "gitops_cluster",
      displayName: "GitOps Cluster",
      description: "Kubernetes cluster registered with a GitOps agent. Supports list and get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "cluster_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/clusters",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/clusters",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "List clusters for a GitOps agent",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/clusters/{clusterIdentifier}",
          pathParams: {
            agent_id: "agentIdentifier",
            cluster_id: "clusterIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps cluster details",
        },
      },
    },
    {
      resourceType: "gitops_repository",
      displayName: "GitOps Repository",
      description:
        "Git repository registered with a GitOps agent. Supports list and get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "repo_id"],
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repositories",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "List repositories for a GitOps agent",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repositories/{repoIdentifier}",
          pathParams: {
            agent_id: "agentIdentifier",
            repo_id: "repoIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository details",
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
      listFilterFields: ["pod_name", "namespace", "container", "tail_lines"],
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
      listFilterFields: ["namespace", "resource_name", "kind"],
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
