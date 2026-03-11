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
	"github.com/harness/mcp-server/common/pkg/chaoscommons"
	"github.com/harness/mcp-server/common/pkg/common"
	mcputils "github.com/harness/mcp-server/common/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var identityRegex = regexp.MustCompile(`[^a-z0-9-]+`)

// ListExperimentsTool creates a tool for listing the experiments
func ListExperimentsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolExperimentsList,
			mcp.WithDescription(chaoscommons.DescToolExperimentsList),
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
	return mcp.NewTool(chaoscommons.ToolExperimentDescribe,
			mcp.WithDescription(chaoscommons.DescToolExperimentDescribe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, chaoscommons.ParamExperimentID)
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
	return mcp.NewTool(chaoscommons.ToolExperimentRunResult,
			mcp.WithDescription(chaoscommons.DescToolExperimentRunResult),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamExperimentRunID,
				mcp.Description(chaoscommons.DescExperimentRunID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, chaoscommons.ParamExperimentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
				}
			}

			experimentRunID, err := RequiredParam[string](request, chaoscommons.ParamExperimentRunID)
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
	return mcp.NewTool(chaoscommons.ToolExperimentRun,
			mcp.WithDescription(chaoscommons.DescToolExperimentRun),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInputsetIdentity,
				mcp.Description(chaoscommons.DescInputsetIdentity),
			),
			mcp.WithArray(chaoscommons.ParamExperimentVariables,
				mcp.Description(chaoscommons.DescExperimentVariables),
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
			mcp.WithObject(chaoscommons.ParamTasks,
				mcp.Description(chaoscommons.DescTasks),
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

			experimentID, err := RequiredParam[string](request, chaoscommons.ParamExperimentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
				}
			}

			inputsetIdentity, err := OptionalParam[string](request, chaoscommons.ParamInputsetIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentVariablesRaw, err := OptionalParam[[]interface{}](request, chaoscommons.ParamExperimentVariables)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			taskVariablesRaw, err := OptionalParam[map[string]any](request, chaoscommons.ParamTasks)
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
	return mcp.NewTool(chaoscommons.ToolProbesList,
			mcp.WithDescription(chaoscommons.DescToolProbesList),
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
	return mcp.NewTool(chaoscommons.ToolProbeDescribe,
			mcp.WithDescription(chaoscommons.DescToolProbeDescribe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamProbeID,
				mcp.Description(chaoscommons.DescProbeID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			probeID, err := RequiredParam[string](request, chaoscommons.ParamProbeID)
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
	return mcp.NewTool(chaoscommons.ToolCreateExperimentFromTemplate,
			mcp.WithDescription(chaoscommons.DescToolCreateExperimentFromTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamTemplateID,
				mcp.Description(chaoscommons.DescTemplateID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInfraID,
				mcp.Description(chaoscommons.DescInfraID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamEnvironmentID,
				mcp.Description(chaoscommons.DescEnvironmentID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentity),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamName,
				mcp.Description(chaoscommons.DescName),
			),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentity),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateID, err := RequiredParam[string](request, chaoscommons.ParamTemplateID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infraID, err := RequiredParam[string](request, chaoscommons.ParamInfraID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environmentID, err := RequiredParam[string](request, chaoscommons.ParamEnvironmentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !strings.HasPrefix(infraID, fmt.Sprintf("%s/", environmentID)) {
				infraID = fmt.Sprintf("%s/%s", environmentID, infraID)
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := OptionalParam[string](request, chaoscommons.ParamName)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if name == "" {
				name = fmt.Sprintf("%s-%s", templateID, utils.RandStringBytes(3))
			}

			identity, err := OptionalParam[string](request, chaoscommons.ParamIdentity)
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
	return mcp.NewTool(chaoscommons.ToolListExperimentTemplates,
			mcp.WithDescription(chaoscommons.DescToolListExperimentTemplates),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentity),
			),
			mcp.WithString(chaoscommons.ParamInfrastructureType,
				mcp.Description(chaoscommons.DescInfrastructureType),
			),
			mcp.WithString(chaoscommons.ParamInfrastructure,
				mcp.Description(chaoscommons.DescInfrastructure),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearch),
			),
			mcp.WithString(chaoscommons.ParamSortField,
				mcp.Description(chaoscommons.DescSortField),
				mcp.Enum("name", "lastUpdated", "experimentName"),
			),
			mcp.WithBoolean(chaoscommons.ParamSortAscending,
				mcp.Description(chaoscommons.DescSortAscending),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScope),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTags),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			infrastructureType, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructureType)
			infrastructure, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructure)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			sortField, _ := OptionalParam[string](request, chaoscommons.ParamSortField)
			sortAscending, _ := OptionalParam[bool](request, chaoscommons.ParamSortAscending)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)
			tags, _ := OptionalParam[string](request, chaoscommons.ParamTags)

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
				return nil, fmt.Errorf("failed to list experiment templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list experiment templates response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetExperimentTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolGetExperimentTemplate,
			mcp.WithDescription(chaoscommons.DescToolGetExperimentTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityExperimentTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityOwner),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevision),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolDeleteExperimentTemplate,
			mcp.WithDescription(chaoscommons.DescToolDeleteExperimentTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityExperimentTemplateDelete),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityOwner),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamVerbose,
				mcp.Description(chaoscommons.DescVerbose),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			verbose, _ := OptionalParam[bool](request, chaoscommons.ParamVerbose)

			if err := client.DeleteExperimentTemplate(ctx, scope, identity, hubIdentity, verbose); err != nil {
				return nil, fmt.Errorf("failed to delete experiment template: %w", err)
			}

			return mcp.NewToolResultText(`{"deleted":true}`), nil
		}
}

func GetExperimentTemplateRevisionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolListExperimentTemplateRevisions,
			mcp.WithDescription(chaoscommons.DescToolListExperimentTemplateRevisions),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityExperimentTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityOwner),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInfrastructureType,
				mcp.Description(chaoscommons.DescInfrastructureType),
			),
			mcp.WithString(chaoscommons.ParamInfrastructure,
				mcp.Description(chaoscommons.DescInfrastructure),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearch),
			),
			mcp.WithString(chaoscommons.ParamSortField,
				mcp.Description(chaoscommons.DescSortField),
				mcp.Enum("name", "lastUpdated", "experimentName"),
			),
			mcp.WithBoolean(chaoscommons.ParamSortAscending,
				mcp.Description(chaoscommons.DescSortAscending),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScope),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTags),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infrastructureType, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructureType)
			infrastructure, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructure)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			sortField, _ := OptionalParam[string](request, chaoscommons.ParamSortField)
			sortAscending, _ := OptionalParam[bool](request, chaoscommons.ParamSortAscending)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)
			tags, _ := OptionalParam[string](request, chaoscommons.ParamTags)

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
	return mcp.NewTool(chaoscommons.ToolGetExperimentTemplateVariables,
			mcp.WithDescription(chaoscommons.DescToolGetExperimentTemplateVariables),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityExperimentTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityOwner),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionOptional),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolGetExperimentTemplateYaml,
			mcp.WithDescription(chaoscommons.DescToolGetExperimentTemplateYaml),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityExperimentTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityOwner),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionOptional),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolCompareExperimentTemplateRevisions,
			mcp.WithDescription(chaoscommons.DescToolCompareExperimentTemplateRevisions),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityExperimentTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityOwner),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision1,
				mcp.Description(chaoscommons.DescRevision1),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision2,
				mcp.Description(chaoscommons.DescRevision2),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision1, err := RequiredParam[string](request, chaoscommons.ParamRevision1)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision2, err := RequiredParam[string](request, chaoscommons.ParamRevision2)
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
	return mcp.NewTool(chaoscommons.ToolExperimentVariablesList,
			mcp.WithDescription(chaoscommons.DescToolExperimentVariablesList),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, chaoscommons.ParamExperimentID)
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
	return mcp.NewTool(chaoscommons.ToolListLinuxInfrastructures,
			mcp.WithDescription(chaoscommons.DescToolListLinuxInfrastructures),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamStatus,
				mcp.Description(chaoscommons.DescStatus),
				mcp.Enum("Active", "All"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			statusFilter := "Active"
			status, err := OptionalParam[string](request, chaoscommons.ParamStatus)
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
	return mcp.NewTool(chaoscommons.ToolListFaultTemplates,
			mcp.WithDescription(chaoscommons.DescToolListFaultTemplates),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityList),
			),
			mcp.WithString(chaoscommons.ParamType,
				mcp.Description(chaoscommons.DescFaultType),
			),
			mcp.WithString(chaoscommons.ParamInfrastructureType,
				mcp.Description(chaoscommons.DescInfrastructureType),
			),
			mcp.WithString(chaoscommons.ParamInfrastructure,
				mcp.Description(chaoscommons.DescInfrastructure),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchFaultTemplates),
			),
			mcp.WithString(chaoscommons.ParamSortField,
				mcp.Description(chaoscommons.DescSortField),
				mcp.Enum("name", "lastUpdated"),
			),
			mcp.WithBoolean(chaoscommons.ParamSortAscending,
				mcp.Description(chaoscommons.DescSortAscending),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScopeFault),
			),
			mcp.WithBoolean(chaoscommons.ParamIsEnterprise,
				mcp.Description(chaoscommons.DescIsEnterprise),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTagsFault),
			),
			mcp.WithString(chaoscommons.ParamCategory,
				mcp.Description(chaoscommons.DescCategory),
			),
			mcp.WithString(chaoscommons.ParamPermissionsRequired,
				mcp.Description(chaoscommons.DescPermissionsRequired),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			faultType, _ := OptionalParam[string](request, chaoscommons.ParamType)
			infrastructureType, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructureType)
			infrastructure, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructure)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			sortField, _ := OptionalParam[string](request, chaoscommons.ParamSortField)
			sortAscending, _ := OptionalParam[bool](request, chaoscommons.ParamSortAscending)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)
			isEnterprise, _ := OptionalParam[bool](request, chaoscommons.ParamIsEnterprise)
			tags, _ := OptionalParam[string](request, chaoscommons.ParamTags)
			category, _ := OptionalParam[string](request, chaoscommons.ParamCategory)
			permissionsRequired, _ := OptionalParam[string](request, chaoscommons.ParamPermissionsRequired)

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
	return mcp.NewTool(chaoscommons.ToolGetFaultTemplate,
			mcp.WithDescription(chaoscommons.DescToolGetFaultTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityFaultTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFault),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionFault),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolDeleteFaultTemplate,
			mcp.WithDescription(chaoscommons.DescToolDeleteFaultTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityFaultTemplateDelete),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFault),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
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
	return mcp.NewTool(chaoscommons.ToolListFaultTemplateRevisions,
			mcp.WithDescription(chaoscommons.DescToolListFaultTemplateRevisions),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityFaultTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFault),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
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
	return mcp.NewTool(chaoscommons.ToolGetFaultTemplateVariables,
			mcp.WithDescription(chaoscommons.DescToolGetFaultTemplateVariables),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityFaultTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFault),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionFaultOptional),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolGetFaultTemplateYaml,
			mcp.WithDescription(chaoscommons.DescToolGetFaultTemplateYaml),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityFaultTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFault),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionFaultOptional),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[string](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolCompareFaultTemplateRevisions,
			mcp.WithDescription(chaoscommons.DescToolCompareFaultTemplateRevisions),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityFaultTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFault),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision1,
				mcp.Description(chaoscommons.DescRevision1),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevision2,
				mcp.Description(chaoscommons.DescRevision2),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision1, err := RequiredParam[string](request, chaoscommons.ParamRevision1)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision2, err := RequiredParam[string](request, chaoscommons.ParamRevision2)
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
	return mcp.NewTool(chaoscommons.ToolListProbeTemplates,
			mcp.WithDescription(chaoscommons.DescToolListProbeTemplates),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityListProbe),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchProbe),
			),
			mcp.WithString(chaoscommons.ParamInfraType,
				mcp.Description(chaoscommons.DescInfraType),
			),
			mcp.WithString(chaoscommons.ParamEntityType,
				mcp.Description(chaoscommons.DescEntityTypeProbe),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScopeProbe),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			infraType, _ := OptionalParam[string](request, chaoscommons.ParamInfraType)
			entityType, _ := OptionalParam[string](request, chaoscommons.ParamEntityType)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)

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
	return mcp.NewTool(chaoscommons.ToolGetProbeTemplate,
			mcp.WithDescription(chaoscommons.DescToolGetProbeTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityProbeTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityProbe),
			),
			mcp.WithNumber(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionProbe),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			revision, _ := OptionalParam[float64](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolDeleteProbeTemplate,
			mcp.WithDescription(chaoscommons.DescToolDeleteProbeTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityProbeTemplateDelete),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityProbe),
				mcp.Required(),
			),
			mcp.WithNumber(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionProbeDelete),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[float64](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolGetProbeTemplateVariables,
			mcp.WithDescription(chaoscommons.DescToolGetProbeTemplateVariables),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityProbeTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityProbe),
			),
			mcp.WithNumber(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionProbeVars),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			revision, _ := OptionalParam[float64](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolListActionTemplates,
			mcp.WithDescription(chaoscommons.DescToolListActionTemplates),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityListAction),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchAction),
			),
			mcp.WithString(chaoscommons.ParamInfraType,
				mcp.Description(chaoscommons.DescInfraType),
			),
			mcp.WithString(chaoscommons.ParamEntityType,
				mcp.Description(chaoscommons.DescEntityTypeAction),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScopeAction),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			infraType, _ := OptionalParam[string](request, chaoscommons.ParamInfraType)
			entityType, _ := OptionalParam[string](request, chaoscommons.ParamEntityType)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)

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
	return mcp.NewTool(chaoscommons.ToolGetActionTemplate,
			mcp.WithDescription(chaoscommons.DescToolGetActionTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityActionTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity, // is this a required or optional field?
				mcp.Description(chaoscommons.DescHubIdentityAction),
			),
			mcp.WithNumber(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionAction),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			revision, _ := OptionalParam[float64](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolDeleteActionTemplate,
			mcp.WithDescription(chaoscommons.DescToolDeleteActionTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityActionTemplateDelete),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityAction),
				mcp.Required(),
			),
			mcp.WithNumber(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionActionDelete),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revision, _ := OptionalParam[float64](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolListActionTemplateRevisions,
			mcp.WithDescription(chaoscommons.DescToolListActionTemplateRevisions),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityActionTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityAction),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchActionRevisions),
			),
			mcp.WithString(chaoscommons.ParamInfraType,
				mcp.Description(chaoscommons.DescInfraType),
			),
			mcp.WithString(chaoscommons.ParamEntityType,
				mcp.Description(chaoscommons.DescEntityTypeAction),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScopeRevisions),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			infraType, _ := OptionalParam[string](request, chaoscommons.ParamInfraType)
			entityType, _ := OptionalParam[string](request, chaoscommons.ParamEntityType)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)

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
	return mcp.NewTool(chaoscommons.ToolGetActionTemplateVariables,
			mcp.WithDescription(chaoscommons.DescToolGetActionTemplateVariables),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityActionTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityAction),
			),
			mcp.WithNumber(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionActionVars),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			revision, _ := OptionalParam[float64](request, chaoscommons.ParamRevision)

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
	return mcp.NewTool(chaoscommons.ToolCompareActionTemplateRevisions,
			mcp.WithDescription(chaoscommons.DescToolCompareActionTemplateRevisions),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityActionTemplate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityAction),
			),
			mcp.WithString(chaoscommons.ParamRevision,
				mcp.Description(chaoscommons.DescRevisionActionCompare),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamRevisionToCompare,
				mcp.Description(chaoscommons.DescRevisionToCompare),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)

			revision, err := RequiredParam[string](request, chaoscommons.ParamRevision)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			revisionToCompare, err := RequiredParam[string](request, chaoscommons.ParamRevisionToCompare)
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
	return mcp.NewTool(chaoscommons.ToolListHubs,
			mcp.WithDescription(chaoscommons.DescToolListHubs),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchHubs),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScopeHubs),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)

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
	return mcp.NewTool(chaoscommons.ToolGetHub,
			mcp.WithDescription(chaoscommons.DescToolGetHub),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityExact),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
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
	return mcp.NewTool(chaoscommons.ToolListHubFaults,
			mcp.WithDescription(chaoscommons.DescToolListHubFaults),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityFaultsFilter),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchFaults),
			),
			mcp.WithString(chaoscommons.ParamInfraType,
				mcp.Description(chaoscommons.DescInfraTypeFilter),
			),
			mcp.WithString(chaoscommons.ParamEntityType,
				mcp.Description(chaoscommons.DescEntityTypeFault),
			),
			mcp.WithString(chaoscommons.ParamPermissionsRequired,
				mcp.Description(chaoscommons.DescPermissionsRequiredEnum),
				mcp.Enum("Basic", "Advanced"),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScopeFaults),
			),
			mcp.WithBoolean(chaoscommons.ParamOnlyTemplatisedFaults,
				mcp.Description(chaoscommons.DescOnlyTemplatisedFaults),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, _ := OptionalParam[string](request, chaoscommons.ParamHubIdentity)
			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			infraType, _ := OptionalParam[string](request, chaoscommons.ParamInfraType)
			entityType, _ := OptionalParam[string](request, chaoscommons.ParamEntityType)
			permissionsRequired, _ := OptionalParam[string](request, chaoscommons.ParamPermissionsRequired)
			includeAllScope, _ := OptionalParam[bool](request, chaoscommons.ParamIncludeAllScope)
			onlyTemplatisedFaults, _ := OptionalParam[bool](request, chaoscommons.ParamOnlyTemplatisedFaults)

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
	return mcp.NewTool(chaoscommons.ToolDeleteHub,
			mcp.WithDescription(chaoscommons.DescToolDeleteHub),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityDelete),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
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
	return mcp.NewTool(chaoscommons.ToolCreateHub,
			mcp.WithDescription(chaoscommons.DescToolCreateHub),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityChaosHub),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamName,
				mcp.Description(chaoscommons.DescHubName),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamDescription,
				mcp.Description(chaoscommons.DescHubDescription),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTagsHub),
			),
			mcp.WithString(chaoscommons.ParamConnectorRef,
				mcp.Description(chaoscommons.DescConnectorRef),
			),
			mcp.WithString(chaoscommons.ParamRepoName,
				mcp.Description(chaoscommons.DescRepoName),
			),
			mcp.WithString(chaoscommons.ParamRepoBranch,
				mcp.Description(chaoscommons.DescRepoBranch),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, chaoscommons.ParamName)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			connectorRef, _ := OptionalParam[string](request, chaoscommons.ParamConnectorRef)
			repoName, _ := OptionalParam[string](request, chaoscommons.ParamRepoName)
			repoBranch, _ := OptionalParam[string](request, chaoscommons.ParamRepoBranch)
			description, _ := OptionalParam[string](request, chaoscommons.ParamDescription)
			tagsStr, _ := OptionalParam[string](request, chaoscommons.ParamTags)

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
	return mcp.NewTool(chaoscommons.ToolUpdateHub,
			mcp.WithDescription(chaoscommons.DescToolUpdateHub),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityUpdate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamName,
				mcp.Description(chaoscommons.DescHubNameUpdate),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamDescription,
				mcp.Description(chaoscommons.DescHubDescriptionUpdate),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTagsReplace),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, chaoscommons.ParamHubIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, chaoscommons.ParamName)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			description, _ := OptionalParam[string](request, chaoscommons.ParamDescription)
			tagsStr, _ := OptionalParam[string](request, chaoscommons.ParamTags)

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
	return mcp.NewTool(chaoscommons.ToolListChaosGuardConditions,
			mcp.WithDescription(chaoscommons.DescToolListChaosGuardConditions),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchConditions),
			),
			mcp.WithString(chaoscommons.ParamSortField,
				mcp.Description(chaoscommons.DescSortField),
				mcp.Enum("name", "lastUpdated"),
			),
			mcp.WithBoolean(chaoscommons.ParamSortAscending,
				mcp.Description(chaoscommons.DescSortAscending),
			),
			mcp.WithString(chaoscommons.ParamInfrastructureType,
				mcp.Description(chaoscommons.DescInfrastructureTypeFilter),
				mcp.Enum("Kubernetes", "KubernetesV2", "Linux", "Windows"),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTagsFilter),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			sortField, _ := OptionalParam[string](request, chaoscommons.ParamSortField)
			sortAscending, _ := OptionalParam[bool](request, chaoscommons.ParamSortAscending)
			infraType, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructureType)
			tags, _ := OptionalParam[string](request, chaoscommons.ParamTags)

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
	return mcp.NewTool(chaoscommons.ToolGetChaosGuardCondition,
			mcp.WithDescription(chaoscommons.DescToolGetChaosGuardCondition),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityChaosGuardCondition),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
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
	return mcp.NewTool(chaoscommons.ToolDeleteChaosGuardCondition,
			mcp.WithDescription(chaoscommons.DescToolDeleteChaosGuardCondition),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityChaosGuardConditionDelete),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
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
	return mcp.NewTool(chaoscommons.ToolListChaosGuardRules,
			mcp.WithDescription(chaoscommons.DescToolListChaosGuardRules),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchRules),
			),
			mcp.WithString(chaoscommons.ParamSortField,
				mcp.Description(chaoscommons.DescSortField),
				mcp.Enum("name", "lastUpdated"),
			),
			mcp.WithBoolean(chaoscommons.ParamSortAscending,
				mcp.Description(chaoscommons.DescSortAscending),
			),
			mcp.WithString(chaoscommons.ParamInfrastructureType,
				mcp.Description(chaoscommons.DescInfrastructureTypeFilter),
				mcp.Enum("Kubernetes", "KubernetesV2", "Linux", "Windows"),
			),
			mcp.WithString(chaoscommons.ParamTags,
				mcp.Description(chaoscommons.DescTagsFilter),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			search, _ := OptionalParam[string](request, chaoscommons.ParamSearch)
			sortField, _ := OptionalParam[string](request, chaoscommons.ParamSortField)
			sortAscending, _ := OptionalParam[bool](request, chaoscommons.ParamSortAscending)
			infraType, _ := OptionalParam[string](request, chaoscommons.ParamInfrastructureType)
			tags, _ := OptionalParam[string](request, chaoscommons.ParamTags)

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
	return mcp.NewTool(chaoscommons.ToolGetChaosGuardRule,
			mcp.WithDescription(chaoscommons.DescToolGetChaosGuardRule),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityChaosGuardRule),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
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
	return mcp.NewTool(chaoscommons.ToolDeleteChaosGuardRule,
			mcp.WithDescription(chaoscommons.DescToolDeleteChaosGuardRule),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityChaosGuardRuleDelete),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
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
	return mcp.NewTool(chaoscommons.ToolEnableChaosGuardRule,
			mcp.WithDescription(chaoscommons.DescToolEnableChaosGuardRule),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescIdentityChaosGuardRule),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamEnabled,
				mcp.Description(chaoscommons.DescEnabled),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, chaoscommons.ParamIdentity)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			enabled, err := RequiredParam[bool](request, chaoscommons.ParamEnabled)
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
