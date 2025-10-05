package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func GetEntityTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_entity",
			mcp.WithDescription(`Get details of a specific entity(services, APIs, user groups, resources) in the Harness IDP Catalog. Entities can represent services, APIs, user groups, resources, and more. The tool returns metadata for the Harness entities matching the filter criteria, including their identifier, scope, kind, reference type (INLINE/GIT), YAML definition, Git details (branch, path, repo), ownership, tags, lifecycle, scorecards, status, and group. Use the list_entities tool to first to get the id.
			Note: If the fetched entity is a workflow, it might contain a token field but that is to be IGNORED.`),
			common.WithScope(config, false),
			mcp.WithString("entity_id",
				mcp.Required(),
				mcp.Description("The Unique identifier of the entity within its scope and kind. This is not the name of the entity"),
			),
			mcp.WithString("kind",
				mcp.Required(),
				mcp.Description("Kind of the entity (e.g., component, api, resource, user, workflow)"),
				mcp.Enum(dto.EntityKindApi, dto.EntityKindComponent, dto.EntityKindEnvironment, dto.EntityKindEnvironment, dto.EntityKindEnvironmentblueprint, dto.EntityKindGroup, dto.EntityKindResource, dto.EntityKindUser, dto.EntityKindWorkflow),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			entityId, err := RequiredParam[string](request, "entity_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			kind, err := OptionalParam[string](request, "kind")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, err := client.GetEntity(ctx, scope, kind, entityId)
			if err != nil {
				return nil, fmt.Errorf("failed to get entity: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal entity: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListEntitiesTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_entities",
			mcp.WithDescription(`List entities in the Harness Internal Developer Portal Catalog. Entities can represent services, APIs, user groups, resources, and more. The tool returns metadata for the Harness entities matching the filter criteria, including their identifier, scope, kind, reference type (INLINE/GIT), YAML definition, Git details (branch, path, repo), ownership, tags, lifecycle, scorecards, status, and group.
			If limit is not provided, use the tool multiple times to fetch all the entities in a paginated manner.
			Note: If the fetched entity is a workflow, it might contain a token field but that is to be IGNORED.`),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter entities"),
			),
			common.WithScope(config, false),
			mcp.WithString("scope_level",
				mcp.Description("Option to fetch the entities for the specified scope level."),
				mcp.Required(),
				mcp.DefaultString(dto.ScopeLevelDefault),
				mcp.Enum(dto.ScopeLevelDefault, dto.ScopeLevelAccount, dto.ScopeLevelOrg, dto.ScopeLevelProject),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination - page 0 is the first page"),
				mcp.Required(),
				mcp.Min(0),
				mcp.DefaultNumber(0),
			),
			mcp.WithNumber("size",
				mcp.Description("Number of items per page"),
				mcp.Required(),
				mcp.DefaultNumber(20),
				mcp.Max(100),
			),
			mcp.WithString("sort",
				mcp.Description("Option to sort entities"),
			),
			mcp.WithString("owned_by_me",
				mcp.Description("Option to fetch only the entities owned by me"),
			),
			mcp.WithString("favorites",
				mcp.Description("Option to fetch only my favorite entities"),
			),
			mcp.WithString("kind",
				mcp.Description("Option to fetch only the entities of the specified kinds which would be any of (API, Component, Workflow or User Group). It is to be passed as a comma separated string"),
				mcp.Enum(dto.EntityKindApi, dto.EntityKindComponent, dto.EntityKindEnvironment, dto.EntityKindEnvironment, dto.EntityKindEnvironmentblueprint, dto.EntityKindGroup, dto.EntityKindResource, dto.EntityKindUser, dto.EntityKindWorkflow),
				mcp.Required(),
				mcp.DefaultString(dto.EntityKindDefault),
			),
			mcp.WithString("type",
				mcp.Description("Option to fetch only the entities of the specified types. It is to be passed as a comma separated string"),
			),
			mcp.WithString("owner",
				mcp.Description("Option to Filter entities by their owner references. It is to be passed as a comma separated string."),
			),
			mcp.WithString("lifecycle",
				mcp.Description("Option to fetch only the entities for the specified lifecycle like experimental/production. It is to be passed as a comma separated string"),
			),
			mcp.WithString("tags",
				mcp.Description("Option to fetch only the entities for the specified tags. It is to be passed as a comma separated string"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &dto.GetEntitiesParams{}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scopeLevel, err := OptionalParam[string](request, "scope_level")
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

			sort, err := OptionalParam[string](request, "sort")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			ownedByMe, err := OptionalParam[bool](request, "owned_by_me")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			favorites, err := OptionalParam[bool](request, "favorites")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			kind, err := OptionalParam[string](request, "kind")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			type_, err := OptionalParam[string](request, "type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			owner, err := OptionalParam[string](request, "owner")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			lifecycle, err := OptionalParam[string](request, "lifecycle")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			tags, err := OptionalParam[string](request, "tags")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params = &dto.GetEntitiesParams{
				Page:       int32(page),
				Limit:      int32(size),
				SearchTerm: searchTerm,
				Sort:       sort,
				OwnedByMe:  ownedByMe,
				Favorites:  favorites,
				Kind:       kind,
				Type:       type_,
				Owner:      owner,
				Lifecycle:  lifecycle,
				Tags:       tags,
			}

			data, err := client.ListEntities(ctx, scope, scopeLevel, params)
			if err != nil {
				return nil, fmt.Errorf("failed to list entities: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal entities list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetScorecardTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scorecard",
			mcp.WithDescription("Get details of a specific scorecard in the Harness IDP Catalog. Use this only when the **id** is provided or known."),
			common.WithScope(config, false),
			mcp.WithString("scorecard_id",
				mcp.Required(),
				mcp.Description("The Unique identifier of the score within its scope and kind"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scorecardId, err := RequiredParam[string](request, "scorecard_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetScorecard(ctx, scope, scorecardId)
			if err != nil {
				return nil, fmt.Errorf("failed to get scorecard: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal scorecard: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListScorecardsTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_scorecards",
			mcp.WithDescription("List scorecards in the Harness Internal Developer Portal Catalog."),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListScorecards(ctx, scope)
			if err != nil {
				return nil, fmt.Errorf("failed to list scorecards: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal scorecard list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetScoreSummaryTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_score_summary",
			mcp.WithDescription("Get Score Summary for Scorecards in the Harness Internal Developer Portal Catalog."),
			mcp.WithString("entity_identifier",
				mcp.Required(),
				mcp.Description("The Unique identifier of the entity within its scope and kind. This is not the name of the scorecard"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			entityId, err := RequiredParam[string](request, "entity_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetScorecardSummary(ctx, scope, entityId)
			if err != nil {
				return nil, fmt.Errorf("failed to get scorecard summary: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal scorecard summary: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetScoresTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scores",
			mcp.WithDescription("Get Scores for Scorecards in the Harness Internal Developer Portal Catalog."),
			mcp.WithString("entity_identifier",
				mcp.Required(),
				mcp.Description("The Unique identifier of the entity within its scope and kind. This is not the name of the scorecard"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			entityId, err := RequiredParam[string](request, "entity_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetScorecardScores(ctx, scope, entityId)
			if err != nil {
				return nil, fmt.Errorf("failed to list scorecards: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal scorecard list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetScorecardStatsTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scorecard_stats",
			mcp.WithDescription("Get Stats for Scorecards in the Harness Internal Developer Portal i.e. the scores for all the entities that have this scorecard configured."),
			mcp.WithString("scorecard_identifier",
				mcp.Required(),
				mcp.Description("The Unique identifier of the scorecard. This is not the name of the scorecard"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scorecardId, err := RequiredParam[string](request, "scorecard_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, err := client.GetScorecardStats(ctx, scope, scorecardId)
			if err != nil {
				return nil, fmt.Errorf("failed to get scorecard stats: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal scorecard stats: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetCheckTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scorecard_check",
			mcp.WithDescription(`Get details of a specific check configured in a scorecard. A check is a query performed against a data point for a software component which results in either Pass or Fail.`),
			common.WithScope(config, false),
			mcp.WithString("check_id",
				mcp.Required(),
				mcp.Description("The Unique identifier of the check. This is not the name of the check"),
			),
			mcp.WithBoolean("is_custom",
				mcp.Description("Whether the check is a custom check or not. This will be mentioned in the scorecard details."),
				mcp.DefaultBool(false),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			checkId, err := RequiredParam[string](request, "check_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			isCustom, err := OptionalParam[bool](request, "is_custom")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCheck(ctx, scope, checkId, isCustom)
			if err != nil {
				return nil, fmt.Errorf("failed to get check: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal check: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListChecksTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_scorecard_checks",
			mcp.WithDescription(`List checks in the Harness Internal Developer Portal Catalog. A check is a query performed against a data point for a software component which results in either Pass or Fail.`),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter entities"),
			),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("sort_type",
				mcp.Description("Sort type for the results (e.g., name, description or data_source)"),
				mcp.Enum(dto.ChecksSortTypeName, dto.ChecksSortTypeDescription, dto.ChecksSortTypeDataSource),
			),
			mcp.WithString("sort_order",
				mcp.Description("Sort order for the results (e.g., ASC for ascending or DESC for descending)"),
				mcp.Enum(dto.ChecksSortOrderAsc, dto.ChecksSortOrderDesc),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &dto.GetChecksParams{}
			scope, err := common.FetchScope(ctx, config, request, false)
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
			sortType, err := OptionalParam[string](request, "sort_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			sortOrder, err := OptionalParam[string](request, "sort_order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			sort := ""
			if sortType != "" {
				sort += sortType
				if sortOrder != "" {
					sort += "," + sortOrder
				}
			}

			params = &dto.GetChecksParams{
				Limit:      int32(size),
				Page:       int32(page),
				SearchTerm: searchTerm,
				Sort:       sort,
			}

			data, err := client.ListChecks(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to list checks: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal checks list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetCheckStatsTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scorecard_check_stats",
			mcp.WithDescription("Get Stats for checks in the Harness Internal Developer Portal i.e. the status (PASS or FAIL) for all the entities that have a scorecard configured which has this check."),
			mcp.WithString("check_identifier",
				mcp.Required(),
				mcp.Description("The Unique identifier of the check. This is not the name of the check"),
			),
			common.WithScope(config, false),
			mcp.WithBoolean("is_custom",
				mcp.Description("Whether the check is a custom check or not. This will be mentioned in the scorecard details."),
				mcp.DefaultBool(false),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			checkId, err := RequiredParam[string](request, "check_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			isCustom, err := OptionalParam[bool](request, "is_custom")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCheckStats(ctx, scope, checkId, isCustom)
			if err != nil {
				return nil, fmt.Errorf("failed to get check stats: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal check stats: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ExecuteWorkflowTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("execute_workflow",
			mcp.WithDescription(`Execute a workflow in the Harness Internal Developer Portal Catalog. This tool takes in the entity metadata of the workflow and a set of values to be used for the execution.
			Usage Guidance:
			- Use the get_entity tool to fetch the workflow details
			- The set of values provided has to be validated against the input set required by the workflow.
			- Provide only non-authentication parameters in the values object
			- All HarnessAuthToken fields should be OMITTED regardless of workflow requirements
			- Validate other required parameters against the workflow's input set
			⚠️ IMPORTANT: 
			- NEVER request or include token values when executing workflows. The system handles authentication automatically - DO NOT prompt users for tokens, even if they appear as required parameters in the workflow definition.
			- DO NOT execute the workflow if the valueset is not sufficient.`),
			common.WithScope(config, false),
			mcp.WithObject("workflow_details",
				mcp.Required(),
				mcp.Description("A json representation of the workflow entity. This json contains the metadata of the workflow(like owner, name, description, ref etc) and a yaml field which should contain the spec.parameters against which the values should be validated. Only the parameters marked required are mandatory."),
			),
			mcp.WithObject("identifier",
				mcp.Required(),
				mcp.Description("The identifier of the workflow to be executed. This can be extracted from the field identifier of the workflow_details."),
			),
			mcp.WithObject("values",
				mcp.Description("The values to be used for the workflow execution. The values should be in the format of a json object. These values are to be validated against the parameters of the workflow. Do NOT validate the field of type HarnessAuthToken, it is not to be provided in the prompt."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			_, err = RequiredParam[interface{}](request, "workflow_details")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			identifier, err := RequiredParam[string](request, "identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			values, err := OptionalParam[map[string]interface{}](request, "values")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ExecuteWorkflow(ctx, scope, identifier, values)
			if err != nil {
				return nil, fmt.Errorf("failed to execute workflow: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal workflow execution response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
