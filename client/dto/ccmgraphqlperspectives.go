package dto

const (
	TimeFilterLast7         = "LAST_7" // It doesn't work using "LAST_7_DAYS"
	TimeFilterThisMonth     = "THIS_MONTH"
	TimeFilterLast30Days    = "LAST_30_DAYS"
	TimeFilterThisQuarter   = "THIS_QUARTER"
	TimeFilterThisYear      = "THIS_YEAR"
	TimeFilterLastMonth     = "LAST_MONTH"
	TimeFilterLastQuarter   = "LAST_QUARTER"
	TimeFilterLastYear      = "LAST_YEAR"
	TimeFilterLast3Months   = "LAST_3_MONTHS"
	TimeFilterLast6Months   = "LAST_6_MONTHS"
	TimeFilterLast12Months  = "LAST_12_MONTHS"
)

const (
	GridGroupByCostCategory     = "business_mapping"
	GridGroupByAWSAccount       = "awsUsageaccountid"
	GridGroupByAWSBillingEntity = "awsBillingEntity"
	GridGroupByAWSInstanceType  = "awsInstancetype"
	GridGroupByAWSLineItemType  = "awsLineItemType"
	GridGroupByAWSPayerAccount  = "awspayeraccountid"
	GridGroupByAWSService       = "awsServicecode"
	GridGroupByAWSUsageType     = "awsUsageType"
	GridGroupByRegion           = "region"
	GridGroupByProduct          = "product"
	GridGroupByCloudProvider    = "cloudProvider"
	GridGroupByLabel            = "label" 
	GridGroupByLabelV2          = "label_v2"
	GridGroupByNone             = "none"
)

const (
	ValueTypeCostCategory     = "business_mapping"
	ValueTypeAWSAccount       = "awsUsageaccountid"
	ValueTypeAWSBillingEntity = "awsBillingEntity"
	ValueTypeAWSInstanceType  = "awsInstancetype"
	ValueTypeAWSLineItemType  = "awsLineItemType"
	ValueTypeAWSPayerAccount  = "awspayeraccountid"
	ValueTypeAWSService       = "awsServicecode"
	ValueTypeAWSUsageType     = "awsUsageType"
	ValueTypeRegion           = "region"
	ValueTypeProduct          = "product"
	ValueTypeCloudProvider    = "cloudProvider"
	ValueTypeLabel            = "label"
	ValueTypeLabelKey         = "label_key"
	ValueTypeLabelV2          = "label_v2"
	ValueTypeLabelV2Key       = "label_v2_key"
)

const (
	TimeGroupByDay   = "DAY"
	TimeGroupByWeek  = "WEEK"
	TimeGroupByMonth = "MONTH"
)


var (
	ValueTypes = []string{
		ValueTypeCostCategory,
		ValueTypeAWSAccount,
		ValueTypeAWSBillingEntity,
		ValueTypeAWSInstanceType,
		ValueTypeAWSLineItemType,
		ValueTypeAWSPayerAccount,
		ValueTypeAWSService,
		ValueTypeAWSUsageType,
		ValueTypeRegion,
		ValueTypeProduct,
		ValueTypeCloudProvider,
		ValueTypeLabel,
		ValueTypeLabelKey,
		ValueTypeLabelV2,
		ValueTypeLabelV2Key,
	}
	TimeFilterValues = []string{
		TimeFilterLast7,
		TimeFilterThisMonth,
		TimeFilterLast30Days,
		TimeFilterThisQuarter,
		TimeFilterThisYear,
		TimeFilterLastMonth,
		TimeFilterLastQuarter,
		TimeFilterLastYear,
		TimeFilterLast3Months,
		TimeFilterLast6Months,
		TimeFilterLast12Months,
	}
)

type CCMKeyValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CCMGraphQLError struct {
	Message    string                      `json:"message"`
	Locations  []CCMGraphQLErrorLocation   `json:"locations"`
	Extensions CCMGraphQLErrorExtensions   `json:"extensions"`
}

type CCMGraphQLErrorLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

type CCMGraphQLErrorExtensions struct {
	Classification string `json:"classification"`
}

type CCMGraphQLFilters  = map[string][]string
type CCMGraphQLKeyValueFilters = map[string]map[string]any

type CCMPerspectiveGridOptions struct {

	AccountId             string `json:"account_id"`
	ViewId                string `json:"view_id"`
	TimeFilter            string `json:"time_filter"`
	IsClusterOnly         bool   `json:"is_cluster_only"`
	IsClusterHourlyData   bool   `json:"is_cluster_hourly_data"`
	Limit                 int32  `json:"limit"`
	Offset                int32  `json:"offset"`
	GroupBy               map[string]any `json:"group_by"`
	IncludeOthers         bool   `json:"include_others"`
	IncludeAnomalies      bool   `json:"include_anomalies"`
	IncludeUnallocatedCost bool  `json:"include_unallocated_cost"`
	AwsIncludeDiscounts   bool   `json:"aws_include_discounts"`
	AwsIncludeCredits     bool   `json:"aws_include_credits"`
	AwsIncludeRefunds     bool   `json:"aws_include_refunds"`
	AwsIncludeTaxes       bool   `json:"aws_include_taxes"`
	AwsCost               string `json:"aws_cost"`

	Filters CCMGraphQLFilters 
	KeyValueFilters CCMGraphQLKeyValueFilters
}

type CCMPerspectiveTimeSeriesOptions struct {
	CCMPerspectiveGridOptions
	TimeGroupBy string `json:"time_group_by"`
}

type CCMPerspectiveGridResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data CCMPerspectiveGridDataWrapper `json:"data"`
}

type CCMPerspectiveGridDataWrapper struct {
	PerspectiveGrid      CCMPerspectiveGridEntityStats `json:"perspectiveGrid"`
	PerspectiveTotalCount int                       `json:"perspectiveTotalCount"`
}

type CCMPerspectiveGridEntityStats struct {
	Data       []CCMPerspectiveGridDataPoint `json:"data"`
	Typename   string                     `json:"__typename"`
}

type CCMPerspectiveGridDataPoint struct {
	Name      string  `json:"name"`
	ID        string  `json:"id"`
	Cost      float64 `json:"cost"`
	CostTrend float64 `json:"costTrend"`
	Typename  string  `json:"__typename"`
}


type CCMPerspectiveTimeSeriesResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data struct {
		PerspectiveTimeSeriesStats struct {
			Stats []CCMPerspectiveTimeSeriesStat `json:"stats"`
		} `json:"perspectiveTimeSeriesStats"`
	} `json:"data"`
}

type CCMPerspectiveTimeSeriesStat struct {
	Values []CCMPerspectiveTimeSeriesValue `json:"values"`
}

type CCMPerspectiveTimeSeriesValue struct {
	Key       CCMPerspectiveReference `json:"key"`
	Value     float64              `json:"value"`
	Typename  string               `json:"__typename"`
}

type CCMPerspectiveReference struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Typename  string `json:"__typename"`
}

type CCMPerspectiveSummaryWithBudgetOptions = CCMPerspectiveGridOptions

type CCMStatsInfo struct {
	StatsDescription string   `json:"statsDescription"`
	StatsLabel       string   `json:"statsLabel"`
	StatsTrend       float64  `json:"statsTrend"`
	StatsValue       string   `json:"statsValue"`
	Value            *float64 `json:"value"`
	Typename         string   `json:"__typename"`
}

type CCMPerspectiveTrendStats struct {
	Cost                 CCMStatsInfo  `json:"cost"`
	IdleCost             CCMStatsInfo  `json:"idleCost"`
	UnallocatedCost      CCMStatsInfo  `json:"unallocatedCost"`
	UtilizedCost         CCMStatsInfo  `json:"utilizedCost"`
	EfficiencyScoreStats *CCMStatsInfo `json:"efficiencyScoreStats"`
	Typename             string        `json:"__typename"`
}

type CCMPerspectiveForecastCost struct {
	Cost     CCMStatsInfo `json:"cost"`
	Typename string       `json:"__typename"`
}

type CCMPerspectiveSummaryWithBudgetResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data struct {
		PerspectiveTrendStats   CCMPerspectiveTrendStats   `json:"perspectiveTrendStats"`
		PerspectiveForecastCost CCMPerspectiveForecastCost `json:"perspectiveForecastCost"`
	} `json:"data"`
}

type CCMPerspectiveBudget struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	BudgetAmount float64 `json:"budgetAmount"`
	ActualCost  float64 `json:"actualCost"`
	TimeLeft    int     `json:"timeLeft"`
	TimeUnit    string  `json:"timeUnit"`
	TimeScope   string  `json:"timeScope"`
	Period      string  `json:"period"`
	FolderID    string  `json:"folderId"`
	Typename    string  `json:"__typename"`
}

type CCMPerspectiveBudgetResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data struct {
		BudgetSummaryList []CCMPerspectiveBudget `json:"budgetSummaryList"`
	} `json:"data"`
}

type CCMPerspectiveBudgetOptions struct {
	AccountId             string `json:"account_id"`
	PerspectiveId         string `json:"perspective_id"`
}

type CCMCurrencyPreference struct {
	DestinationCurrency string `json:"destinationCurrency"`
	Symbol              string `json:"symbol"`
	Locale              string `json:"locale"`
	SetupTime           int64  `json:"setupTime"`
	Typename            string `json:"__typename"`
}

type CCMMetadata struct {
	K8sClusterConnectorPresent      bool                `json:"k8sClusterConnectorPresent"`
	CloudDataPresent                bool                `json:"cloudDataPresent"`
	AwsConnectorsPresent            bool                `json:"awsConnectorsPresent"`
	GcpConnectorsPresent            bool                `json:"gcpConnectorsPresent"`
	AzureConnectorsPresent          bool                `json:"azureConnectorsPresent"`
	ApplicationDataPresent          bool                `json:"applicationDataPresent"`
	InventoryDataPresent            bool                `json:"inventoryDataPresent"`
	ClusterDataPresent              bool                `json:"clusterDataPresent"`
	ExternalDataPresent             bool                `json:"externalDataPresent"`
	IsSampleClusterPresent          bool                `json:"isSampleClusterPresent"`
	DefaultAzurePerspectiveId       string              `json:"defaultAzurePerspectiveId"`
	DefaultAwsPerspectiveId         string              `json:"defaultAwsPerspectiveId"`
	DefaultGcpPerspectiveId         string              `json:"defaultGcpPerspectiveId"`
	DefaultClusterPerspectiveId     string              `json:"defaultClusterPerspectiveId"`
	DefaultExternalDataPerspectiveId string             `json:"defaultExternalDataPerspectiveId"`
	ShowCostOverview                bool                `json:"showCostOverview"`
	CurrencyPreference              CCMCurrencyPreference `json:"currencyPreference"`
	Typename                        string              `json:"__typename"`
}

type CCMMetadataResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data struct {
		CCMMetadata CCMMetadata `json:"ccmMetaData"`
	} `json:"data"`
}

type CCMPerspectiveRecommendationsOptions struct {
	AccountId             string `json:"account_id"`
	ViewId                string `json:"view_id"`
	TimeFilter            string `json:"time_filter"`
	Limit                 int32  `json:"limit"`
	Offset                int32  `json:"offset"`
	MinSaving int 		`json:"min_saving"`
	Filters CCMGraphQLFilters 
	KeyValueFilters CCMGraphQLKeyValueFilters
	RecommendationStates []string
}

type CCMRecommendationStatsV2 struct {
	TotalMonthlyCost   float64 `json:"totalMonthlyCost"`
	TotalMonthlySaving float64 `json:"totalMonthlySaving"`
	Count              int     `json:"count"`
	Typename           string  `json:"__typename"`
}

type CCMRecommendationsV2 struct {
	Items    []any  `json:"items"`
	Typename string `json:"__typename"`
}

type CCMPerspectiveRecommendationsResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data struct {
		RecommendationStatsV2 CCMRecommendationStatsV2 `json:"recommendationStatsV2"`
		RecommendationsV2     CCMRecommendationsV2     `json:"recommendationsV2"`
	} `json:"data"`
}

type CCMPerspectiveFilterValuesOptions struct {
	AccountId             string `json:"account_id"`
	ViewId                string `json:"view_id"`
	TimeFilter            string `json:"time_filter"`
	ValueType             string `json:"value_type"`
	ValueSubType          string `json:"value_sub_type"`
	Limit                 int32  `json:"limit"`
	Offset                int32  `json:"offset"`
	IsClusterHourlyData bool
}

type CCMPerspectiveFilterValues struct {
	Values    []string `json:"values"`
	Typename  string   `json:"__typename"`
}

type CCMPerspectiveFilterValuesResponse struct {
	Errors []CCMGraphQLError `json:"errors"`
	Data struct {
		PerspectiveFilters CCMPerspectiveFilterValues `json:"perspectiveFilters"`
	} `json:"data"`
}
