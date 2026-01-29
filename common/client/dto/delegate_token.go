package dto

import (
	"strings"
)

// DelegateEntityOwner represents the scope ownership of a delegate token
type DelegateEntityOwner struct {
	Identifier string `json:"identifier"`
}

// GetOrgID returns the organization ID from the identifier
func (o *DelegateEntityOwner) GetOrgID() string {
	if o == nil || o.Identifier == "" {
		return ""
	}
	parts := strings.Split(o.Identifier, "/")
	return parts[0]
}

// GetProjectID returns the project ID from the identifier, if present
func (o *DelegateEntityOwner) GetProjectID() string {
	if o == nil || o.Identifier == "" {
		return ""
	}
	parts := strings.Split(o.Identifier, "/")
	if len(parts) > 1 {
		return parts[1]
	}
	return ""
}

// EmbeddedUser represents a user in the delegate token context
type EmbeddedUser struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
}

// Principal represents an NG user in the delegate token context
type Principal struct {
	Type                   string                 `json:"type"`
	Name                   string                 `json:"name"`
	Email                  string                 `json:"email"`
	Username               string                 `json:"username"`
	AccountID              string                 `json:"accountId"`
	Role                   interface{}            `json:"role"`
	UniqueID               string                 `json:"uniqueId"`
	ImpersonatingPrincipal interface{}            `json:"impersonatingPrincipal"`
	JWTClaims              map[string]interface{} `json:"jwtclaims"`
}

// DelegateTokenStatus represents the status of a delegate token
type DelegateTokenStatus string

const (
	DelegateTokenStatusActive  DelegateTokenStatus = "ACTIVE"
	DelegateTokenStatusRevoked DelegateTokenStatus = "REVOKED"
)

// DelegateToken represents a delegate token
type DelegateToken struct {
	UUID            *string    `json:"uuid"`
	AccountID       string     `json:"accountId"`
	Name            string     `json:"name"`
	CreatedBy       *string    `json:"createdBy"`
	CreatedByNGUser *Principal `json:"createdByNgUser"`
	CreatedAt       int64      `json:"createdAt"`
	CreatedAtTime   string     `json:"createdAtTime"`
	Status          string     `json:"status"`
	Value           string     `json:"value"`
	OwnerIdentifier string     `json:"ownerIdentifier"`
	ParentUniqueID  string     `json:"parentUniqueId"`
	RevokeAfter     int64      `json:"revokeAfter"`
	RevokeAfterTime string     `json:"revokeAfterTime"`
	IsNG            bool       `json:"isNg"`
	LastUsedAt      int64      `json:"lastUsedAt"`
	LastUsedAtTime  string     `json:"lastUsedAtTime"`
	TokenHash       string     `json:"tokenHash"`
}

// FormatTimestamps formats the Unix timestamps into human-readable format
func (d *DelegateToken) FormatTimestamps() {
	d.CreatedAtTime = FormatUnixMillisToRFC3339(d.CreatedAt)
	if d.RevokeAfter > 0 {
		d.RevokeAfterTime = FormatUnixMillisToRFC3339(d.RevokeAfter)
	}
	if d.LastUsedAt > 0 {
		d.LastUsedAtTime = FormatUnixMillisToRFC3339(d.LastUsedAt)
	}
}

// DelegateTokenListResponse represents the response from the list delegate tokens API
type DelegateTokenListResponse struct {
	MetaData         interface{}     `json:"metaData"`
	Resource         []DelegateToken `json:"resource"`
	ResponseMessages []string        `json:"responseMessages"`
}

// DelegateTokenResponse represents the response from the create/get delegate token API
type DelegateTokenResponse struct {
	MetaData         map[string]interface{} `json:"metaData"`
	Resource         DelegateToken          `json:"resource"`
	ResponseMessages []string               `json:"responseMessages"`
}

// DelegateTokenOptions represents the options for listing delegate tokens
type DelegateTokenOptions struct {
	Page       int    `json:"page,omitempty"`
	Limit      int    `json:"limit,omitempty"`
	Sort       string `json:"sort,omitempty"`
	Order      string `json:"order,omitempty"`
	Status     string `json:"status,omitempty"`     // Filter by token status
	SearchTerm string `json:"searchTerm,omitempty"` // Search by name
}

// DelegateInstanceDetail represents details of a delegate instance
type DelegateInstanceDetail struct {
	UUID                          string `json:"uuid"`
	LastHeartbeat                 int64  `json:"lastHeartbeat"`
	ActivelyConnected             bool   `json:"activelyConnected"`
	HostName                      string `json:"hostName"`
	TokenActive                   bool   `json:"tokenActive"`
	Version                       string `json:"version"`
	DelegateExpirationTime        int64  `json:"delegateExpirationTime"`
	PollingModeEnabled            bool   `json:"polllingModeEnabled"`
	DelegateInstanceVersionStatus string `json:"delegateInstanceVersionStatus"`
	Runner                        bool   `json:"runner"`
	Disabled                      bool   `json:"disabled"`
}

// DelegateGroupDetail represents details of a delegate group
type DelegateGroupDetail struct {
	GroupID                     string                   `json:"groupId"`
	DelegateGroupIdentifier     string                   `json:"delegateGroupIdentifier"`
	DelegateType                string                   `json:"delegateType"`
	GroupName                   string                   `json:"groupName"`
	GroupImplicitSelectors      map[string]string        `json:"groupImplicitSelectors"`
	LastHeartBeat               int64                    `json:"lastHeartBeat"`
	ConnectivityStatus          string                   `json:"connectivityStatus"`
	ActivelyConnected           bool                     `json:"activelyConnected"`
	GrpcActive                  bool                     `json:"grpcActive"`
	DelegateInstanceDetails     []DelegateInstanceDetail `json:"delegateInstanceDetails"`
	TokenActive                 bool                     `json:"tokenActive"`
	AutoUpgrade                 string                   `json:"autoUpgrade"`
	DelegateGroupExpirationTime int64                    `json:"delegateGroupExpirationTime"`
	UpgraderLastUpdated         int64                    `json:"upgraderLastUpdated"`
	Immutable                   bool                     `json:"immutable"`
	GroupVersion                string                   `json:"groupVersion"`
	DelegateGroupVersionStatus  string                   `json:"delegateGroupVersionStatus"`
	Unsupported                 bool                     `json:"unsupported"`
}

// DelegateGroupsResource represents the resource in delegate groups response
type DelegateGroupsResource struct {
	DelegateGroupDetails []DelegateGroupDetail `json:"delegateGroupDetails"`
	AutoUpgradeOffCount  int                   `json:"autoUpgradeOffCount"`
}

// DelegateGroupsResponse represents the response from the get delegate groups by token API
type DelegateGroupsResponse struct {
	MetaData         map[string]interface{} `json:"metaData"`
	Resource         DelegateGroupsResource `json:"resource"`
	ResponseMessages []string               `json:"responseMessages"`
}
