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

// GetRegistryTool creates a tool for getting a specific registry
func GetRegistryTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_registry",
			mcp.WithDescription("Get details of a specific registry in Harness artifact registry."),
			mcp.WithString("registry",
				mcp.Required(),
				mcp.Description("The name of the registry"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			registryRef, err := requiredParam[string](request, "registry")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the GetRegistry API
			ref := utils.GetScopeRef(scope, registryRef)
			response, err := client.Registry.GetRegistryWithResponse(ctx, ref)
			if err != nil {
				return nil, fmt.Errorf("failed to get registry: %w", err)
			}

			if response.JSON200 == nil {
				return nil, fmt.Errorf("failed to get registry: unexpected response status %d", response.StatusCode())
			}

			// ["foo","bar"]
			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal registry data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListRegistriesTool creates a tool for listing registries
func ListRegistriesTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_registries",
			mcp.WithDescription("List registries in Harness artifact registry."),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination - page 0 is the first page"),
				mcp.Min(0),
			),
			mcp.WithNumber("size",
				mcp.DefaultNumber(10),
				mcp.Description("Number of items per page"),
			),
			mcp.WithString("type",
				mcp.Description("Optional type to filter registries (UPSTREAM or VIRTUAL)"),
			),
			mcp.WithString("package_type",
				mcp.Description("Optional type to filter registries by package type (DOCKER, HELM, MAVEN, etc)"),
			),

			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			log.Println("Listing registries")
			params := &ar.GetAllRegistriesParams{}
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

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			ref := utils.GetScopeRef(scope)

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

			log.Printf("Listing registries with ref: %s, size: %d, page: %d", ref, *params.Size, *params.Page)

			// Call the GetAllRegistries API
			response, err := client.Registry.GetAllRegistriesWithResponse(ctx, ref, params)
			if err != nil {
				return nil, fmt.Errorf("failed to list registries: %w", err)
			}

			if response.JSON200 == nil {
				return nil, fmt.Errorf("failed to list registries: unexpected response status %d",
					response.StatusCode())
			}

			r, err := json.Marshal(response.JSON200.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal registries data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
