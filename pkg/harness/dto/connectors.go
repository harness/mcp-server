package dto

import "time"

// ConnectorCatalogueItem represents an item in the connector catalogue.
// Based on https://apidocs.harness.io/tag/Connectors#operation/getConnectorCatalogue
type ConnectorCatalogueItem struct {
	Category                       string   `json:"category,omitempty"`
	Type                           string   `json:"type,omitempty"`
	Name                           string   `json:"name,omitempty"`
	Description                    string   `json:"description,omitempty"`
	LogoURL                        string   `json:"logoURL,omitempty"`
	Tags                           []string `json:"tags,omitempty"`
	HarnessManaged                 bool     `json:"harnessManaged,omitempty"`
	Beta                           bool     `json:"beta,omitempty"`
	ComingSoon                     bool     `json:"comingSoon,omitempty"`
	ComingSoonDate                 string   `json:"comingSoonDate,omitempty"`
	ComingSoonDescription          string   `json:"comingSoonDescription,omitempty"`
	IsNew                          bool     `json:"isNew,omitempty"`
	NewUntil                       *time.Time `json:"newUntil,omitempty"`
	SupportedDelegateTypes         []string `json:"supportedDelegateTypes,omitempty"`
	DelegateSelectors              []string `json:"delegateSelectors,omitempty"`
	DelegateRequiresConnectivityMode bool     `json:"delegateRequiresConnectivityMode,omitempty"`
	ConnectivityModes              []string `json:"connectivityModes,omitempty"`
	DocumentationLink              string   `json:"documentationLink,omitempty"`
	IsSSCA                         bool     `json:"isSSCA,omitempty"`
	SSCADescription                string   `json:"sscaDescription,omitempty"`
	SSCADocumentationLink          string   `json:"sscaDocumentationLink,omitempty"`
	SSCAType                       string   `json:"sscaType,omitempty"`
	SSCASupported                  bool     `json:"sscaSupported,omitempty"`
}
