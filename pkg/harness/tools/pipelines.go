package tools

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

func GetPipelineTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pipeline",
			mcp.WithDescription("Get details of a specific pipeline in a Harness repository. Use list_pipelines (if available) first to find the correct pipeline_id if you're unsure of the exact ID."),
			mcp.WithString("pipeline_id",
				mcp.Required(),
				mcp.Description("The ID of the pipeline"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			pipelineID, err := RequiredParam[string](request, "pipeline_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Get(ctx, scope, pipelineID)
			if err != nil {
				return nil, fmt.Errorf("failed to get pipeline: %w", err)
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pipeline: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListPipelinesTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_pipelines",
			mcp.WithDescription("List pipelines in a Harness repository."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter pipelines"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.PipelineListOptions{
				SearchTerm: searchTerm,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list pipelines: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pipeline list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func FetchExecutionURLTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("fetch_execution_url",
			mcp.WithDescription("Fetch the execution URL for a pipeline execution in Harness."),
			mcp.WithString("pipeline_id",
				mcp.Required(),
				mcp.Description("The ID of the pipeline"),
			),
			mcp.WithString("plan_execution_id",
				mcp.Required(),
				mcp.Description("The ID of the plan execution"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			pipelineID, err := RequiredParam[string](request, "pipeline_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			planExecutionID, err := RequiredParam[string](request, "plan_execution_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			url, err := client.FetchExecutionURL(ctx, scope, pipelineID, planExecutionID)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch execution URL: %w", err)
			}

			return mcp.NewToolResultText(url), nil
		}
}

func GetExecutionTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_execution",
			mcp.WithDescription("Get details of a specific pipeline execution in Harness."),
			mcp.WithString("plan_execution_id",
				mcp.Required(),
				mcp.Description("The ID of the plan execution"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			planExecutionID, err := RequiredParam[string](request, "plan_execution_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetExecution(ctx, scope, planExecutionID)
			if err != nil {
				return nil, fmt.Errorf("failed to get execution details: %w", err)
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal execution details: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListExecutionsTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_executions",
			mcp.WithDescription("List pipeline executions in a Harness repository."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter executions"),
			),
			mcp.WithString("pipeline_identifier",
				mcp.Description("Optional pipeline identifier to filter executions"),
			),
			mcp.WithString("status",
				mcp.Description("Optional status to filter executions (e.g., Running, Success, Failed)"),
			),
			mcp.WithString("branch",
				mcp.Description("Optional branch to filter executions"),
			),
			mcp.WithBoolean("my_deployments",
				mcp.Description("Optional flag to show only my deployments"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pipelineIdentifier, err := OptionalParam[string](request, "pipeline_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			branch, err := OptionalParam[string](request, "branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			myDeployments, err := OptionalParam[bool](request, "my_deployments")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.PipelineExecutionOptions{
				SearchTerm:         searchTerm,
				PipelineIdentifier: pipelineIdentifier,
				Status:             status,
				Branch:             branch,
				MyDeployments:      myDeployments,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.ListExecutions(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list pipeline executions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pipeline executions list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListInputSetsTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_input_sets",
			mcp.WithDescription("List input sets for a pipeline."),
			mcp.WithString("pipeline_identifier",
				mcp.Required(),
				mcp.Description("Pipeline identifier to filter input sets."),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter out Input Sets based on name, identifier, tags."),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pipelineIdentifier, err := OptionalParam[string](request, "pipeline_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.InputSetListOptions{
				PipelineIdentifier: pipelineIdentifier,
				SearchTerm:         searchTerm,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.ListInputSets(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list input sets: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal input sets list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetInputSetTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_input_set",
			mcp.WithDescription("Get details of a specific input set for a pipeline in Harness."),
			mcp.WithString("pipeline_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the pipeline."),
			),
			mcp.WithString("input_set_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the input set."),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			pipelineIdentifier, err := RequiredParam[string](request, "pipeline_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			inputSetIdentifier, err := RequiredParam[string](request, "input_set_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetInputSet(ctx, scope, pipelineIdentifier, inputSetIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get input set: %w", err)
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal input set: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetPipelineSummaryTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pipeline_summary",
			mcp.WithDescription("Provides a concise summary of a pipeline's overall structure and execution info highlighting key aspects rather than detailed pipeline definition such as pipeline yaml, external references, etc."),
			mcp.WithString("pipeline_id",
				mcp.Required(),
				mcp.Description("Identifier of the pipeline."),
			),
			mcp.WithBoolean("get_metadata_only",
				mcp.Description("Whether to only fetch metadata without full pipeline details."),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			pipelineID, err := RequiredParam[string](request, "pipeline_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			getMetadataOnly, err := OptionalParam[bool](request, "get_metadata_only")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetPipelineSummary(ctx, scope, pipelineID, getMetadataOnly)
			if err != nil {
				return nil, fmt.Errorf("failed to get pipeline summary: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pipeline summary: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListTriggersTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_triggers",
			mcp.WithDescription("List triggers in a Harness pipeline."),
			mcp.WithString("target_identifier",
				mcp.Required(),
				mcp.Description("Identifier of the target pipeline."),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter triggers based on name, identifier, tags."),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			targetIdentifier, err := RequiredParam[string](request, "target_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.TriggerListOptions{
				SearchTerm:       searchTerm,
				TargetIdentifier: targetIdentifier,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.ListTriggers(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list triggers: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal trigger list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
