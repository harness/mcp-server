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

// GetRegistryTool creates a tool for getting a specific registry
func GetRegistryTool(config *config.Config, client *ar.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_registry",
			mcp.WithDescription("Get details of a specific registry in Harness artifact registry"),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			registryRef, err := RequiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the GetRegistry API
			ref := utils.GetRef(scope, registryRef)
			response, err := client.GetRegistryWithResponse(ctx, ref)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if response.JSON200 == nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to get registry: unexpected response status %d",
					response.StatusCode()).Error()), nil
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListRegistriesTool creates a tool for listing registries
func ListRegistriesTool(config *config.Config, client *ar.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_registries",
			mcp.WithDescription("List registries in Harness artifact registry"),
			mcp.WithString("type",
				mcp.Description("Optional type to filter registries"),
				mcp.Enum(string(ar.RegistryTypeParamUPSTREAM), string(ar.RegistryTypeParamVIRTUAL)),
			),
			mcp.WithString("package_type",
				mcp.Description("Optional type to filter registries by package type"),
				mcp.Enum(string(ar.DOCKER), string(ar.HELM), string(ar.MAVEN), string(ar.GENERIC)),
			),
			WithPagination(),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &ar.GetAllRegistriesParams{}
			pageInt, sizeInt, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			pageInt64, sizeInt64 := int64(pageInt), int64(sizeInt)
			params.Page = &pageInt64
			params.Size = &sizeInt64

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			ref := utils.GetRef(scope)

			packageType, ok, err := OptionalParamOK[string](request, "package_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && len(packageType) > 0 {
				pkgType := []string{packageType}
				params.PackageType = &pkgType
			}

			// Handle type parameter
			registryType, ok, err := OptionalParamOK[string](request, "type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && registryType != "" {
				regType := ar.GetAllRegistriesParamsType(registryType)
				params.Type = &regType
			}

			// Call the GetAllRegistries API
			response, err := client.GetAllRegistriesWithResponse(ctx, ref, params)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if response.JSON200 == nil {
				return mcp.NewToolResultError(fmt.Errorf("failed to list registries: unexpected response status %d",
					response.StatusCode()).Error()), nil
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
