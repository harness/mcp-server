package harness

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListGitOpsApplicationsTool creates a tool for listing GitOps applications
// https://apidocs.harness.io/tag/Application#operation/ApplicationService_ListApps
func ListGitOpsApplicationsTool(config *config.Config, client *client.GitOpsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_gitops_applications",
			mcp.WithDescription("List GitOps applications in Harness."),
			mcp.WithString("app_name",
				mcp.Description("Optional filter for application name"),
			),
			mcp.WithString("namespace",
				mcp.Description("Optional filter for namespace"),
			),
			mcp.WithString("health",
				mcp.Description("Optional filter for application health (e.g., Healthy, Degraded)"),
			),
			mcp.WithString("sync_status",
				mcp.Description("Optional filter for sync status (e.g., Synced, OutOfSync)"),
			),
			mcp.WithArray("clusters",
				mcp.Description("Optional list of cluster names to filter by"),
			),
			mcp.WithArray("projects",
				mcp.Description("Optional list of project names to filter by"),
			),
			mcp.WithNumber("offset",
				mcp.DefaultNumber(0),
				mcp.Description("Offset for pagination"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Maximum number of applications to return"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.GitOpsApplicationOptions{}

			// Handle pagination
			offset, err := OptionalParam[float64](request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if offset >= 0 {
				opts.Offset = int(offset)
			}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle filters
			appName, err := OptionalParam[string](request, "app_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.AppName = appName

			namespace, err := OptionalParam[string](request, "namespace")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.Namespace = namespace

			health, err := OptionalParam[string](request, "health")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.Health = health

			syncStatus, err := OptionalParam[string](request, "sync_status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.SyncStatus = syncStatus

			// Handle array parameters - get directly from parameters to avoid comparable constraint issues
			clustersParam, clustersOk := request.Params.Arguments["clusters"]
			clustersRaw := make([]interface{}, 0)
			if clustersOk && clustersParam != nil {
				if clusters, ok := clustersParam.([]interface{}); ok {
					clustersRaw = clusters
				}
			}
			if len(clustersRaw) > 0 {
				clusters := make([]string, 0, len(clustersRaw))
				for _, c := range clustersRaw {
					if cluster, ok := c.(string); ok {
						clusters = append(clusters, cluster)
					}
				}
				opts.Clusters = clusters
			}

			// Handle projects parameter - get directly from parameters to avoid comparable constraint issues
			projectsParam, projectsOk := request.Params.Arguments["projects"]
			projectsRaw := make([]interface{}, 0)
			if projectsOk && projectsParam != nil {
				if projects, ok := projectsParam.([]interface{}); ok {
					projectsRaw = projects
				}
			}
			if len(projectsRaw) > 0 {
				projects := make([]string, 0, len(projectsRaw))
				for _, p := range projectsRaw {
					if project, ok := p.(string); ok {
						projects = append(projects, project)
					}
				}
				opts.Projects = projects
			}

			applications, count, err := client.ListApplications(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list GitOps applications: %w", err)
			}

			// Create response with applications and metadata
			response := map[string]interface{}{
				"applications": applications,
				"count":       count,
				"offset":      opts.Offset,
				"limit":       opts.Limit,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal GitOps applications list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListGitOpsAgentApplicationsTool creates a tool for listing agent applications
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_List
func ListGitOpsAgentApplicationsTool(config *config.Config, client *client.GitOpsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_gitops_agent_applications",
			mcp.WithDescription("List applications managed by GitOps agents in Harness."),
			mcp.WithString("name",
				mcp.Description("Optional filter for application name"),
			),
			mcp.WithString("namespace",
				mcp.Description("Optional filter for namespace"),
			),
			mcp.WithString("cluster_id",
				mcp.Description("Optional filter for cluster ID"),
			),
			mcp.WithString("project",
				mcp.Description("Optional filter for project name"),
			),
			mcp.WithNumber("offset",
				mcp.DefaultNumber(0),
				mcp.Description("Offset for pagination"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Maximum number of applications to return"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.GitOpsAgentApplicationListOptions{}

			// Handle pagination
			offset, err := OptionalParam[float64](request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if offset >= 0 {
				opts.Offset = int(offset)
			}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle filters
			name, err := OptionalParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.Name = name

			namespace, err := OptionalParam[string](request, "namespace")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.Namespace = namespace

			clusterID, err := OptionalParam[string](request, "cluster_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.ClusterID = clusterID

			project, err := OptionalParam[string](request, "project")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.Project = project

			applications, err := client.ListAgentApplications(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list GitOps agent applications: %w", err)
			}

			// Create response with applications and metadata
			response := map[string]interface{}{
				"applications": applications,
				"count":       len(applications),
				"offset":      opts.Offset,
				"limit":       opts.Limit,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal GitOps agent applications list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetGitOpsManagedResourcesTool creates a tool for getting resources managed by a GitOps application
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_ManagedResources
func GetGitOpsManagedResourcesTool(config *config.Config, client *client.GitOpsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_gitops_managed_resources",
			mcp.WithDescription("Get resources managed by a GitOps application in Harness."),
			mcp.WithString("name",
				mcp.Required(),
				mcp.Description("Application name"),
			),
			mcp.WithString("namespace",
				mcp.Description("Optional application namespace"),
			),
			mcp.WithString("cluster_id",
				mcp.Required(),
				mcp.Description("Cluster ID"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get required parameters
			name, err := requiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			clusterID, err := requiredParam[string](request, "cluster_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get optional parameters
			namespace, err := OptionalParam[string](request, "namespace")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resources, err := client.GetManagedResources(ctx, scope, name, namespace, clusterID)
			if err != nil {
				return nil, fmt.Errorf("failed to get GitOps managed resources: %w", err)
			}

			// Create response
			response := map[string]interface{}{
				"resources": resources,
				"count":     len(resources),
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal GitOps managed resources: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetGitOpsPodLogsTool creates a tool for getting pod logs for a GitOps application
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_PodLogs
func GetGitOpsPodLogsTool(config *config.Config, client *client.GitOpsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_gitops_pod_logs",
			mcp.WithDescription("Get pod logs for a GitOps application in Harness."),
			mcp.WithString("name",
				mcp.Required(),
				mcp.Description("Application name"),
			),
			mcp.WithString("namespace",
				mcp.Description("Optional application namespace"),
			),
			mcp.WithString("cluster_id",
				mcp.Required(),
				mcp.Description("Cluster ID"),
			),
			mcp.WithString("pod_name",
				mcp.Required(),
				mcp.Description("Name of the pod to get logs for"),
			),
			mcp.WithString("container",
				mcp.Description("Optional container name (if not specified, logs from all containers will be retrieved)"),
			),
			mcp.WithBoolean("follow",
				// Default is false, but we don't use a DefaultBoolean function as it doesn't exist
				mcp.Description("Whether to follow logs (stream updates). Default is false."),
			),
			mcp.WithNumber("since_seconds",
				mcp.Description("Get logs from the last N seconds"),
			),
			mcp.WithNumber("tail_lines",
				mcp.Description("Number of lines from the end of the logs to show"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get required parameters
			name, err := requiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			clusterID, err := requiredParam[string](request, "cluster_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			podName, err := requiredParam[string](request, "pod_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get optional parameters
			namespace, err := OptionalParam[string](request, "namespace")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			container, err := OptionalParam[string](request, "container")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Default value for follow is false
			follow := false
			
			// Check if the parameter exists
			if followParam, ok := request.Params.Arguments["follow"]; ok && followParam != nil {
				if followBool, ok := followParam.(bool); ok {
					follow = followBool
				}
			}

			sinceSecs, err := OptionalParam[float64](request, "since_seconds")
			if err != nil {
				sinceSecs = 0
			}

			tailLines, err := OptionalParam[float64](request, "tail_lines")
			if err != nil {
				tailLines = 0
			}

			logs, err := client.GetPodLogs(ctx, scope, name, namespace, clusterID, podName, container, follow, int(sinceSecs), int(tailLines))
			if err != nil {
				return nil, fmt.Errorf("failed to get GitOps pod logs: %w", err)
			}

			// Create response
			response := map[string]interface{}{
				"logs": logs,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal GitOps pod logs: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetGitOpsClusterByNameTool creates a tool for getting a GitOps cluster by name
// https://apidocs.harness.io/tag/Clusters#operation/AgentClusterService_GetByName
func GetGitOpsClusterByNameTool(config *config.Config, client *client.GitOpsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_gitops_cluster",
			mcp.WithDescription("Get a GitOps cluster by name in Harness."),
			mcp.WithString("name",
				mcp.Required(),
				mcp.Description("Cluster name"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get required parameters
			name, err := requiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			cluster, err := client.GetClusterByName(ctx, scope, name)
			if err != nil {
				return nil, fmt.Errorf("failed to get GitOps cluster: %w", err)
			}

			r, err := json.Marshal(cluster)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal GitOps cluster: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
