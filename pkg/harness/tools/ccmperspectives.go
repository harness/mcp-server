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
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/harness/harness-mcp/pkg/ccmcommons"
	"strings"
)

func ListCcmPerspectivesDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_perspectives_detail",
			mcp.WithDescription("List the cost perspectives with advanced options in Harness Cloud Cost Management"),
			mcp.WithString("search_key",
				mcp.Description("Optional search key to filter perspectives"),
			),
			mcp.WithString("sort_type",
				mcp.Description("Sort type for the results (e.g., NAME, LAST_EDIT)"),
				mcp.DefaultString(dto.SortByTime),
				mcp.Enum(dto.SortByTime, dto.SortByCost, dto.SortByClusterCost, dto.SortByName),
			),
			mcp.WithString("sort_order",
				mcp.Description("Sort order for the results (e.g., ASCENDING, DESCENDING)"),
				mcp.DefaultString(dto.SortOrderDescending),
				mcp.Enum(dto.SortOrderAscending, dto.SortOrderDescending),
			),
			mcp.WithString("cloud_filter",
				mcp.Description("Filters for cloud and clusters (e.g., AWS, GCP, AZURE)"),
				mcp.Enum(dto.FilterByAws, dto.FilterByAzure, dto.FilterByGcp, dto.FilterByCluster, dto.FilterByDefault),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of items per page"),
			),
			mcp.WithNumber("offset",
				mcp.DefaultNumber(1),
				mcp.Description("Offset or page number for pagination"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMListPerspectivesDetailOptions{}
			params.AccountIdentifier = accountId

			// Handle search key parameter
			searchKey, ok, err := OptionalParamOK[string](request, "search_key")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && searchKey != "" {
				params.SearchKey = searchKey
			}

			// Handle sort type parameter
			sortType, ok, err := OptionalParamOK[string](request, "sort_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortType != "" {
				params.SortType = sortType
			}

			// Handle sort order parameter
			sortOrder, ok, err := OptionalParamOK[string](request, "sort_order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortOrder != "" {
				params.SortOrder = sortOrder
			}

			// Handle limit parameter
			limit, ok, err := OptionalParamOK[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.Limit = utils.SafeFloatToInt32(limit, 5)
			}

			// Handle offset parameter
			offset, ok, err := OptionalParamOK[float64](request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.Offset = utils.SafeFloatToInt32(offset, 1)
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListPerspectivesDetail(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspectives: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspectives: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetCcmPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_perspective",
			mcp.WithDescription("Get a perspective with advanced options in Harness Cloud Cost Management"),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			perspectiveId, err := OptionalParam[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMGetPerspectiveOptions{}
			params.AccountIdentifier = accountId
			params.PerspectiveId = perspectiveId

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetPerspective(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspective: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspective: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetLastPeriodCostCcmPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	defaultStartTime := utils.CurrentMMDDYYYY()
	return mcp.NewTool("get_last_period_cost_ccm_perspective",
			mcp.WithDescription("Get the last period cost for a perspective in Harness Cloud Cost Management"),
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
			),
			mcp.WithString("start_time",
				mcp.Required(),
				mcp.DefaultString(defaultStartTime),
				mcp.Description("Start time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)"),
			),
			mcp.WithString("period",
				mcp.Description("Required period to get the cost for"),
				mcp.DefaultString(dto.PeriodMonthly),
				mcp.Enum(dto.PeriodDaily, dto.PeriodWeekly, dto.PeriodMonthly, dto.PeriodQuarterly, dto.PeriodYearly),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			perspectiveId, err := OptionalParam[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTimeStr, err := OptionalParam[string](request, "start_time")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			startTime, err := utils.FormatMMDDYYYYToUnixMillis(startTimeStr)

			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			period, err := OptionalParam[string](request, "period")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMGetLastPeriodCostPerspectiveOptions{}
			params.AccountIdentifier = accountId
			params.PerspectiveId = perspectiveId
			params.StartTime = startTime
			params.Period = period

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetLastCostPerspective(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspective: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspective: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetLastTwelveMonthsCostCcmPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	defaultStartTime := utils.CurrentMMDDYYYY()
	return mcp.NewTool("get_last_twelve_months_cost_ccm_perspective",
			mcp.WithDescription("Get the last twelve months cost for a perspective in Harness Cloud Cost Management"),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
			),
			mcp.WithString("start_time",
				mcp.DefaultString(defaultStartTime),
				mcp.Description("Start time of the period in MM/DD/YYYY format (e.g. 04/01/2023)"),
			),
			// API Documentation specify that **only** YEARLY 'period' is supported
			// So, for now the value will be "Harcoded".
			// Same for 'breakdown' field, but supporting MONTHLY
			// Same for 'type' field, but supporting PREVIOUS_PERIOD_SPEND
			// TODO: Check with team.
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			perspectiveId, err := OptionalParam[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTimeStr, err := OptionalParam[string](request, "start_time")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTime, err := utils.FormatMMDDYYYYToUnixMillis(startTimeStr)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMGetLastTwelveMonthsCostPerspectiveOptions{}
			params.AccountIdentifier = accountId
			params.PerspectiveId = perspectiveId
			params.StartTime = startTime

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetLastTwelveMonthsCostPerspective(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspective: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspective: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
	}

// Create perspective
func CreateCcmPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createPerspectiveTool(config, client),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return createPerspectiveHandler(config, client, ctx, request)
		}
}

func createPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool) {

	return mcp.NewTool("create_ccm_perspective",
			mcp.WithDescription("Get the last twelve months cost for a perspective in Harness Cloud Cost Management"),
			mcp.WithString("account_id",
				mcp.Description("The account identifier owner of the perspective"),
				mcp.DefaultString("Z60xsRGoTeqOoAFRCsmlBQ"), // REMOVEEE, just for testing!!!
			),
			mcp.WithString("clone",
				mcp.DefaultBool(false),
				mcp.Description("Whether to clone the perspective or create a new one"),
			),
			mcp.WithString("update_total_cost",
				mcp.DefaultBool(false),
				mcp.Description("Whether to clone the perspective or create a new one"),
			),
			mcp.WithString("name",
				mcp.Required(),
				mcp.Description("Required perspective name"),
			),
			mcp.WithString("folder_id",
				mcp.DefaultString("rO1Spt18TXGQEw9eS9CLYg"), // REMOVEEE, just for testing!!!
				mcp.Description("Idenfifier for the containing folder of the perspective"),
			),
			mcp.WithString("view_version",
				mcp.Required(),
				mcp.DefaultString("1"),
				mcp.Description("Required. Version of the view"),
			),
			mcp.WithString("view_time_range_type",
				mcp.Required(),
				mcp.Enum(dto.TimeRangeTypeLast7Days, dto.TimeRangeTypeLast30Days, dto.TimeRangeTypeLastMonth, dto.TimeRangeTypeCurrentMonth, dto.TimeRangeTypeCustom),
				mcp.DefaultString(dto.TimeRangeTypeLast7Days),
				mcp.Description("Containing folder identifier of the perspective"),
			),
			mcp.WithString("view_time_range_start",
				mcp.Description("Start time when using view_time_range_type=Custom. In format MM/DD/YYYY. ie: 04/30/2023 for April 30, 2023"),
			),
			mcp.WithString("view_time_range_end",
				mcp.Description("End time when using view_time_range_type=Custom. In format MM/DD/YYYY. ie: 04/30/2023 for April 30, 2023"),
			),
			mcp.WithArray("data_sources",
			mcp.Description(fmt.Sprintf("Supported data sources: %s", getSupportedDataSources())),
				mcp.Enum(dto.DataSourceAws, dto.DataSourceGcp, dto.DataSourceAzure, dto.DataSourceExternalData, dto.DataSourceCommon, dto.DataSourceCustom, dto.DataSourceBusinessMapping, dto.DataSourceLabel, dto.DataSourceLabelV2),
			),
			mcp.WithBoolean("view_pref_show_anomalies",
				mcp.DefaultBool(false),
				mcp.Description("Whether to show anomalies in the view"),
			),
			mcp.WithBoolean("view_pref_include_others",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include other data in the view"),
			),
			mcp.WithBoolean("view_pref_include_unallocated_cost",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include discounts in the view"),
			),
			mcp.WithBoolean("view_pref_aws_pref_include_discounts",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include discounts in AWS view"),
			),
			mcp.WithBoolean("view_pref_aws_pref_include_credits",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include credits in AWS view"),
			),
			mcp.WithBoolean("view_pref_aws_pref_include_refunds",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include refunds in AWS view"),
			),
			mcp.WithBoolean("view_pref_aws_pref_include_taxes",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include taxes in AWS view"),
			),
			mcp.WithString("view_pref_aws_pref_aws_cost",
				mcp.Enum(dto.AwsCostUnblended, dto.AwsCostBlended),
				mcp.Description(fmt.Sprintf("How to show AWS cost (%s, %s)", dto.AwsCostUnblended, dto.AwsCostBlended)),
				mcp.DefaultString(dto.AwsCostUnblended),
			),
			mcp.WithBoolean("view_pref_gcp_pref_include_discounts",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include discounts"),
			),
			mcp.WithBoolean("view_pref_gcp_pref_include_taxes",
				mcp.DefaultBool(false),
				mcp.Description("Whether to include taxes"),
			),
			mcp.WithString("view_pref_azure_pref_cost_type",
				mcp.Enum(dto.AzureCostTypeActual, dto.AzureCostTypeAmortized),
				mcp.Description(fmt.Sprintf("How to show AZURE cost (%s, %s)", dto.AzureCostTypeActual, dto.AzureCostTypeAmortized)),
			),
			mcp.WithString("view_type",
				mcp.Required(),
				mcp.Description(fmt.Sprintf("View type (%s, %s, %s)", dto.ViewTypeSample, dto.ViewTypeCustomer, dto.ViewTypeDefault)),
				mcp.DefaultString(dto.ViewTypeDefault),
			),
			mcp.WithString("view_state",
				mcp.Required(),
				mcp.DefaultString(dto.ViewStateCompleted),
				mcp.Enum(dto.ViewStateDraft, dto.ViewStateCompleted),
				mcp.Description("State of view. Set to completed if it is not provided."),
			),
			createPerspectiveRules(),
		)
}

func createPerspectiveHandler(config *config.Config, client *client.CloudCostManagementService, ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

	// Account Id for querystring.
	accountId, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	perspectiveAccountId, err := OptionalParam[string](request, "account_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	clone, err := OptionalParam[bool](request, "clone")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	updateTotalCost, err := OptionalParam[bool](request, "update_total_cost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	name, err := OptionalParam[string](request, "name")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	folderId, err := OptionalParam[string](request, "folder_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewVersion, err := OptionalParam[string](request, "view_version")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewTimeRangeType, err := OptionalParam[string](request, "view_time_range_type")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewType, err := OptionalParam[string](request, "view_type")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewState, err := OptionalParam[string](request, "view_state")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	params := &dto.CCMCreatePerspectiveOptions{}
	params.AccountId = accountId
	params.Clone = clone
	params.UpdateTotalCost = updateTotalCost
	if perspectiveAccountId != "" {
		params.Body.AccountId = perspectiveAccountId
	}
	params.Body.Name = name
	params.Body.FolderId = folderId
	params.Body.ViewVersion = viewVersion
	params.Body.ViewTimeRange.ViewTimeRangeType = viewTimeRangeType

	if viewTimeRangeType == dto.TimeRangeTypeCustom {
		viewTimeRangeStartString, err := OptionalParam[string](request, "view_time_range_start")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		viewTimeRangeEndString, err := OptionalParam[string](request, "view_time_range_end")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		viewTimeRangeStart, err := utils.FormatMMDDYYYYToUnixMillis(viewTimeRangeStartString)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		viewTimeRangeEnd, err := utils.FormatMMDDYYYYToUnixMillis(viewTimeRangeEndString)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		params.Body.ViewTimeRange.StartTime = viewTimeRangeStart
		params.Body.ViewTimeRange.EndTime = viewTimeRangeEnd
	} else {
		params.Body.ViewTimeRange.StartTime = 0
		params.Body.ViewTimeRange.EndTime = 0
	}

	viewPrefShowAnomalies, err := OptionalParam[bool](request, "view_pref_show_anomalies")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefIncludeOthers, err := OptionalParam[bool](request, "view_pref_include_others")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefIncludeUnallocatedCost, err := OptionalParam[bool](request, "view_pref_include_unallocated_cost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefAwsPrefIncludeDiscounts, err := OptionalParam[bool](request, "view_pref_aws_pref_include_discounts")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefAwsPrefIncludeCredits, err := OptionalParam[bool](request, "view_pref_aws_pref_include_credits")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefAwsPrefIncludeRefunds, err := OptionalParam[bool](request, "view_pref_aws_pref_include_refunds")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefAwsPrefIncludeTaxes, err := OptionalParam[bool](request, "view_pref_aws_pref_include_taxes")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefAwsPrefAwsCost, err := OptionalParam[string](request, "view_pref_aws_pref_aws_cost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefGcpPrefIncludeDiscounts, err := OptionalParam[bool](request, "view_pref_gcp_pref_include_discounts")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefGcpPrefIncludeTaxes, err := OptionalParam[bool](request, "view_pref_gcp_pref_include_taxes")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	viewPrefAzureViewPrefCostType, err := OptionalParam[string](request, "view_pref_azure_pref_cost_type")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	dataSources, err := OptionalStringArrayParam(request, "data_sources")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if dataSources != nil {
		params.Body.DataSources = dataSources
	}
	params.Body.ViewPreferences.ShowAnomalies = viewPrefShowAnomalies
	params.Body.ViewPreferences.IncludeOthers = viewPrefIncludeOthers
	params.Body.ViewPreferences.IncludeUnallocatedCost = viewPrefIncludeUnallocatedCost
	params.Body.ViewPreferences.AwsPreferences.IncludeDiscounts = viewPrefAwsPrefIncludeDiscounts
	params.Body.ViewPreferences.AwsPreferences.IncludeCredits = viewPrefAwsPrefIncludeCredits
	params.Body.ViewPreferences.AwsPreferences.IncludeRefunds = viewPrefAwsPrefIncludeRefunds
	params.Body.ViewPreferences.AwsPreferences.IncludeTaxes = viewPrefAwsPrefIncludeTaxes
	params.Body.ViewPreferences.AwsPreferences.AwsCost = viewPrefAwsPrefAwsCost
	params.Body.ViewPreferences.GcpPreferences.IncludeDiscounts = viewPrefGcpPrefIncludeDiscounts
	params.Body.ViewPreferences.GcpPreferences.IncludeTaxes = viewPrefGcpPrefIncludeTaxes
	params.Body.ViewPreferences.AzureViewPreferences.CostType = viewPrefAzureViewPrefCostType

	viewRules, err := OptionalAnyArrayParam(request, "view_rules")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if viewRules != nil {
		rules, err := ccmcommons. AdaptViewRulesMap(viewRules) 
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		params.Body.ViewRules = rules
	}

	params.Body.ViewType = viewType
	params.Body.ViewState = viewState
	scope, err := FetchScope(config, request, false)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	data, err := client.CreatePerspective(ctx, scope, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create CCM Perspective: %w", err)
	}

	r, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CCM Perspective: %w", err)
	}

	return mcp.NewToolResultText(string(r)), nil
}

func getSupportedDataSources() string {
	return strings.Join([]string{
		dto.DataSourceAws,
		dto.DataSourceGcp,
		dto.DataSourceAzure,
		dto.DataSourceExternalData,
		dto.DataSourceCommon,
		dto.DataSourceCustom,
		dto.DataSourceBusinessMapping,
		dto.DataSourceLabel,
		dto.DataSourceLabelV2,
	}, ", ")
}

func getSupportedFieldId() string {
	return strings.Join([]string{
		dto.FieldIdCluster,
		dto.FieldIdAws,
		dto.FieldIdGcp,
		dto.FieldIdAzure,
		dto.FieldIdExternalData,
		dto.FieldIdCommon,
		dto.FieldIdCustom,
		dto.FieldIdBusinessMapping,
		dto.FieldIdLabel,
		dto.FieldIdLabelV2,
	}, ", ")
}

func createPerspectiveRules() mcp.ToolOption {
	// option_description := fmt.Sprintf(" field %s. The format for this field is: {\"field\": \"field_name\", \"value\": \"field_value\"}.",group_by_options),

var fieldDescription = `
A list of view rules that define the filtering logic for this Perspective. Each rule contains one or more view conditions specifying which data to include or exclude from the Perspective. These conditions allow filtering by dimensions such as Kubernetes clusters, cloud providers (AWS, GCP, Azure), business mappings, custom fields, and labels.

Each viewCondition includes:

The filter type (currently only ViewIdCondition is supported),

A viewField specifying the dimension to filter on (e.g., cost category or resource type),

An identifier defining the field source (e.g., "CLUSTER", "AWS", "LABEL_V2", etc.),

An operator such as "IN", "EQUALS", or "LIKE",

A list of values used in the condition.

Use this field to define precise inclusion/exclusion logic for data shown in the Perspective.
`

   return mcp.WithArray(
        "view_rules",
        mcp.Description(fieldDescription),
        mcp.Items(map[string]any{
            "view_conditions": map[string]any{
                "type":        "array",
                "description": getConditionInstructions(), 
                "items": map[string]any{
                    "type": "object",
                    "properties": map[string]any{
                        "view_field": map[string]any{
                            "type":        "object",
                            "description": getFilterInstructions(), 
                            "properties": map[string]any{
                                "field1_id":         map[string]any{"type": "string"},
                                "field2_id":       map[string]any{"type": "string"},
                                "field3_id":       map[string]any{"type": "string"},
                            },
                            "required": []string{"field1_id"},
                        },
                        "view_operator": map[string]any{
                            "type": "string",
							"description": getOperatorsDescription(), 
                            "enum": getSupportedOperators(), 
                        },
                        "values": map[string]any{
                            "type":  "array",
                            "items": map[string]any{"type": "string"},
                        },
                    },
                    "required": []string{"type", "view_field", "view_operator", "values"},
                },
				},
        }),
    )
}

func getFilterInstructions() string {
	return ccmcommons.GetFilterInstructions()
}

func getSupportedOperators() []string {
	return ccmcommons.GetSupportedOperators()
}

func getConditionInstructions() string {
	return ccmcommons.GetConditionInstructions()
}

func getOperatorsDescription() string {
	return ccmcommons.OperatorsDescription
}
func GetOperatorsDescription() string {
	return ccmcommons.OperatorsDescription
}
