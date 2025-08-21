package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListArtifactsTool creates a tool for listing artifacts in a registry
func ListArtifactsTool(config *config.Config, client *ar.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_artifacts",
			mcp.WithDescription("List artifacts in a Harness artifact registry"),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			mcp.WithString("search",
				mcp.Description("Optional search term to filter artifacts"),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			registryRef, err := RequiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &ar.GetAllArtifactsByRegistryParams{}

			pageInt, sizeInt, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			pageInt64, sizeInt64 := int64(pageInt), int64(sizeInt)
			params.Page = &pageInt64
			params.Size = &sizeInt64

			// Handle search parameter
			search, ok, err := OptionalParamOK[string](request, "search")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && search != "" {
				params.SearchTerm = &search
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if scope.AccountID == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", scope.AccountID)

			ref := utils.GetRef(scope, registryRef)

			// Call the GetAllArtifactsByRegistry API
			response, err := client.GetAllArtifactsByRegistryWithResponse(ctx, ref, params)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if response.JSON200 == nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to list artifacts: unexpected response status %d",
					response.StatusCode()).Error()), nil
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
