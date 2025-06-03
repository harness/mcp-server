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

type CCMListPerspectivesDetailOptions struct {
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	SearchKey         string `json:"searchKey,omitempty"`
	SortType          string `json:"sortType,omitempty"` // Enum: "NAME", "LAST_EDIT"
	SortOrder         string `json:"sortOrder,omitempty"` // Enum: "ASCENDING", "DESCENDING"
	CloudFilters         string `json:"cloudFilters,omitempty"` 
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
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	PerspectiveId string `json:"perspectiveId,omitempty"`
}

type CCMPerspectiveDetail struct {
	CCMBaseResponse
	Data          CCMPerspective    `json:"data"`
}

type CCMPerspective struct {
	UUID             string               `json:"uuid"`
	Name             string               `json:"name"`
	AccountID        string               `json:"accountId"`
	FolderID         string               `json:"folderId"`
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
	Type string `json:"type"`
}

type CCMViewVisualization struct {
	Granularity string          `json:"granularity"`
	GroupBy     CCMGroupBy      `json:"groupBy"`
	ChartType   string          `json:"chartType"`
}

type CCMGroupBy struct {
	FieldID       string `json:"fieldId"`
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

