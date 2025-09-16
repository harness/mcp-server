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
	UUID            *string     `json:"uuid"`
	AccountID       string      `json:"accountId"`
	Name            string      `json:"name"`
	CreatedBy       *string     `json:"createdBy"`
	CreatedByNGUser *Principal  `json:"createdByNgUser"`
	CreatedAt       int64       `json:"createdAt"`
	CreatedAtTime   string      `json:"createdAtTime"`
	Status          string      `json:"status"`
	Value           interface{} `json:"value"`
	OwnerIdentifier string      `json:"ownerIdentifier"`
	ParentUniqueID  string      `json:"parentUniqueId"`
	RevokeAfter     int64       `json:"revokeAfter"`
	RevokeAfterTime string      `json:"revokeAfterTime"`
	IsNG            bool        `json:"isNg"`
	LastUsedAt      int64       `json:"lastUsedAt"`
	LastUsedAtTime  string      `json:"lastUsedAtTime"`
	TokenHash       string      `json:"tokenHash"`
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
	MetaData interface{}     `json:"metaData"`
	Resource []DelegateToken `json:"resource"`
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
