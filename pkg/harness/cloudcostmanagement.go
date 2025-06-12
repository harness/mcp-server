package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"time"
)

// GetCcmOverview creates a tool for getting a ccm overview from an account
func GetCcmOverviewTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	now := time.Now()
	defaultStartTime := utils.FormatUnixToMMDDYYYY(now.AddDate(0, 0, -60).Unix()) 
	defaultEndTime:= utils.CurrentMMDDYYYY(); 
	return mcp.NewTool("get_ccm_overview",
			mcp.WithDescription("Get an overview from an specific account in Harness Cloud Cost Management"),
			mcp.WithString("accountIdentifier",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("startTime",
				mcp.DefaultString(defaultStartTime),
				mcp.Description("Start time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)"),
			),
			mcp.WithString("endTime",
				mcp.DefaultString(defaultEndTime),
				mcp.Description("End time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)"),
			),
			mcp.WithString("groupBy",
				mcp.Description("Optional type to group by period"),
				mcp.DefaultString(dto.PeriodTypeHour),
				mcp.Enum(dto.PeriodTypeHour, dto.PeriodTypeDay, dto.PeriodTypeMonth, dto.PeriodTypeWeek, dto.PeriodTypeQuarter, dto.PeriodTypeYear),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accID, err := OptionalParam[string](request, "accountIdentifier")
			if accID == "" {
				accID, err = getAccountID(config, request)
			}
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			startTimeStr, err := requiredParam[string](request, "startTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			endTimeStr, err := requiredParam[string](request, "endTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			startTime, err :=  utils.FormatMMDDYYYYToUnixMillis(startTimeStr)
			endTime, err := utils.FormatMMDDYYYYToUnixMillis(endTimeStr)

			groupBy, err := requiredParam[string](request, "groupBy")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetOverview(ctx, accID, startTime, endTime, groupBy)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Overview: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Overview: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// getAccountID retrieves AccountID from the config file
func getAccountID(config *config.Config, request mcp.CallToolRequest) (string, error) {
	scope, scopeErr := fetchScope(config, request, true)
	if scopeErr != nil {
		return "", nil
	}
	return scope.AccountID, nil
}
