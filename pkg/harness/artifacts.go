package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/pkg/utils"
	"log"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListArtifactsTool creates a tool for listing artifacts in a registry
func ListArtifactsTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_artifacts",
			mcp.WithDescription("List artifacts in a Harness artifact registry."),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination - page 0 is the first page"),
				mcp.Min(0),
			),
			mcp.WithNumber("size",
				mcp.DefaultNumber(10),
				mcp.Description("Number of items per page"),
			),
			mcp.WithString("search",
				mcp.Description("Optional search term to filter artifacts"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			log.Println("Listing artifacts")

			registryRef, err := requiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &ar.GetAllArtifactsByRegistryParams{}

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			pageInt := int64(page)
			params.Page = &pageInt

			size, err := OptionalParam[float64](request, "size")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			sizeInt := int64(size)
			if sizeInt == 0 {
				sizeInt = 10
			}
			params.Size = &sizeInt

			// Handle search parameter
			search, ok, err := OptionalParamOK[string](request, "search")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && search != "" {
				params.SearchTerm = &search
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			ref := utils.GetScopeRef(scope, registryRef)

			log.Printf("Listing artifacts with ref: %s, size: %d, page: %d", ref, *params.Size, *params.Page)

			// Call the GetAllArtifactsByRegistry API
			response, err := client.Registry.GetAllArtifactsByRegistryWithResponse(ctx, ref, params)
			if err != nil {
				return nil, fmt.Errorf("failed to list artifacts: %w", err)
			}

			if response.JSON200 == nil {
				return nil, fmt.Errorf("failed to list artifacts: unexpected response status %d",
					response.StatusCode())
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal artifacts data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
