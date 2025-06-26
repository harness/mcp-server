package harness

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func ListConnectorCatalogueTool(harnessConfig *config.Config, c *client.Client) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_connector_catalogue",
			mcp.WithDescription("List the Harness connector catalogue."),
			WithScope(harnessConfig, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(harnessConfig, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			connectorService := client.ConnectorService{Client: c}
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
