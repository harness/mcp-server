package dto

var AllowedActions = map[string]struct{}{
	"CREATE":                  {},
	"UPDATE":                  {},
	"RESTORE":                 {},
	"DELETE":                  {},
	"FORCE_DELETE":            {},
	"UPSERT":                  {},
	"INVITE":                  {},
	"RESEND_INVITE":          {},
	"REVOKE_INVITE":          {},
	"ADD_COLLABORATOR":       {},
	"REMOVE_COLLABORATOR":    {},
	"CREATE_TOKEN":           {},
	"REVOKE_TOKEN":           {},
	"LOGIN":                  {},
	"LOGIN2FA":               {},
	"UNSUCCESSFUL_LOGIN":     {},
	"ADD_MEMBERSHIP":         {},
	"REMOVE_MEMBERSHIP":      {},
	"ERROR_BUDGET_RESET":     {},
	"START":                  {},
	"END":                    {},
	"STAGE_START":            {},
	"STAGE_END":              {},
	"PAUSE":                  {},
	"RESUME":                 {},
	"ABORT":                  {},
	"TIMEOUT":                {},
	"SIGNED_EULA":            {},
	"ROLE_ASSIGNMENT_CREATED": {},
	"ROLE_ASSIGNMENT_UPDATED": {},
	"ROLE_ASSIGNMENT_DELETED": {},
	"MOVE":                   {},
	"ENABLED":                {},
	"DISABLED":               {},
	"DISMISS_ANOMALY":        {},
	"RERUN":                  {},
	"BYPASS":                 {},
	"STABLE_VERSION_CHANGED": {},
	"SYNC_START":             {},
	"START_IMPERSONATION":    {},
	"END_IMPERSONATION":      {},
	"MOVE_TO_GIT":            {},
	"FREEZE_BYPASS":          {},
	"EXPIRED":                {},
	"FORCE_PUSH":             {},
}

type AuditPrincipal struct {
	Type       string `json:"type"`
	Identifier string `json:"identifier"`
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
	FilterType string               `json:"filterType,omitempty"`
	StartTime  int64                `json:"startTime,omitempty"`
	EndTime    int64                `json:"endTime,omitempty"`
}

type AuditOutput[T any] struct {
	Status string             `json:"status,omitempty"`
	Data   AuditOutputData[T] `json:"data,omitempty"`
}

type AuditOutputData[T any] struct {
	PageItemCount int    `json:"pageItemCount,omitempty"`
	PageSize      int    `json:"pageSize,omitempty"`
	Content       []T    `json:"content,omitempty"`
	PageIndex     int    `json:"pageIndex,omitempty"`
	HasNext       bool   `json:"hasNext,omitempty"`
	PageToken     string `json:"pageToken,omitempty"`
	TotalItems    int    `json:"totalItems,omitempty"`
	TotalPages    int    `json:"totalPages,omitempty"`
}

type AuditListItem struct {
	AuditID            string                  `json:"auditId,omitempty"`
	InsertId           string                  `json:"insertId,omitempty"`
	Resource           AuditResource           `json:"resource,omitempty"`
	Action             string                  `json:"action,omitempty"`
	Module             string                  `json:"module,omitempty"`
	Timestamp          int64                   `json:"timestamp,omitempty"`
	AuthenticationInfo AuditAuthenticationInfo `json:"authenticationInfo,omitempty"`
	ResourceScope      AuditResourceScope      `json:"resourceScope,omitempty"`
	Time               string
}

type AuditResource struct {
	Type       string              `json:"type"`
	Identifier string              `json:"identifier"`
	Labels     AuditResourceLabels `json:"labels,omitempty"`
}

type AuditResourceLabels struct {
	ResourceName string `json:"resourceName,omitempty"`
}

type AuditAuthenticationInfo struct {
	Principal AuditPrincipal                `json:"principal"`
	Labels    AuditAuthenticationInfoLabels `json:"labels,omitempty"`
}

type AuditAuthenticationInfoLabels struct {
	UserID   string `json:"userId,omitempty"`
	Username string `json:"username,omitempty"`
}
