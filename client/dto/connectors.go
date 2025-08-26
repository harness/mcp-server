package dto

import (
	"time"
)

// ConnectorCatalogueItem represents an item in the connector catalogue.
// Based on https://apidocs.harness.io/tag/Connectors#operation/getConnectorCatalogue
type ConnectorCatalogueItem struct {
	Category                         string     `json:"category,omitempty"`
	Type                             string     `json:"type,omitempty"`
	Name                             string     `json:"name,omitempty"`
	Description                      string     `json:"description,omitempty"`
	LogoURL                          string     `json:"logoURL,omitempty"`
	Tags                             []string   `json:"tags,omitempty"`
	HarnessManaged                   bool       `json:"harnessManaged,omitempty"`
	Beta                             bool       `json:"beta,omitempty"`
	ComingSoon                       bool       `json:"comingSoon,omitempty"`
	ComingSoonDate                   string     `json:"comingSoonDate,omitempty"`
	ComingSoonDescription            string     `json:"comingSoonDescription,omitempty"`
	IsNew                            bool       `json:"isNew,omitempty"`
	NewUntil                         *time.Time `json:"newUntil,omitempty"`
	SupportedDelegateTypes           []string   `json:"supportedDelegateTypes,omitempty"`
	DelegateSelectors                []string   `json:"delegateSelectors,omitempty"`
	DelegateRequiresConnectivityMode bool       `json:"delegateRequiresConnectivityMode,omitempty"`
	ConnectivityModes                []string   `json:"connectivityModes,omitempty"`
	DocumentationLink                string     `json:"documentationLink,omitempty"`
	IsSSCA                           bool       `json:"isSSCA,omitempty"`
	SSCADescription                  string     `json:"sscaDescription,omitempty"`
	SSCADocumentationLink            string     `json:"sscaDocumentationLink,omitempty"`
	SSCAType                         string     `json:"sscaType,omitempty"`
	SSCASupported                    bool       `json:"sscaSupported,omitempty"`
}

// formatUnixMillisToRFC3339 converts Unix timestamp in milliseconds to RFC3339 format
func formatUnixMillisToRFC3339(ms int64) string {
	if ms <= 0 {
		return ""
	}
	sec := ms / 1000
	nsec := (ms % 1000) * 1000000
	t := time.Unix(sec, nsec)
	return t.Format(time.RFC3339)
}

// ConnectorDetail represents the detailed information of a connector.
// Based on https://apidocs.harness.io/tag/Connectors#operation/getConnector
type ConnectorDetail struct {
	Connector             Connector                      `json:"connector"`
	CreatedAt             int64                          `json:"createdAt"`
	LastModifiedAt        int64                          `json:"lastModifiedAt"`
	Status                ConnectorStatus                `json:"status"`
	ActivityDetails       ActivityDetails                `json:"activityDetails"`
	HarnessManaged        bool                           `json:"harnessManaged"`
	GitDetails            ConnectorGitDetails            `json:"gitDetails"`
	EntityValidityDetails ConnectorEntityValidityDetails `json:"entityValidityDetails"`
	GovernanceMetadata    interface{}                    `json:"governanceMetadata,omitempty"`
	IsFavorite            bool                           `json:"isFavorite"`
}

// ConnectorDetailResponse extends ConnectorDetail with human-readable timestamp fields
type ConnectorDetailResponse struct {
	// Core connector fields
	Connector Connector `json:"connector"`
	// Human-readable timestamps in RFC3339 instead of Unix timestamps
	CreatedAtTime      string `json:"created_at_time"`
	LastModifiedAtTime string `json:"last_modified_at_time"`
	// Nested structures with human-readable fields
	Status          ConnectorStatusResponse `json:"status"`
	ActivityDetails ActivityDetailsResponse `json:"activityDetails"`
	// Other fields from ConnectorDetail
	HarnessManaged        bool                           `json:"harnessManaged"`
	GitDetails            ConnectorGitDetails            `json:"gitDetails"`
	EntityValidityDetails ConnectorEntityValidityDetails `json:"entityValidityDetails"`
	GovernanceMetadata    interface{}                    `json:"governanceMetadata,omitempty"`
	IsFavorite            bool                           `json:"isFavorite"`
}

// Connector represents the core connector information.
type Connector struct {
	Name              string                 `json:"name"`
	Identifier        string                 `json:"identifier"`
	Description       string                 `json:"description"`
	AccountIdentifier string                 `json:"accountIdentifier"`
	OrgIdentifier     string                 `json:"orgIdentifier"`
	ProjectIdentifier string                 `json:"projectIdentifier"`
	Tags              map[string]string      `json:"tags"`
	Type              string                 `json:"type"`
	Spec              map[string]interface{} `json:"spec"`
}

// ConnectorEntityValidityDetails represents the validity information of a connector.
type ConnectorEntityValidityDetails struct {
	Valid       bool   `json:"valid"`
	InvalidYaml string `json:"invalidYaml"`
}

// ConnectorStatus represents the status information of a connector.
type ConnectorStatus struct {
	Status          string           `json:"status"`
	ErrorSummary    string           `json:"errorSummary"`
	Errors          []ConnectorError `json:"errors"`
	TestedAt        int64            `json:"testedAt"`
	LastTestedAt    int64            `json:"lastTestedAt"`
	LastConnectedAt int64            `json:"lastConnectedAt"`
	LastAlertSent   int64            `json:"lastAlertSent"`
}

// ConnectorStatusResponse extends ConnectorStatus with human-readable timestamp fields
type ConnectorStatusResponse struct {
	// Original fields from ConnectorStatus
	Status       string           `json:"status"`
	ErrorSummary string           `json:"errorSummary"`
	Errors       []ConnectorError `json:"errors"`
	// Human-readable timestamps instead of Unix timestamps
	TestedAtTime        string `json:"tested_at_time"`
	LastTestedAtTime    string `json:"last_tested_at_time"`
	LastConnectedAtTime string `json:"last_connected_at_time"`
	LastAlertSentTime   string `json:"last_alert_sent_time"`
}

// ConnectorError represents an error in connector status.
type ConnectorError struct {
	Reason  string `json:"reason"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// ActivityDetails represents the activity information of a connector.
type ActivityDetails struct {
	LastActivityTime int64 `json:"lastActivityTime"`
}

// ActivityDetailsResponse extends ActivityDetails with human-readable timestamp fields
type ActivityDetailsResponse struct {
	// Human-readable timestamp instead of Unix timestamp
	LastActivityTimeStr string `json:"last_activity_time"`
}

// ConnectorGitDetails represents git-related information of a connector.
type ConnectorGitDetails struct {
	Valid       bool   `json:"valid"`
	InvalidYaml string `json:"invalidYaml"`
}

// ConnectorListRequestBody represents the request body for listing connectors.
// Based on https://apidocs.harness.io/tag/Connectors#operation/getConnectorListV2
type ConnectorListRequestBody struct {
	ConnectorNames                    []string          `json:"connectorNames,omitempty"`
	ConnectorIdentifiers              []string          `json:"connectorIdentifiers,omitempty"`
	Description                       string            `json:"description,omitempty"`
	Types                             []string          `json:"types,omitempty"`
	Categories                        []string          `json:"categories,omitempty"`
	ConnectivityStatuses              []string          `json:"connectivityStatuses,omitempty"`
	InheritingCredentialsFromDelegate *bool             `json:"inheritingCredentialsFromDelegate,omitempty"`
	ConnectorConnectivityModes        []string          `json:"connectorConnectivityModes,omitempty"`
	Tags                              map[string]string `json:"tags,omitempty"`
	FilterType                        string            `json:"filterType,omitempty"`
}

// ConnectorListQueryParams represents query parameters for listing connectors.
type ConnectorListQueryParams struct {
	SearchTerm                           string `json:"searchTerm,omitempty"`
	FilterIdentifier                     string `json:"filterIdentifier,omitempty"`
	IncludeAllConnectorsAvailableAtScope *bool  `json:"includeAllConnectorsAvailableAtScope,omitempty"`
	Branch                               string `json:"branch,omitempty"`
	RepoIdentifier                       string `json:"repoIdentifier,omitempty"`
	GetDefaultFromOtherRepo              *bool  `json:"getDefaultFromOtherRepo,omitempty"`
	GetDistinctFromBranches              *bool  `json:"getDistinctFromBranches,omitempty"`
	Version                              string `json:"version,omitempty"`
	OnlyFavorites                        *bool  `json:"onlyFavorites,omitempty"`
	PageIndex                            *int   `json:"pageIndex,omitempty"`
	PageSize                             *int   `json:"pageSize,omitempty"`
	SortOrders                           string `json:"sortOrders,omitempty"`
	PageToken                            string `json:"pageToken,omitempty"`
}

// ConnectorListResponse represents the response from listing connectors.
type ConnectorListResponse struct {
	Status        string            `json:"status"`
	Data          ConnectorListData `json:"data"`
	MetaData      interface{}       `json:"metaData"`
	CorrelationID string            `json:"correlationId"`
}

// ConnectorListData represents the data section of connector list response.
type ConnectorListData struct {
	Content       []ConnectorDetail `json:"content"`
	PageInfo      PageInfo          `json:"pageInfo"`
	Empty         bool              `json:"empty"`
	TotalElements int               `json:"totalElements"`
	TotalPages    int               `json:"totalPages"`
}

// ConnectorListDataResponse extends ConnectorListData with human-readable timestamp fields in content
type ConnectorListDataResponse struct {
	Content       []ConnectorDetailResponse `json:"content"`
	PageInfo      PageInfo                  `json:"pageInfo"`
	Empty         bool                      `json:"empty"`
	TotalElements int                       `json:"totalElements"`
	TotalPages    int                       `json:"totalPages"`
}

// PageInfo represents pagination information.
type PageInfo struct {
	Page    int  `json:"page"`
	Size    int  `json:"size"`
	HasNext bool `json:"hasNext"`
	HasPrev bool `json:"hasPrev"`
}

// ToConnectorStatus converts ConnectorStatus adding RFC3339 time strings
func ToConnectorStatus(s ConnectorStatus) ConnectorStatusResponse {
	return ConnectorStatusResponse{
		Status:              s.Status,
		ErrorSummary:        s.ErrorSummary,
		Errors:              s.Errors,
		TestedAtTime:        formatUnixMillisToRFC3339(s.TestedAt),
		LastTestedAtTime:    formatUnixMillisToRFC3339(s.LastTestedAt),
		LastConnectedAtTime: formatUnixMillisToRFC3339(s.LastConnectedAt),
		LastAlertSentTime:   formatUnixMillisToRFC3339(s.LastAlertSent),
	}
}

// ToActivityDetails converts ActivityDetails adding RFC3339 time string
func ToActivityDetails(a ActivityDetails) ActivityDetailsResponse {
	return ActivityDetailsResponse{
		LastActivityTimeStr: formatUnixMillisToRFC3339(a.LastActivityTime),
	}
}

// ToConnectorDetail converts ConnectorDetail adding RFC3339 time strings and nested conversions
func ToConnectorDetail(d ConnectorDetail) ConnectorDetailResponse {
	return ConnectorDetailResponse{
		Connector:             d.Connector,
		CreatedAtTime:         formatUnixMillisToRFC3339(d.CreatedAt),
		LastModifiedAtTime:    formatUnixMillisToRFC3339(d.LastModifiedAt),
		Status:                ToConnectorStatus(d.Status),
		ActivityDetails:       ToActivityDetails(d.ActivityDetails),
		HarnessManaged:        d.HarnessManaged,
		GitDetails:            d.GitDetails,
		EntityValidityDetails: d.EntityValidityDetails,
		GovernanceMetadata:    d.GovernanceMetadata,
		IsFavorite:            d.IsFavorite,
	}
}

// ToConnectorListData converts ConnectorListData content to include human-readable times
func ToConnectorListData(data ConnectorListData) ConnectorListDataResponse {
	out := ConnectorListDataResponse{
		PageInfo:      data.PageInfo,
		Empty:         data.Empty,
		TotalElements: data.TotalElements,
		TotalPages:    data.TotalPages,
	}
	if len(data.Content) > 0 {
		out.Content = make([]ConnectorDetailResponse, len(data.Content))
		for i, item := range data.Content {
			out.Content[i] = ToConnectorDetail(item)
		}
	}
	return out
}
