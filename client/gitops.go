package client

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Application paths
	gitopsApplicationListPath           = "v1/applications"
	gitopsAgentApplicationListPath      = "v1/applications"
	gitopsAgentApplicationParentPath    = "v1/applications/%s/parent"
	gitopsAgentApplicationResourcesPath = "v1/applications/%s/resources"
	gitopsAgentApplicationTreePath      = "v1/applications/%s/resource-tree"
	gitopsAgentApplicationEventsPath    = "v1/applications/%s/events"
	gitopsAgentApplicationManifestsPath = "v1/applications/%s/manifests"
	gitopsAgentApplicationPodLogsPath   = "v1/applications/%s/pods/%s/logs"
	gitopsAgentApplicationRevisionPath  = "v1/applications/%s/revisions/%s/metadata"

	// Cluster paths
	gitopsClusterListPath       = "v1/clusters"
	gitopsClusterByURLPath      = "v1/clusters/by-url"
	gitopsClusterByNamePath     = "v1/clusters/%s"

	// Dashboard paths
	gitopsDashboardCountsPath   = "v1/dashboards/recently-created-counts"
	
	// Reconciliation paths
	gitopsReconcileCounts       = "v1/reconciliation/counts"
)

type GitOpsClient struct {
	Client *Client
}

// setDefaultPaginationForGitOpsApplication sets default pagination values for GitOpsApplicationOptions
func setDefaultPaginationForGitOpsApplication(opts *dto.GitOpsApplicationOptions) {
	if opts == nil {
		return
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}

	if opts.Limit <= 0 {
		opts.Limit = defaultPageSize
	} else if opts.Limit > maxPageSize {
		opts.Limit = maxPageSize
	}
}

// setDefaultPaginationForGitOpsAgentApplication sets default pagination for GitOpsAgentApplicationListOptions
func setDefaultPaginationForGitOpsAgentApplication(opts *dto.GitOpsAgentApplicationListOptions) {
	if opts == nil {
		return
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}

	if opts.Limit <= 0 {
		opts.Limit = defaultPageSize
	} else if opts.Limit > maxPageSize {
		opts.Limit = maxPageSize
	}
}

// setDefaultPaginationForGitOpsCluster sets default pagination for GitOpsClusterOptions
func setDefaultPaginationForGitOpsCluster(opts *dto.GitOpsClusterOptions) {
	if opts == nil {
		return
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}

	if opts.Limit <= 0 {
		opts.Limit = defaultPageSize
	} else if opts.Limit > maxPageSize {
		opts.Limit = maxPageSize
	}
}

// ===== Application API Methods =====

// ListApplications lists applications in GitOps
// https://apidocs.harness.io/tag/Application#operation/ApplicationService_ListApps
func (g *GitOpsClient) ListApplications(ctx context.Context, scope dto.Scope, opts *dto.GitOpsApplicationOptions) ([]dto.GitOpsApplication, int, error) {
	path := gitopsApplicationListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.GitOpsApplicationOptions{}
	}

	setDefaultPaginationForGitOpsApplication(opts)

	params["offset"] = fmt.Sprintf("%d", opts.Offset)
	params["limit"] = fmt.Sprintf("%d", opts.Limit)

	if opts.AppName != "" {
		params["appName"] = opts.AppName
	}
	if opts.Namespace != "" {
		params["namespace"] = opts.Namespace
	}
	if opts.Health != "" {
		params["health"] = opts.Health
	}
	if opts.SyncStatus != "" {
		params["syncStatus"] = opts.SyncStatus
	}
	
	// Handle array parameters
	if len(opts.Clusters) > 0 {
		params["clusters"] = strings.Join(opts.Clusters, ",")
	}
	if len(opts.Projects) > 0 {
		params["projects"] = strings.Join(opts.Projects, ",")
	}
	if len(opts.Repos) > 0 {
		params["repos"] = strings.Join(opts.Repos, ",")
	}
	if len(opts.Labels) > 0 {
		params["labels"] = strings.Join(opts.Labels, ",")
	}

	var response dto.GitOpsApplicationListResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list GitOps applications: %w", err)
	}

	return response.Applications, response.Count, nil
}

// ListAgentApplications lists applications from the agent
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_List
func (g *GitOpsClient) ListAgentApplications(ctx context.Context, scope dto.Scope, opts *dto.GitOpsAgentApplicationListOptions) ([]dto.GitOpsAgentApplication, error) {
	path := gitopsAgentApplicationListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.GitOpsAgentApplicationListOptions{}
	}

	setDefaultPaginationForGitOpsAgentApplication(opts)

	if opts.Name != "" {
		params["name"] = opts.Name
	}
	if opts.Namespace != "" {
		params["namespace"] = opts.Namespace
	}
	if opts.ClusterID != "" {
		params["clusterId"] = opts.ClusterID
	}
	if opts.Project != "" {
		params["project"] = opts.Project
	}
	params["offset"] = fmt.Sprintf("%d", opts.Offset)
	params["limit"] = fmt.Sprintf("%d", opts.Limit)

	var response dto.GitOpsAgentApplicationListResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list agent applications: %w", err)
	}

	return response.Items, nil
}

// GetApplicationParent gets the parent application from agent
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_Parent
func (g *GitOpsClient) GetApplicationParent(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string) (*dto.GitOpsAgentApplication, error) {
	if name == "" || clusterID == "" {
		return nil, fmt.Errorf("application name and clusterID are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationParentPath, url.PathEscape(name))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID

	var response dto.GitOpsApplicationParentResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get application parent: %w", err)
	}

	return &response.Parent, nil
}

// GetManagedResources gets managed resources for an application
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_ManagedResources
func (g *GitOpsClient) GetManagedResources(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string) ([]dto.GitOpsResource, error) {
	if name == "" || clusterID == "" {
		return nil, fmt.Errorf("application name and clusterID are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationResourcesPath, url.PathEscape(name))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID

	var response dto.GitOpsManagedResourcesResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get managed resources: %w", err)
	}

	return response.Items, nil
}

// GetResourceTree gets the resource tree for an application
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_ResourceTree
func (g *GitOpsClient) GetResourceTree(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string) ([]dto.GitOpsResourceTreeNode, error) {
	if name == "" || clusterID == "" {
		return nil, fmt.Errorf("application name and clusterID are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationTreePath, url.PathEscape(name))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID

	var response dto.GitOpsResourceTreeResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource tree: %w", err)
	}

	return response.Nodes, nil
}

// ListResourceEvents lists events for a resource
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_ListResourceEvents
func (g *GitOpsClient) ListResourceEvents(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string, resourceName string, resourceNamespace string, resourceUID string) ([]dto.GitOpsResourceEvent, error) {
	if name == "" || clusterID == "" {
		return nil, fmt.Errorf("application name and clusterID are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationEventsPath, url.PathEscape(name))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID
	
	if resourceName != "" {
		params["resourceName"] = resourceName
	}
	if resourceNamespace != "" {
		params["resourceNamespace"] = resourceNamespace
	}
	if resourceUID != "" {
		params["resourceUID"] = resourceUID
	}

	var response dto.GitOpsResourceEventsResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list resource events: %w", err)
	}

	return response.Items, nil
}

// GetManifests gets manifests for an application
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_GetManifests
func (g *GitOpsClient) GetManifests(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string, revision string) ([]dto.GitOpsManifest, error) {
	if name == "" || clusterID == "" {
		return nil, fmt.Errorf("application name and clusterID are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationManifestsPath, url.PathEscape(name))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID
	if revision != "" {
		params["revision"] = revision
	}

	var response dto.GitOpsManifestsResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get manifests: %w", err)
	}

	return response.Manifests, nil
}

// GetPodLogs gets logs for a pod
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_PodLogs
func (g *GitOpsClient) GetPodLogs(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string, podName string, container string, follow bool, sinceSecs int, tailLines int) ([]dto.GitOpsPodLog, error) {
	if name == "" || clusterID == "" || podName == "" {
		return nil, fmt.Errorf("application name, clusterID, and podName are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationPodLogsPath, url.PathEscape(name), url.PathEscape(podName))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID
	params["podName"] = podName
	
	if container != "" {
		params["container"] = container
	}
	params["follow"] = fmt.Sprintf("%t", follow)
	if sinceSecs > 0 {
		params["sinceSeconds"] = fmt.Sprintf("%d", sinceSecs)
	}
	if tailLines > 0 {
		params["tailLines"] = fmt.Sprintf("%d", tailLines)
	}

	var response dto.GitOpsPodLogsResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod logs: %w", err)
	}

	return response.Logs, nil
}

// GetRevisionMetadata gets metadata for a revision
// https://apidocs.harness.io/tag/Applications#operation/AgentApplicationService_RevisionMetadata
func (g *GitOpsClient) GetRevisionMetadata(ctx context.Context, scope dto.Scope, name string, namespace string, clusterID string, revision string) (*dto.GitOpsRevisionMetadata, error) {
	if name == "" || clusterID == "" || revision == "" {
		return nil, fmt.Errorf("application name, clusterID, and revision are required")
	}

	path := fmt.Sprintf(gitopsAgentApplicationRevisionPath, url.PathEscape(name), url.PathEscape(revision))
	params := make(map[string]string)
	addScope(scope, params)

	params["name"] = name
	if namespace != "" {
		params["namespace"] = namespace
	}
	params["clusterId"] = clusterID
	params["revision"] = revision

	var response dto.GitOpsRevisionMetadataResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get revision metadata: %w", err)
	}

	return &response.Metadata, nil
}

// ===== Cluster API Methods =====

// ListClusters lists clusters in GitOps
// https://apidocs.harness.io/tag/Clusters#operation/getClusterList
func (g *GitOpsClient) ListClusters(ctx context.Context, scope dto.Scope, opts *dto.GitOpsClusterOptions) ([]dto.GitOpsCluster, int, error) {
	path := gitopsClusterListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.GitOpsClusterOptions{}
	}

	setDefaultPaginationForGitOpsCluster(opts)

	params["offset"] = fmt.Sprintf("%d", opts.Offset)
	params["limit"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Status != "" {
		params["status"] = opts.Status
	}
	
	// Handle array parameters
	if len(opts.Projects) > 0 {
		params["projects"] = strings.Join(opts.Projects, ",")
	}

	var response dto.GitOpsClusterListResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list GitOps clusters: %w", err)
	}

	return response.Clusters, response.Count, nil
}

// GetClusterByURL gets a cluster by URL
// https://apidocs.harness.io/tag/Clusters#operation/AgentClusterService_GetByUrl
func (g *GitOpsClient) GetClusterByURL(ctx context.Context, scope dto.Scope, serverURL string) (*dto.GitOpsCluster, error) {
	if serverURL == "" {
		return nil, fmt.Errorf("server URL is required")
	}

	path := gitopsClusterByURLPath
	params := make(map[string]string)
	addScope(scope, params)

	params["server"] = serverURL

	var response dto.GitOpsCluster
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster by URL: %w", err)
	}

	return &response, nil
}

// GetClusterByName gets a cluster by name
// https://apidocs.harness.io/tag/Clusters#operation/AgentClusterService_GetByName
func (g *GitOpsClient) GetClusterByName(ctx context.Context, scope dto.Scope, name string) (*dto.GitOpsCluster, error) {
	if name == "" {
		return nil, fmt.Errorf("cluster name is required")
	}

	path := fmt.Sprintf(gitopsClusterByNamePath, url.PathEscape(name))
	params := make(map[string]string)
	addScope(scope, params)

	var response dto.GitOpsCluster
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster by name: %w", err)
	}

	return &response, nil
}

// ===== Dashboard API Methods =====

// GetDashboardCounts gets counts for the dashboard
// https://apidocs.harness.io/tag/Dashboards#operation/DashboardService_RecentlyCreatedCounts
func (g *GitOpsClient) GetDashboardCounts(ctx context.Context, scope dto.Scope) (*dto.GitOpsDashboardCounts, error) {
	path := gitopsDashboardCountsPath
	params := make(map[string]string)
	addScope(scope, params)

	var response dto.GitOpsDashboardCounts
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard counts: %w", err)
	}

	return &response, nil
}

// ===== Reconciliation API Methods =====

// GetReconciliationCounts gets reconciliation counts
// https://apidocs.harness.io/tag/Reconciler#operation/ReconcilerService_CollectCounts
func (g *GitOpsClient) GetReconciliationCounts(ctx context.Context, scope dto.Scope) (*dto.GitOpsReconciliationCounts, error) {
	path := gitopsReconcileCounts
	params := make(map[string]string)
	addScope(scope, params)

	var response dto.GitOpsReconciliationCounts
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get reconciliation counts: %w", err)
	}

	return &response, nil
}
