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

// GetSecretTool creates a tool for retrieving a secret from Harness
func GetSecretTool(config *config.Config, client *client.SecretsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_secret",
			mcp.WithDescription("Get a secret by identifier from Harness."),
			mcp.WithString("secret_identifier",
				mcp.Required(),
				mcp.Description("Identifier of the secret to retrieve"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			secretIdentifier, err := RequiredParam[string](request, "secret_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the client to get the secret
			response, err := client.GetSecret(ctx, scope, secretIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get secret: %w", err)
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal secret response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
