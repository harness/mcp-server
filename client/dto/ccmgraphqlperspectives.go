package dto

const (
	TimeFilterLast7         = "LAST_7"
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
	TimeGroupByDay   = "DAY"
	TimeGroupByWeek  = "WEEK"
	TimeGroupByMonth = "MONTH"
)

type CCMKeyValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
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
	Data struct {
		PerspectiveTrendStats   CCMPerspectiveTrendStats   `json:"perspectiveTrendStats"`
		PerspectiveForecastCost CCMPerspectiveForecastCost `json:"perspectiveForecastCost"`
	} `json:"data"`
}
