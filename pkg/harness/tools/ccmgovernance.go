package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	CloudProviderAWS   = "AWS"
	CloudProviderGCP   = "GCP"
	CloudProviderAZURE = "AZURE"
)

func getProviders() []string {
	return []string{
		CloudProviderAWS,
		CloudProviderGCP,
		CloudProviderAZURE,
	}
}

type ClientFunctionGovernanceInterface func(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error)

func GetCcmTotalNewEnforcementRecommendationsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "ccm_total_new_enforcement_recommendations"
	desc := "Return the total number of new enforcement for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalNewEnforcementRecommendations)
		}
}

func GetCcmTotalActiveEnforcementsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "ccm_total_active_enforcements"
	desc := "Return the total number of active enforcement for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalActiveEnforcements)
		}
}

func GetCcmTotalEvaluationsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "ccm_total_evaluations"
	desc := "Return the total number of evaluations for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalEvaluations)
		}
}

func GetCcmTotalRealisedSavingsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "ccm_total_realised_savings"
	desc := "Return the total number of realised savings for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalRealisedSavings)
		}
}

func governanceDefinition(name string, description string) mcp.Tool {
	return mcp.NewTool(name,
		mcp.WithDescription(description),
		mcp.WithString("cloudProvider",
			mcp.Required(),
			mcp.DefaultString(CloudProviderAWS),
			mcp.Enum(getProviders()...),
			mcp.Description("Cloud provider to get the recommendations for. (e.g. AWS, GCP, AZURE)"),
		),
	)
}

func governanceHandler(
	config *config.Config,
	ctx context.Context,
	request mcp.CallToolRequest,
	clientFunction ClientFunctionGovernanceInterface,
) (*mcp.CallToolResult, error) {

	accountId, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	cloudProvider, err := OptionalParam[string](request, "cloudProvider")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if cloudProvider == "" {
		return mcp.NewToolResultError("cloudProvider is required"), nil
	}

	data, err := clientFunction(ctx, accountId, cloudProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to get governance values: %w", err)
	}

	r, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CCM Overview: %w", err)
	}
	return mcp.NewToolResultText(string(r)), nil
}
