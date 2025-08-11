package tools

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

const (
	CCMCommitmentCoverageEventType  = "commitment_coverage_sorted"
	defaultTargetCoveragePercentage = 90.0

	FollowUpGroupCommitmentCoverageByRegionsPrompt = "Help me group commitment coverage by regions"
	FollowUpGroupCommitmentCoverageBySavingsPrompt = "Help me estimate savings opportunities"
)

func FetchEstimatedSavingsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_commitment_estimated_savings",
			mcp.WithDescription("Get commitment annualized estimated savings information for provided cloud account(s) in Harness Cloud Cost Management with optionally provided target coverage or else defaults to 90% of target coverage"),
			mcp.WithString("service",
				mcp.Description("Optional service to estimate savings for"),
			),
			mcp.WithNumber("target_coverage",
				mcp.Description("Optional target coverage to estimate savings"),
				mcp.DefaultNumber(defaultTargetCoveragePercentage),
				mcp.Max(95),
				mcp.Min(10),
			),
			mcp.WithArray("cloud_account_ids",
				mcp.WithStringItems(),
				mcp.Description("cloud account IDs to estimate savings for"),
				mcp.Required(),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMCommitmentOptions{}
			params.AccountIdentifier = &accountId

			// Handle service parameter
			service, ok, err := OptionalParamOK[string](request, "service")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && service != "" {
				params.Service = &service
			}

			cloudAccountIDs, err := OptionalStringArrayParam(request, "cloud_account_ids")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if len(cloudAccountIDs) == 0 {
				return mcp.NewToolResultError("missing required parameter: cloud_account_ids"), nil
			}
			params.CloudAccountIDs = cloudAccountIDs

			targetCoverage, ok, err := OptionalParamOK[float64](request, "target_coverage")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !ok {
				targetCoverage = defaultTargetCoveragePercentage
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetEstimatedSavings(ctx, scope, targetCoverage, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment coverage: %s", err)), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment coverage: %s", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
