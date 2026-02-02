package client

import (
	"context"
	"fmt"

	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/client/gitops/generated"
)

const (
	gitopsApplicationsPath     = "applications"
	gitopsApplicationPath      = "applications/%s"
	gitopsResourceTreePath     = "applications/%s/resource-tree"
	gitopsEventsPath           = "applications/%s/events"
	gitopsPodLogsPath          = "applications/%s/pods/%s/logs/batch"
	gitopsManagedResourcesPath = "applications/%s/managed-resources"
	gitopsResourceActionsPath  = "applications/%s/resource/actions"
	gitopsAgentsPath           = "agents"
	gitopsAgentPath            = "agents/%s"
	gitopsAppSetsPath          = "applicationsets"
	gitopsAppSetPath           = "applicationsets/%s"
	gitopsClustersPath         = "clusters"
	gitopsClusterPath          = "clusters/%s"
	gitopsReposPath            = "repositories"
	gitopsRepoPath             = "repositories/%s"
	gitopsRepoCredsPath        = "repocreds"
	gitopsRepoCredPath         = "repocreds/%s"
	gitopsDashboardPath        = "dashboard/overview"
)

type GitOpsService struct {
	Client *Client
}

func (g *GitOpsService) ListApplications(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	clusterIdentifier string,
	repoIdentifier string,
	searchTerm string,
	page, pageSize int,
) (*generated.Servicev1Applicationlist, error) {
	path := gitopsApplicationsPath

	params := map[string]string{
		"routingId": scope.AccountID,
	}

	requestBody := map[string]interface{}{
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"pageIndex":         page,
		"pageSize":          pageSize,
	}

	if agentIdentifier != "" {
		requestBody["agentIdentifier"] = agentIdentifier
	}
	if clusterIdentifier != "" {
		requestBody["clusterIdentifier"] = clusterIdentifier
	}
	if repoIdentifier != "" {
		requestBody["repoIdentifier"] = repoIdentifier
	}
	if searchTerm != "" {
		requestBody["searchTerm"] = searchTerm
	}

	var response generated.Servicev1Applicationlist
	err := g.Client.Post(ctx, path, params, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list applications: %w", err)
	}

	return &response, nil
}

func (g *GitOpsService) GetApplication(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
	refresh string,
) (*generated.Servicev1Application, error) {
	path := fmt.Sprintf(gitopsApplicationPath, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"agentIdentifier":   agentIdentifier,
	}

	if refresh != "" {
		params["query.refresh"] = refresh
	}

	var response generated.Servicev1Application
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get application '%s': %w", applicationName, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListAgents(
	ctx context.Context,
	scope dto.Scope,
	agentType string,
	searchTerm string,
	page, pageSize int,
	includeAllScopes bool,
) (*generated.V1AgentList, error) {
	path := gitopsAgentsPath

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"pageIndex":         fmt.Sprintf("%d", page),
		"pageSize":          fmt.Sprintf("%d", pageSize),
	}

	// Add org/project only if provided (empty means account-level query)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	if agentType != "" {
		params["type"] = agentType
	}
	if searchTerm != "" {
		params["searchTerm"] = searchTerm
	}
	if includeAllScopes {
		params["ignoreScope"] = "true"
		params["metadataOnly"] = "true"
	}

	var response generated.V1AgentList
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	return &response, nil
}

func (g *GitOpsService) GetAgent(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
) (*generated.V1Agent, error) {
	path := fmt.Sprintf(gitopsAgentPath, agentIdentifier)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
	}

	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	var response generated.V1Agent
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get GitOps agent '%s': %w", agentIdentifier, err)
	}

	return &response, nil
}

func (g *GitOpsService) GetApplicationResourceTree(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
) (*generated.ApplicationsApplicationTree, error) {
	path := fmt.Sprintf(gitopsResourceTreePath, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"agentIdentifier":   agentIdentifier,
	}

	var response generated.ApplicationsApplicationTree
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource tree for '%s': %w", applicationName, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListApplicationEvents(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
	resourceName string,
	resourceNamespace string,
	resourceUID string,
) (*generated.ApplicationsEventList, error) {
	path := fmt.Sprintf(gitopsEventsPath, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"agentIdentifier":   agentIdentifier,
	}

	if resourceName != "" {
		params["query.resourceName"] = resourceName
	}
	if resourceNamespace != "" {
		params["query.resourceNamespace"] = resourceNamespace
	}
	if resourceUID != "" {
		params["query.resourceUID"] = resourceUID
	}

	var response generated.ApplicationsEventList
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list events for '%s': %w", applicationName, err)
	}

	return &response, nil
}

func (g *GitOpsService) GetPodLogs(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
	podName string,
	namespace string,
	container string,
	tailLines int,
) (*generated.ApplicationsLogEntriesBatch, error) {
	path := fmt.Sprintf(gitopsPodLogsPath, applicationName, podName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"agentIdentifier":   agentIdentifier,
		"query.namespace":   namespace,
		"query.podName":     podName,
	}

	if container != "" {
		params["query.container"] = container
	}
	if tailLines > 0 {
		params["query.tailLines"] = fmt.Sprintf("%d", tailLines)
	}

	var response generated.ApplicationsLogEntriesBatch
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod logs for '%s': %w", podName, err)
	}

	return &response, nil
}

func (g *GitOpsService) GetManagedResources(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
) (*generated.ApplicationsManagedResourcesResponse, error) {
	path := fmt.Sprintf(gitopsManagedResourcesPath, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"agentIdentifier":   agentIdentifier,
	}

	var response generated.ApplicationsManagedResourcesResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get managed resources for '%s': %w", applicationName, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListResourceActions(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
	resourceName string,
	namespace string,
	kind string,
	group string,
	version string,
) (*generated.ApplicationsResourceActionsListResponse, error) {
	path := fmt.Sprintf(gitopsResourceActionsPath, applicationName)

	params := map[string]string{
		"routingId":              scope.AccountID,
		"accountIdentifier":      scope.AccountID,
		"orgIdentifier":          scope.OrgID,
		"projectIdentifier":      scope.ProjectID,
		"agentIdentifier":        agentIdentifier,
		"query.name":             resourceName,
		"query.namespace":        namespace,
		"query.resourceName":     resourceName,
		"query.kind":             kind,
	}

	if group != "" {
		params["query.group"] = group
	}
	if version != "" {
		params["query.version"] = version
	}

	var response generated.ApplicationsResourceActionsListResponse
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list resource actions for '%s': %w", applicationName, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListApplicationSets(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	searchTerm string,
	page, pageSize int,
) (*generated.Servicev1ApplicationSetList, error) {
	path := gitopsAppSetsPath

	params := map[string]string{
		"routingId": scope.AccountID,
	}

	requestBody := map[string]interface{}{
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"pageIndex":         page,
		"pageSize":          pageSize,
	}

	if agentIdentifier != "" {
		requestBody["agentIdentifier"] = agentIdentifier
	}
	if searchTerm != "" {
		requestBody["searchTerm"] = searchTerm
	}

	var response generated.Servicev1ApplicationSetList
	err := g.Client.Post(ctx, path, params, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list application sets: %w", err)
	}

	return &response, nil
}

func (g *GitOpsService) GetApplicationSet(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	identifier string,
) (*generated.Servicev1ApplicationSet, error) {
	path := fmt.Sprintf(gitopsAppSetPath, identifier)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"agentIdentifier":   agentIdentifier,
	}

	var response generated.Servicev1ApplicationSet
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get application set '%s': %w", identifier, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListClusters(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	searchTerm string,
	page, pageSize int,
) (*generated.V1Clusterlist, error) {
	path := gitopsClustersPath

	params := map[string]string{
		"routingId": scope.AccountID,
	}

	requestBody := map[string]interface{}{
		"accountIdentifier": scope.AccountID,
		"pageIndex":         page,
		"pageSize":          pageSize,
	}
	if scope.OrgID != "" {
		requestBody["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		requestBody["projectIdentifier"] = scope.ProjectID
	}

	if agentIdentifier != "" {
		requestBody["agentIdentifier"] = agentIdentifier
	}
	if searchTerm != "" {
		requestBody["searchTerm"] = searchTerm
	}

	var response generated.V1Clusterlist
	err := g.Client.Post(ctx, path, params, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list clusters: %w", err)
	}

	return &response, nil
}

func (g *GitOpsService) GetCluster(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	identifier string,
) (*generated.Servicev1Cluster, error) {
	path := fmt.Sprintf(gitopsClusterPath, identifier)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"agentIdentifier":   agentIdentifier,
	}

	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	var response generated.Servicev1Cluster
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster '%s': %w", identifier, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListRepositories(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	searchTerm string,
	page, pageSize int,
) (*generated.V1Repositorylist, error) {
	path := gitopsReposPath

	params := map[string]string{
		"routingId": scope.AccountID,
	}

	requestBody := map[string]interface{}{
		"accountIdentifier": scope.AccountID,
		"pageIndex":         page,
		"pageSize":          pageSize,
	}

	if scope.OrgID != "" {
		requestBody["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		requestBody["projectIdentifier"] = scope.ProjectID
	}
	if agentIdentifier != "" {
		requestBody["agentIdentifier"] = agentIdentifier
	}
	if searchTerm != "" {
		requestBody["searchTerm"] = searchTerm
	}

	var response generated.V1Repositorylist
	err := g.Client.Post(ctx, path, params, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list repositories: %w", err)
	}

	return &response, nil
}

func (g *GitOpsService) GetRepository(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	identifier string,
) (*generated.Servicev1Repository, error) {
	path := fmt.Sprintf(gitopsRepoPath, identifier)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"agentIdentifier":   agentIdentifier,
	}

	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	var response generated.Servicev1Repository
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get repository '%s': %w", identifier, err)
	}

	return &response, nil
}

func (g *GitOpsService) ListRepoCredentials(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	searchTerm string,
	page, pageSize int,
) (*generated.Servicev1RepositoryCredentialsList, error) {
	path := gitopsRepoCredsPath

	params := map[string]string{
		"routingId": scope.AccountID,
	}

	requestBody := map[string]interface{}{
		"accountIdentifier": scope.AccountID,
		"pageIndex":         page,
		"pageSize":          pageSize,
	}

	if scope.OrgID != "" {
		requestBody["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		requestBody["projectIdentifier"] = scope.ProjectID
	}
	if agentIdentifier != "" {
		requestBody["agentIdentifier"] = agentIdentifier
	}
	if searchTerm != "" {
		requestBody["searchTerm"] = searchTerm
	}

	var response generated.Servicev1RepositoryCredentialsList
	err := g.Client.Post(ctx, path, params, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list repository credentials: %w", err)
	}

	return &response, nil
}

func (g *GitOpsService) GetRepoCredentials(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	identifier string,
) (*generated.Servicev1RepositoryCredentials, error) {
	path := fmt.Sprintf(gitopsRepoCredPath, identifier)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"agentIdentifier":   agentIdentifier,
	}

	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	var response generated.Servicev1RepositoryCredentials
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get repository credential '%s': %w", identifier, err)
	}

	return &response, nil
}

func (g *GitOpsService) GetDashboardOverview(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
) (*generated.V1DashboardOverview, error) {
	path := gitopsDashboardPath

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
	}

	if agentIdentifier != "" {
		params["agentIdentifier"] = agentIdentifier
	}

	var response generated.V1DashboardOverview
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard overview: %w", err)
	}

	return &response, nil
}

