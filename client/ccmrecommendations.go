package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
	"strconv"
	"log/slog"
)
const (
	ccmRecommendationsListPath = ccmBasePath + "/recommendation/overview/list?accountIdentifier=%s"
	ccmRecommendationsByResourceTypeListPath = ccmBasePath + "/recommendation/overview/resource-type/stats?accountIdentifier=%s"
	ccmRecommendationsStatsPath = ccmBasePath + "/recommendation/overview/stats?accountIdentifier=%s"
	ccmUpdateRecommendationStatePath = ccmBasePath + "/recommendation/overview/change-state?accountIdentifier=%s"
	ccmOverrideRecommendationSavingsPath = ccmBasePath + "/recommendation/overview/override-savings?accountIdentifier=%s"
	ccmCreateRecommendationJiraTicketPath = ccmBasePath + "/recommendation/jira/create?accountIdentifier=%s"
	ccmCreateRecommendationServiceNowTicketPath = ccmBasePath + "/recommendation/servicenow/create?accountIdentifier=%s"
	ccmGetRecommendationDetailPath = ccmBasePath + "/recommendation/details/%s?accountIdentifier=%s&id=%s"

)

const (
	ec2Path = "ec2-instance"
	azureVmPath = "azure-vm"
	ecsServicePath = "ecs-service"
	nodePoolPath = "node-pool"
	workloadPath = "workload"
)

func (r *CloudCostManagementService) ListRecommendations(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, scope, accountId, options, ccmRecommendationsListPath)
}

func (r *CloudCostManagementService) ListRecommendationsByResourceType(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, scope, accountId, options, ccmRecommendationsByResourceTypeListPath)
}

func (r *CloudCostManagementService) GetRecommendationsStats(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, scope, accountId, options, ccmRecommendationsStatsPath)
}

func (r *CloudCostManagementService)UpdateRecommendationState(
	ctx context.Context, 
	scope dto.Scope, 
	accountId string, 
	recommendationId string,
	state string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmUpdateRecommendationStatePath, accountId)
	params := make(map[string]string)
	params["recommendationId"] = recommendationId 
	params["state"] = state

	resp := new(map[string]any)

	err := r.Client.Post(ctx, path, params, nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to update cloud cost management Recommendation state: %w", err)
	}

	return resp, nil
}

func (r *CloudCostManagementService)OverrideRecommendationSavings(
	ctx context.Context, 
	scope dto.Scope, 
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
	scope dto.Scope, 
	accountId string, 
	options map[string]any,
	url string,
) (*map[string]any, error) {

	path := fmt.Sprintf(url, accountId)
	params := make(map[string]string)
	addScope(scope, params)

	items := new(map[string]any)

	err := r.Client.Post(ctx, path, params, options, &items)
	if err != nil { return nil, fmt.Errorf("Failed to list cloud cost management recommendations: %w", err)
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


	body := map[string]any{
		"recommendationId": ticketDetails.RecommendationId,
		"resourceType":     ticketDetails.ResourceType,
		"connectorRef":     ticketDetails.ConnectorRef,
		"ticketType":       ticketDetails.TicketType,
		"fields":           ticketDetails.Fields,
	}

	if ticketDetails.Platform == dto.TicketPlatformJira {
		body["projectKey"] = ticketDetails.ProjectKey
	}

	slog.Debug("Creating CCM Ticket", "accountId", accountId, "jiraDetails", body, "ticketType", ticketDetails.TicketType)

	resp := new(map[string]any)

	err := r.Client.Post(ctx, url, nil, body, &resp)
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
	if err != nil { return nil, fmt.Errorf("Failed to list cloud cost management recommendations: %w", err)
	}

	return items, nil
}


