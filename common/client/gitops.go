package client

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
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

	resp, err := g.Client.GetStream(context.Background(), path, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod logs stream for '%s': %w", podName, err)
	}
	defer resp.Body.Close()

	entries := g.readLogStream(ctx, resp.Body, tailLines)

	count := int32(len(entries))
	return &generated.ApplicationsLogEntriesBatch{
		Entries: &entries,
		Count:   &count,
	}, nil
}

func (g *GitOpsService) readLogStream(ctx context.Context, body io.ReadCloser, tailLines int) []generated.ApplicationsLogEntry {
	const (
		streamReadTimeout      = 10 * time.Second
		scannerBufferSize      = 64 * 1024
		scannerMaxSize         = 1024 * 1024
		defaultChannelBuffer   = 100
		maxChannelBuffer       = 1000
	)

	channelBufferSize := defaultChannelBuffer
	if tailLines > 0 {
		if tailLines < maxChannelBuffer {
			channelBufferSize = tailLines
		} else {
			channelBufferSize = maxChannelBuffer
		}
	}

	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, scannerBufferSize), scannerMaxSize)

	readCtx, cancel := context.WithTimeout(ctx, streamReadTimeout)
	defer cancel()

	entriesCh := make(chan generated.ApplicationsLogEntry, channelBufferSize)
	done := make(chan struct{})

	go func() {
		defer close(done)
		defer close(entriesCh)

		count := 0
		for scanner.Scan() {
			select {
			case <-readCtx.Done():
				return
			default:
				if entry := parseLogLine(ctx, scanner.Text()); entry != nil {
					entriesCh <- *entry
					count++
					if tailLines > 0 && count >= tailLines {
						return
					}
				}
			}
		}

		if err := scanner.Err(); err != nil {
			slog.DebugContext(ctx, "Scanner error while reading log stream", "error", err)
		}
	}()

	var entries []generated.ApplicationsLogEntry
	for {
		select {
		case <-readCtx.Done():
			slog.DebugContext(ctx, "Pod logs stream reading timed out", "entriesCollected", len(entries))
			return entries
		case entry, ok := <-entriesCh:
			if !ok {
				slog.DebugContext(ctx, "Pod logs stream reading completed", "entriesCollected", len(entries))
				return entries
			}
			entries = append(entries, entry)
		}
	}
}

func parseLogLine(ctx context.Context, line string) *generated.ApplicationsLogEntry {
	if line == "" {
		return nil
	}

	var wrapper struct {
		Result generated.ApplicationsLogEntry `json:"result"`
	}

	if err := json.Unmarshal([]byte(line), &wrapper); err != nil {
		slog.DebugContext(ctx, "Failed to parse log entry", "error", err)
		return nil
	}

	return &wrapper.Result
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
