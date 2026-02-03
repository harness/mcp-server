package client

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/client/gitops/generated"
)

const (
	gitopsApplicationsPath     = "applications"
	gitopsApplicationPath      = "agents/%s/applications/%s"
	gitopsResourceTreePath     = "agents/%s/applications/%s/resource-tree"
	gitopsEventsPath           = "agents/%s/applications/%s/events"
	gitopsPodLogsPath          = "agents/%s/applications/%s/logs"
	gitopsManagedResourcesPath = "agents/%s/applications/%s/managed-resources"
	gitopsResourceActionsPath  = "agents/%s/applications/%s/resource/actions"
	gitopsAgentsPath           = "agents"
	gitopsAgentPath            = "agents/%s"
	gitopsAppSetsPath          = "applicationsets"
	gitopsAppSetPath           = "applicationset/%s"
	gitopsClustersPath         = "clusters"
	gitopsClusterPath          = "agents/%s/clusters/%s"
	gitopsReposPath            = "repositories"
	gitopsRepoPath             = "agents/%s/repositories/%s"
	gitopsRepoCredsPath        = "repocreds"
	gitopsRepoCredPath         = "agents/%s/repocreds/%s"
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
	path := fmt.Sprintf(gitopsApplicationPath, agentIdentifier, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
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
	path := fmt.Sprintf(gitopsResourceTreePath, agentIdentifier, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
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
	path := fmt.Sprintf(gitopsEventsPath, agentIdentifier, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
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
	path := fmt.Sprintf(gitopsPodLogsPath, agentIdentifier, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
		"query.podName":     podName,
		"query.namespace":   namespace,
		"query.kind":        "Pod",
		"query.follow":      "true",
	}

	if container != "" {
		params["query.container"] = container
	}
	if tailLines > 0 {
		params["query.tailLines"] = fmt.Sprintf("%d", tailLines)
	}

	// Use original context for HTTP connection (no timeout on connection)
	resp, err := g.Client.GetStream(ctx, path, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod logs stream for '%s': %w", podName, err)
	}
	defer resp.Body.Close()

	var entries []generated.ApplicationsLogEntry
	scanner := bufio.NewScanner(resp.Body)

	// Apply timeout only to reading the stream (not the HTTP connection)
	readCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Read lines until we have enough entries or timeout
	done := make(chan struct{})
	go func() {
		defer close(done)
		for scanner.Scan() {
			select {
			case <-readCtx.Done():
				// Context cancelled or timed out, stop reading
				return
			default:
				line := scanner.Text()

				// Skip empty lines
				if line == "" {
					continue
				}

				// The API returns different formats:
				// - With session cookies: SSE format "data: {json}"
				// - With API key: Plain JSON "{json}"
				jsonData := line
				if strings.HasPrefix(line, "data: ") {
					jsonData = strings.TrimPrefix(line, "data: ")
				}

				// Parse {"result": {...}} wrapper
				var wrapper struct {
					Result generated.ApplicationsLogEntry `json:"result"`
				}

				if err := json.Unmarshal([]byte(jsonData), &wrapper); err != nil {
					slog.WarnContext(ctx, "Failed to unmarshal log entry from stream", "error", err, "json", jsonData)
					continue // Skip malformed lines
				}

				entries = append(entries, wrapper.Result)

				// Stop after collecting requested number of lines
				if tailLines > 0 && len(entries) >= tailLines {
					return
				}
			}
		}
	}()

	// Wait for either timeout or stream to finish
	select {
	case <-readCtx.Done():
		// Stream reading timed out or context cancelled
		slog.InfoContext(ctx, "Pod logs stream reading finished due to timeout or cancellation", "entriesCollected", len(entries))
	case <-done:
		// Stream finished naturally
		slog.InfoContext(ctx, "Pod logs stream reading finished naturally", "entriesCollected", len(entries))
	}

	if scanner.Err() != nil {
		return nil, fmt.Errorf("error reading log stream: %w", scanner.Err())
	}

	count := int32(len(entries))
	return &generated.ApplicationsLogEntriesBatch{
		Entries: &entries,
		Count:   &count,
	}, nil
}

func (g *GitOpsService) GetManagedResources(
	ctx context.Context,
	scope dto.Scope,
	agentIdentifier string,
	applicationName string,
) (*generated.ApplicationsManagedResourcesResponse, error) {
	path := fmt.Sprintf(gitopsManagedResourcesPath, agentIdentifier, applicationName)

	params := map[string]string{
		"routingId":         scope.AccountID,
		"accountIdentifier": scope.AccountID,
		"orgIdentifier":     scope.OrgID,
		"projectIdentifier": scope.ProjectID,
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
	path := fmt.Sprintf(gitopsResourceActionsPath, agentIdentifier, applicationName)

	params := map[string]string{
		"routingId":            scope.AccountID,
		"accountIdentifier":    scope.AccountID,
		"orgIdentifier":        scope.OrgID,
		"projectIdentifier":    scope.ProjectID,
		"request.namespace":    namespace,
		"request.resourceName": resourceName,
		"request.kind":         kind,
	}

	if group != "" {
		params["request.group"] = group
	}
	if version != "" {
		params["request.version"] = version
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
	path := fmt.Sprintf(gitopsClusterPath, agentIdentifier, identifier)

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
	path := fmt.Sprintf(gitopsRepoPath, agentIdentifier, identifier)

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
	path := fmt.Sprintf(gitopsRepoCredPath, agentIdentifier, identifier)

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
