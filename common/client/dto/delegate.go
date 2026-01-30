package dto

// DelegateReplica represents a delegate replica instance
type DelegateReplica struct {
	UUID          string `json:"uuid,omitempty"`
	LastHeartbeat int64  `json:"lastHeartbeat,omitempty"`
	HostName      string `json:"hostName,omitempty"`
	Version       string `json:"version,omitempty"`
	ExpiringAt    int64  `json:"expiringAt,omitempty"`
}

// Delegate represents a delegate in Harness
type Delegate struct {
	Type             string            `json:"type,omitempty"`
	Name             string            `json:"name,omitempty"`
	Description      string            `json:"description,omitempty"`
	Tags             []string          `json:"tags,omitempty"`
	LastHeartBeat    int64             `json:"lastHeartBeat,omitempty"`
	Connected        bool              `json:"connected"`
	DelegateReplicas []DelegateReplica `json:"delegateReplicas,omitempty"`
	AutoUpgrade      string            `json:"autoUpgrade,omitempty"`
	Legacy           bool              `json:"legacy"`
	OrgName          string            `json:"orgName,omitempty"`
	ProjectName      string            `json:"projectName,omitempty"`
}

// DelegateListFilter represents the filter options for listing delegates
type DelegateListFilter struct {
	Status                  string            `json:"status,omitempty"`
	Description             string            `json:"description,omitempty"`
	HostName                string            `json:"hostName,omitempty"`
	DelegateName            string            `json:"delegateName,omitempty"`
	DelegateType            string            `json:"delegateType,omitempty"`
	DelegateGroupIdentifier string            `json:"delegateGroupIdentifier,omitempty"`
	DelegateTags            []string          `json:"delegateTags,omitempty"`
	DelegateInstanceFilter  string            `json:"delegateInstanceFilter,omitempty"`
	AutoUpgrade             string            `json:"autoUpgrade,omitempty"`
	VersionStatus           string            `json:"versionStatus,omitempty"`
	Tags                    map[string]string `json:"tags,omitempty"`
	FilterType              string            `json:"filterType"`
}

// DelegateListResponse represents the response from the list delegates API
type DelegateListResponse struct {
	MetaData         interface{}  `json:"metaData"`
	Resource         []Delegate   `json:"resource"`
	ResponseMessages []string     `json:"responseMessages"`
}

// DelegateListOptions represents the options for listing delegates
type DelegateListOptions struct {
	All bool `json:"all,omitempty"`
}
