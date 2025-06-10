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

// ListInfrastructuresTool creates a tool for listing infrastructures
// https://apidocs.harness.io/tag/Infrastructures#operation/getInfrastructureList
func ListInfrastructuresTool(config *config.Config, client *client.InfrastructureClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_infrastructures",
			mcp.WithDescription("List infrastructure definitions in Harness."),
			mcp.WithString("type",
				mcp.Description("Optional filter for infrastructure type"),
			),
			mcp.WithString("deployment",
				mcp.Description("Optional filter for deployment type (e.g., Kubernetes, ECS)"),
			),
			mcp.WithString("environment",
				mcp.Description("Optional filter for environment"),
			),
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
				mcp.Description("Number of infrastructures per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.InfrastructureOptions{}

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

			// Handle filters
			infraType, err := OptionalParam[string](request, "type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if infraType != "" {
				opts.Type = infraType
			}

			deployment, err := OptionalParam[string](request, "deployment")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if deployment != "" {
				opts.Deployment = deployment
			}

			environment, err := OptionalParam[string](request, "environment")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if environment != "" {
				opts.Environment = environment
			}

			// Handle sorting
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

			infrastructures, totalCount, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list infrastructures: %w", err)
			}

			// Create response with infrastructures and metadata
			response := map[string]interface{}{
				"infrastructures": infrastructures,
				"totalCount":      totalCount,
				"pageSize":        opts.Limit,
				"pageNumber":      opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal infrastructures list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// MoveInfrastructureConfigsTool creates a tool for moving configurations between infrastructures
// https://apidocs.harness.io/tag/Infrastructures#operation/moveInfraConfigs
func MoveInfrastructureConfigsTool(config *config.Config, client *client.InfrastructureClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("move_infrastructure_configs",
			mcp.WithDescription("Move configurations from one infrastructure to another in Harness."),
			mcp.WithString("source_org",
				mcp.Required(),
				mcp.Description("Source organization identifier"),
			),
			mcp.WithString("source_project",
				mcp.Required(),
				mcp.Description("Source project identifier"),
			),
			mcp.WithString("source_infrastructure",
				mcp.Required(),
				mcp.Description("Source infrastructure identifier"),
			),
			mcp.WithString("target_org",
				mcp.Required(),
				mcp.Description("Target organization identifier"),
			),
			mcp.WithString("target_project",
				mcp.Required(),
				mcp.Description("Target project identifier"),
			),
			mcp.WithString("target_infrastructure",
				mcp.Required(),
				mcp.Description("Target infrastructure identifier"),
			),
			mcp.WithArray("config_types",
				mcp.Required(),
				mcp.Description("Types of configurations to move"),
			),
			mcp.WithArray("service_refs",
				mcp.Description("Optional list of service references to move"),
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
			sourceInfra, err := requiredParam[string](request, "source_infrastructure")
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
			targetInfra, err := requiredParam[string](request, "target_infrastructure")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			configTypesRaw, err := requiredParam[[]interface{}](request, "config_types")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
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
			moveRequest := &dto.MoveInfraConfigsRequest{
				SourceInfrastructureRef: dto.InfrastructureRef{
					OrgIdentifier:     sourceOrg,
					ProjectIdentifier:  sourceProject,
					Identifier:        sourceInfra,
				},
				TargetInfrastructureRef: dto.InfrastructureRef{
					OrgIdentifier:     targetOrg,
					ProjectIdentifier:  targetProject,
					Identifier:        targetInfra,
				},
				ConfigTypes: configTypes,
			}
			
			// Process optional service refs
			serviceRefsRaw, err := OptionalParam[[]interface{}](request, "service_refs")
			if err == nil && len(serviceRefsRaw) > 0 {
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

			// Execute the move operation
			success, err := client.MoveConfigs(ctx, moveRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to move infrastructure configurations: %w", err)
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
