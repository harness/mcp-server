package dto

import "time"

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

// ConnectorDetail represents the detailed information of a connector.
// Based on https://apidocs.harness.io/tag/Connectors#operation/getConnector
type ConnectorDetail struct {
	Connector             Connector             `json:"connector"`
	CreatedAt             int64                 `json:"createdAt"`
	LastModifiedAt        int64                 `json:"lastModifiedAt"`
	Status                ConnectorStatus       `json:"status"`
	ActivityDetails       ActivityDetails       `json:"activityDetails"`
	HarnessManaged        bool                  `json:"harnessManaged"`
	GitDetails            GitDetails            `json:"gitDetails"`
	EntityValidityDetails EntityValidityDetails `json:"entityValidityDetails"`
	GovernanceMetadata    interface{}           `json:"governanceMetadata,omitempty"`
	IsFavorite            bool                  `json:"isFavorite"`
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

// GitDetails represents git-related information of a connector.
type GitDetails struct {
	Valid       bool   `json:"valid"`
	InvalidYaml string `json:"invalidYaml"`
}

// EntityValidityDetails represents the validity information of a connector.
type EntityValidityDetails struct {
	Valid       bool   `json:"valid"`
	InvalidYaml string `json:"invalidYaml"`
}
