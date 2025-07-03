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
	GridGroupByCostCategory     = "COST_CATEGORY"      // custom
	GridGroupByAWSAccount       = "AWS_ACCOUNT"
	GridGroupByAWSBillingEntity = "AWS_BILLING_ENTITY"
	GridGroupByAWSInstanceType  = "AWS_INSTANCE_TYPE"
	GridGroupByAWSLineItemType  = "AWS_LINE_ITEM_TYPE"
	GridGroupByAWSPayerAccount  = "AWS_PAYER_ACCOUNT"
	GridGroupByAWSService       = "AWS_SERVICE"
	GridGroupByAWSUsageType     = "AWS_USAGE_TYPE"
	GridGroupByRegion           = "REGION"
	GridGroupByProduct          = "PRODUCT"
	GridGroupByCloudProvider    = "CLOUD_PROVIDER"
	GridGroupByLabel            = "LABEL"              // custom
	GridGroupByLabelV2          = "LABEL_V2"           // custom
	GridGroupByNone             = "NONE"
)

type CCMKeyValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

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

	Filters map[string][]string
	KeyValueFilters map[string]map[string]any
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
