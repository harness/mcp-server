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
