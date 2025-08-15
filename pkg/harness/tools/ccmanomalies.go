package tools

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/ccmcommons"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type ClientFunctionAnomaliesListInterface func(ctx context.Context, accountId string, params map[string]any) (*map[string]any, error)

const (
	FunctionAnomaliesSummary     = 0
	FunctionListAnomalies        = 1
	FunctionListIgnoredAnomalies = 2
)

func GetCcmAnomaliesSummaryTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewToolWithRawSchema("get_ccm_anomalies_summary", ccmcommons.GetAnomaliesSummaryDescription,
			anomaliesSummaryDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return anomaliesListHandler(config, ctx, request, client.GetAnomaliesSummary)
		}
}

func ListCcmIgnoredAnomaliesTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewToolWithRawSchema("list_ccm_ignored_anomalies", ccmcommons.ListIgnoredAnomaliesDescription,
			anomaliesIgnoredListDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return anomaliesListHandler(config, ctx, request, client.ListIgnoredAnomalies)
		}
}

func ListCcmAnomaliesTool(config *config.Config, client *client.CloudCostManagementService,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("list_ccm_anomalies", ccmcommons.ListIgnoredAnomaliesDescription,
			anomaliesListDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return anomaliesListDTOHandler(config, ctx, request, client.ListAnomalies)
		}
}

func anomaliesListHandler(
	config *config.Config,
	ctx context.Context,
	request mcp.CallToolRequest,
	clientFunction ClientFunctionAnomaliesListInterface,
) (*mcp.CallToolResult, error) {

	accountId, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	k8sClusterNames, err := OptionalStringArrayParam(request, "k8sClusterNames")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	k8sNamespaces, err := OptionalStringArrayParam(request, "k8sNamespaces")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	k8sWorkloadNames, err := OptionalStringArrayParam(request, "k8sWorkloadNames")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	k8sServiceNames, err := OptionalStringArrayParam(request, "k8sServiceNames")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	gcpProjects, err := OptionalStringArrayParam(request, "gcpProjects")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	gcpProducts, err := OptionalStringArrayParam(request, "gcpProducts")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	gcpSKUDescriptions, err := OptionalStringArrayParam(request, "gcpSKUDescriptions")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	awsAccounts, err := OptionalStringArrayParam(request, "awsAccounts")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	awsServices, err := OptionalStringArrayParam(request, "awsServices")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	awsUsageTypes, err := OptionalStringArrayParam(request, "awsUsageTypes")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	azureSubscriptionGuids, err := OptionalStringArrayParam(request, "azureSubscriptionGuids")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	azureResourceGroups, err := OptionalStringArrayParam(request, "azureResourceGroups")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	azureMeterCategories, err := OptionalStringArrayParam(request, "azureMeterCategories")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	minActualAmount, err := OptionalParam[float64](request, "minActualAmount")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	minAnomalousSpend, err := OptionalParam[float64](request, "minAnomalousSpend")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	timeFilters, err := OptionalAnyArrayParam(request, "timeFilters")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	orderBy, err := OptionalAnyArrayParam(request, "orderBy")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	groupBy, err := OptionalAnyArrayParam(request, "groupBy")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	aggregations, err := OptionalAnyArrayParam(request, "aggregations")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	searchText, err := OptionalStringArrayParam(request, "searchText")
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
	status, err := OptionalStringArrayParam(request, "status")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	anomalyIds, err := OptionalStringArrayParam(request, "anomalyIds")
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
		filterType = "Anomaly"
	}

	params := map[string]any{
		"k8sClusterNames":        k8sClusterNames,
		"k8sNamespaces":          k8sNamespaces,
		"k8sWorkloadNames":       k8sWorkloadNames,
		"k8sServiceNames":        k8sServiceNames,
		"gcpProjects":            gcpProjects,
		"gcpProducts":            gcpProducts,
		"gcpSKUDescriptions":     gcpSKUDescriptions,
		"awsAccounts":            awsAccounts,
		"awsServices":            awsServices,
		"awsUsageTypes":          awsUsageTypes,
		"azureSubscriptionGuids": azureSubscriptionGuids,
		"azureResourceGroups":    azureResourceGroups,
		"azureMeterCategories":   azureMeterCategories,
		"minActualAmount":        minActualAmount,
		"minAnomalousSpend":      minAnomalousSpend,
		"timeFilters":            timeFilters,
		"orderBy":                orderBy,
		"groupBy":                groupBy,
		"aggregations":           aggregations,
		"searchText":             searchText,
		"offset":                 offset,
		"limit":                  limit,
		"status":                 status,
		"anomalyIds":             anomalyIds,
		"tags":                   tags,
		"filterType":             filterType,
	}

	options := make(map[string]any)
	options["anomalyFilterPropertiesDTO"] = params

	data, err := clientFunction(ctx, accountId, options)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	r, err := json.Marshal(data)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(string(r)), nil
}

func anomaliesListDTOHandler(
	config *config.Config,
	ctx context.Context,
	request mcp.CallToolRequest,
	clientFunction ClientFunctionAnomaliesListInterface,
) (*mcp.CallToolResult, error) {

	accountId, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	filter, err := OptionalParam[map[string]any](request, "anomalyFilterPropertiesDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	perspectiveQuery, err := OptionalParam[map[string]any](request, "perspectiveQueryDTO")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	filterType, ok := filter["filterType"].(string)
	if !ok || filterType == "" {
		filter["filterType"] = "Anomaly"
	}

	options := map[string]any{
		"anomalyFilterPropertiesDTO": filter,
		"perspectiveQuery":           perspectiveQuery,
	}

	data, err := clientFunction(ctx, accountId, options)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	r, err := json.Marshal(data)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(string(r)), nil
}

func anomaliesSummaryDefinition() json.RawMessage {
	return generalListRawMessage(generalListMap())
}

func anomaliesIgnoredListDefinition() json.RawMessage {
	return generalListRawMessage(generalListMap())
}

func anomaliesListDefinition() json.RawMessage {
	return generalListRawMessage(
		map[string]any{
			"anomalyFilterPropertiesDTO": generalListMap(),
			"perspectiveQueryDTO":        perspectiveQueryDTOMap(),
		},
	)
}

func perspectiveQueryDTOMap() map[string]any {
	slog.Debug("Creating perspective query DTO map")
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"filters": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"idFilter": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"fieldId":   map[string]any{"type": "string"},
								"fieldName": map[string]any{"type": "string"},
								"fieldIdentifier": map[string]any{
									"type": "string",
									"enum": getFieldIdentifiers(),
								},
								"identifierName": map[string]any{"type": "string"},
							},
							"operator": map[string]any{
								"type": "string",
								"enum": getAnomFilterOperators(),
							},
							"values": map[string]any{
								"type":  "array",
								"items": map[string]any{"type": "string"},
							},
						},
						"timeFilter": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"field":    map[string]any{"type": "object", "properties": map[string]any{}},
								"operator": map[string]any{"type": "string"},
								"value":    map[string]any{"type": "number"},
							},
							"required": []string{"field", "operator", "value"},
						},
						"timeRangeTypeFilter": map[string]any{
							"type":    "string",
							"enum":    getTimeRanges(),
							"default": dto.TimeRangeLastMonth,
						},
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
											"fieldId":   map[string]any{"type": "string"},
											"fieldName": map[string]any{"type": "string"},
											"fieldIdentifier": map[string]any{
												"type": "string",
												"enum": getFieldIdentifiers(),
											},
											"identifierName": map[string]any{"type": "string"},
										},
									},
								},
							},
						},
					},
				},
			},
			"groupBy": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"entityGroupBy": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"fieldId":   map[string]any{"type": "string"},
								"fieldName": map[string]any{"type": "string"},
								"fieldIdentifier": map[string]any{
									"type": "string",
									"enum": getFieldIdentifiers(),
								},
								"identifierName": map[string]any{"type": "string"},
							},
						},
						"timeTruncGroupBy": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"resolution": map[string]any{
									"type": "string",
									"enum": getAnomTimeGroupBy(),
								},
							},
						},
					},
				},
			},
		},
	}
}

func generalListMap() map[string]any {
	return map[string]any{
		"k8sClusterNames":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"k8sNamespaces":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"k8sWorkloadNames":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"k8sServiceNames":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"gcpProjects":            map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"gcpProducts":            map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"gcpSKUDescriptions":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"awsAccounts":            map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"awsServices":            map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"awsUsageTypes":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"azureSubscriptionGuids": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"azureResourceGroups":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"azureMeterCategories":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"minActualAmount":        map[string]any{"type": "number"},
		"minAnomalousSpend":      map[string]any{"type": "number"},
		"timeFilters": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"operator": map[string]any{
						"type": "string",
						"enum": getTimeFilterOperators(),
					},
					"timestamp": map[string]any{"type": "number"},
				},
				"required": []string{"operator", "timestamp"},
			},
		},
		"orderBy": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"field": map[string]any{
						"type": "string",
						"enum": getAnomalyFields(),
					},
					"order": map[string]any{
						"type": "string",
						"enum": []string{dto.SortOrderAsc, dto.SortOrderDesc},
					},
				},
				"required": []string{"field", "order"},
			},
		},
		"groupBy": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"groupByField": map[string]any{
						"type": "string",
						"enum": getAnomalyFields(),
					},
				},
				"required": []string{"groupByField"},
			},
		},
		"aggregations": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"operationType": map[string]any{
						"type": "string",
						"enum": getAgregOperationTypes(),
					},
					"field": map[string]any{
						"type": "string",
						"enum": getAnomalyFields(),
					},
				},
				"required": []string{"operationType", "field"},
			},
		},
		"searchText": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"offset":     map[string]any{"type": "number", "defult": 0},
		"limit":      map[string]any{"type": "number", "default": 100, "minimum": 1, "maximum": 1000},
		"status":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"anomalyIds": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"tags": map[string]any{
			"type":                 "object",
			"properties":           map[string]any{},
			"additionalProperties": map[string]any{"type": "string"},
		},
		"filterType": map[string]any{"type": "string"},
	}
}

func generalListRawMessage(properties map[string]any) json.RawMessage {
	requiredFields := []string{"filterType"}
	schema := map[string]any{
		"type":       "object",
		"properties": properties,
		"required":   requiredFields,
	}
	b, _ := json.Marshal(schema)
	return json.RawMessage(b)
}

func getAnomalyFields() []string {
	return []string{
		dto.AnomalyFieldPerspectiveID,
		dto.AnomalyFieldAnomalyID,
		dto.AnomalyFieldWorkload,
		dto.AnomalyFieldWorkloadType,
		dto.AnomalyFieldClusterID,
		dto.AnomalyFieldClusterName,
		dto.AnomalyFieldClusterNamespace,
		dto.AnomalyFieldClusterNamespaceID,
		dto.AnomalyFieldClusterWorkload,
		dto.AnomalyFieldClusterWorkloadID,
		dto.AnomalyFieldClusterNode,
		dto.AnomalyFieldClusterPod,
		dto.AnomalyFieldClusterParentInstanceID,
		dto.AnomalyFieldClusterStorage,
		dto.AnomalyFieldClusterApplication,
		dto.AnomalyFieldClusterEnvironment,
		dto.AnomalyFieldClusterService,
		dto.AnomalyFieldClusterCloudProvider,
		dto.AnomalyFieldClusterEcsService,
		dto.AnomalyFieldClusterEcsServiceID,
		dto.AnomalyFieldClusterEcsTask,
		dto.AnomalyFieldClusterEcsTaskID,
		dto.AnomalyFieldClusterEcsLaunchType,
		dto.AnomalyFieldClusterEcsLaunchTypeID,
		dto.AnomalyFieldNamespace,
		dto.AnomalyFieldService,
		dto.AnomalyFieldServiceName,
		dto.AnomalyFieldGcpProduct,
		dto.AnomalyFieldGcpProject,
		dto.AnomalyFieldGcpSkuID,
		dto.AnomalyFieldGcpSkuDescription,
		dto.AnomalyFieldAwsAccount,
		dto.AnomalyFieldAwsService,
		dto.AnomalyFieldAwsInstanceType,
		dto.AnomalyFieldAwsUsageType,
		dto.AnomalyFieldAwsBillingEntity,
		dto.AnomalyFieldAwsLineItemType,
		dto.AnomalyFieldAzureSubscriptionGuid,
		dto.AnomalyFieldAzureMeterName,
		dto.AnomalyFieldAzureMeterCategory,
		dto.AnomalyFieldAzureMeterSubcategory,
		dto.AnomalyFieldAzureResourceID,
		dto.AnomalyFieldAzureResourceGroupName,
		dto.AnomalyFieldAzureResourceType,
		dto.AnomalyFieldAzureResource,
		dto.AnomalyFieldAzureServiceName,
		dto.AnomalyFieldAzureServiceTier,
		dto.AnomalyFieldAzureInstanceID,
		dto.AnomalyFieldAzureSubscriptionName,
		dto.AnomalyFieldAzurePublisherName,
		dto.AnomalyFieldAzurePublisherType,
		dto.AnomalyFieldAzureReservationID,
		dto.AnomalyFieldAzureReservationName,
		dto.AnomalyFieldAzureFrequency,
		dto.AnomalyFieldAzureChargeType,
		dto.AnomalyFieldAzurePricingModel,
		dto.AnomalyFieldAzureBenefitName,
		dto.AnomalyFieldAzureResourceName,
		dto.AnomalyFieldCommonProduct,
		dto.AnomalyFieldCommonRegion,
		dto.AnomalyFieldCommonNone,
		dto.AnomalyFieldCloudProvider,
		dto.AnomalyFieldStatus,
		dto.AnomalyFieldRegion,
		dto.AnomalyFieldAnomalyTime,
		dto.AnomalyFieldActualCost,
		dto.AnomalyFieldExpectedCost,
		dto.AnomalyFieldAnomalousSpend,
		dto.AnomalyFieldCostImpact,
		dto.AnomalyFieldAll,
		dto.AnomalyFieldAnomalousSpendPercent,
		dto.AnomalyFieldTotalCost,
		dto.AnomalyFieldIdleCost,
		dto.AnomalyFieldUnallocatedCost,
		dto.AnomalyFieldRuleName,
		dto.AnomalyFieldRuleSetName,
		dto.AnomalyFieldPotentialSavings,
		dto.AnomalyFieldLastEvaluatedAt,
		dto.AnomalyFieldAnomalyStatus,
		dto.AnomalyFieldRecommendationsCount,
		dto.AnomalyFieldActualAmount,
		dto.AnomalyFieldCriticality,
		dto.AnomalyFieldDuration,
		dto.AnomalyFieldUpdatedAt,
		dto.AnomalyFieldUpdatedBy,
		dto.AnomalyFieldUpdatedAtRelative,
	}
}

func getTimeFilterOperators() []string {
	return []string{
		dto.TimeFilterOperatorNotIn,
		dto.TimeFilterOperatorIn,
		dto.TimeFilterOperatorEquals,
		dto.TimeFilterOperatorNotNull,
		dto.TimeFilterOperatorNull,
		dto.TimeFilterOperatorLike,
		dto.TimeFilterOperatorGreaterThan,
		dto.TimeFilterOperatorLessThan,
		dto.TimeFilterOperatorGreaterThanEqualsTo,
		dto.TimeFilterOperatorLessThanEqualsTo,
		dto.TimeFilterOperatorAfter,
		dto.TimeFilterOperatorBefore,
	}
}

func getAgregOperationTypes() []string {
	return []string{
		dto.AgregOperationTypeSum,
		dto.AgregOperationTypeMax,
		dto.AgregOperationTypeMin,
		dto.AgregOperationTypeAvg,
		dto.AgregOperationTypeCount,
	}
}

func getAnomalyStatuses() []string {
	return []string{
		dto.AnomalyStatusActive,
		dto.AnomalyStatusIgnored,
		dto.AnomalyStatusArchived,
		dto.AnomalyStatusResolved,
	}
}

func getFieldIdentifiers() []string {
	return []string{
		dto.FieldIdentifierCluster,
		dto.FieldIdentifierAWS,
		dto.FieldIdentifierGCP,
		dto.FieldIdentifierAzure,
		dto.FieldIdentifierExternalData,
		dto.FieldIdentifierCommon,
		dto.FieldIdentifierCustom,
		dto.FieldIdentifierBusinessMapping,
		dto.FieldIdentifierLabel,
		dto.FieldIdentifierLabelV2,
	}
}

func getTimeRanges() []string {
	return []string{
		dto.TimeRangeLastMonth,
		dto.TimeRangeCurrentMonth,
	}
}

func getAnomTimeGroupBy() []string {
	return []string{
		dto.AnomTimeGroupByHour,
		dto.AnomTimeGroupByDay,
		dto.AnomTimeGroupByMonth,
		dto.AnomTimeGroupByWeek,
		dto.AnomTimeGroupByQuarter,
		dto.AnomTimeGroupByYear,
	}
}

func getAnomFilterOperators() []string {
	return []string{
		dto.AnomFilterOperatorNotIn,
		dto.AnomFilterOperatorIn,
		dto.AnomFilterOperatorEquals,
		dto.AnomFilterOperatorNotNull,
		dto.AnomFilterOperatorNull,
		dto.AnomFilterOperatorLike,
		dto.AnomFilterOperatorSearch,
	}
}
