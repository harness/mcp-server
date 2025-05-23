package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"time"
)

// GetCcmOverview creates a tool for getting a ccm overview from an account
func GetCcmOverview(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	now := time.Now()
	defaultStartTime := now.AddDate(0, 0, -60).Unix()
	defaultEndTime := now.Unix()
	return mcp.NewTool("get_ccm_overview",
			mcp.WithDescription("Get an overview from an specific account in Harness Cloud Cost Management"),
			mcp.WithString("accountIdentifier",
				mcp.Description("The account identifier"),
			),
			mcp.WithNumber("startTime",
				mcp.DefaultNumber(float64(defaultStartTime)),
				mcp.Description("Start time of the period"),
			),
			mcp.WithNumber("endTime",
				mcp.DefaultNumber(float64(defaultEndTime)),
				mcp.Description("End time of the period"),
			),
			mcp.WithString("groupBy",
				mcp.Description("Optional type to group by period"),
				mcp.DefaultString(string(dto.HOUR)),
				mcp.Enum(string(dto.HOUR), string(dto.DAY), string(dto.MONTH), string(dto.WEEK), string(dto.QUARTER), string(dto.YEAR)),
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

			startTimeFloat, err := requiredParam[float64](request, "startTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTime := int64(startTimeFloat)

			endTimeFloat, err := requiredParam[float64](request, "endTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			endTime := int64(endTimeFloat)

			groupBy, err := requiredParam[string](request, "groupBy")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.CloudCostManagement.GetOverview(ctx, accID, startTime, endTime, groupBy)
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
