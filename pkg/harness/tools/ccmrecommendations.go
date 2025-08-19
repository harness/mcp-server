package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/ccmcommons"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	FilterTypeRecommendation = "CCMRecommendation"
)

type ClientFunctionRecommendationsInterface func(ctx context.Context, scope dto.Scope, accountId string, params map[string]any) (*map[string]any, error)
type GetRecommendationDetail func(ctx context.Context, options dto.CCMRecommendationDetailOptions) (*map[string]any, error)
type CreateTicketForRecommendation func(ctx context.Context, accountId string, ticketDetails dto.CCMTicketDetails) (*map[string]any, error)

func ListCcmRecommendationsTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewToolWithRawSchema("list_ccm_recommendations", ccmcommons.ListRecommendationsDescription,
			recommendationsListDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return recommendationsHandler(config, ctx, request, client.ListRecommendations)
		}
}

func ListCcmRecommendationsByResourceTypeTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewToolWithRawSchema("list_ccm_recommendations_by_resource_type", ccmcommons.ListRecommendationsByResourceTypeDescription,
			recommendationsListDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return recommendationsHandler(config, ctx, request, client.ListRecommendationsByResourceType)
		}
}

func GetCcmRecommendationsStatsTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewToolWithRawSchema("get_ccm_recommendations_stats", ccmcommons.GetRecommendationsStatsDescription,
			recommendationsListDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return recommendationsHandler(config, ctx, request, client.GetRecommendationsStats)
		}
}

func UpdateCcmRecommendationStateTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewTool("update_ccm_recommendation_state",
			mcp.WithDescription(`
			<UPDATE_TOOL>Marks a recommendation as Applied/Open/Ignored in Harness Cloud Cost Management. This is a state-changing operation. 
			Before calling, summarize the proposed changes and ask the user to confirm. Proceed ONLY if the user explicitly replies "yes".

			`),
			mcp.WithString("recommendation_id",
				mcp.Required(),
				mcp.Description("Recommendation ID to update"),
			),
			mcp.WithString("state",
				mcp.Enum(dto.RecommendationStateIgnored, dto.RecommendationStateOpen, dto.RecommendationStateApplied),
				mcp.DefaultString(dto.RecommendationStateApplied),
				mcp.Required(),
				mcp.Description("New state for recommendation"),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    utils.ToBoolPtr(false),
				DestructiveHint: utils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			recommendationId, err := OptionalParam[string](request, "recommendation_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			state, err := OptionalParam[string](request, "state")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.UpdateRecommendationState(ctx, scope, accountId, recommendationId, state)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func OverrideCcmRecommendationSavingsTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewTool("override_ccm_recommendation_savings",
			mcp.WithDescription(`
			Overrides recommendation savings in Harness Cloud Cost Management.  This is a state-changing operation. 
			Before calling, summarize the proposed changes and ask the user to confirm. Proceed ONLY if the user explicitly replies "yes".
			`),
			mcp.WithString("recommendation_id",
				mcp.Required(),
				mcp.Description("Recommendation ID to update"),
			),
			mcp.WithNumber("overridden_savings",
				mcp.Required(),
				mcp.Description("New savings for recommendation"),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    utils.ToBoolPtr(false),
				DestructiveHint: utils.ToBoolPtr(true),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			recommendationId, err := OptionalParam[string](request, "recommendation_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			savings, err := OptionalParam[float64](request, "overridden_savings")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.OverrideRecommendationSavings(ctx, scope, accountId, recommendationId, savings)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func recommendationsHandler(
	config *config.Config,
	ctx context.Context,
	request mcp.CallToolRequest,
	clientFunction ClientFunctionRecommendationsInterface,
) (*mcp.CallToolResult, error) {

	// Account Id for querystring.
	accountId, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	scope, err := FetchScope(config, request, false)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	k8sProps, err := OptionalParam[map[string]any](request, "k8sRecommendationFilterPropertiesDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	awsProps, err := OptionalParam[map[string]any](request, "awsRecommendationFilterPropertiesDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	azureProps, err := OptionalParam[map[string]any](request, "azureRecommendationFilterProperties")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	containerProps, err := OptionalParam[map[string]any](request, "containerRecommendationFilterPropertiesDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	governanceProps, err := OptionalParam[map[string]any](request, "governanceRecommendationFilterPropertiesDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	baseProps, err := OptionalParam[map[string]any](request, "baseRecommendationFilterPropertiesDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	perspectiveFilters, err := OptionalParam[[]any](request, "perspectiveFilters")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	minSaving, err := OptionalParam[float64](request, "minSaving")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	minCost, err := OptionalParam[float64](request, "minCost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	daysBack, err := OptionalParam[float64](request, "daysBack")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	offset, err := OptionalParam[float64](request, "offset")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	limit, err := OptionalParam[float64](request, "limit")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	childRecommendation, err := OptionalParam[bool](request, "childRecommendation")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	includeIgnoredRecommendation, err := OptionalParam[bool](request, "includeIgnoredRecommendation")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	parentRecommendation, err := OptionalParam[bool](request, "parentRecommendation")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	tagDTOs, err := OptionalParam[[]any](request, "tagDTOs")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	costCategoryDTOs, err := OptionalParam[[]any](request, "costCategoryDTOs")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	tags, err := OptionalParam[map[string]any](request, "tags")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	filterType, err := OptionalParam[string](request, "filterType")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if filterType == "" {
		filterType = FilterTypeRecommendation
	}

	params := map[string]any{
		"k8sRecommendationFilterPropertiesDTO":        k8sProps,
		"awsRecommendationFilterPropertiesDTO":        awsProps,
		"azureRecommendationFilterProperties":         azureProps,
		"containerRecommendationFilterPropertiesDTO":  containerProps,
		"governanceRecommendationFilterPropertiesDTO": governanceProps,
		"baseRecommendationFilterPropertiesDTO":       baseProps,
		"perspectiveFilters":                          perspectiveFilters,
		"minSaving":                                   minSaving,
		"minCost":                                     minCost,
		"daysBack":                                    daysBack,
		"offset":                                      offset,
		"limit":                                       limit,
		"childRecommendation":                         childRecommendation,
		"includeIgnoredRecommendation":                includeIgnoredRecommendation,
		"parentRecommendation":                        parentRecommendation,
		"tagDTOs":                                     tagDTOs,
		"costCategoryDTOs":                            costCategoryDTOs,
		"tags":                                        tags,
		"filterType":                                  filterType,
	}

	data, err := clientFunction(ctx, scope, accountId, params)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	r, err := json.Marshal(data)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(string(r)), nil
}

var createJiraToolName = "create_jira_ticket_for_ccm_recommendation"

func CreateCcmJiraTicketTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createTicketTool(createJiraToolName, "Creates a Jira ticket for a CCM recommendation", config, client.CreateJiraTicket)
}

func CreateCcmServiceNowTicketTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createTicketTool("create_service_now_ticket_for_ccm_recommendation", "Creates a Service Now ticket for a CCM recommendation", config, client.CreateServiceNowTicket)
}

func createTicketTool(name string, description string, config *config.Config, clientCall CreateTicketForRecommendation,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	options := []mcp.ToolOption{
		mcp.WithDescription(description),
		mcp.WithString("recommendation_id",
			mcp.Required(),
			mcp.Description("Recommendation ID"),
		),
		mcp.WithString("resource_type",
			mcp.Description("Resource type"),
			mcp.Enum(
				dto.ResourceTypeWorkload,
				dto.ResourceTypeNodePool,
				dto.ResourceTypeECSService,
				dto.ResourceTypeEC2Instance,
				dto.ResourceTypeGovernance,
				dto.ResourceTypeAzureInstance,
			),
			mcp.Required(),
		),
		mcp.WithString("connector_ref", mcp.Required(), mcp.Description("Connector reference")),
		mcp.WithObject("fields", mcp.Required(), mcp.Description("Additional fields")),
		mcp.WithToolAnnotation(mcp.ToolAnnotation{
			ReadOnlyHint:    utils.ToBoolPtr(false),
			DestructiveHint: utils.ToBoolPtr(true),
		}),
	}

	if name == createJiraToolName {
		options = append(options,
			mcp.WithString("project_key", mcp.Required(), mcp.Description("Jira project key. Get the possible values for this field by using the `list_jira_projects` tool.")),
			mcp.WithString("issue_type", mcp.Required(), mcp.Description("Issue type. Get the value for this field by using the `list_jira_issue_types` tool.")),
		)
	} else {
		options = append(options,
			mcp.WithString("ticket_type", mcp.Required(), mcp.Description("Ticket type")),
		)
	}

	return mcp.NewTool(name, options...,
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			recommendationId, err := OptionalParam[string](request, "recommendation_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			resourceType, err := OptionalParam[string](request, "resource_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			connectorRef, err := OptionalParam[string](request, "connector_ref")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			fields, err := OptionalParam[map[string]any](request, "fields")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if recommendationId == "" {
				return mcp.NewToolResultError("recommendation_id is required"), nil
			}
			if resourceType == "" {
				return mcp.NewToolResultError("resource_type is required"), nil
			}
			if connectorRef == "" {
				return mcp.NewToolResultError("connector_ref is required"), nil
			}

			projectKey := ""
			ticketType := ""
			platform := dto.TicketPlatformJira
			if name == createJiraToolName {
				projectKey, err = OptionalParam[string](request, "project_key")
				if err != nil {
					return mcp.NewToolResultError(err.Error()), nil
				}
				if projectKey == "" {
					return mcp.NewToolResultError("project_key is required"), nil
				}

				ticketType, err = OptionalParam[string](request, "issue_type")
				if err != nil {
					return mcp.NewToolResultError("Error when getting issue_type: " + err.Error()), nil
				}
			} else {
				ticketType, err = OptionalParam[string](request, "ticket_type")
				if err != nil {
					return mcp.NewToolResultError("Error when getting ticket_type: " + err.Error()), nil
				}
				platform = dto.TicketPlatformServiceNow
			}

			if ticketType == "" {
				return mcp.NewToolResultError("Ticket or Issue type can not be nil"), nil
			}

			ticketDetail := dto.CCMTicketDetails{
				RecommendationId: recommendationId,
				ResourceType:     resourceType,
				ConnectorRef:     connectorRef,
				ProjectKey:       projectKey,
				TicketType:       ticketType,
				Fields:           fields,
				Platform:         platform,
			}

			data, err := clientCall(ctx, accountId, ticketDetail)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

const (
	ToolEC2        int = 1
	ToolAzureVm    int = 2
	ToolECSService     = 3
	ToolNodePool       = 4
	ToolWorkload       = 5
)

func GetEc2RecommendationDetailTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createRecommendationDetailTool(
		"get_ec2_recommendation_detail",
		"Returns EC2 Recommendation details for the given Recommendation identifier.",
		config, client.GetEc2RecommendationDetail, ToolEC2)
}

func GetAzureVmRecommendationDetailTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createRecommendationDetailTool(
		"get_azure_vm_recommendation_detail",
		"Returns Azure Vm Recommendation details for the given Recommendation identifier.",
		config, client.GetAzureVmRecommendationDetail, ToolAzureVm)
}

func GetEcsServiceRecommendationDetailTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createRecommendationDetailTool(
		"get_ecs_service_recommendation_detail",
		"Returns ECS Service Recommendation details for the given Recommendation identifier.",
		config, client.GetEcsServiceRecommendationDetail, ToolECSService)
}

func GetNodePoolRecommendationDetailTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createRecommendationDetailTool(
		"get_node_pool_recommendation_detail",
		"Returns Node Pool Recommendation details for the given Recommendation identifier.",
		config, client.GetNodePoolRecommendationDetail, ToolNodePool)
}

func GetWorkloadRecommendationDetailTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createRecommendationDetailTool(
		"get_workload_recommendation_detail",
		"Returns Workload Recommendation details for the given Recommendation identifier.",
		config, client.GetWorkloadRecommendationDetail, ToolWorkload)
}

func createRecommendationDetailTool(
	name string,
	description string,
	config *config.Config,
	clientCall GetRecommendationDetail,
	toolId int,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	options := []mcp.ToolOption{
		mcp.WithDescription(description),
		mcp.WithString("recommendation_id",
			mcp.Required(),
			mcp.Description("ECS Recommendation identifier."),
		),
	}

	if toolId == ToolECSService || toolId == ToolWorkload {
		options = append(options,
			mcp.WithString("from",
				mcp.Description("Should use org.joda.time.DateTime parsable format. Example, '2022-01-31', '2022-01-31T07:54Z' or '2022-01-31T07:54:51.264Z' Defaults to Today-7days"),
			))

		options = append(options,
			mcp.WithString("to",
				mcp.Description("Should use org.joda.time.DateTime parsable format. Example, '2022-01-31', '2022-01-31T07:54Z' or '2022-01-31T07:54:51.264Z' Defaults to Today"),
			))
	}

	if toolId == ToolECSService {
		options = append(options,
			mcp.WithNumber("buffer_percentage",
				mcp.Description("Buffer Percentage defaults to zero"),
			))
	}

	return mcp.NewTool(name, options...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			recommendationId, err := OptionalParam[string](request, "recommendation_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			from, err := OptionalParam[string](request, "from")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			to, err := OptionalParam[string](request, "to")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			bufferPercentage, err := OptionalParam[int64](request, "buffer_percentage")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			fromDate := ""
			toDate := ""
			if toolId == ToolECSService || toolId == ToolWorkload {
				fromDate, err = utils.FormatMMDDYYYYToHyphenYYYYMMDD(from)
				if err != nil {
					return mcp.NewToolResultError("Error when parsing from date:" + err.Error()), nil
				}
				toDate, err = utils.FormatMMDDYYYYToHyphenYYYYMMDD(to)
				if err != nil {
					return mcp.NewToolResultError("Error when parsing to date:" + err.Error()), nil
				}
			}

			detailOption := dto.CCMRecommendationDetailOptions{
				AccountIdentifier: accountId,
				RecommendationId:  recommendationId,
				From:              fromDate,
				To:                toDate,
				BufferPercentage:  bufferPercentage,
			}

			data, err := clientCall(ctx, detailOption)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListJiraProjectsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_jira_projects",
			mcp.WithDescription("Get a list of Jira project to create a ticket for a Recommendation in Harness Cloud Cost Management"),
			mcp.WithString("jira_connector_ref",
				mcp.Required(),
				mcp.Description("Jira connector reference to fetch projects from"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			connector, err := RequiredParam[string](request, "jira_connector_ref")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListJiraProjects(ctx, accountId, connector)
			if err != nil {
				return nil, fmt.Errorf("failed to get a list of Jira Projects: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal Jira Projects list: %w", err)
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListJiraIssueTypesTool(
	config *config.Config,
	client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_jira_issue_types",
			mcp.WithDescription("Get a list of Jira projects to create a ticket for a Recommendation in Harness Cloud Cost Management"),
			mcp.WithString("jira_connector_ref",
				mcp.Required(),
				mcp.Description("Jira connector reference to fetch projects from"),
			),
			mcp.WithString("project_key",
				mcp.Required(),
				mcp.Description("Jira project key to fetch issue types from. Get the values for this parameter from the `list_jira_projects` tool"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			connector, err := RequiredParam[string](request, "jira_connector_ref")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			projectKey, err := RequiredParam[string](request, "project_key")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			options := dto.CCMJiraIssueTypesOptions{
				AccountId:    accountId,
				ConnectorRef: connector,
				ProjectKey:   projectKey,
			}
			data, err := client.ListJiraIssueTypes(ctx, options)
			if err != nil {
				return nil, fmt.Errorf("failed to get a list of Jira Projects: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal Jira Projects list: %w", err)
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func recommendationsListDefinition() json.RawMessage {
	return toRawMessage(commonRecommendationsSchema(), []string{})
}

func commonRecommendationsSchema() map[string]any {

	return map[string]any{
		"k8sRecommendationFilterPropertiesDTO": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ids":                  map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"names":                map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"namespaces":           map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"clusterNames":         map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"resourceTypes":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"recommendationStates": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"cloudProvider":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"regions":              map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
		},
		"awsRecommendationFilterPropertiesDTO": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"instanceType": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
		},
		"azureRecommendationFilterProperties": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"instanceType":  map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"resourceGroup": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
		},
		"containerRecommendationFilterPropertiesDTO": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"k8sClusterName": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"k8sNamespace":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"ecsClusterName": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"ecsLaunchType":  map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
		},
		"governanceRecommendationFilterPropertiesDTO": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"governanceRuleName": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
		},
		"baseRecommendationFilterPropertiesDTO": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":                  map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"cloudAccountId":      map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"cloudAccountName":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"resourceId":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"resourceName":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"region":              map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"resourceType":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"recommendationState": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"cloudProvider":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
		},
		"perspectiveFilters": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"idFilter": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"field": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"fieldId":        map[string]any{"type": "string"},
									"fieldName":      map[string]any{"type": "string"},
									"identifier":     map[string]any{"type": "string"},
									"identifierName": map[string]any{"type": "string"},
								},
							},
							"operator": map[string]any{"type": "string"},
							"values":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						},
					},
					"timeFilter": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"field": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"fieldId":        map[string]any{"type": "string"},
									"fieldName":      map[string]any{"type": "string"},
									"identifier":     map[string]any{"type": "string"},
									"identifierName": map[string]any{"type": "string"},
								},
							},
							"operator": map[string]any{"type": "string"},
							"value":    map[string]any{"type": "number"},
						},
					},
					"timeRangeTypeFilter": map[string]any{"type": "string"},
					"viewMetadataFilter": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"viewId":    map[string]any{"type": "string"},
							"isPreview": map[string]any{"type": "boolean"},
							"preview":   map[string]any{"type": "boolean"},
						},
					},
					"ruleFilter": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"conditions": map[string]any{
								"type": "array",
								"items": map[string]any{
									"type": "object",
									"properties": map[string]any{
										"field": map[string]any{
											"type": "object",
											"properties": map[string]any{
												"fieldId":        map[string]any{"type": "string"},
												"fieldName":      map[string]any{"type": "string"},
												"identifier":     map[string]any{"type": "string"},
												"identifierName": map[string]any{"type": "string"},
											},
										},
										"operator": map[string]any{"type": "string"},
										"values":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
									},
								},
							},
						},
					},
				},
			},
		},
		"minSaving":                    map[string]any{"type": "number", "default": 1},
		"minCost":                      map[string]any{"type": "number"},
		"daysBack":                     map[string]any{"type": "number", "default": 10},
		"offset":                       map[string]any{"type": "number", "default": 0},
		"limit":                        map[string]any{"type": "number", "default": 10},
		"childRecommendation":          map[string]any{"type": "boolean"},
		"includeIgnoredRecommendation": map[string]any{"type": "boolean"},
		"parentRecommendation":         map[string]any{"type": "boolean"},
		"tagDTOs": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"key":   map[string]any{"type": "string"},
					"value": map[string]any{"type": "string"},
				},
			},
		},
		"costCategoryDTOs": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"costCategory": map[string]any{"type": "string"},
					"costBucket":   map[string]any{"type": "string"},
				},
			},
		},
		"tags": map[string]any{
			"type":                 "object",
			"additionalProperties": map[string]any{"type": "string"},
		},
		"filterType": map[string]any{"type": "string", "default": FilterTypeRecommendation},
	}
}

func toRawMessage(properties map[string]any, requiredFields []string) json.RawMessage {

	schema := map[string]any{
		"type":       "object",
		"properties": properties,
		"required":   requiredFields,
	}
	b, _ := json.Marshal(schema)
	return json.RawMessage(b)
}
