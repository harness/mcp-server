package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/harness/harness-mcp/pkg/harness/event"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	CCMCommitmentCoverageEventType    = "commitment_coverage_sorted"
	CCMCommitmentEC2AnalysisEventType = "commitment_ec2_analysis"
	defaultTargetCoveragePercentage   = 90.0

	FollowUpGroupCommitmentCoverageByRegionsPrompt = "Help me group commitment coverage by regions"
	FollowUpGroupCommitmentCoverageBySavingsPrompt = "Help me estimate savings opportunities"
)

func FetchEstimatedSavingsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_commitment_estimated_savings",
			mcp.WithDescription("Get commitment annualized estimated savings opportunities information for provided cloud account(s) in Harness Cloud Cost Management with optionally provided target coverage or else defaults to 90% of target coverage"),
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
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
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

			scope, err := common.FetchScope(ctx, config, request, false)
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

func FetchEC2AnalysisTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_commitment_ec2_analysis",
			mcp.WithDescription("Get AWS EC2 commitment analysis information for the account in Harness Cloud Cost Management that provides analysis on Commitment Spend across AWS Reserved Instances (RI) and Savings Plans (SP) alongside a detaied breakdown of Utilization. It also details savings derived so far along with additional potential for savings"),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
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

			if len(cloudAccountIDs) > 0 {
				params.CloudAccountIDs = cloudAccountIDs
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var response dto.CommitmentEC2AnalysisResponse

			// Fetch commitment spends
			spendsData, err := client.GetCommitmentSpends(ctx, scope, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment coverage: %s", err)), nil
			}

			r, err := json.Marshal(spendsData.Response)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment coverage: %s", err)), nil
			}

			spendsDetails := make(map[string]*dto.ComputeSpendsDetail)

			err = json.Unmarshal(r, &spendsDetails)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to unmarshal commitment coverage: %s", err)), nil
			}

			var totalMonthlyCommitmentSpend, totalEstimatedAnnualizedSavings float64

			for key, val := range spendsDetails {
				response.CommitmentSpends = append(response.CommitmentSpends, &dto.CommitmentSpendsResponse{
					Key:        key,
					Cost:       val.Table.TotalSpend,
					YearlyCost: val.Table.TotalSpend * 12,
					Trend:      val.Table.Trend,
				})

				totalMonthlyCommitmentSpend += val.Table.TotalSpend
			}

			// Get Utilisation data
			utilisationData, err := client.GetCommitmentUtilisation(ctx, scope, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment utilisation: %s", err)), nil
			}

			if utilisationData != nil {
				summary, err := computeCommitmentUtilisationSummary(ctx, utilisationData)
				if err != nil {
					return mcp.NewToolResultError(err.Error()), nil
				}
				response.CommitmentUtilisation = summary
			}

			masterAccounts, err := client.GetCommitmentMasterAccounts(ctx, scope)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment master accounts: %s", err)), nil
			}

			if masterAccounts != nil && len(masterAccounts.Data.Content) > 0 {
				// Fetch estimated savings for the same after populating params with cloud accounts of all master accounts
				for _, masterAccount := range masterAccounts.Data.Content {
					params.CloudAccountIDs = append(params.CloudAccountIDs, masterAccount.Connector.Identifier)
				}

				estimatedSavings, err := client.GetEstimatedSavings(ctx, scope, defaultTargetCoveragePercentage, params)
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("failed to get estimated savings: %s", err)), nil
				}

				for _, val := range estimatedSavings.Data {
					response.EstimatedSavings = append(response.EstimatedSavings, &dto.CommitmentEstimatedSavings{
						AnnualizedSavings: val.AnnualizedSavings,
						CloudAccountID:    val.CloudAccountID,
					})
					totalEstimatedAnnualizedSavings += val.AnnualizedSavings
				}

			}

			// Get current savings
			currentSavings, err := client.GetCommitmentSavings(ctx, scope, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment savings: %s", err)), nil
			}

			jsonBytes, err := json.Marshal(currentSavings.Response)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment savings: %s", err)), nil
			}

			var totalSavings float64

			savingsDetails := make(map[string]*dto.SavingsDetail)
			err = json.Unmarshal(jsonBytes, &savingsDetails)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to unmarshal commitment savings: %s", err)), nil
			}

			for _, val := range savingsDetails {
				if val.Table != nil {
					totalSavings += val.Table.Total
				}
			}

			response.CurrentSavings = totalSavings

			// Calculate ESR = (Estimated Annualized Savings / (Estimated Annualized Savings + Estimated Annualized Spend)) * 100
			response.ESRYearly = (totalEstimatedAnnualizedSavings / (totalEstimatedAnnualizedSavings + (totalMonthlyCommitmentSpend * 12))) * 100

			// Response for internal Harness MCP calls with a custom event
			if config.Internal {
				responseContents := []mcp.Content{}

				commitmentEC2AnalysisEvent := event.NewCustomEvent(CCMCommitmentEC2AnalysisEventType, response, event.WithContinue(false))

				// Create embedded resources for the event
				eventResource, err := commitmentEC2AnalysisEvent.CreateEmbeddedResource()
				if err != nil {
					return mcp.NewToolResultError(err.Error()), nil
				} else {
					responseContents = append(responseContents, eventResource)
				}

				return &mcp.CallToolResult{
					Content: responseContents,
				}, nil
			}

			// Response to be handled by the client for external calls
			externalResponse, err := json.Marshal(response)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment ec2 analysis: %s", err)), nil
			}

			return mcp.NewToolResultText(string(externalResponse)), nil
		}
}

// computeCommitmentUtilisationSummary converts the raw utilisation API response into a
// CommitmentUtilisationSummary, computing running averages for percentage and trend
// and building a per-key breakdown.
func computeCommitmentUtilisationSummary(ctx context.Context, utilisationData *dto.CCMCommitmentBaseResponse) (*dto.CommitmentUtilisationSummary, error) {
	r, err := json.Marshal(utilisationData.Response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal commitment utilisation: %s", err)
	}

	slog.InfoContext(ctx, "Utilization in ec2 commitment analysis", "utilisationData", string(r))

	utilisationDetails := make(map[string]*dto.CommitmentUtlizationsDetail)

	err = json.Unmarshal(r, &utilisationDetails)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal commitment utilisation: %s", err)
	}

	var utilisationOverall dto.CommitmentUtilisationResponse
	var utilisationBreakdown []*dto.CommitmentUtilisationResponse
	// Track counts to compute running averages
	var utilisationCount int
	var trendCount int
	var trendAverage float64

	for key, val := range utilisationDetails {
		if val == nil || val.Table == nil || val.Table.Trend == nil {
			continue
		}

		utilisationOverall.ComputeSpend += val.Table.ComputeSpend
		utilisationOverall.Utilization += val.Table.Utilization

		// Running average for Percentage
		utilisationOverall.Percentage = ((utilisationOverall.Percentage * float64(utilisationCount)) + val.Table.Percentage) / float64(utilisationCount+1)
		utilisationCount++
		utilisationOverall.Trend = ((utilisationOverall.Trend * float64(utilisationCount)) + *val.Table.Trend) / float64(utilisationCount+1)

		// Running average for Trend (skip nils)
		if val.Table.Trend != nil {
			trendAverage = ((trendAverage * float64(trendCount)) + *val.Table.Trend) / float64(trendCount+1)
			trendCount++
		}

		utilisationBreakdown = append(utilisationBreakdown, &dto.CommitmentUtilisationResponse{
			Key:          key,
			ComputeSpend: val.Table.ComputeSpend,
			Utilization:  val.Table.Utilization,
			Percentage:   val.Table.Percentage,
			Trend:        *val.Table.Trend,
		})
	}

	return &dto.CommitmentUtilisationSummary{
		Overall:   &utilisationOverall,
		Breakdown: utilisationBreakdown,
	}, nil
}
