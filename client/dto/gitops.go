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

// GitOpsApplicationResourceTree holds nodes which belong to the application
type GitOpsApplicationResourceTree struct {
	Nodes         []ResourceNode `json:"nodes,omitempty"`         // List of nodes directly managed by the application and their children
	OrphanedNodes []ResourceNode `json:"orphanedNodes,omitempty"` // Orphaned nodes not managed by the app but in the same namespace
	Hosts         []HostInfo     `json:"hosts,omitempty"`         // Kubernetes nodes that run application related pods
}

// ResourceNode contains information about live resource and its children
type ResourceNode struct {
	ResourceRef     *ResourceRef              `json:"resourceRef,omitempty"`
	ParentRefs      []ResourceRef             `json:"parentRefs,omitempty"`
	Info            []InfoItem                `json:"info,omitempty"`
	NetworkingInfo  *ResourceNetworkingInfo   `json:"networkingInfo,omitempty"`
	ResourceVersion string                    `json:"resourceVersion,omitempty"`
	Images          []string                  `json:"images,omitempty"`
	Health          *HealthStatus             `json:"health,omitempty"`
	CreatedAt       string                    `json:"createdAt,omitempty"`
}

// ResourceRef includes fields which uniquely identify a resource
type ResourceRef struct {
	Group     string `json:"group,omitempty"`
	Version   string `json:"version,omitempty"`
	Kind      string `json:"kind,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name,omitempty"`
	UID       string `json:"uid,omitempty"`
}

// InfoItem represents an info item about a resource
type InfoItem struct {
	Name  string `json:"name,omitempty"`
	Value string `json:"value,omitempty"`
}

// ResourceNetworkingInfo holds networking resource related information
type ResourceNetworkingInfo struct {
	TargetLabels map[string]string  `json:"targetLabels,omitempty"`
	TargetRefs   []ResourceRef      `json:"targetRefs,omitempty"`
	Labels       map[string]string  `json:"labels,omitempty"`
	Ingress      []IngressInfo      `json:"ingress,omitempty"`
	ExternalURLs []string           `json:"externalURLs,omitempty"`
}

// IngressInfo represents ingress information
type IngressInfo struct {
	Hostname string `json:"hostname,omitempty"`
	Path     string `json:"path,omitempty"`
}

// HostInfo holds host name and resources metrics
type HostInfo struct {
	Name          string             `json:"name,omitempty"`
	ResourcesInfo []HostResourceInfo `json:"resourcesInfo,omitempty"`
	SystemInfo    *NodeSystemInfo    `json:"systemInfo,omitempty"`
}

// HostResourceInfo represents resource information for a host
type HostResourceInfo struct {
	ResourceName         string `json:"resourceName,omitempty"`
	RequestedByApp       string `json:"requestedByApp,omitempty"`
	RequestedByNeighbors string `json:"requestedByNeighbors,omitempty"`
	Capacity             string `json:"capacity,omitempty"`
}

// NodeSystemInfo represents node system information
type NodeSystemInfo struct {
	MachineID               string `json:"machineID,omitempty"`
	SystemUUID              string `json:"systemUUID,omitempty"`
	BootID                  string `json:"bootID,omitempty"`
	KernelVersion           string `json:"kernelVersion,omitempty"`
	OSImage                 string `json:"osImage,omitempty"`
	ContainerRuntimeVersion string `json:"containerRuntimeVersion,omitempty"`
	KubeletVersion          string `json:"kubeletVersion,omitempty"`
	KubeProxyVersion        string `json:"kubeProxyVersion,omitempty"`
	OperatingSystem         string `json:"operatingSystem,omitempty"`
	Architecture            string `json:"architecture,omitempty"`
}

// GitOpsGetResourceTreeOptions represents the options for getting application resource tree
type GitOpsGetResourceTreeOptions struct {
	Namespace    string `json:"namespace,omitempty"`    // Resource namespace
	Name         string `json:"name,omitempty"`         // Resource name
	Version      string `json:"version,omitempty"`      // Resource version
	Group        string `json:"group,omitempty"`        // Resource group
	Kind         string `json:"kind,omitempty"`         // Resource kind
	AppNamespace string `json:"appNamespace,omitempty"` // Application namespace
	Project      string `json:"project,omitempty"`      // Project name
}
