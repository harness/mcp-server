package harness

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

// ListArtifactVersionsTool creates a tool for listing artifact versions in a registry
func ListArtifactVersionsTool(config *config.Config, client *ar.ClientWithResponses) (
	tool mcp.Tool,
	handler server.ToolHandlerFunc,
) {
	return mcp.NewTool("list_artifact_versions",
			mcp.WithDescription("List artifact versions in a Harness artifact registry"),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			mcp.WithString("artifact",
				mcp.Required(),
				mcp.Description("The name of the artifact"),
			),
			mcp.WithString("search",
				mcp.Description("Optional search term to filter versions"),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			registryRef, err := requiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			artifactRef, err := requiredParam[string](request, "artifact")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &ar.GetAllArtifactVersionsParams{}

			pageInt, sizeInt, err := fetchPagination(request)
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

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			registryFullRef := utils.GetRef(scope, registryRef)

			// Call the GetAllArtifactVersions API
			response, err := client.GetAllArtifactVersionsWithResponse(ctx, registryFullRef, artifactRef,
				params)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if response.JSON200 == nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to list artifact versions: unexpected response status %d",
					response.StatusCode()).Error()), nil
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to marshal versions data: %w", err).Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListArtifactFilesTool creates a tool for listing files for a specific artifact version in a registry
func ListArtifactFilesTool(config *config.Config, client *ar.ClientWithResponses) (
	tool mcp.Tool,
	handler server.ToolHandlerFunc,
) {
	return mcp.NewTool("list_artifact_files",
			mcp.WithDescription("List files for a specific artifact version in a Harness artifact registry"),
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
			mcp.WithString("sort_order",
				mcp.Description("Optional sort order"),
				mcp.Enum("asc", "desc"),
			),
			mcp.WithString("sort_field",
				mcp.Description("Optional field to sort by"),
				mcp.Enum("updatedAt"),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
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

			pageInt, sizeInt, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			pageInt64, sizeInt64 := int64(pageInt), int64(sizeInt)
			params.Page = &pageInt64
			params.Size = &sizeInt64

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
			registryFullRef := utils.GetRef(scope, registryRef)

			// Call the GetArtifactFiles API
			response, err := client.GetArtifactFilesWithResponse(ctx, registryFullRef, artifactRef, versionRef,
				params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to list artifact files: %w", err).Error()), nil
			}

			if response.JSON200 == nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to list artifact files: unexpected response status %d",
					response.StatusCode()).Error()), nil
			}

			r, err := json.Marshal(response.JSON200)
			if err != nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to marshal files data: %w", err).Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
