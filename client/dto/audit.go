package dto

type AuditPrincipal struct {
	Type       string `json:"type"`
	Identifier string `json:"identifier"`
}

type AuditPaginationOptions struct {
	Page int `json:"page,omitempty"`
	Size int `json:"size,omitempty"`
}

// AuditListOptions represents the options for listing pipelines
type AuditListOptions struct {
	AuditPaginationOptions
	SearchTerm string `json:"searchTerm,omitempty"`
}

type AuditResourceScope struct {
	AccountIdentifier string `json:"accountIdentifier"`
	OrgIdentifier     string `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string `json:"projectIdentifier,omitempty"`
}

type ListAuditEventsFilter struct {
	Scopes     []AuditResourceScope `json:"scopes,omitempty"`
	Principals []AuditPrincipal     `json:"principals,omitempty"`
	Actions    []string             `json:"actions,omitempty"`
	FilterType	string               `json:"filterType,omitempty"`
	StartTime	int64                `json:"startTime,omitempty"`
	EndTime		int64                `json:"endTime,omitempty"`
	Modules		[]string			`json:"modules,omitempty"`	
}


type AuditOutput[T any] struct {
	Status 		string			`json:"status,omitempty"`
	Data 		AuditOutputData[T]	`json:"data,omitempty"`
}

type AuditOutputData[T any] struct {
	PageItemCount		int				`json:"pageItemCount,omitempty"`
	PageSize 			int				`json:"pageSize,omitempty"`
	Content				[]T				`json:"content,omitempty"`
	PageIndex			int				`json:"pageIndex,omitempty"`
	HasNext				bool			`json:"hasNext,omitempty"`
	PageToken			string			`json:"pageToken,omitempty"`
	TotalItems			int 			`json:totalItems, omitempty`
	TotalPages			int				`json:totalPages, omitempty`
}

type AuditListItem struct {
	AuditID				string		`json:"auditId,omitempty"`
	InsertId			string		`json:"insertId,omitempty"`
	Resource			AuditResource		`json:"resource,omitempty"`
	Action				string		`json:"action,omitempty"`
	Module				string		`json:"module,omitempty"`
	Timestamp			int64		`json:"timestamp,omitempty"`
	AuthenticationInfo 	AuditAuthenticationInfo 	`json:"authenticationInfo,omitempty"`
	ResourceScope 		AuditResourceScope	`json:"resourceScope,omitempty"`
}

type AuditResource struct {
	Type				string		`json:"type"`
	Identifier			string		`json:"identifier"`
	Labels				AuditResourceLabels		`json:"labels,omitempty"`
}

type AuditResourceLabels struct {
	ResourceName		string		`json:"resourceName,omitempty"`
}

type AuditAuthenticationInfo struct {
	Principal			AuditPrincipal	`json:"principal"`
	Labels				AuditAuthenticationInfoLabels	`json:"labels,omitempty"`
}

type AuditAuthenticationInfoLabels struct {
	UserID				string		`json:"userId,omitempty"`
	Username			string		`json:"username,omitempty"`
}
