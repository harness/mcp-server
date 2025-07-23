package dto

// ***************************
// Perspective List Detail 
// ***************************
const (
	SortByTime string = "TIME"
	SortByCost string = "COST"
	SortByClusterCost string = "CLUSTER_COST"
	SortByName string = "NAME"
)

const (
	SortOrderAscending  string = "ASCENDING"
	SortOrderDescending string = "DESCENDING"
)

const (
	FilterByAws string = "AWS"
	FilterByAzure string = "AZURE"
	FilterByGcp string = "GCP"
	FilterByCluster string = "CLUSTER"
	FilterByDefault string = "DEFAULT"
)

const (
	PeriodDaily    string = "DAILY"
	PeriodWeekly   string = "WEEKLY"
	PeriodMonthly  string = "MONTHLY"
	PeriodQuarterly string = "QUARTERLY"
	PeriodYearly   string = "YEARLY"
)

const (
	TimeRangeTypeLast7Days string = "LAST_7"
	TimeRangeTypeLast30Days string = "LAST_30_DAYS"
	TimeRangeTypeLastMonth string = "LAST_MONTH"
	TimeRangeTypeCurrentMonth string = "CURRENT_MONTH"
	TimeRangeTypeCustom string = "CUSTOM"
)

const (
	ViewTypeSample string = "SAMPLE"
	ViewTypeCustomer string = "CUSTOMER"
	ViewTypeDefault string = "DEFAULT"
)

const (
	ViewStateDraft string = "DRAFT"
	ViewStateCompleted string = "COMPLETED"
)

const (
	AwsCostAmortised string = "AMORTISED"
	AwsCostNetAmortised string = "NET_AMORTISED"
	AwsCostBlended string = "BLENDED"
	AwsCostUnblended string = "UNBLENDED"
	AwsCostEffective string = "EFFECTIVE"
)

const (
	DataSourceCluster string = "CLUSTER"
	DataSourceAws string = "AWS"
	DataSourceGcp string = "GCP"
	DataSourceAzure string = "AZURE"
	DataSourceExternalData string = "EXTERNAL_DATA"
	DataSourceCommon string = "COMMON"
	DataSourceCustom string = "CUSTOM"
	DataSourceBusinessMapping string = "BUSINESS_MAPPING"
	DataSourceLabel string = "LABEL"
	DataSourceLabelV2 string = "LABEL_V2"
)

const (
	AzureCostTypeActual string = "ACTUAL"
	AzureCostTypeAmortized string = "AMORTIZED"
)

const (
	FieldIdCluster string = "CLUSTER"
	FieldIdAws string = "AWS"
	FieldIdGcp string = "GCP"
	FieldIdAzure string = "AZURE"
	FieldIdExternalData string = "EXTERNAL_DATA"
	FieldIdCommon string = "COMMON"
	FieldIdCustom string = "CUSTOM"
	FieldIdBusinessMapping string = "BUSINESS_MAPPING"
	FieldIdLabel string = "LABEL"
	FieldIdLabelV2 string = "LABEL_V2"
)

const (
	ConditionOperatorIn       = "IN"
	ConditionOperatorNotIn    = "NOT_IN"
	ConditionOperatorEquals   = "EQUALS"
	ConditionOperatorNotNull  = "NOT_NULL"
	ConditionOperatorNull     = "NULL"
	ConditionOperatorLike     = "LIKE"
)

type CCMListPerspectivesDetailOptions struct {
	AccountIdentifier string
	SearchKey         string
	SortType          string
	SortOrder         string
	CloudFilters      string
	CCMPaginationOptions
}

type CCMPerspectiveView struct {
	ID                      string `json:"id"`
	Name                    string `json:"name"`
	FolderID                string `json:"folderId"`
	FolderName              string `json:"folderName"`
	ReportScheduledConfigured bool `json:"reportScheduledConfigured"`
}

type CCMPerspectiveViewList struct {
	TotalCount int       `json:"totalCount"`
	Views      []CCMPerspectiveView `json:"views"`
}

type CCMPerspectivesDetailList struct {
	CCMBaseResponse
	Data          CCMPerspectiveViewList `json:"data,omitempty"`
}

// ***************************
// Get Perspective Detail 
// ***************************
type CCMGetPerspectiveOptions struct {
	AccountIdentifier string
	PerspectiveId string
}

type CCMPerspectiveDetail struct {
	CCMBaseResponse
	Data          CCMPerspective    `json:"data"`
}

type CCMPerspective struct {
	UUID             string               `json:"uuid"`
	Name             string               `json:"name"`
	AccountId        string               `json:"accountId"`
	FolderId         string               `json:"folderId"`
	ViewVersion      string               `json:"viewVersion"`
	ViewTimeRange    CCMViewTimeRange     `json:"viewTimeRange"`
	ViewRules        []CCMViewRule        `json:"viewRules"`
	DataSources      []string             `json:"dataSources"`
	ViewVisualization CCMViewVisualization `json:"viewVisualization"`
	ViewPreferences  CCMViewPreferences   `json:"viewPreferences"`
	ViewType         string               `json:"viewType"`
	ViewState        string               `json:"viewState"`
	TotalCost        float64              `json:"totalCost"`
	CreatedAt        int64                `json:"createdAt"`
	LastUpdatedAt    int64                `json:"lastUpdatedAt"`
	CreatedBy        CCMUser              `json:"createdBy"`
	LastUpdatedBy    CCMUser              `json:"lastUpdatedBy"`
}

type CCMViewTimeRange struct {
	ViewTimeRangeType string `json:"viewTimeRangeType"`
	StartTime         int64  `json:"startTime"`
	EndTime           int64  `json:"endTime"`
}

type CCMViewRule struct {
	ViewConditions []CCMViewCondition `json:"viewConditions"`
}

type CCMViewCondition struct {
	Type         string         `json:"type"`
	ViewField    CCMViewField   `json:"viewField"`
	ViewOperator string         `json:"viewOperator"`
	Values       []string       `json:"values"`
}

type CCMViewField struct {
	FieldId        string `json:"fieldId"`
	FieldName      string `json:"fieldName"`
	Identifier     string `json:"identifier"`
	IdentifierName string `json:"identifierName"`
}

type CCMViewVisualization struct {
	Granularity string          `json:"granularity"`
	GroupBy     CCMGroupBy      `json:"groupBy"`
	ChartType   string          `json:"chartType"`
}

type CCMGroupBy struct {
	FieldId       string `json:"fieldId"`
	FieldName     string `json:"fieldName"`
	Identifier    string `json:"identifier"`
	IdentifierName string `json:"identifierName"`
}

type CCMViewPreferences struct {
	ShowAnomalies        bool                 `json:"showAnomalies"`
	IncludeOthers        bool                 `json:"includeOthers"`
	IncludeUnallocatedCost bool               `json:"includeUnallocatedCost"`
	AwsPreferences       CCMAwsPreferences    `json:"awsPreferences"`
	GcpPreferences       CCMGcpPreferences    `json:"gcpPreferences"`
	AzureViewPreferences CCMAzureViewPreferences `json:"azureViewPreferences"`
}

type CCMAwsPreferences struct {
	IncludeDiscounts bool   `json:"includeDiscounts"`
	IncludeCredits   bool   `json:"includeCredits"`
	IncludeRefunds   bool   `json:"includeRefunds"`
	IncludeTaxes     bool   `json:"includeTaxes"`
	AwsCost          string `json:"awsCost"`
}

type CCMGcpPreferences struct {
	IncludeDiscounts bool `json:"includeDiscounts"`
	IncludeTaxes     bool `json:"includeTaxes"`
}

type CCMAzureViewPreferences struct {
	CostType string `json:"costType"`
}

// ***************************
// Get Last period cost perspective 
// ***************************
type CCMGetLastPeriodCostPerspectiveOptions struct {
	CCMGetPerspectiveOptions
	StartTime int64 
	Period string
}

type CCMLastPeriodCostPerspective struct {
	CCMBaseResponse
	Data          float64 `json:"data,omitempty"`
}

// ***************************
// Get Last twelve months cost perspective 
// ***************************
type CCMGetLastTwelveMonthsCostPerspectiveOptions = CCMGetLastPeriodCostPerspectiveOptions 

type CCMCostByTime struct {
	Time int64 `json:"time,omitempty"` // Unix epoch milliseconds
	Value   float64 `json:"value,omitempty"`  // Cost 
}

type CCMLastTwelveMonthsCostPerspective struct {
	CCMBaseResponse
	Data          []CCMCostByTime `json:"data,omitempty"`
}

// ***************************
// Create perspective 
// ***************************
type CCMCreatePerspectiveOptions struct {
	AccountId string
	Clone bool
	UpdateTotalCost bool
	Body CCMPerspective
}

type CCMCreatePerspectiveResponse struct {
	CCMBaseResponse
	Data          CCMPerspective `json:"data"`
}
