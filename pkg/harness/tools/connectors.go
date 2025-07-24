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

func ListConnectorCatalogueTool(harnessConfig *config.Config, connectorService *client.ConnectorService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_connector_catalogue",
			mcp.WithDescription("List the Harness connector catalogue."),
			WithScope(harnessConfig, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(harnessConfig, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			catalogue, err := connectorService.ListConnectorCatalogue(ctx, scope)
			if err != nil {
				return nil, fmt.Errorf("failed to list connector catalogue: %w", err)
			}

			responseBytes, err := json.Marshal(catalogue)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connector catalogue: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// GetConnectorDetailsTool creates a tool for getting details of a specific connector
// https://apidocs.harness.io/tag/Connectors#operation/getConnector
func GetConnectorDetailsTool(config *config.Config, connectorService *client.ConnectorService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("get_connector_details",
			mcp.WithDescription("Get detailed information about a specific connector."),
			mcp.WithString("connector_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the connector"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			connectorIdentifier, err := RequiredParam[string](request, "connector_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := connectorService.GetConnector(ctx, scope, connectorIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get connector: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connector: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
