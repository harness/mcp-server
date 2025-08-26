package client

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	ngBasePath                                  = "ng/api"
	ccmRecommendationsListPath                  = ccmBasePath + "/recommendation/overview/list?accountIdentifier=%s"
	ccmRecommendationsByResourceTypeListPath    = ccmBasePath + "/recommendation/overview/resource-type/stats?accountIdentifier=%s"
	ccmRecommendationsStatsPath                 = ccmBasePath + "/recommendation/overview/stats?accountIdentifier=%s"
	ccmUpdateRecommendationStatePath            = ccmBasePath + "/recommendation/overview/change-state?accountIdentifier=%s"
	ccmOverrideRecommendationSavingsPath        = ccmBasePath + "/recommendation/overview/override-savings?accountIdentifier=%s"
	ccmCreateRecommendationJiraTicketPath       = ccmBasePath + "/recommendation/jira/create?accountIdentifier=%s"
	ccmCreateRecommendationServiceNowTicketPath = ccmBasePath + "/recommendation/servicenow/create?accountIdentifier=%s"
	ccmGetRecommendationDetailPath              = ccmBasePath + "/recommendation/details/%s?accountIdentifier=%s&id=%s"
	ccmTicketToolSettingsPath                   = ngBasePath + "/settings?accountIdentifier=%s&category=CE&group=ticketing_preferences"
	ccmJiraProjectsPath                         = ngBasePath + "/jira/projects?accountIdentifier=%s&connectorRef=%s"
	ccmJiraMetadataPath                         = ngBasePath + "/jira/createMetadata?accountIdentifier=%s"
)

const (
	ec2Path        = "ec2-instance"
	azureVmPath    = "azure-vm"
	ecsServicePath = "ecs-service"
	nodePoolPath   = "node-pool"
	workloadPath   = "workload"
)

func (r *CloudCostManagementService) ListRecommendations(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, accountId, options, ccmRecommendationsListPath)
}

func (r *CloudCostManagementService) ListRecommendationsByResourceType(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, accountId, options, ccmRecommendationsByResourceTypeListPath)
}

func (r *CloudCostManagementService) GetRecommendationsStats(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, accountId, options, ccmRecommendationsStatsPath)
}

func (r *CloudCostManagementService) UpdateRecommendationState(
	ctx context.Context,
	accountId string,
	recommendationId string,
	state string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmUpdateRecommendationStatePath, accountId)
	params := make(map[string]string)
	params["recommendationId"] = recommendationId
	params["state"] = state

	resp := new(map[string]any)

	err := r.Client.Post(ctx, path, params, nil, map[string]string{}, &resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to update cloud cost management Recommendation state: %w", err)
	}

	return resp, nil
}

func (r *CloudCostManagementService) OverrideRecommendationSavings(
	ctx context.Context,
	accountId string,
	recommendationId string,
	savings float64,
) (*map[string]any, error) {
	path := fmt.Sprintf(ccmOverrideRecommendationSavingsPath, accountId)
	params := make(map[string]string)
	params["recommendationId"] = recommendationId
	params["overriddenSavings"] = strconv.FormatFloat(savings, 'f', -1, 64)

	resp := new(map[string]any)

	err := r.Client.Put(ctx, path, params, nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to override cloud cost management Recommendation savings: %w", err)
	}

	return resp, nil
}

func (r *CloudCostManagementService) getRecommendations(
	ctx context.Context,
	accountId string,
	options map[string]any,
	url string,
) (*map[string]any, error) {

	path := fmt.Sprintf(url, accountId)
	params := make(map[string]string)

	items := new(map[string]any)

	err := r.Client.Post(ctx, path, params, options, map[string]string{}, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management recommendations: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) CreateJiraTicket(
	ctx context.Context,
	accountId string,
	ticketDetails dto.CCMTicketDetails,
) (*map[string]any, error) {

	url := fmt.Sprintf(ccmCreateRecommendationJiraTicketPath, accountId) // Define ccmCreateJiraIssue as needed
	return r.createTicket(ctx, accountId, ticketDetails, url)
}

func (r *CloudCostManagementService) CreateServiceNowTicket(
	ctx context.Context,
	accountId string,
	ticketDetails dto.CCMTicketDetails,
) (*map[string]any, error) {

	url := fmt.Sprintf(ccmCreateRecommendationServiceNowTicketPath, accountId) // Define ccmCreateJiraIssue as needed
	return r.createTicket(ctx, accountId, ticketDetails, url)
}

func (r *CloudCostManagementService) createTicket(
	ctx context.Context,
	accountId string,
	ticketDetails dto.CCMTicketDetails,
	url string,
) (*map[string]any, error) {

	// Fist check if ticketing tool is available from settings
	platform, err := r.getTicketingToolSettings(ctx, accountId)

	if err != nil {
		return nil, fmt.Errorf("Failed to get ticket tool settings in cloud cost management recommendations: %w", err)
	}

	if platform != ticketDetails.Platform {
		return nil, fmt.Errorf("Ticketing tool not available for this account: %s", ticketDetails.Platform)
	}

	body := map[string]any{
		"recommendationId": ticketDetails.RecommendationId,
		"resourceType":     ticketDetails.ResourceType,
		"connectorRef":     ticketDetails.ConnectorRef,
		"fields":           ticketDetails.Fields,
	}

	if ticketDetails.Platform == dto.TicketPlatformJira {
		body["projectKey"] = ticketDetails.ProjectKey
		body["issueType"] = ticketDetails.TicketType
	} else {
		body["ticketType"] = ticketDetails.TicketType
	}

	slog.Debug("Creating CCM Ticket", "accountId", accountId, "jiraDetails", body, "ticketType", ticketDetails.TicketType)

	resp := new(map[string]any)

	err = r.Client.Post(ctx, url, nil, body, map[string]string{}, &resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to create CCM Jira issue: %w", err)
	}

	return resp, nil
}

func (r *CloudCostManagementService) GetEc2RecommendationDetail(ctx context.Context, options dto.CCMRecommendationDetailOptions) (*map[string]any, error) {
	return r.getRecommendationDetail(ctx, options, ec2Path)
}

func (r *CloudCostManagementService) GetAzureVmRecommendationDetail(ctx context.Context, options dto.CCMRecommendationDetailOptions) (*map[string]any, error) {
	return r.getRecommendationDetail(ctx, options, azureVmPath)
}

func (r *CloudCostManagementService) GetEcsServiceRecommendationDetail(ctx context.Context, options dto.CCMRecommendationDetailOptions) (*map[string]any, error) {
	return r.getRecommendationDetail(ctx, options, ecsServicePath)
}

func (r *CloudCostManagementService) GetNodePoolRecommendationDetail(ctx context.Context, options dto.CCMRecommendationDetailOptions) (*map[string]any, error) {
	return r.getRecommendationDetail(ctx, options, nodePoolPath)
}

func (r *CloudCostManagementService) GetWorkloadRecommendationDetail(ctx context.Context, options dto.CCMRecommendationDetailOptions) (*map[string]any, error) {
	return r.getRecommendationDetail(ctx, options, workloadPath)
}

func (r *CloudCostManagementService) ListJiraProjects(
	ctx context.Context,
	accountId string,
	connector string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmJiraProjectsPath, accountId, connector)

	items := new(map[string]any)

<<<<<<< HEAD
	err := r.NgManClient.Get(ctx, path, nil, nil, &items)
=======
	err := r.Client.Get(ctx, path, nil, nil, &items)
>>>>>>> master
	if err != nil {
		return nil, fmt.Errorf("Failed to list Jira Projects: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) ListJiraIssueTypes(
	ctx context.Context,
	options dto.CCMJiraIssueTypesOptions,
) (*dto.CCMJiraIssueTypesList, error) {

	path := fmt.Sprintf(ccmJiraMetadataPath, options.AccountId)

	params := map[string]string{
		"connectorRef": options.ConnectorRef,
		"projectKey":   options.ProjectKey,
	}

	resp := new(dto.CCMJiraIssueTypesResponse)
<<<<<<< HEAD
	err := r.NgManClient.Get(ctx, path, params, nil, &resp)
=======
	err := r.Client.Get(ctx, path, params, nil, &resp)
>>>>>>> master
	if err != nil {
		return nil, fmt.Errorf("Failed to list Jira Issue Types: %w", err)
	}
	slog.Debug("Jira Issue Types Response", "response", resp)
	items := ExtractIssueTypesList(*resp)
	slog.Debug("Jira Issue Types Response", "items", items)
	return &items, nil
}

func (r *CloudCostManagementService) getRecommendationDetail(
	ctx context.Context,
	options dto.CCMRecommendationDetailOptions,
	typePath string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmGetRecommendationDetailPath, typePath, options.AccountIdentifier, options.RecommendationId)
	params := make(map[string]string)

	if typePath == ecsServicePath || typePath == workloadPath {
		params["from"] = options.From
		params["to"] = options.To
	}

	if typePath == ecsServicePath {
		params["bufferPercentage"] = strconv.FormatInt(options.BufferPercentage, 10)
	}

	items := new(map[string]any)

	err := r.Client.Get(ctx, path, params, nil, &items)

	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management recommendations: %w", err)
	}

	return items, nil
}

// Returns dto.TicketPlatformJira or dto.TicketPlatformServiceNow based on the settings
func (r *CloudCostManagementService) getTicketingToolSettings(
	ctx context.Context,
	accountId string,
) (string, error) {

	path := fmt.Sprintf(ccmTicketToolSettingsPath, accountId)

	resp := new(dto.CCMTicketToolSettingsResponse)
<<<<<<< HEAD
	err := r.NgManClient.Get(ctx, path, nil, nil, &resp)
=======
	err := r.Client.Get(ctx, path, nil, nil, &resp)
>>>>>>> master
	if err != nil {
		return "", fmt.Errorf("Failed to get ticket tool settings in cloud cost management recommendations: %w", err)
	}

	return ExtractTicketingToolValue(*resp)
}

func ExtractTicketingToolValue(resp dto.CCMTicketToolSettingsResponse) (string, error) {
	for _, d := range resp.Data {
		if d.Setting.Identifier == "ticketing_tool" {
			slog.Debug("Current ticketing tool setting", "setting", d.Setting.Value)
			return d.Setting.Value, nil
		}
	}

	slog.Debug("Current ticketing tool setting not found")
	return "", fmt.Errorf("ticketing_tool setting not found")
}

func ExtractIssueTypesList(resp dto.CCMJiraIssueTypesResponse) dto.CCMJiraIssueTypesList {
	var issueTypes []dto.CCMJiraIssueType
	for _, project := range resp.Data.Projects {
		for _, issueType := range project.IssueTypes {
			issueTypes = append(issueTypes, issueType)
		}
	}
	return dto.CCMJiraIssueTypesList{CCMBaseResponse: resp.CCMBaseResponse, Data: issueTypes}
}
