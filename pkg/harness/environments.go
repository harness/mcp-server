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
)

// GetEnvironmentTool creates a tool for getting details of a specific environment
// https://apidocs.harness.io/tag/Environments#operation/getEnvironmentV2
func GetEnvironmentTool(config *config.Config, client *client.EnvironmentClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_environment",
			mcp.WithDescription("Get details of a specific environment in Harness."),
			mcp.WithString("environment_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the environment"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			environmentIdentifier, err := requiredParam[string](request, "environment_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Get(ctx, scope, environmentIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get environment: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environment: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListEnvironmentsTool creates a tool for listing environments
// https://apidocs.harness.io/tag/Environments#operation/getEnvironmentList
func ListEnvironmentsTool(config *config.Config, client *client.EnvironmentClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_environments",
			mcp.WithDescription("List environments in Harness."),
			mcp.WithString("sort",
				mcp.Description("Optional field to sort by (e.g., name)"),
			),
			mcp.WithString("order",
				mcp.Description("Optional sort order (asc or desc)"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination (0-based)"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of environments per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.EnvironmentOptions{}

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if page >= 0 {
				opts.Page = int(page)
			}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle other optional parameters
			sort, err := OptionalParam[string](request, "sort")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sort != "" {
				opts.Sort = sort
			}

			order, err := OptionalParam[string](request, "order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if order != "" {
				opts.Order = order
			}

			environments, totalCount, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list environments: %w", err)
			}

			// Create response with environments and metadata
			response := map[string]interface{}{
				"environments": environments,
				"totalCount":   totalCount,
				"pageSize":     opts.Limit,
				"pageNumber":   opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environment list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// MoveEnvironmentConfigsTool creates a tool for moving configurations between environments
// https://apidocs.harness.io/tag/Environments#operation/moveEnvironmentConfigs
func MoveEnvironmentConfigsTool(config *config.Config, client *client.EnvironmentClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("move_environment_configs",
			mcp.WithDescription("Move configurations from one environment to another in Harness."),
			mcp.WithString("source_org",
				mcp.Required(),
				mcp.Description("Source organization identifier"),
			),
			mcp.WithString("source_project",
				mcp.Required(),
				mcp.Description("Source project identifier"),
			),
			mcp.WithString("source_environment",
				mcp.Required(),
				mcp.Description("Source environment identifier"),
			),
			mcp.WithString("target_org",
				mcp.Required(),
				mcp.Description("Target organization identifier"),
			),
			mcp.WithString("target_project",
				mcp.Required(),
				mcp.Description("Target project identifier"),
			),
			mcp.WithString("target_environment",
				mcp.Required(),
				mcp.Description("Target environment identifier"),
			),
			mcp.WithArray("config_types",
				mcp.Required(),
				mcp.Description("Types of configurations to move (e.g., 'Service', 'Infrastructure')"),
			),
			mcp.WithArray("service_refs",
				mcp.Description("Optional list of service references to move"),
			),
			mcp.WithArray("infrastructure_refs",
				mcp.Description("Optional list of infrastructure references to move"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract required parameters
			sourceOrg, err := requiredParam[string](request, "source_org")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			sourceProject, err := requiredParam[string](request, "source_project")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			sourceEnv, err := requiredParam[string](request, "source_environment")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			targetOrg, err := requiredParam[string](request, "target_org")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			targetProject, err := requiredParam[string](request, "target_project")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			targetEnv, err := requiredParam[string](request, "target_environment")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			// Get config_types parameter directly from the request parameters as []interface{} doesn't satisfy the comparable constraint
			param, ok := request.Params.Arguments["config_types"]
			if !ok || param == nil {
				return mcp.NewToolResultError("config_types is required"), nil
			}
			
			configTypesRaw, ok := param.([]interface{})
			if !ok || len(configTypesRaw) == 0 {
				return mcp.NewToolResultError("config_types must be a non-empty array"), nil
			}
			
			// Convert config types to strings
			configTypes := make([]string, 0, len(configTypesRaw))
			for _, ct := range configTypesRaw {
				if configType, ok := ct.(string); ok {
					configTypes = append(configTypes, configType)
				}
			}
			
			if len(configTypes) == 0 {
				return mcp.NewToolResultError("at least one config type must be specified"), nil
			}

			// Create move request
			moveRequest := &dto.MoveEnvironmentConfigsRequest{
				SourceEnvironmentRef: dto.EnvironmentRef{
					OrgIdentifier:     sourceOrg,
					ProjectIdentifier: sourceProject,
					Identifier:        sourceEnv,
				},
				TargetEnvironmentRef: dto.EnvironmentRef{
					OrgIdentifier:     targetOrg,
					ProjectIdentifier: targetProject,
					Identifier:        targetEnv,
				},
				ConfigTypes: configTypes,
			}
			
			// Process optional service refs - get directly from parameters to avoid comparable constraint issues
			serviceRefsParam, serviceRefsOk := request.Params.Arguments["service_refs"]
			serviceRefsRaw := make([]interface{}, 0)
			if serviceRefsOk && serviceRefsParam != nil {
				if serviceRefs, ok := serviceRefsParam.([]interface{}); ok {
					serviceRefsRaw = serviceRefs
				}
			}
			if len(serviceRefsRaw) > 0 {
				serviceRefs := make([]dto.ServiceRef, 0, len(serviceRefsRaw))
				for _, sr := range serviceRefsRaw {
					if srvMap, ok := sr.(map[string]interface{}); ok {
						org, _ := srvMap["org_identifier"].(string)
						project, _ := srvMap["project_identifier"].(string)
						id, _ := srvMap["identifier"].(string)
						
						if org != "" && project != "" && id != "" {
							serviceRefs = append(serviceRefs, dto.ServiceRef{
								OrgIdentifier:     org,
								ProjectIdentifier: project,
								Identifier:        id,
							})
						}
					}
				}
				moveRequest.ServiceRefs = serviceRefs
			}
			
			// Process optional infrastructure refs - get directly from parameters to avoid comparable constraint issues
			infraRefsParam, infraRefsOk := request.Params.Arguments["infrastructure_refs"]
			infraRefsRaw := make([]interface{}, 0)
			if infraRefsOk && infraRefsParam != nil {
				if infraRefs, ok := infraRefsParam.([]interface{}); ok {
					infraRefsRaw = infraRefs
				}
			}
			if len(infraRefsRaw) > 0 {
				infraRefs := make([]dto.InfrastructureRef, 0, len(infraRefsRaw))
				for _, ir := range infraRefsRaw {
					if infraMap, ok := ir.(map[string]interface{}); ok {
						org, _ := infraMap["org_identifier"].(string)
						project, _ := infraMap["project_identifier"].(string)
						id, _ := infraMap["identifier"].(string)
						
						if org != "" && project != "" && id != "" {
							infraRefs = append(infraRefs, dto.InfrastructureRef{
								OrgIdentifier:     org,
								ProjectIdentifier: project,
								Identifier:        id,
							})
						}
					}
				}
				moveRequest.InfrastructureRefs = infraRefs
			}

			// Execute the move operation
			success, err := client.MoveConfigs(ctx, moveRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to move environment configurations: %w", err)
			}

			// Create the response
			response := map[string]interface{}{
				"success": success,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
