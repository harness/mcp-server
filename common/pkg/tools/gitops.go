package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func ListAgentsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_agents",
			mcp.WithDescription(`List all GitOps agents in Harness.

GitOps agents are the ArgoCD instances that manage application deployments.
Agents can be scoped at ACCOUNT, ORG, or PROJECT level.

**SCOPE BEHAVIOR:**
- **Account-level**: Do NOT pass org_id or project_id
- **Org-level**: Pass org_id only (no project_id)  
- **Project-level**: Pass both org_id AND project_id

**Use this tool to answer:**
- "What GitOps agents are available?"
- "Which agents are healthy/connected?"
- "Show me all account-level agents"
- "List agents across all scopes"

**Response includes for each agent:**
- Agent name, identifier, and scope (ACCOUNT/ORG/PROJECT)
- Health status of ArgoCD components
- Connection status and last heartbeat
- Version information
- Agent type (managed vs hosted)`),
			common.WithOptionalScope(config),
			WithPagination(),
			mcp.WithString("type",
				mcp.Description("Optional: Filter by agent type (MANAGED_ARGO_PROVIDER or HOSTED_ARGO_PROVIDER)"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional: Search term to filter agents by name"),
			),
			mcp.WithBoolean("include_all_scopes",
				mcp.Description("Set to true to list agents from ALL scopes (account, org, project) ignoring the current scope."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentType, _ := OptionalParam[string](request, "type")
			searchTerm, _ := OptionalParam[string](request, "search_term")
			includeAllScopes, _ := OptionalParam[bool](request, "include_all_scopes")

			data, err := client.ListAgents(ctx, scope, agentType, searchTerm, page, size, includeAllScopes)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list agents response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetAgentTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_agent",
			mcp.WithDescription(`Get detailed information about a single GitOps agent.

**Use this tool to answer:**
- "Show me details of agent X"
- "What's the health status of this agent?"
- "What version is this agent running?"
- "What clusters are connected to this agent?"
- "What namespace is this agent deployed in?"

**Response includes:**
- All fields from list (name, identifier, health, version, etc.)
- Full health details for each ArgoCD component
- Credentials and connection info
- Operator information
- Upgrade availability
- Disaster recovery node info (if configured)

**SCOPE BEHAVIOR:**
- **Account-level agent**: Do NOT pass org_id or project_id
- **Org-level agent**: Pass org_id only (no project_id)
- **Project-level agent**: Pass both org_id AND project_id`),
			common.WithOptionalScope(config),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetAgent(ctx, scope, agentIdentifier)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get agent response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListApplicationsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_applications",
			mcp.WithDescription(`List all ArgoCD applications managed by Harness GitOps.

Returns a list of applications with their sync status, health status, source repository, 
and destination cluster/namespace.

**Use this tool to answer:**
- "What GitOps applications are deployed?"
- "Which applications are out of sync?"
- "What apps are managed by a specific agent?"
- "Show me applications deployed to a specific cluster"
- "Show me applications deployed to a specific namespace"

**Response includes for each application:**
- Application name and identifiers
- Agent that manages the application
- Source: Git repo URL, path, target revision
- Destination: Kubernetes server and namespace
- Sync status: Synced, OutOfSync, Unknown
- Health status: Healthy, Progressing, Degraded, Missing

**NOTE:** This returns summary data only. For full details (resources, history, conditions), 
use gitops_get_application for each app.`),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional: Filter by GitOps agent identifier (e.g., 'account.myagent')"),
			),
			mcp.WithString("cluster_identifier",
				mcp.Description("Optional: Filter by cluster identifier"),
			),
			mcp.WithString("repo_identifier",
				mcp.Description("Optional: Filter by repository identifier"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional: Search term to filter applications by name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, _ := OptionalParam[string](request, "agent_identifier")
			clusterIdentifier, _ := OptionalParam[string](request, "cluster_identifier")
			repoIdentifier, _ := OptionalParam[string](request, "repo_identifier")
			searchTerm, _ := OptionalParam[string](request, "search_term")

			data, err := client.ListApplications(ctx, scope, agentIdentifier, clusterIdentifier, repoIdentifier, searchTerm, page, size)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list applications response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetApplicationTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_application",
			mcp.WithDescription(`Get detailed information about a single ArgoCD application managed by Harness GitOps.

Returns complete application details including resources, sync history, and operation state.

**Use this tool to answer:**
- "Show me details of application X"
- "What resources are deployed by this application?"
- "What's the sync history of this app?"
- "Why is this application unhealthy?"
- "What images are deployed in this application?"

**Response includes:**
- All fields from list (name, source, destination, status, etc.)
- **Resources**: List of all Kubernetes resources with their sync/health status
- **Conditions**: Any warnings or errors on the application
- **Operation State**: Current/last sync operation details
- **History**: Deployment revision history`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
			mcp.WithString("application_name",
				mcp.Description("Name of the application to retrieve"),
				mcp.Required(),
			),
			mcp.WithString("refresh",
				mcp.Description("Optional: Set to 'normal' (refresh if source changed) or 'hard' (force regenerate manifests) to refresh before fetching"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			applicationName, err := RequiredParam[string](request, "application_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			refresh, _ := OptionalParam[string](request, "refresh")

			data, err := client.GetApplication(ctx, scope, agentIdentifier, applicationName, refresh)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get application response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetApplicationResourceTreeTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_app_resource_tree",
			mcp.WithDescription(`Get the complete resource tree for an ArgoCD application.

Shows all Kubernetes resources deployed by the application with their health status and parent-child relationships.

**Use this tool to answer:**
- "What resources are deployed by this application?"
- "Show me the pod hierarchy for this app"
- "Which resources are unhealthy?"
- "What's the relationship between resources?"
- "How many replicas are running?"

**Response includes:**
- **Nodes**: All K8s resources (Deployments, Services, Pods, ConfigMaps, etc.)
- **Resource Info**: Kind, name, namespace, version, UID
- **Health Status**: Healthy, Progressing, Degraded, Missing for each resource
- **Sync Status**: Synced, OutOfSync for each resource
- **Parent References**: Parent-child relationships between resources
- **Images**: Container images used by pod resources
- **Network Info**: Ingress URLs and external IPs
- **Orphaned Nodes**: Resources no longer managed by the app`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
			mcp.WithString("application_name",
				mcp.Description("Name of the application"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			applicationName, err := RequiredParam[string](request, "application_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetApplicationResourceTree(ctx, scope, agentIdentifier, applicationName)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal resource tree response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListApplicationEventsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_app_events",
			mcp.WithDescription(`List Kubernetes events for an ArgoCD application or specific resource.

Shows events like pod scheduling, image pulls, errors, and warnings.

**Use this tool to answer:**
- "What events occurred for this application?"
- "Why did this pod fail to schedule?"
- "Show me recent deployment events"
- "What warnings are there for this app?"

**Response includes:**
- **Event Type**: Normal, Warning
- **Reason**: SuccessfulCreate, FailedScheduling, Pulled, Created, Started, etc.
- **Message**: Detailed event description
- **Timestamp**: When the event occurred
- **Count**: How many times the event occurred
- **Involved Object**: Resource that triggered the event
- **Source**: Component that reported the event`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier"),
				mcp.Required(),
			),
			mcp.WithString("application_name",
				mcp.Description("Name of the application"),
				mcp.Required(),
			),
			mcp.WithString("resource_name",
				mcp.Description("Optional: Filter events for a specific resource name"),
			),
			mcp.WithString("resource_namespace",
				mcp.Description("Optional: Filter events for a specific namespace"),
			),
			mcp.WithString("resource_uid",
				mcp.Description("Optional: Filter events for a specific resource UID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			applicationName, err := RequiredParam[string](request, "application_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resourceName, _ := OptionalParam[string](request, "resource_name")
			resourceNamespace, _ := OptionalParam[string](request, "resource_namespace")
			resourceUID, _ := OptionalParam[string](request, "resource_uid")

			data, err := client.ListApplicationEvents(ctx, scope, agentIdentifier, applicationName, resourceName, resourceNamespace, resourceUID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal events response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetPodLogsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_pod_logs",
			mcp.WithDescription(`Get container logs from a pod in an ArgoCD application.

Retrieves logs from running or terminated containers.

**Use this tool to answer:**
- "Show me logs from pod X"
- "What errors are in the application logs?"
- "Show the last 100 lines of logs"
- "What's happening in this container?"
- "Debug why this pod is failing"

**Response includes:**
- **Log Lines**: Container stdout/stderr output
- **Timestamps**: When each log line was written (if available)
- **Container Name**: Which container produced the logs`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier"),
				mcp.Required(),
			),
			mcp.WithString("application_name",
				mcp.Description("Name of the application"),
				mcp.Required(),
			),
			mcp.WithString("pod_name",
				mcp.Description("Name of the pod to get logs from"),
				mcp.Required(),
			),
			mcp.WithString("namespace",
				mcp.Description("Namespace where the pod is running"),
				mcp.Required(),
			),
			mcp.WithString("container",
				mcp.Description("Optional: Specific container name (defaults to main container)"),
			),
			mcp.WithNumber("tail_lines",
				mcp.Description("Number of lines to return from the end of logs (default: 100)"),
				mcp.DefaultNumber(100),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			applicationName, err := RequiredParam[string](request, "application_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			podName, err := RequiredParam[string](request, "pod_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			namespace, err := RequiredParam[string](request, "namespace")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			container, _ := OptionalParam[string](request, "container")
			tailLines, _ := OptionalParamWithDefault[float64](request, "tail_lines", 100)

			data, err := client.GetPodLogs(ctx, scope, agentIdentifier, applicationName, podName, namespace, container, int(tailLines))
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal pod logs response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetManagedResourcesTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_managed_resources",
			mcp.WithDescription(`Get all managed resources for an ArgoCD application with live manifests and diffs.

Shows the actual Kubernetes manifests being managed and any differences from desired state.

**Use this tool to answer:**
- "What resources are managed by this app?"
- "Show me the actual deployment manifest"
- "What's different between live and desired state?"
- "Is there any drift in this application?"
- "What's the current resource configuration?"

**Response includes:**
- **Resource List**: All managed K8s resources
- **Live State**: Current manifest from cluster
- **Target State**: Desired manifest from Git
- **Diff**: Differences between live and target (if out of sync)
- **Resource Details**: Kind, name, namespace, group, version`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier"),
				mcp.Required(),
			),
			mcp.WithString("application_name",
				mcp.Description("Name of the application"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			applicationName, err := RequiredParam[string](request, "application_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetManagedResources(ctx, scope, agentIdentifier, applicationName)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal managed resources response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListResourceActionsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_resource_actions",
			mcp.WithDescription(`List available actions for a specific resource in an ArgoCD application.

Shows what operations can be performed on a resource (like restart, scale, etc.).

**Use this tool to answer:**
- "What actions can I perform on this deployment?"
- "Can I restart this pod?"
- "What operations are available for this resource?"
- "Is scaling enabled for this deployment?"

**Response includes:**
- **Action Names**: Available actions (e.g., restart, resume, pause)
- **Action Parameters**: Required/optional parameters for each action
- **Disabled State**: Whether action is currently available
- **Action Descriptions**: What each action does`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier"),
				mcp.Required(),
			),
			mcp.WithString("application_name",
				mcp.Description("Name of the application"),
				mcp.Required(),
			),
			mcp.WithString("resource_name",
				mcp.Description("Name of the resource"),
				mcp.Required(),
			),
			mcp.WithString("namespace",
				mcp.Description("Namespace of the resource"),
				mcp.Required(),
			),
			mcp.WithString("kind",
				mcp.Description("Kind of the resource (e.g., Deployment, StatefulSet, Pod)"),
				mcp.Required(),
			),
			mcp.WithString("group",
				mcp.Description("Optional: API group of the resource (e.g., apps, batch)"),
			),
			mcp.WithString("version",
				mcp.Description("Optional: API version of the resource (e.g., v1, v1beta1)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			applicationName, err := RequiredParam[string](request, "application_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resourceName, err := RequiredParam[string](request, "resource_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			namespace, err := RequiredParam[string](request, "namespace")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			kind, err := RequiredParam[string](request, "kind")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			group, _ := OptionalParam[string](request, "group")
			version, _ := OptionalParam[string](request, "version")

			data, err := client.ListResourceActions(ctx, scope, agentIdentifier, applicationName, resourceName, namespace, kind, group, version)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal resource actions response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListApplicationSetsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_applicationsets",
			mcp.WithDescription(`List all ApplicationSets managed by Harness GitOps.

ApplicationSets are templates that generate multiple Applications from a single definition.

**Use this tool to answer:**
- "What ApplicationSets are defined?"
- "Show me app templates"
- "How many apps does this ApplicationSet generate?"
- "What generators are being used?"

**Response includes for each ApplicationSet:**
- ApplicationSet name and identifier
- Generator type (list, cluster, git, etc.)
- Template specification
- Generated applications count
- Sync status`),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional: Filter by GitOps agent identifier"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional: Search term to filter ApplicationSets by name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, _ := OptionalParam[string](request, "agent_identifier")
			searchTerm, _ := OptionalParam[string](request, "search_term")

			data, err := client.ListApplicationSets(ctx, scope, agentIdentifier, searchTerm, page, size)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list applicationsets response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetApplicationSetTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_applicationset",
			mcp.WithDescription(`Get detailed information about a single ApplicationSet by its identifier.

Returns the complete ApplicationSet specification including generators, template, and sync policy.

**Use this tool to answer:**
- "Show me details of ApplicationSet with ID X"
- "What generators does this ApplicationSet use?"
- "What template is configured?"
- "What's the sync policy for this ApplicationSet?"

**NOTE:** The identifier is the UUID of the ApplicationSet, which can be obtained from the 
gitops_list_applicationsets response (look for the 'identifier' field or metadata.uid).

**Response includes:**
- Full ApplicationSet specification
- Generators configuration (list, cluster, git, matrix, merge, etc.)
- Template definition (source, destination, syncPolicy)
- Sync policy settings
- Status and conditions
- Generated applications list`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
			mcp.WithString("identifier",
				mcp.Description("ApplicationSet identifier (UUID). Get this from gitops_list_applicationsets response."),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identifier, err := RequiredParam[string](request, "identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetApplicationSet(ctx, scope, agentIdentifier, identifier)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get applicationset response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListClustersTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_clusters",
			mcp.WithDescription(`List all clusters registered in Harness GitOps.

Clusters are Kubernetes clusters where ArgoCD can deploy applications.

**SCOPE BEHAVIOR:**
- **Account-level clusters**: Do NOT pass org_id or project_id
- **Org-level clusters**: Pass org_id only (no project_id)
- **Project-level clusters**: Pass both org_id AND project_id

**Use this tool to answer:**
- "What clusters are available?"
- "Which clusters are connected?"
- "Show me all deployment targets"
- "List clusters for a specific agent"

**Response includes for each cluster:**
- Cluster name and identifier
- Server URL (Kubernetes API endpoint)
- Connection status
- Agent that manages the cluster
- Namespaces (if configured)
- Labels and annotations`),
			common.WithOptionalScope(config),
			WithPagination(),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional: Filter clusters by GitOps agent identifier"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional: Search term to filter clusters by name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, _ := OptionalParam[string](request, "agent_identifier")
			searchTerm, _ := OptionalParam[string](request, "search_term")

			data, err := client.ListClusters(ctx, scope, agentIdentifier, searchTerm, page, size)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list clusters response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetClusterTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_cluster",
			mcp.WithDescription(`Get detailed information about a single cluster.

Returns the complete cluster configuration including connection info and namespaces.

**Use this tool to answer:**
- "Show me details of cluster X"
- "What's the server URL for this cluster?"
- "What namespaces are configured?"
- "Is this cluster connected?"

**Response includes:**
- Full cluster specification
- Server URL (Kubernetes API endpoint)
- Connection status and info
- Configured namespaces
- Labels and annotations
- TLS configuration

**SCOPE BEHAVIOR:**
- **Account-level cluster**: Do NOT pass org_id or project_id
- **Org-level cluster**: Pass org_id only (no project_id)
- **Project-level cluster**: Pass both org_id AND project_id`),
			common.WithOptionalScope(config),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
			mcp.WithString("identifier",
				mcp.Description("Cluster identifier"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identifier, err := RequiredParam[string](request, "identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCluster(ctx, scope, agentIdentifier, identifier)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get cluster response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GitOpsListRepositoriesTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_repositories",
			mcp.WithDescription(`List all Git/Helm repositories registered in Harness GitOps.

Repositories are the source locations where ArgoCD pulls application manifests from.

**SCOPE BEHAVIOR:**
- **Account-level repos**: Do NOT pass org_id or project_id
- **Org-level repos**: Pass org_id only (no project_id)
- **Project-level repos**: Pass both org_id AND project_id

**Use this tool to answer:**
- "What repositories are configured?"
- "Which repos are connected?"
- "Show me all Git sources for this project"
- "List repositories for a specific agent"

**Response includes for each repository:**
- Repository URL
- Connection status (connected/failed)
- Repository type (git/helm)
- Agent that manages the repository
- Credentials reference (if any)`),
			common.WithOptionalScope(config),
			WithPagination(),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional: Filter repositories by GitOps agent identifier"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional: Search term to filter repositories by name/URL"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, _ := OptionalParam[string](request, "agent_identifier")
			searchTerm, _ := OptionalParam[string](request, "search_term")

			data, err := client.ListRepositories(ctx, scope, agentIdentifier, searchTerm, page, size)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list repositories response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GitOpsGetRepositoryTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_repository",
			mcp.WithDescription(`Get detailed information about a single repository.

Returns the complete repository configuration including connection info and credentials reference.

**Use this tool to answer:**
- "Show me details of repository X"
- "What's the URL for this repository?"
- "Is this repository connected?"
- "What credentials does this repo use?"

**Response includes:**
- Full repository specification
- Repository URL
- Connection status
- Repository type (git/helm)
- Credentials reference
- Project and labels

**SCOPE BEHAVIOR:**
- **Account-level repo**: Do NOT pass org_id or project_id
- **Org-level repo**: Pass org_id only (no project_id)
- **Project-level repo**: Pass both org_id AND project_id`),
			common.WithOptionalScope(config),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
			mcp.WithString("identifier",
				mcp.Description("Repository identifier"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identifier, err := RequiredParam[string](request, "identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetRepository(ctx, scope, agentIdentifier, identifier)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get repository response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListRepoCredentialsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_list_repo_credentials",
			mcp.WithDescription(`List all repository credential templates in Harness GitOps.

Repository credentials are reusable authentication templates that can be applied to multiple repositories 
matching a URL pattern.

**SCOPE BEHAVIOR:**
- **Account-level credentials**: Do NOT pass org_id or project_id
- **Org-level credentials**: Pass org_id only (no project_id)
- **Project-level credentials**: Pass both org_id AND project_id

**Use this tool to answer:**
- "What repository credentials are configured?"
- "Which credential templates exist?"
- "Show me all Git auth templates for this project"
- "List credentials for a specific agent"

**Response includes for each credential:**
- Credential identifier
- URL pattern (e.g., https://github.com/myorg/*)
- Credential type (SSH, HTTPS, GitHub App)
- Username (if applicable)
- Agent that manages the credential`),
			common.WithOptionalScope(config),
			WithPagination(),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional: Filter credentials by GitOps agent identifier"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional: Search term to filter credentials"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, _ := OptionalParam[string](request, "agent_identifier")
			searchTerm, _ := OptionalParam[string](request, "search_term")

			data, err := client.ListRepoCredentials(ctx, scope, agentIdentifier, searchTerm, page, size)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list repo credentials response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetRepoCredentialsTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_repo_credentials",
			mcp.WithDescription(`Get detailed information about a single repository credential template.

Returns the complete credential configuration including URL pattern and type.

**Use this tool to answer:**
- "Show me details of repository credential X"
- "What URL pattern does this GitOps repo credential cover?"
- "What authentication type is configured for this credential template?"

**Response includes:**
- Full credential specification
- URL pattern
- Credential type (SSH, HTTPS, GitHub App)
- Username (if applicable)
- Associated repositories

**SCOPE BEHAVIOR:**
- **Account-level credential**: Do NOT pass org_id or project_id
- **Org-level credential**: Pass org_id only (no project_id)
- **Project-level credential**: Pass both org_id AND project_id`),
			common.WithOptionalScope(config),
			mcp.WithString("agent_identifier",
				mcp.Description("GitOps agent identifier (e.g., 'account.myagent' or 'myagent')"),
				mcp.Required(),
			),
			mcp.WithString("identifier",
				mcp.Description("Repository credential identifier"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchOptionalScope(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, err := RequiredParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identifier, err := RequiredParam[string](request, "identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetRepoCredentials(ctx, scope, agentIdentifier, identifier)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get repo credentials response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetDashboardOverviewTool(config *config.McpServerConfig, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("gitops_get_dashboard_overview",
			mcp.WithDescription(`Get an overview of the GitOps dashboard with key metrics.

Returns aggregate statistics about applications, clusters, and repositories.

**Use this tool to answer:**
- "What's the overall status of my GitOps deployments?"
- "How many applications are healthy vs degraded?"
- "Give me a summary of my GitOps project"
- "What are the key metrics for this GitOps project?"

**Response includes:**
- Application status counts (healthy, degraded, progressing, suspended)
- Sync status counts (synced, out of sync, unknown)
- Total application count
- Total cluster count
- Total repository count`),
			common.WithScope(config, false),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional: Filter dashboard by specific GitOps agent"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			agentIdentifier, _ := OptionalParam[string](request, "agent_identifier")

			data, err := client.GetDashboardOverview(ctx, scope, agentIdentifier)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal dashboard overview response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// Helper function for optional parameters with defaults
func OptionalParamWithDefault[T any](request mcp.CallToolRequest, paramName string, defaultValue T) (T, error) {
	val, err := OptionalParam[T](request, paramName)
	if err != nil || isZeroValue(val) {
		return defaultValue, nil
	}
	return val, nil
}

func isZeroValue[T any](val T) bool {
	return fmt.Sprintf("%v", val) == fmt.Sprintf("%v", *new(T))
}

