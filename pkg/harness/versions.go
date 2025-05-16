package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/pkg/utils"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListVersionsTool creates a tool for listing artifact versions in a registry
func ListVersionsTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_versions",
			mcp.WithDescription("List artifact versions in a Harness artifact registry."),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			mcp.WithString("artifact",
				mcp.Required(),
				mcp.Description("The name of the artifact"),
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
				mcp.Description("Optional search term to filter versions"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			log.Println("Listing artifact versions")

			registryRef, err := requiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			artifactRef, err := requiredParam[string](request, "artifact")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &ar.GetAllArtifactVersionsParams{}

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
			registryFullRef := utils.GetScopeRef(scope, registryRef)

			log.Printf("Listing versions for registry: %s, artifact: %s, size: %d, page: %d", registryFullRef,
				artifactRef, *params.Size, *params.Page)

			// Call the GetAllArtifactVersions API
			response, err := client.Registry.GetAllArtifactVersionsWithResponse(ctx, registryFullRef, artifactRef,
				params)
			if err != nil {
				return nil, fmt.Errorf("failed to list artifact versions: %w", err)
			}

			if response.JSON200 == nil {
				return nil, fmt.Errorf("failed to list artifact versions: unexpected response status %d",
					response.StatusCode())
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal versions data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListFilesTool creates a tool for listing files for a specific artifact version in a registry
func ListFilesTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_files",
			mcp.WithDescription("List files for a specific artifact version in a Harness artifact registry."),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			mcp.WithString("artifact",
				mcp.Required(),
				mcp.Description("The name of the artifact"),
			),
			mcp.WithString("version",
				mcp.Required(),
				mcp.Description("The version of the artifact"),
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
			mcp.WithString("sort_order",
				mcp.Description("Optional sort order (asc or desc)"),
			),
			mcp.WithString("sort_field",
				mcp.Description("Optional field to sort by"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			log.Println("Listing artifact files")

			registryRef, err := requiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			artifactRef, err := requiredParam[string](request, "artifact")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			versionRef, err := requiredParam[string](request, "version")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &ar.GetArtifactFilesParams{}

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

			// Handle sort options
			sortOrder, ok, err := OptionalParamOK[string](request, "sort_order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortOrder != "" {
				params.SortOrder = &sortOrder
			}

			sortField, ok, err := OptionalParamOK[string](request, "sort_field")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortField != "" {
				params.SortField = &sortField
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			registryFullRef := utils.GetScopeRef(scope, registryRef)

			log.Printf("Listing files for registry: %s, artifact: %s, version: %s, size: %d, page: %d",
				registryFullRef, artifactRef, versionRef, *params.Size, *params.Page)

			// Call the GetArtifactFiles API
			response, err := client.Registry.GetArtifactFilesWithResponse(ctx, registryFullRef, artifactRef, versionRef,
				params)
			if err != nil {
				return nil, fmt.Errorf("failed to list artifact files: %w", err)
			}

			if response.JSON200 == nil {
				return nil, fmt.Errorf("failed to list artifact files: unexpected response status %d",
					response.StatusCode())
			}

			r, err := json.Marshal(response.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal files data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
