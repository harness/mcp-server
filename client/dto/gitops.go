package dto

// GitOpsApplication represents a GitOps application in Harness
type GitOpsApplication struct {
	AccountIdentifier  string                 `json:"accountIdentifier,omitempty"`
	OrgIdentifier      string                 `json:"orgIdentifier,omitempty"`
	ProjectIdentifier  string                 `json:"projectIdentifier,omitempty"`
	AgentIdentifier    string                 `json:"agentIdentifier,omitempty"`
	Name               string                 `json:"name,omitempty"`
	ClusterIdentifier  string                 `json:"clusterIdentifier,omitempty"`
	RepoIdentifier     string                 `json:"repoIdentifier,omitempty"`
	App                *ApplicationSpec       `json:"app,omitempty"`
	CreatedAt          string                 `json:"createdAt,omitempty"`
	LastModifiedAt     string                 `json:"lastModifiedAt,omitempty"`
	Stale              bool                   `json:"stale,omitempty"`
}

// ApplicationSpec represents the Argo CD application specification
type ApplicationSpec struct {
	Metadata *ApplicationMetadata `json:"metadata,omitempty"`
	Spec     *AppSpec             `json:"spec,omitempty"`
	Status   *AppStatus           `json:"status,omitempty"`
}

// ApplicationMetadata represents the application metadata
type ApplicationMetadata struct {
	Name              string            `json:"name,omitempty"`
	Namespace         string            `json:"namespace,omitempty"`
	Labels            map[string]string `json:"labels,omitempty"`
	Annotations       map[string]string `json:"annotations,omitempty"`
	CreationTimestamp string            `json:"creationTimestamp,omitempty"`
}

// AppSpec represents the application spec
type AppSpec struct {
	Project     string                 `json:"project,omitempty"`
	Source      *ApplicationSource     `json:"source,omitempty"`
	Destination *ApplicationDestination `json:"destination,omitempty"`
	SyncPolicy  *SyncPolicy            `json:"syncPolicy,omitempty"`
}

// ApplicationSource represents the application source
type ApplicationSource struct {
	RepoURL        string `json:"repoURL,omitempty"`
	Path           string `json:"path,omitempty"`
	TargetRevision string `json:"targetRevision,omitempty"`
	Chart          string `json:"chart,omitempty"`
}

// ApplicationDestination represents the application destination
type ApplicationDestination struct {
	Server    string `json:"server,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name,omitempty"`
}

// SyncPolicy represents the sync policy
type SyncPolicy struct {
	Automated   *AutomatedSync `json:"automated,omitempty"`
	SyncOptions []string       `json:"syncOptions,omitempty"`
}

// AutomatedSync represents automated sync settings
type AutomatedSync struct {
	Prune    bool `json:"prune,omitempty"`
	SelfHeal bool `json:"selfHeal,omitempty"`
}

// AppStatus represents the application status
type AppStatus struct {
	Health           *HealthStatus       `json:"health,omitempty"`
	Sync             *SyncStatus         `json:"sync,omitempty"`
	OperationState   *OperationState     `json:"operationState,omitempty"`
	ReconciledAt     string              `json:"reconciledAt,omitempty"`
	ObservedAt       string              `json:"observedAt,omitempty"`
	Resources        []ResourceStatus    `json:"resources,omitempty"`
	Summary          *ApplicationSummary `json:"summary,omitempty"`
}

// HealthStatus represents the health status
type HealthStatus struct {
	Status  string `json:"status,omitempty"`
	Message string `json:"message,omitempty"`
}

// SyncStatus represents the sync status
type SyncStatus struct {
	Status    string `json:"status,omitempty"`
	Revision  string `json:"revision,omitempty"`
	ComparedTo ComparedTo `json:"comparedTo,omitempty"`
}

// ComparedTo represents what the sync is compared to
type ComparedTo struct {
	Source      ApplicationSource      `json:"source,omitempty"`
	Destination ApplicationDestination `json:"destination,omitempty"`
}

// OperationState represents the operation state
type OperationState struct {
	Phase      string `json:"phase,omitempty"`
	Message    string `json:"message,omitempty"`
	StartedAt  string `json:"startedAt,omitempty"`
	FinishedAt string `json:"finishedAt,omitempty"`
}

// ResourceStatus represents a resource status
type ResourceStatus struct {
	Group     string        `json:"group,omitempty"`
	Version   string        `json:"version,omitempty"`
	Kind      string        `json:"kind,omitempty"`
	Namespace string        `json:"namespace,omitempty"`
	Name      string        `json:"name,omitempty"`
	Status    string        `json:"status,omitempty"`
	Health    *HealthStatus `json:"health,omitempty"`
}

// ApplicationSummary represents summary information
type ApplicationSummary struct {
	ExternalURLs []string            `json:"externalURLs,omitempty"`
	Images       []string            `json:"images,omitempty"`
}

// GitOpsApplicationListResponse represents the response from the list GitOps applications API
type GitOpsApplicationListResponse struct {
	Content       []GitOpsApplication `json:"content"`
	TotalPages    int                 `json:"totalPages"`
	TotalItems    int                 `json:"totalItems"`
	PageItemCount int                 `json:"pageItemCount"`
	PageSize      int                 `json:"pageSize"`
	PageIndex     int                 `json:"pageIndex"`
	Empty         bool                `json:"empty"`
}

// GitOpsApplicationOptions represents the options for listing GitOps applications
type GitOpsApplicationOptions struct {
	SearchTerm        string                 `json:"searchTerm,omitempty"`
	Filter            map[string]interface{} `json:"filter,omitempty"`
	SortBy            string                 `json:"sortBy,omitempty"`
	SortOrder         string                 `json:"sortOrder,omitempty"`
	MetadataOnly      bool                   `json:"metadataOnly,omitempty"`
	Fields            []string               `json:"fields,omitempty"`
	AgentIdentifier   string                 `json:"agentIdentifier,omitempty"`
	PaginationOptions `json:",inline"`
}

// GitOpsApplicationQueryRequest represents the request body for listing applications
type GitOpsApplicationQueryRequest struct {
	AccountIdentifier string                 `json:"accountIdentifier"`
	OrgIdentifier     string                 `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string                 `json:"projectIdentifier,omitempty"`
	SearchTerm        string                 `json:"searchTerm,omitempty"`
	PageSize          int                    `json:"pageSize,omitempty"`
	PageIndex         int                    `json:"pageIndex,omitempty"`
	Filter            map[string]interface{} `json:"filter,omitempty"`
	SortBy            string                 `json:"sortBy,omitempty"`
	SortOrder         string                 `json:"sortOrder,omitempty"`
	MetadataOnly      bool                   `json:"metadataOnly,omitempty"`
	Fields            []string               `json:"fields,omitempty"`
}

// GitOpsGetApplicationOptions represents the options for getting a specific GitOps application
type GitOpsGetApplicationOptions struct {
	Refresh          string   `json:"refresh,omitempty"`          // "normal" or "hard" refresh mode
	Project          []string `json:"project,omitempty"`          // Project names to restrict returned applications
	ResourceVersion  string   `json:"resourceVersion,omitempty"`  // Resource version for watch calls
	Selector         string   `json:"selector,omitempty"`         // Label selector to filter applications
	Repo             string   `json:"repo,omitempty"`             // Repository URL to filter applications
	AppNamespace     string   `json:"appNamespace,omitempty"`     // Application namespace
	FetchFromHarness bool     `json:"fetchFromHarness,omitempty"` // Fetch directly from Harness DB instead of agent
}
