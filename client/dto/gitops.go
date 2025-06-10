package dto

import (
	"time"
)

// ===== GitOps Applications =====

// GitOpsApplication represents an application in GitOps
type GitOpsApplication struct {
	ID                string                 `json:"id,omitempty"`
	Name              string                 `json:"name"`
	Description       string                 `json:"description,omitempty"`
	ClusterID         string                 `json:"clusterId,omitempty"`
	ClusterName       string                 `json:"clusterName,omitempty"`
	Namespace         string                 `json:"namespace,omitempty"`
	Project           string                 `json:"project,omitempty"`
	Labels            map[string]string      `json:"labels,omitempty"`
	Annotations       map[string]string      `json:"annotations,omitempty"`
	Status            string                 `json:"status,omitempty"`
	Health            string                 `json:"health,omitempty"`
	SyncStatus        string                 `json:"syncStatus,omitempty"`
	RepoURL           string                 `json:"repoUrl,omitempty"`
	Path              string                 `json:"path,omitempty"`
	OrgIdentifier     string                 `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string                 `json:"projectIdentifier,omitempty"`
	CreatedAt         int64                  `json:"createdAt,omitempty"`
	UpdatedAt         int64                  `json:"updatedAt,omitempty"`
	AdditionalData    map[string]interface{} `json:"additionalData,omitempty"`
}

// GitOpsApplicationListResponse represents the response from the list applications API
type GitOpsApplicationListResponse struct {
	Applications []GitOpsApplication `json:"applications,omitempty"`
	Count        int                 `json:"count,omitempty"`
	Offset       int                 `json:"offset,omitempty"`
	Limit        int                 `json:"limit,omitempty"`
}

// GitOpsApplicationOptions represents options for listing GitOps applications
type GitOpsApplicationOptions struct {
	Offset    int      `json:"offset,omitempty"`
	Limit     int      `json:"limit,omitempty"`
	Clusters  []string `json:"clusters,omitempty"`
	Projects  []string `json:"projects,omitempty"`
	Repos     []string `json:"repos,omitempty"`
	AppName   string   `json:"appName,omitempty"`
	Labels    []string `json:"labels,omitempty"`
	Namespace string   `json:"namespace,omitempty"`
	Health    string   `json:"health,omitempty"`
	SyncStatus string  `json:"syncStatus,omitempty"`
}

// GitOpsAgentApplicationListOptions represents options for listing agent applications
type GitOpsAgentApplicationListOptions struct {
	Name       string   `json:"name,omitempty"`
	Namespace  string   `json:"namespace,omitempty"`
	ClusterID  string   `json:"clusterId,omitempty"`
	Project    string   `json:"project,omitempty"`
	Offset     int      `json:"offset,omitempty"`
	Limit      int      `json:"limit,omitempty"`
}

// GitOpsAgentApplication represents an application in GitOps managed by an agent
type GitOpsAgentApplication struct {
	Metadata struct {
		Name              string            `json:"name"`
		Namespace         string            `json:"namespace"`
		ClusterName       string            `json:"clusterName"`
		Labels            map[string]string `json:"labels,omitempty"`
		Annotations       map[string]string `json:"annotations,omitempty"`
		CreationTimestamp time.Time         `json:"creationTimestamp"`
	} `json:"metadata"`
	Status struct {
		Health    string `json:"health"`
		Sync      string `json:"sync"`
		Resources struct {
			Healthy   int `json:"healthy"`
			Unhealthy int `json:"unhealthy"`
		} `json:"resources"`
		Summary struct {
			Images []string `json:"images,omitempty"`
		} `json:"summary"`
	} `json:"status"`
	Spec struct {
		Project     string `json:"project"`
		Source      GitOpsApplicationSource `json:"source"`
		Destination GitOpsApplicationDestination `json:"destination"`
	} `json:"spec"`
}

// GitOpsApplicationSource represents the source configuration of a GitOps application
type GitOpsApplicationSource struct {
	RepoURL        string `json:"repoURL"`
	Path           string `json:"path,omitempty"`
	TargetRevision string `json:"targetRevision,omitempty"`
	Chart          string `json:"chart,omitempty"`
	Helm           map[string]interface{} `json:"helm,omitempty"`
	Kustomize      map[string]interface{} `json:"kustomize,omitempty"`
	Directory      map[string]interface{} `json:"directory,omitempty"`
}

// GitOpsApplicationDestination represents the destination of a GitOps application
type GitOpsApplicationDestination struct {
	Server    string `json:"server"`
	Namespace string `json:"namespace"`
	Name      string `json:"name,omitempty"`
}

// GitOpsApplicationParentResponse represents the response from application parent API
type GitOpsApplicationParentResponse struct {
	Parent GitOpsAgentApplication `json:"parent"`
}

// GitOpsAgentApplicationListResponse represents the response from agent application list API
type GitOpsAgentApplicationListResponse struct {
	Items []GitOpsAgentApplication `json:"items"`
}

// GitOpsResource represents a resource in GitOps
type GitOpsResource struct {
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Health    string `json:"health,omitempty"`
	Message   string `json:"message,omitempty"`
	SyncStatus string `json:"syncStatus,omitempty"`
}

// GitOpsManagedResourcesResponse represents managed resources response
type GitOpsManagedResourcesResponse struct {
	Items []GitOpsResource `json:"items"`
}

// GitOpsResourceTreeNode represents a node in a resource tree in GitOps
type GitOpsResourceTreeNode struct {
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Health    string `json:"health,omitempty"`
	SyncStatus string `json:"syncStatus,omitempty"`
	Children  []GitOpsResourceTreeNode `json:"children,omitempty"`
}

// GitOpsResourceTreeResponse represents the resource tree response
type GitOpsResourceTreeResponse struct {
	Nodes []GitOpsResourceTreeNode `json:"nodes"`
}

// GitOpsResourceEvent represents an event for a resource
type GitOpsResourceEvent struct {
	Type      string    `json:"type"`
	Reason    string    `json:"reason"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// GitOpsResourceEventsResponse represents the resource events response
type GitOpsResourceEventsResponse struct {
	Items []GitOpsResourceEvent `json:"items"`
}

// GitOpsPodLog represents pod logs in GitOps
type GitOpsPodLog struct {
	PodName     string `json:"podName"`
	LogContent  string `json:"logContent"`
	LastLogLine string `json:"lastLogLine,omitempty"`
}

// GitOpsPodLogsResponse represents the pod logs response
type GitOpsPodLogsResponse struct {
	Logs []GitOpsPodLog `json:"logs"`
}

// GitOpsManifest represents a manifest in GitOps
type GitOpsManifest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// GitOpsManifestsResponse represents the manifests response
type GitOpsManifestsResponse struct {
	Manifests []GitOpsManifest `json:"manifests"`
}

// GitOpsRevisionMetadata represents revision metadata in GitOps
type GitOpsRevisionMetadata struct {
	Author      string    `json:"author"`
	Message     string    `json:"message"`
	Revision    string    `json:"revision"`
	Date        time.Time `json:"date"`
	Tags        []string  `json:"tags,omitempty"`
	SignatureInfo map[string]interface{} `json:"signatureInfo,omitempty"`
}

// GitOpsRevisionMetadataResponse represents the revision metadata response
type GitOpsRevisionMetadataResponse struct {
	Metadata GitOpsRevisionMetadata `json:"metadata"`
}

// ===== GitOps Clusters =====

// GitOpsCluster represents a cluster in GitOps
type GitOpsCluster struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Server            string    `json:"server"`
	Status            string    `json:"status"`
	ConnectionStatus  string    `json:"connectionStatus,omitempty"`
	Message           string    `json:"message,omitempty"`
	Version           string    `json:"version,omitempty"`
	OrgIdentifier     string    `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string    `json:"projectIdentifier,omitempty"`
	CreatedAt         time.Time `json:"createdAt,omitempty"`
	UpdatedAt         time.Time `json:"updatedAt,omitempty"`
}

// GitOpsClusterListResponse represents the response from list clusters API
type GitOpsClusterListResponse struct {
	Clusters []GitOpsCluster `json:"clusters"`
	Count    int             `json:"count"`
	Offset   int             `json:"offset"`
	Limit    int             `json:"limit"`
}

// GitOpsClusterOptions represents options for listing GitOps clusters
type GitOpsClusterOptions struct {
	Offset  int      `json:"offset,omitempty"`
	Limit   int      `json:"limit,omitempty"`
	Projects []string `json:"projects,omitempty"`
	Status   string   `json:"status,omitempty"`
}

// ===== GitOps Dashboard =====

// GitOpsDashboardCounts represents counts for GitOps dashboard
type GitOpsDashboardCounts struct {
	Applications  int `json:"applications"`
	Clusters      int `json:"clusters"`
	Repositories  int `json:"repositories"`
	RecentlyCreated struct {
		Applications int `json:"applications"`
		Clusters     int `json:"clusters"`
	} `json:"recentlyCreated"`
}

// ===== GitOps Reconciliation =====

// GitOpsReconciliationCounts represents reconciliation counts
type GitOpsReconciliationCounts struct {
	Total    int `json:"total"`
	Healthy  int `json:"healthy"`
	Degraded int `json:"degraded"`
	Missing  int `json:"missing"`
	Unknown  int `json:"unknown"`
	OutOfSync int `json:"outOfSync"`
}
