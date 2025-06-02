package dto

// ***************************
// Perspective List Detail 
// ***************************
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
