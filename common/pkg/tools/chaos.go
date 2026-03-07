package tools

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/harness/harness-go-sdk/harness/utils"
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var identityRegex = regexp.MustCompile(`[^a-z0-9-]+`)

// ListExperimentsTool creates a tool for listing the experiments
func ListExperimentsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiments_list",
			mcp.WithDescription("List the chaos experiments"),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListExperiments(ctx, scope, pagination)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetExperimentsTool creates a tool to get the experiment details
func GetExperimentsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_describe",
			mcp.WithDescription("Retrieves information about chaos experiment, allowing users to get an overview and detailed insights for each experiment"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experiment ID %s, expected a valid UUID", experimentID)), nil
				}
			}

			data, err := client.GetExperiment(ctx, scope, experimentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetExperimentRunsTool creates a tool to get the experiment run details
func GetExperimentRunsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_run_result",
			mcp.WithDescription("Retrieves run result of chaos experiment runs, helping to describe and summarize the details of each experiment run"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
			mcp.WithString("experimentRunID",
				mcp.Description("Unique Identifier for an experiment run"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
				}
			}

			experimentRunID, err := RequiredParam[string](request, "experimentRunID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentRunID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentRunID %s, expected a valid UUID", experimentRunID)), nil
				}
			}

			data, err := client.GetExperimentRun(ctx, scope, experimentID, experimentRunID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get chaos experiment run response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// RunExperimentTool creates a tool to run the experiment
func RunExperimentTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_run",
			mcp.WithDescription("Run the chaos experiment"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
			mcp.WithString("inputsetIdentity",
				mcp.Description("Optional inputset identity to use for the experiment run"),
			),
			mcp.WithArray("experimentVariables",
				mcp.Description("Optional experiment variables as an array of objects where each object has a name and value"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name": map[string]any{
							"type":        "string",
							"description": "Name of the variable",
						},
						"value": map[string]any{
							"type":        "string",
							"description": "Value of the variable",
						},
					},
					"required": []string{"name"},
				}),
			),
			mcp.WithObject("tasks",
				mcp.Description("Optional task-level variables as a map where key is task name and value is an object of variable name-value pairs"),
				mcp.Properties(map[string]any{}), // no fixed props
				mcp.AdditionalProperties(map[string]any{
					"type":                 "object",
					"additionalProperties": map[string]any{},
				}),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
				}
			}

			inputsetIdentity, err := OptionalParam[string](request, "inputsetIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentVariablesRaw, err := OptionalParam[[]interface{}](request, "experimentVariables")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			taskVariablesRaw, err := OptionalParam[map[string]any](request, "tasks")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentRunRequest := getRuntimeVariables(inputsetIdentity, experimentVariablesRaw, taskVariablesRaw)

			if err := validateVariables(ctx, scope, experimentID, client, experimentRunRequest); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.RunExperiment(ctx, scope, experimentID, experimentRunRequest)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal run chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListProbesTool creates a tool for listing the probes
func ListProbesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probes_list",
			mcp.WithDescription("List the chaos probes"),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListProbes(ctx, scope, pagination)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos probes response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetProbeTool creates a tool to get the probe details
func GetProbeTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_describe",
			mcp.WithDescription("Retrieves information about chaos probe, allowing users to get an overview and detailed insights for each probe"),
			common.WithScope(config, false),
			mcp.WithString("probeId",
				mcp.Description("Unique Identifier for a probe"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			probeID, err := RequiredParam[string](request, "probeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetProbe(ctx, scope, probeID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get chaos probe response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CreateExperimentFromTemplateTool creates a tool to create the experiment from template
func CreateExperimentFromTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_create_experiment_from_template",
			mcp.WithDescription("Create the chaos experiment from template"),
			common.WithScope(config, false),
			mcp.WithString("templateId",
				mcp.Description("Unique Identifier for a experiment template"),
				mcp.Required(),
			),
			mcp.WithString("infraId",
				mcp.Description("Unique Identifier for a infrastructure"),
				mcp.Required(),
			),
			mcp.WithString("environmentId",
				mcp.Description("Unique Identifier for a environment"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique Identifier for a chaos hub"),
				mcp.Required(),
			),
			mcp.WithString("name",
				mcp.Description("User defined name of the experiment"),
			),
			mcp.WithString("identity",
				mcp.Description("User defined identity of the experiment"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateID, err := RequiredParam[string](request, "templateId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infraID, err := RequiredParam[string](request, "infraId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environmentID, err := RequiredParam[string](request, "environmentId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !strings.HasPrefix(infraID, fmt.Sprintf("%s/", environmentID)) {
				infraID = fmt.Sprintf("%s/%s", environmentID, infraID)
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := OptionalParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if name == "" {
				name = fmt.Sprintf("%s-%s", templateID, utils.RandStringBytes(3))
			}

			identity, err := OptionalParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if identity == "" {
				identity = generateIdentity(name)
			}

			requestPayload := dto.CreateExperimentFromTemplateRequest{
				InfraRef: infraID,
				IdentifiersQuery: dto.IdentifiersQuery{
					AccountIdentifier:      scope.AccountID,
					OrganizationIdentifier: scope.OrgID,
					ProjectIdentifier:      scope.ProjectID,
				},
				Name:     name,
				Identity: identity,
			}

			data, err := client.CreateExperimentFromTemplateRequest(ctx, scope, templateID, hubIdentity, requestPayload)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal create chaos experiment from template response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListExperimentTemplatesTool creates a tool for listing the experiment templates
func ListExperimentTemplatesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_list",
			mcp.WithDescription("List the chaos experiment templates from chaos hubs."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique Identifier for a chaos hub"),
			),
			mcp.WithString("infrastructureType",
				mcp.Description("Infrastructure type filter (e.g. Kubernetes)"),
			),
			mcp.WithString("infrastructure",
				mcp.Description("Infrastructure filter (e.g. KubernetesV2)"),
			),
			mcp.WithString("search",
				mcp.Description("Search templates by name or identity"),
			),
			mcp.WithString("sortField",
				mcp.Description("Field to sort results by"),
				mcp.Enum("name", "lastUpdated", "experimentName"),
			),
			mcp.WithBoolean("sortAscending",
				mcp.Description("When true, sort in ascending order. Defaults to false (descending)."),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns templates from all orgs and projects in the account. When false (default), returns only templates in the current org and project."),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags to filter by. Templates must have ALL specified tags (AND filter)."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := OptionalParam[string](request, "hubIdentity")
			infrastructureType, _ := OptionalParam[string](request, "infrastructureType")
			infrastructure, _ := OptionalParam[string](request, "infrastructure")
			search, _ := OptionalParam[string](request, "search")
			sortField, _ := OptionalParam[string](request, "sortField")
			sortAscending, _ := OptionalParam[bool](request, "sortAscending")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")
			tags, _ := OptionalParam[string](request, "tags")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListExperimentTemplates(ctx, scope, pagination, hubIdentity, infrastructureType, infrastructure, search, sortField, sortAscending, includeAllScope, tags)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos experiment templates response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetExperimentTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_describe",
			mcp.WithDescription("Retrieves detailed information about a specific chaos experiment template by its identity, including its spec, variables, revision, and metadata."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the experiment template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the template"),
				mcp.Required(),
			),
			mcp.WithString("revision",
				mcp.Description("Specific revision of the template to retrieve. If omitted, the latest revision is returned."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, "revision")

			data, err := client.GetExperimentTemplate(ctx, scope, identity, hubIdentity, revision)
			if err != nil {
				return nil, fmt.Errorf("failed to get experiment template: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal experiment template response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteExperimentTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_delete",
			mcp.WithDescription("Deletes a chaos experiment template by its identity (soft delete). The template must not be referenced by any existing experiment, otherwise the delete will be rejected."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the experiment template to delete"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the template"),
				mcp.Required(),
			),
			mcp.WithBoolean("verbose",
				mcp.Description("When true, enables verbose server-side logging for debugging."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			verbose, _ := OptionalParam[bool](request, "verbose")

			if err := client.DeleteExperimentTemplate(ctx, scope, identity, hubIdentity, verbose); err != nil {
				return nil, fmt.Errorf("failed to delete experiment template: %w", err)
			}

			return mcp.NewToolResultText(`{"deleted":true}`), nil
		}
}

func GetExperimentTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_revisions",
			mcp.WithDescription("Lists all revisions of a specific chaos experiment template by its identity. Supports pagination, search, sort, and filtering."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the experiment template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the template"),
				mcp.Required(),
			),
			mcp.WithString("infrastructureType",
				mcp.Description("Infrastructure type filter (e.g. Kubernetes)"),
			),
			mcp.WithString("infrastructure",
				mcp.Description("Infrastructure filter (e.g. KubernetesV2)"),
			),
			mcp.WithString("search",
				mcp.Description("Search revisions by name or identity"),
			),
			mcp.WithString("sortField",
				mcp.Description("Field to sort results by"),
				mcp.Enum("name", "lastUpdated", "experimentName"),
			),
			mcp.WithBoolean("sortAscending",
				mcp.Description("When true, sort in ascending order. Defaults to false (descending)."),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns templates from all orgs and projects in the account. When false (default), returns only templates in the current org and project."),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags to filter by. Templates must have ALL specified tags (AND filter)."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infrastructureType, _ := OptionalParam[string](request, "infrastructureType")
			infrastructure, _ := OptionalParam[string](request, "infrastructure")
			search, _ := OptionalParam[string](request, "search")
			sortField, _ := OptionalParam[string](request, "sortField")
			sortAscending, _ := OptionalParam[bool](request, "sortAscending")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")
			tags, _ := OptionalParam[string](request, "tags")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.GetExperimentTemplateRevisions(ctx, scope, identity, hubIdentity, pagination, infrastructureType, infrastructure, search, sortField, sortAscending, includeAllScope, tags)
			if err != nil {
				return nil, fmt.Errorf("failed to get experiment template revisions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal experiment template revisions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetExperimentTemplateVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_variables",
			mcp.WithDescription("Retrieves the input variables (faults, probes, actions) of a specific chaos experiment template. Useful for understanding what inputs are needed before launching an experiment from a template."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the experiment template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the template"),
				mcp.Required(),
			),
			mcp.WithString("revision",
				mcp.Description("Specific revision of the template. If omitted, the latest revision is used."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, "revision")

			data, err := client.GetExperimentTemplateVariables(ctx, scope, identity, hubIdentity, revision)
			if err != nil {
				return nil, fmt.Errorf("failed to get experiment template variables: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal experiment template variables response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetExperimentTemplateYamlTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_yaml",
			mcp.WithDescription("Retrieves the YAML representation of a specific chaos experiment template. Returns the raw template YAML string for a given revision."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the experiment template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the template"),
				mcp.Required(),
			),
			mcp.WithString("revision",
				mcp.Description("Specific revision of the template. If omitted, the latest revision is used."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, "revision")

			data, err := client.GetExperimentTemplateYaml(ctx, scope, identity, hubIdentity, revision)
			if err != nil {
				return nil, fmt.Errorf("failed to get experiment template yaml: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal experiment template yaml response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func CompareExperimentTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_compare",
			mcp.WithDescription("Compares two revisions of a chaos experiment template, returning the YAML of both revisions for diff comparison. Both revision1 and revision2 are required."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the experiment template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the template"),
				mcp.Required(),
			),
			mcp.WithString("revision1",
				mcp.Description("First revision identifier for comparison"),
				mcp.Required(),
			),
			mcp.WithString("revision2",
				mcp.Description("Second revision identifier for comparison"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision1, err := RequiredParam[string](request, "revision1")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision2, err := RequiredParam[string](request, "revision2")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.CompareExperimentTemplateRevisions(ctx, scope, identity, hubIdentity, revision1, revision2)
			if err != nil {
				return nil, fmt.Errorf("failed to compare experiment template revisions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal compare revisions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListExperimentVariablesTool creates a tool for listing the experiment variables
func ListExperimentVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_variables_list",
			mcp.WithDescription("List the chaos experiment variables"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				return nil, fmt.Errorf("invalid experiment ID %s, expected a valid UUID", experimentID)
			}

			data, err := client.ListExperimentVariables(ctx, scope, experimentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos experiment variables response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func isValidUUID(u string) bool {
	_, err := uuid.Parse(u)
	return err == nil
}

// generateIdentity converts a name string into a valid identity.
// Allowed characters: lowercase letters, digits, and hyphens.
func generateIdentity(name string) string {
	// Convert to lowercase
	identity := strings.ToLower(name)

	// Replace spaces and underscores with hyphens
	identity = strings.ReplaceAll(identity, " ", "-")
	identity = strings.ReplaceAll(identity, "_", "-")

	// Remove all invalid characters (anything not a-z, 0-9, or hyphen)
	identity = identityRegex.ReplaceAllString(identity, "")

	// Remove leading or trailing hyphens
	identity = strings.Trim(identity, "-")

	return identity
}

func validateVariables(ctx context.Context, scope dto.Scope, experimentID string, client *client.ChaosService, experimentRunRequest *dto.ExperimentRunRequest) error {
	var (
		errMsg = "experiment variables are required. Try running the experiment by providing experiment and tasks variables"
	)

	// validate the inputs
	variables, err := client.ListExperimentVariables(ctx, scope, experimentID)
	if err != nil {
		return fmt.Errorf("failed to list experiment variables: %w", err)
	}

	if variables == nil || (len(variables.Tasks) == 0 && len(variables.Experiment) == 0) {
		return nil
	}

	if experimentRunRequest != nil && experimentRunRequest.InputsetIdentity != "" {
		return nil
	}

	for _, exp := range variables.Experiment {
		if experimentRunRequest == nil || experimentRunRequest.RuntimeInputs == nil {
			return errors.New(errMsg)
		}
		found := false
		for _, x := range experimentRunRequest.RuntimeInputs.Experiment {
			if exp.Name == x.Name {
				found = true
				break
			}
		}
		if !found {
			return errors.New(errMsg)
		}
	}

	for key, tasks := range variables.Tasks {
		if len(tasks) == 0 {
			continue
		}
		if experimentRunRequest == nil || experimentRunRequest.RuntimeInputs == nil {
			return errors.New(errMsg)
		}
		actualTasksVars, ok := experimentRunRequest.RuntimeInputs.Tasks[key]
		if !ok {
			return errors.New(errMsg)
		}
		for _, task := range tasks {
			found := false
			for _, vars := range actualTasksVars {
				if vars.Name == task.Name {
					found = true
					break
				}
			}
			if !found {
				return errors.New(errMsg)
			}
		}
	}
	return nil
}

func getRuntimeVariables(inputsetIdentity string, experimentVariablesRaw []interface{}, taskVariablesRaw map[string]any) *dto.ExperimentRunRequest {
	var (
		experimentVariables  []dto.VariableMinimum
		tasksVariables       = make(map[string][]dto.VariableMinimum)
		experimentRunRequest *dto.ExperimentRunRequest
	)

	for _, item := range experimentVariablesRaw {
		if itemMap, ok := item.(map[string]interface{}); ok {
			name, ok := itemMap["name"].(string)
			if !ok {
				continue
			}
			value, _ := itemMap["value"]
			experimentVariables = append(experimentVariables, dto.VariableMinimum{
				Name:  name,
				Value: value,
			})
		}
	}

	for key, item := range taskVariablesRaw {
		var taskVariables []dto.VariableMinimum
		if itemMap, ok := item.(map[string]interface{}); ok {
			for name, value := range itemMap {
				taskVariables = append(taskVariables, dto.VariableMinimum{
					Name:  name,
					Value: value,
				})
			}
		}
		tasksVariables[key] = taskVariables
	}

	if len(experimentVariables) > 0 || len(tasksVariables) > 0 {
		inputsetSpec := &dto.ChaosExperimentInputsetSpec{}
		if len(experimentVariables) > 0 {
			inputsetSpec.Experiment = experimentVariables
		}
		if len(tasksVariables) > 0 {
			inputsetSpec.Tasks = tasksVariables
		}
		experimentRunRequest = &dto.ExperimentRunRequest{
			InputsetIdentity: inputsetIdentity,
			RuntimeInputs:    inputsetSpec,
		}
	}

	if inputsetIdentity != "" {
		if experimentRunRequest == nil {
			experimentRunRequest = &dto.ExperimentRunRequest{}
		}
		experimentRunRequest.InputsetIdentity = inputsetIdentity
	}

	return experimentRunRequest
}

// ListLinuxInfrastructuresTool creates a tool for listing Linux infrastructure (load runners)
func ListLinuxInfrastructuresTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_list_linux_infrastructures",
			mcp.WithDescription("List available Linux infrastructure for chaos engineering and load testing. Returns chaos Linux infrastructures (load infrastructures) with their IDs, names, and status. Infra IDs are needed when creating sample load tests via chaos_create_sample_loadtest. By default only active infrastructures are returned; set status to 'All' to list all."),
			common.WithScope(config, false),
			mcp.WithString("status",
				mcp.Description("Filter by infra status. Defaults to 'Active'. Use 'All' to list all infras regardless of status."),
				mcp.Enum("Active", "All"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			statusFilter := "Active"
			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if status == "All" {
				statusFilter = ""
			} else if status != "" {
				statusFilter = status
			}

			data, err := client.ListLinuxInfrastructures(ctx, scope, statusFilter)
			if err != nil {
				return nil, fmt.Errorf("failed to list linux infras: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list linux infras response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListFaultTemplatesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_list",
			mcp.WithDescription("List chaos fault templates from chaos hubs. Supports filtering by hub, type, infrastructure, category, tags, and pagination."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub to list fault templates from"),
			),
			mcp.WithString("type",
				mcp.Description("Fault type filter"),
			),
			mcp.WithString("infrastructureType",
				mcp.Description("Infrastructure type filter (e.g. Kubernetes)"),
			),
			mcp.WithString("infrastructure",
				mcp.Description("Infrastructure filter (e.g. KubernetesV2)"),
			),
			mcp.WithString("search",
				mcp.Description("Search fault templates by name or identity"),
			),
			mcp.WithString("sortField",
				mcp.Description("Field to sort results by"),
				mcp.Enum("name", "lastUpdated"),
			),
			mcp.WithBoolean("sortAscending",
				mcp.Description("When true, sort in ascending order. Defaults to false (descending)."),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns fault templates from all orgs and projects in the account. When false (default), returns only fault templates in the current org and project."),
			),
			mcp.WithBoolean("isEnterprise",
				mcp.Description("When true, filter for enterprise faults only."),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags to filter by. Fault templates must have ALL specified tags (AND filter)."),
			),
			mcp.WithString("category",
				mcp.Description("Comma-separated list of categories to filter by (e.g. Kubernetes,AWS,Linux)."),
			),
			mcp.WithString("permissionsRequired",
				mcp.Description("Filter by permissions required field"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			faultType, _ := OptionalParam[string](request, "type")
			infrastructureType, _ := OptionalParam[string](request, "infrastructureType")
			infrastructure, _ := OptionalParam[string](request, "infrastructure")
			search, _ := OptionalParam[string](request, "search")
			sortField, _ := OptionalParam[string](request, "sortField")
			sortAscending, _ := OptionalParam[bool](request, "sortAscending")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")
			isEnterprise, _ := OptionalParam[bool](request, "isEnterprise")
			tags, _ := OptionalParam[string](request, "tags")
			category, _ := OptionalParam[string](request, "category")
			permissionsRequired, _ := OptionalParam[string](request, "permissionsRequired")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{Page: page, Size: size}

			data, err := client.ListFaultTemplates(ctx, scope, pagination, hubIdentity, faultType, infrastructureType, infrastructure, search, sortField, sortAscending, includeAllScope, isEnterprise, tags, category, permissionsRequired)
			if err != nil {
				return nil, fmt.Errorf("failed to list fault templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list fault templates response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetFaultTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_describe",
			mcp.WithDescription("Retrieves detailed information about a specific chaos fault template by its identity, including its spec, variables, revision, and metadata."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the fault template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the fault template"),
				mcp.Required(),
			),
			mcp.WithString("revision",
				mcp.Description("Specific revision of the fault template to retrieve. If omitted, the latest revision is returned."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, "revision")

			data, err := client.GetFaultTemplate(ctx, scope, identity, hubIdentity, revision)
			if err != nil {
				return nil, fmt.Errorf("failed to get fault template: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal fault template response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteFaultTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_delete",
			mcp.WithDescription("Deletes a chaos fault template by its identity (soft delete)."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the fault template to delete"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the fault template"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if err := client.DeleteFaultTemplate(ctx, scope, identity, hubIdentity); err != nil {
				return nil, fmt.Errorf("failed to delete fault template: %w", err)
			}

			return mcp.NewToolResultText(`{"deleted":true}`), nil
		}
}

func GetFaultTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_revisions",
			mcp.WithDescription("Lists all revisions of a specific chaos fault template by its identity. Supports pagination."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the fault template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the fault template"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{Page: page, Size: size}

			data, err := client.GetFaultTemplateRevisions(ctx, scope, identity, hubIdentity, pagination)
			if err != nil {
				return nil, fmt.Errorf("failed to get fault template revisions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal fault template revisions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetFaultTemplateVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_variables",
			mcp.WithDescription("Retrieves the runtime input variables of a specific chaos fault template, grouped into variables, faultTargets, faultTunable, and faultAuthentication."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the fault template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the fault template"),
				mcp.Required(),
			),
			mcp.WithString("revision",
				mcp.Description("Specific revision of the fault template. If omitted, the latest revision is used."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, "revision")

			data, err := client.GetFaultTemplateVariables(ctx, scope, identity, hubIdentity, revision)
			if err != nil {
				return nil, fmt.Errorf("failed to get fault template variables: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal fault template variables response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetFaultTemplateYamlTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_yaml",
			mcp.WithDescription("Retrieves the YAML representation of a specific chaos fault template. Returns the raw template YAML string for a given revision."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the fault template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the fault template"),
				mcp.Required(),
			),
			mcp.WithString("revision",
				mcp.Description("Specific revision of the fault template. If omitted, the latest revision is used."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, "revision")

			data, err := client.GetFaultTemplateYaml(ctx, scope, identity, hubIdentity, revision)
			if err != nil {
				return nil, fmt.Errorf("failed to get fault template yaml: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal fault template yaml response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func CompareFaultTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_template_compare",
			mcp.WithDescription("Compares two revisions of a chaos fault template, returning the YAML of both revisions for diff comparison. Both revision1 and revision2 are required."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the fault template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub that owns the fault template"),
				mcp.Required(),
			),
			mcp.WithString("revision1",
				mcp.Description("First revision identifier for comparison"),
				mcp.Required(),
			),
			mcp.WithString("revision2",
				mcp.Description("Second revision identifier for comparison"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision1, err := RequiredParam[string](request, "revision1")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision2, err := RequiredParam[string](request, "revision2")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.CompareFaultTemplateRevisions(ctx, scope, identity, hubIdentity, revision1, revision2)
			if err != nil {
				return nil, fmt.Errorf("failed to compare fault template revisions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal compare fault template revisions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListProbeTemplatesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_template_list",
			mcp.WithDescription("List chaos probe templates. Supports filtering by hub, infrastructure type, probe entity type, search, and pagination."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub to list probe templates from"),
			),
			mcp.WithString("search",
				mcp.Description("Search probe templates by name or identity"),
			),
			mcp.WithString("infraType",
				mcp.Description("Infrastructure type filter (e.g. Kubernetes)"),
			),
			mcp.WithString("entityType",
				mcp.Description("Probe type filter (e.g. httpProbe, cmdProbe)"),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns probe templates from all orgs and projects in the account. When false (default), returns only probe templates in the current org and project."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			search, _ := OptionalParam[string](request, "search")
			infraType, _ := OptionalParam[string](request, "infraType")
			entityType, _ := OptionalParam[string](request, "entityType")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListProbeTemplates(ctx, scope, hubIdentity, search, infraType, entityType, includeAllScope, page, size)
			if err != nil {
				return nil, fmt.Errorf("failed to list probe templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list probe templates response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetProbeTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_template_describe",
			mcp.WithDescription("Retrieves detailed information about a specific chaos probe template by its identity, including its type, properties, run properties, and metadata."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the probe template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the probe template belongs to"),
			),
			mcp.WithNumber("revision",
				mcp.Description("Specific revision number to retrieve. Defaults to the latest revision (0) if not provided."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			revision, _ := OptionalParam[float64](request, "revision")

			data, err := client.GetProbeTemplate(ctx, scope, identity, hubIdentity, int64(revision))
			if err != nil {
				return nil, fmt.Errorf("failed to get probe template: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal get probe template response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteProbeTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_template_delete",
			mcp.WithDescription("Deletes a chaos probe template by its identity. Requires hubIdentity. When revision is 0 or not provided, all revisions are deleted. The template must not be referenced by any experiments for deletion to succeed."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the probe template to delete"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the probe template belongs to"),
				mcp.Required(),
			),
			mcp.WithNumber("revision",
				mcp.Description("Specific revision number to delete. When 0 or not provided, all revisions are deleted."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[float64](request, "revision")

			deleted, err := client.DeleteProbeTemplate(ctx, scope, identity, hubIdentity, int64(revision))
			if err != nil {
				return nil, fmt.Errorf("failed to delete probe template: %w", err)
			}

			r, err := json.Marshal(map[string]bool{"deleted": deleted})
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete probe template response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetProbeTemplateVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_template_variables",
			mcp.WithDescription("Retrieves the runtime input variables for a chaos probe template, including probe properties and run properties."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the probe template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the probe template belongs to"),
			),
			mcp.WithNumber("revision",
				mcp.Description("Revision number to get variables for. Defaults to latest revision (0) if not provided."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			revision, _ := OptionalParam[float64](request, "revision")

			data, err := client.GetProbeTemplateVariables(ctx, scope, identity, hubIdentity, int64(revision))
			if err != nil {
				return nil, fmt.Errorf("failed to get probe template variables: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal probe template variables response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListActionTemplatesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_action_template_list",
			mcp.WithDescription("List chaos action templates. Supports filtering by hub, infrastructure type, action entity type, search, and pagination."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub to list action templates from"),
			),
			mcp.WithString("search",
				mcp.Description("Search action templates by name or identity"),
			),
			mcp.WithString("infraType",
				mcp.Description("Infrastructure type filter (e.g. Kubernetes)"),
			),
			mcp.WithString("entityType",
				mcp.Description("Action type filter"),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns action templates from all orgs and projects in the account. When false (default), returns only action templates in the current org and project."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			search, _ := OptionalParam[string](request, "search")
			infraType, _ := OptionalParam[string](request, "infraType")
			entityType, _ := OptionalParam[string](request, "entityType")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListActionTemplates(ctx, scope, hubIdentity, search, infraType, entityType, includeAllScope, page, size)
			if err != nil {
				return nil, fmt.Errorf("failed to list action templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list action templates response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetActionTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_action_template_describe",
			mcp.WithDescription("Retrieves detailed information about a specific chaos action template by its identity, including its spec, variables, revision, and metadata."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the action template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity", // is this a required or optional field?
				mcp.Description("Unique identifier for the chaos hub the action template belongs to"),
			),
			mcp.WithNumber("revision",
				mcp.Description("Specific revision number to retrieve. Defaults to the latest revision (0) if not provided."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			revision, _ := OptionalParam[float64](request, "revision")

			data, err := client.GetActionTemplate(ctx, scope, identity, hubIdentity, int64(revision))
			if err != nil {
				return nil, fmt.Errorf("failed to get action template: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal get action template response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteActionTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_action_template_delete",
			mcp.WithDescription("Deletes a chaos action template by its identity. Requires hubIdentity. When revision is 0 or not provided, all revisions are deleted. The template must not be referenced by any experiments for deletion to succeed."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the action template to delete"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the action template belongs to"),
				mcp.Required(),
			),
			mcp.WithNumber("revision",
				mcp.Description("Specific revision number to delete. When 0 or not provided, all revisions are deleted."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[float64](request, "revision")

			deleted, err := client.DeleteActionTemplate(ctx, scope, identity, hubIdentity, int64(revision))
			if err != nil {
				return nil, fmt.Errorf("failed to delete action template: %w", err)
			}

			r, err := json.Marshal(map[string]bool{"deleted": deleted})
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete action template response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetActionTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_action_template_revisions",
			mcp.WithDescription("Lists all revisions of a chaos action template by its identity, with pagination and optional filtering support."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the action template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the action template belongs to"),
			),
			mcp.WithString("search",
				mcp.Description("Search revisions by name"),
			),
			mcp.WithString("infraType",
				mcp.Description("Infrastructure type filter (e.g. Kubernetes)"),
			),
			mcp.WithString("entityType",
				mcp.Description("Action type filter"),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns revisions from all orgs and projects in the account. When false (default), returns only revisions in the current org and project."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			search, _ := OptionalParam[string](request, "search")
			infraType, _ := OptionalParam[string](request, "infraType")
			entityType, _ := OptionalParam[string](request, "entityType")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetActionTemplateRevisions(ctx, scope, identity, hubIdentity, search, infraType, entityType, includeAllScope, page, size)
			if err != nil {
				return nil, fmt.Errorf("failed to get action template revisions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal action template revisions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetActionTemplateVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_action_template_variables",
			mcp.WithDescription("Retrieves the runtime input variables for a chaos action template, including action properties and run properties."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the action template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the action template belongs to"),
			),
			mcp.WithNumber("revision",
				mcp.Description("Revision number to get variables for. Defaults to latest revision (0) if not provided."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			revision, _ := OptionalParam[float64](request, "revision")

			data, err := client.GetActionTemplateVariables(ctx, scope, identity, hubIdentity, int64(revision))
			if err != nil {
				return nil, fmt.Errorf("failed to get action template variables: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal action template variables response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func CompareActionTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_action_template_compare",
			mcp.WithDescription("Compares two revisions of a chaos action template side by side. Requires the template identity, hub identity, and two revision numbers."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier for the action template"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique identifier for the chaos hub the action template belongs to"),
			),
			mcp.WithString("revision",
				mcp.Description("First revision number to compare"),
				mcp.Required(),
			),
			mcp.WithString("revisionToCompare",
				mcp.Description("Second revision number to compare"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")

			revision, err := RequiredParam[string](request, "revision")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revisionToCompare, err := RequiredParam[string](request, "revisionToCompare")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.CompareActionTemplateRevisions(ctx, scope, identity, hubIdentity, revision, revisionToCompare)
			if err != nil {
				return nil, fmt.Errorf("failed to compare action template revisions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal compare action template revisions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListChaosHubsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_hubs_list",
			mcp.WithDescription("List ChaosHubs (Git-connected repositories containing fault, experiment, probe, and action templates). Returns hub details including repository info, connector configuration, template counts, and sync status. Supports search, pagination, and cross-scope inclusion."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("search",
				mcp.Description("Search hubs by name (case-insensitive)"),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns hubs from all scopes (account, org, project). Defaults to false (project scope only)."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			search, _ := OptionalParam[string](request, "search")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListChaosHubs(ctx, scope, search, includeAllScope, int64(page), int64(size))
			if err != nil {
				return nil, fmt.Errorf("failed to list chaos hubs: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list chaos hubs response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetChaosHubTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_hub_get",
			mcp.WithDescription("Get a ChaosHub by its identity. Returns full hub details including repository URL, branch, connector info, template counts, sync status, and metadata."),
			common.WithScope(config, false),
			mcp.WithString("hubIdentity",
				mcp.Description("The unique identity of the ChaosHub"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetChaosHub(ctx, scope, hubIdentity)
			if err != nil {
				return nil, fmt.Errorf("failed to get chaos hub: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal chaos hub response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListChaosHubFaultsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_hub_faults_list",
			mcp.WithDescription("List faults available in ChaosHubs. Returns fault details including name, category, infrastructure type, permissions required, and platform support. Also returns fault category counts for each infrastructure type. Supports filtering by hub, infrastructure type, category, permissions, and search."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("hubIdentity",
				mcp.Description("Filter faults by a specific ChaosHub identity"),
			),
			mcp.WithString("search",
				mcp.Description("Search faults by name (case-insensitive)"),
			),
			mcp.WithString("infraType",
				mcp.Description("Filter by infrastructure type (e.g. Kubernetes, Linux, Windows)"),
			),
			mcp.WithString("entityType",
				mcp.Description("Filter by fault category (e.g. Kubernetes, AWS, GCP, Azure, Linux, Windows, VMWare, Load)"),
			),
			mcp.WithString("permissionsRequired",
				mcp.Description("Filter by permission level required"),
				mcp.Enum("Basic", "Advanced"),
			),
			mcp.WithBoolean("includeAllScope",
				mcp.Description("When true, returns faults from all scopes. Defaults to false."),
			),
			mcp.WithBoolean("onlyTemplatisedFaults",
				mcp.Description("When true, only returns faults that have templates available. Defaults to false."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			search, _ := OptionalParam[string](request, "search")
			infraType, _ := OptionalParam[string](request, "infraType")
			entityType, _ := OptionalParam[string](request, "entityType")
			permissionsRequired, _ := OptionalParam[string](request, "permissionsRequired")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")
			onlyTemplatisedFaults, _ := OptionalParam[bool](request, "onlyTemplatisedFaults")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListChaosHubFaults(ctx, scope, hubIdentity, search, infraType, entityType, permissionsRequired, includeAllScope, onlyTemplatisedFaults, int64(page), int64(size))
			if err != nil {
				return nil, fmt.Errorf("failed to list chaos hub faults: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list chaos hub faults response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteChaosHubTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_hub_delete",
			mcp.WithDescription("Delete a ChaosHub by its identity. Removes the hub and its associated resources. The default Enterprise ChaosHub cannot be deleted."),
			common.WithScope(config, false),
			mcp.WithString("hubIdentity",
				mcp.Description("The unique identity of the ChaosHub to delete"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			err = client.DeleteChaosHub(ctx, scope, hubIdentity)
			if err != nil {
				return nil, fmt.Errorf("failed to delete chaos hub: %w", err)
			}

			return mcp.NewToolResultText("successfully deleted chaos hub"), nil
		}
}

func CreateChaosHubTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_hub_create",
			mcp.WithDescription("Create a new ChaosHub in the given Harness scope (account, org, project). The hub record stores a Git repo and connector reference that provides chaos fault, experiment, probe, and action templates. The hub identity cannot be 'enterprise-chaoshub' as that is reserved for the default hub."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identifier (slug) for the ChaosHub. Must be unique within the project scope. Cannot be 'enterprise-chaoshub'."),
				mcp.Required(),
			),
			mcp.WithString("name",
				mcp.Description("Display name for the ChaosHub"),
				mcp.Required(),
			),
			mcp.WithString("description",
				mcp.Description("Description of the ChaosHub"),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags for the ChaosHub"),
			),
			mcp.WithString("connectorRef",
				mcp.Description("Harness connector reference for Git authentication (e.g. 'account.myConnector' or 'org.myConnector')."),
			),
			mcp.WithString("repoName",
				mcp.Description("Name of the Git repository."),
			),
			mcp.WithString("repoBranch",
				mcp.Description("Git branch to use for the ChaosHub."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			connectorRef, _ := OptionalParam[string](request, "connectorRef")
			repoName, _ := OptionalParam[string](request, "repoName")
			repoBranch, _ := OptionalParam[string](request, "repoBranch")
			description, _ := OptionalParam[string](request, "description")
			tagsStr, _ := OptionalParam[string](request, "tags")

			var tags []string
			if tagsStr != "" {
				for _, t := range strings.Split(tagsStr, ",") {
					trimmed := strings.TrimSpace(t)
					if trimmed != "" {
						tags = append(tags, trimmed)
					}
				}
			}

			createReq := dto.CreateChaosHubRequest{
				Identity:     identity,
				Name:         name,
				Description:  description,
				Tags:         tags,
				ConnectorRef: connectorRef,
				RepoName:     repoName,
				RepoBranch:   repoBranch,
			}

			data, err := client.CreateChaosHub(ctx, scope, createReq)
			if err != nil {
				return nil, fmt.Errorf("failed to create chaos hub: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal create chaos hub response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func UpdateChaosHubTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_hub_update",
			mcp.WithDescription("Update the editable fields of a ChaosHub (name, description, tags) by its identity."),
			common.WithScope(config, false),
			mcp.WithString("hubIdentity",
				mcp.Description("The unique identity of the ChaosHub to update"),
				mcp.Required(),
			),
			mcp.WithString("name",
				mcp.Description("Updated display name for the ChaosHub"),
				mcp.Required(),
			),
			mcp.WithString("description",
				mcp.Description("Updated description for the ChaosHub"),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags for the ChaosHub (replaces existing tags)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			description, _ := OptionalParam[string](request, "description")
			tagsStr, _ := OptionalParam[string](request, "tags")

			var tags []string
			if tagsStr != "" {
				for _, t := range strings.Split(tagsStr, ",") {
					trimmed := strings.TrimSpace(t)
					if trimmed != "" {
						tags = append(tags, trimmed)
					}
				}
			}

			updateReq := dto.UpdateChaosHubRequest{
				Name:        name,
				Description: description,
				Tags:        tags,
			}

			data, err := client.UpdateChaosHub(ctx, scope, hubIdentity, updateReq)
			if err != nil {
				return nil, fmt.Errorf("failed to update chaos hub: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal update chaos hub response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListChaosGuardConditionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_conditions_list",
			mcp.WithDescription("List ChaosGuard conditions. Conditions define the infrastructure, fault, and application constraints that ChaosGuard rules evaluate against chaos experiments. Supports filtering by infrastructure type, tags, search, sorting, and pagination."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("search",
				mcp.Description("Search conditions by name (case-insensitive)"),
			),
			mcp.WithString("sortField",
				mcp.Description("Field to sort results by"),
				mcp.Enum("name", "lastUpdated"),
			),
			mcp.WithBoolean("sortAscending",
				mcp.Description("When true, sort in ascending order. Defaults to false (descending)."),
			),
			mcp.WithString("infrastructureType",
				mcp.Description("Filter by infrastructure type"),
				mcp.Enum("Kubernetes", "KubernetesV2", "Linux", "Windows"),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags to filter by"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			search, _ := OptionalParam[string](request, "search")
			sortField, _ := OptionalParam[string](request, "sortField")
			sortAscending, _ := OptionalParam[bool](request, "sortAscending")
			infraType, _ := OptionalParam[string](request, "infrastructureType")
			tags, _ := OptionalParam[string](request, "tags")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListChaosGuardConditions(ctx, scope, search, sortField, sortAscending, infraType, tags, page, size)
			if err != nil {
				return nil, fmt.Errorf("failed to list chaosguard conditions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list chaosguard conditions response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetChaosGuardConditionTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_condition_get",
			mcp.WithDescription("Get a ChaosGuard condition by its identifier. Returns the full condition details including infrastructure type, fault specifications, K8s/machine specs, associated rules, and tags."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("The unique identifier of the ChaosGuard condition"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetChaosGuardCondition(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to get chaosguard condition: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal chaosguard condition response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteChaosGuardConditionTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_condition_delete",
			mcp.WithDescription("Delete (soft-delete) a ChaosGuard condition by its identifier. The condition is marked as removed and will no longer appear in listings or be evaluated by rules, but is not permanently erased from the database."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("The unique identifier of the ChaosGuard condition to delete"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.DeleteChaosGuardCondition(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to delete chaosguard condition: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete chaosguard condition response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListChaosGuardRulesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_rules_list",
			mcp.WithDescription("List ChaosGuard governance rules. ChaosGuard rules define security policies that control when and how chaos experiments can run, including user group restrictions, time windows, and conditions. Supports filtering by infrastructure type, tags, search, sorting, and pagination."),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("search",
				mcp.Description("Search rules by name (case-insensitive)"),
			),
			mcp.WithString("sortField",
				mcp.Description("Field to sort results by"),
				mcp.Enum("name", "lastUpdated"),
			),
			mcp.WithBoolean("sortAscending",
				mcp.Description("When true, sort in ascending order. Defaults to false (descending)."),
			),
			mcp.WithString("infrastructureType",
				mcp.Description("Filter by infrastructure type"),
				mcp.Enum("Kubernetes", "KubernetesV2", "Linux", "Windows"),
			),
			mcp.WithString("tags",
				mcp.Description("Comma-separated list of tags to filter by"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			search, _ := OptionalParam[string](request, "search")
			sortField, _ := OptionalParam[string](request, "sortField")
			sortAscending, _ := OptionalParam[bool](request, "sortAscending")
			infraType, _ := OptionalParam[string](request, "infrastructureType")
			tags, _ := OptionalParam[string](request, "tags")

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListChaosGuardRules(ctx, scope, search, sortField, sortAscending, infraType, tags, page, size)
			if err != nil {
				return nil, fmt.Errorf("failed to list chaosguard rules: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list chaosguard rules response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetChaosGuardRuleTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_rule_get",
			mcp.WithDescription("Get a ChaosGuard rule by its identifier. Returns the full rule details including name, description, conditions, time windows, user group restrictions, and enabled status."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("The unique identifier of the ChaosGuard rule"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetChaosGuardRule(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to get chaosguard rule: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal chaosguard rule response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteChaosGuardRuleTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_rule_delete",
			mcp.WithDescription("Delete (soft-delete) a ChaosGuard rule by its identifier. The rule is marked as removed and will no longer appear in listings or be enforced, but is not permanently erased from the database."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("The unique identifier of the ChaosGuard rule to delete"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.DeleteChaosGuardRule(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to delete chaosguard rule: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete chaosguard rule response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func EnableChaosGuardRuleTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_guard_rule_enable",
			mcp.WithDescription("Enable or disable a ChaosGuard rule. When enabled, the rule actively enforces its governance conditions on chaos experiments. When disabled, the rule is inactive and does not affect experiment execution."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("The unique identifier of the ChaosGuard rule"),
				mcp.Required(),
			),
			mcp.WithBoolean("enabled",
				mcp.Description("Set to true to enable the rule, false to disable it"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			enabled, err := RequiredParam[bool](request, "enabled")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			err = client.EnableChaosGuardRule(ctx, scope, identity, enabled)
			if err != nil {
				return nil, fmt.Errorf("failed to enable/disable chaosguard rule: %w", err)
			}

			return mcp.NewToolResultText("updated rule successfully"), nil
		}
}
