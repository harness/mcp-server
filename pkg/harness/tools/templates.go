package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListTemplates creates a tool that allows querying templates at all scopes (account, org, project)
// depending on the input parameters.
func ListTemplates(config *config.Config, client *client.TemplateService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_templates",
			mcp.WithDescription("List templates at account, organization, or project scope depending on the provided parameters."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter templates"),
			),
			mcp.WithString("entity_type",
				mcp.Description("Type of Template - Enum: Step, Stage, Pipeline, CustomDeployment, MonitoredService, SecretManager"),
				mcp.Enum("Step", "Stage", "Pipeline", "CustomDeployment", "MonitoredService", "SecretManager"),
			),
			mcp.WithString("scope",
				mcp.Description("Scope level to query templates from (account, org, project). If not specified, defaults to project if org_id and project_id are provided, org if only org_id is provided, or account otherwise."),
				mcp.Enum("account", "org", "project"),
			),
			mcp.WithBoolean("recursive",
				mcp.Description("If true, returns all supported templates at the specified scope. Default: false"),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Fetch pagination parameters
			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch optional parameters
			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get entity_type parameter if provided
			entityType, err := OptionalParam[string](request, "entity_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get recursive parameter (defaults to false if not provided)
			recursive, err := OptionalParam[bool](request, "recursive")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create options object
			opts := &dto.TemplateListOptions{
				SearchTerm: searchTerm,
				Page:       page,
				Limit:      size,
				Recursive:  recursive,
			}

			// Add entity_type to EntityTypes array if provided
			if entityType != "" {
				opts.EntityTypes = []string{entityType}
			}

			// Determine scope from parameters
			scopeParam, err := OptionalParam[string](request, "scope")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Try to fetch scope parameters (org_id, project_id) if provided
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// If scope is not explicitly specified, determine it from available parameters
			if scopeParam == "" {
				if scope.ProjectID != "" && scope.OrgID != "" {
					scopeParam = "project"
				} else if scope.OrgID != "" {
					scopeParam = "org"
				} else {
					scopeParam = "account"
				}
			}

			// Call appropriate API based on scope
			var data *dto.TemplateMetaDataList
			switch scopeParam {
			case "account":
				data, err = client.ListAccount(ctx, opts)
				if err != nil {
					return nil, fmt.Errorf("failed to list account templates: %w", err)
				}
			case "org":
				if scope.OrgID == "" {
					return mcp.NewToolResultError("org_id is required for org scope"), nil
				}
				data, err = client.ListOrg(ctx, scope, opts)
				if err != nil {
					return nil, fmt.Errorf("failed to list org templates: %w", err)
				}
			case "project":
				if scope.OrgID == "" || scope.ProjectID == "" {
					return mcp.NewToolResultError("org_id and project_id are required for project scope"), nil
				}
				data, err = client.ListProject(ctx, scope, opts)
				if err != nil {
					return nil, fmt.Errorf("failed to list project templates: %w", err)
				}
			default:
				return mcp.NewToolResultError(fmt.Sprintf("invalid scope: %s", scopeParam)), nil
			}

			// Create a new TemplateListOutput from the data
			templateListOutput := dto.ToTemplateResponse(data)

			// Marshal and return the result
			r, err := json.Marshal(templateListOutput)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal template list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetTemplateTool creates a tool that allows getting a specific template
func GetTemplateTool(config *config.Config, client *client.TemplateService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_template",
			mcp.WithDescription("Get details of a specific template in Harness."),
			mcp.WithString("template_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the template to retrieve"),
			),
			mcp.WithString("version_label",
				mcp.Description("Optional version label of the template. If not provided, returns the stable/default version"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get required template identifier
			templateIdentifier, err := RequiredParam[string](request, "template_identifier")
			if err != nil {
				slog.ErrorContext(ctx, "Failed to get template_identifier parameter", "error", err)
				return mcp.NewToolResultError(err.Error()), nil
			}

			slog.InfoContext(ctx, "GetTemplateTool called", "template_identifier", templateIdentifier)

			// Get optional version label
			versionLabel, err := OptionalParam[string](request, "version_label")
			if err != nil {
				slog.ErrorContext(ctx, "Failed to get version_label parameter", "error", err)
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Determine scope from parameters
			scopeParam, err := OptionalParam[string](request, "scope")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch scope parameters
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				slog.ErrorContext(ctx, "Failed to fetch scope", "error", err)
				return mcp.NewToolResultError(err.Error()), nil
			}

			slog.InfoContext(ctx, "Fetched scope", "org", scope.OrgID, "project", scope.ProjectID, "account", scope.AccountID)

			// If scope is not explicitly specified, determine it from available parameters
			if scopeParam == "" {
				if scope.ProjectID != "" && scope.OrgID != "" {
					scopeParam = "project"
				} else if scope.OrgID != "" {
					scopeParam = "org"
				} else {
					scopeParam = "account"
				}
			}

			// Call appropriate API based on scope
			var data *dto.TemplateGetResponse
			switch scopeParam {
			case "account":
				data, err = client.GetAccount(ctx, scope, templateIdentifier, versionLabel)
				if err != nil {
					slog.ErrorContext(ctx, "Failed to get account template from client", "error", err)
					return nil, fmt.Errorf("failed to get account template: %w", err)
				}
			case "org":
				if scope.OrgID == "" {
					return mcp.NewToolResultError("org_id is required for org scope"), nil
				}
				data, err = client.GetOrg(ctx, scope, templateIdentifier, versionLabel)
				if err != nil {
					slog.ErrorContext(ctx, "Failed to get org template from client", "error", err)
					return nil, fmt.Errorf("failed to get org template: %w", err)
				}
			case "project":
				if scope.OrgID == "" || scope.ProjectID == "" {
					return mcp.NewToolResultError("org_id and project_id are required for project scope"), nil
				}
				data, err = client.GetProject(ctx, scope, templateIdentifier, versionLabel)
				if err != nil {
					slog.ErrorContext(ctx, "Failed to get project template from client", "error", err)
					return nil, fmt.Errorf("failed to get project template: %w", err)
				}
			default:
				return mcp.NewToolResultError(fmt.Sprintf("invalid scope: %s", scopeParam)), nil
			}

			slog.InfoContext(ctx, "Got template data", "identifier", data.Template.Identifier, "name", data.Template.Name, "hasYaml", data.Template.Yaml != "")

			// Marshal and return the result
			r, err := json.Marshal(data)
			if err != nil {
				slog.ErrorContext(ctx, "Failed to marshal template", "error", err)
				return nil, fmt.Errorf("failed to marshal template: %w", err)
			}

			slog.InfoContext(ctx, "Returning template JSON", "length", len(r))

			return mcp.NewToolResultText(string(r)), nil
		}
}
