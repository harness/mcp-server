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

func GetEntityTool(config *config.Config, client *client.IDPService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_entity",
			mcp.WithDescription("Get details of a specific entity(services, APIs, user groups, resources) in the Harness IDP Catalog. Entities can represent services, APIs, user groups, resources, and more. The tool returns metadata for the Harness entities matching the filter criteria, including their identifier, scope, kind, reference type (INLINE/GIT), YAML definition, Git details (branch, path, repo), ownership, tags, lifecycle, scorecards, status, and group. Use the list_entities tool to first to get the id."),
			WithScope(config, false),
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
			scope, err := FetchScope(config, request, false)
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
			mcp.WithDescription("List entities in the Harness Internal Developer Portal Catalog. Entities can represent services, APIs, user groups, resources, and more. The tool returns metadata for the Harness entities matching the filter criteria, including their identifier, scope, kind, reference type (INLINE/GIT), YAML definition, Git details (branch, path, repo), ownership, tags, lifecycle, scorecards, status, and group."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter entities"),
			),
			WithScope(config, false),
			WithPagination(),
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
			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			_, size, err := FetchPagination(request)
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

			data, err := client.ListEntities(ctx, scope, params)
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
			WithScope(config, false),
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
			scope, err := FetchScope(config, request, false)
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			scope, err := FetchScope(config, request, false)
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			entityId, err := RequiredParam[string](request, "entity_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, false)
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			entityId, err := RequiredParam[string](request, "entity_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, false)
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
