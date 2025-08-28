package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type ClientFunctionGovernanceInterface func(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error)
type ClientFunctionGovernancePostInterface func(ctx context.Context, options dto.CCMGovernanceValuesOptions) (*map[string]any, error)

func GetCcmTotalNewEnforcementRecommendationsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "get_ccm_total_new_enforcement_recommendations"
	desc := "Return the total number of new enforcement for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalNewEnforcementRecommendations)
		}
}

func GetCcmTotalActiveEnforcementsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "get_ccm_total_active_enforcements"
	desc := "Return the total number of active enforcement for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalActiveEnforcements)
		}
}

func GetCcmTotalEvaluationsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "get_ccm_total_evaluations"
	desc := "Return the total number of evaluations for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalEvaluations)
		}
}

func GetCcmTotalRealisedSavingsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "get_ccm_total_realised_savings"
	desc := "Return the total number of realised savings for an account in Harness Cloud Cost Management"
	return governanceDefinition(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandler(config, ctx, request, client.GetTotalRealisedSavings)
		}
}

func GetCcmDayWiseTotalEvaluationsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "get_ccm_day_wise_total_evaluations"
	desc := "Returns day wise total evaluations information for an account in Harness Cloud Cost Management"
	return governanceDefinitionPost(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandlerPost(config, ctx, request, client.GetTotalRealisedSavingsV2)
		}
}

func GetCcmTotalRealisedSavingsV2Tool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	name := "get_ccm_total_realised_savings_v2"
	desc := "Return the total number of realised savings for an account in Harness Cloud Cost Management"
	return governanceDefinitionPost(name, desc),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return governanceHandlerPost(config, ctx, request, client.GetTotalRealisedSavingsV2)
		}
}

func governanceDefinition(name string, description string) mcp.Tool {
	return mcp.NewTool(name,
		mcp.WithDescription(description),
		mcp.WithString("cloudProvider",
			mcp.Required(),
			mcp.DefaultString(dto.CloudProviderAWS),
			mcp.Enum(getProviders()...),
			mcp.Description("Cloud provider to get the recommendations for. (e.g. AWS, GCP, AZURE)"),
		),
	)
}

func governanceDefinitionPost(name string, description string) mcp.Tool {
	return mcp.NewTool(name,
		mcp.WithDescription(description),
		mcp.WithString("cloudProvider",
			mcp.Required(),
			mcp.DefaultString(dto.CloudProviderAWS),
			mcp.Enum(getProviders()...),
			mcp.Description("Cloud provider to get the recommendations for. (e.g. AWS, GCP, AZURE)"),
		),
		mcp.WithArray("filters",
			mcp.Description("Optional filters to refine the results. Each filter should be an object with 'operator' and 'timestamp' fields."),
			mcp.Items(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"operator": map[string]any{
						"type":        "string",
						"description": "The type of context item (other)",
						"enum":        GetGovFilterOperators(),
					},
					"date": map[string]any{
						"type":        "string",
						"description": "The date in MM-DD-YYYY format. Example: 01-31-2023",
					},
				},
			}),
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

func governanceHandlerPost(
	config *config.Config,
	ctx context.Context,
	request mcp.CallToolRequest,
	clientFunction ClientFunctionGovernancePostInterface,
) (*mcp.CallToolResult, error) {

	accountIdentifier, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	cloudProvider, err := OptionalParam[string](request, "cloudProvider")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	options := dto.CCMGovernanceValuesOptions{}
	options.AccountIdentifier = accountIdentifier
	options.CloudProvider = cloudProvider
	filters, err := OptionalAnyArrayParam(request, "filters")
	filterParams, err := convertFilters(filters)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if cloudProvider == "" {
		options.CloudProvider = cloudProvider
	}

	if len(filters) > 0 {
		options.Filters = filterParams
	}

	data, err := clientFunction(ctx, options)
	if err != nil {
		return mcp.NewToolResultError("Failed to get governance values: " + err.Error()), nil
	}

	r, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CCM Overview: %w", err)
	}
	return mcp.NewToolResultText(string(r)), nil
}

func convertFilters(filters []any) ([]map[string]any, error) {
	var convertedFilters []map[string]any
	if len(filters) > 0 {
		for _, values := range filters {
			filter, ok := values.(map[string]any)
			if !ok {
				// handle error or invalid type
				return nil, fmt.Errorf("invalid filter format: %v", values)
			}
			operator, _ := filter["operator"].(string)
			timestampStr, _ := filter["date"].(string)
			timestamp, err := utils.FormatMMDDYYYYToUnixMillis(timestampStr)
			if err != nil {
				continue
			}
			convertedFilters = append(convertedFilters, map[string]any{
				"operator":  operator,
				"timestamp": timestamp,
			})
		}
	}
	slog.Debug("Converted Filters", "filters", convertedFilters)
	return convertedFilters, nil
}

func GetGovFilterOperators() []string {
	return []string{
		dto.GovFilterOperatorsNotIn,
		dto.GovFilterOperatorsIn,
		dto.GovFilterOperatorsEquals,
		dto.GovFilterOperatorsNotNull,
		dto.GovFilterOperatorsNull,
		dto.GovFilterOperatorsLike,
		dto.GovFilterOperatorsGreaterThan,
		dto.GovFilterOperatorsLessThan,
		dto.GovFilterOperatorsGreaterThanEqualsTo,
		dto.GovFilterOperatorsLessThanEqualsTo,
		dto.GovFilterOperatorsAfter,
		dto.GovFilterOperatorsBefore,
	}
}

func getProviders() []string {
	return []string{
		dto.CloudProviderAWS,
		dto.CloudProviderGCP,
		dto.CloudProviderAZURE,
	}
}
