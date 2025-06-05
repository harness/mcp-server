package dto

import (
	"time"
)

// Event represents a Keycloak event
type Event struct {
	ID        string            `json:"id"`
	Time      int64             `json:"time"`
	Type      string            `json:"type"`
	RealmID   string            `json:"realmId"`
	ClientID  string            `json:"clientId"`
	UserID    string            `json:"userId"`
	IPAddress string            `json:"ipAddress"`
	Details   map[string]string `json:"details"`
}

// AdminEvent represents a Keycloak admin event
type AdminEvent struct {
	ID            string            `json:"id"`
	Time          int64             `json:"time"`
	RealmID       string            `json:"realmId"`
	ResourceType  string            `json:"resourceType"`
	OperationType string            `json:"operationType"`
	ResourcePath  string            `json:"resourcePath"`
	AuthUser      string            `json:"authUser"`
	IPAddress     string            `json:"ipAddress"`
	Details       map[string]string `json:"details"`
}

// UserSession represents a Keycloak user session
type UserSession struct {
	ID            string            `json:"id"`
	UserID        string            `json:"userId"`
	Username      string            `json:"username"`
	IPAddress     string            `json:"ipAddress"`
	Start         int64             `json:"start"`
	LastAccess    int64             `json:"lastAccess"`
	Clients       map[string]string `json:"clients"`
	RememberMe    bool              `json:"rememberMe"`
	TransientUser bool              `json:"transientUser"`
}

// SecurityEvent represents a processed security event
type SecurityEvent struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Time      time.Time         `json:"time"`
	UserID    string            `json:"userId"`
	IPAddress string            `json:"ipAddress"`
	Severity  string            `json:"severity"`
	Details   map[string]string `json:"details"`
}

// SecurityEventsResponse represents a response with security events
type SecurityEventsResponse struct {
	Events     []SecurityEvent `json:"events"`
	TotalCount int             `json:"totalCount"`
	Severity   string          `json:"severity"`
}

// AccessHeatmapData represents access heatmap data
type AccessHeatmapData struct {
	TimeRange    string                  `json:"timeRange"`
	TotalEvents  int                     `json:"totalEvents"`
	UniqueUsers  int                     `json:"uniqueUsers"`
	UniqueIPs    int                     `json:"uniqueIPs"`
	HourlyData   map[string]int          `json:"hourlyData"`
	UserActivity map[string]UserActivity `json:"userActivity"`
	IPActivity   map[string]IPActivity   `json:"ipActivity"`
	Anomalies    []AccessAnomaly         `json:"anomalies"`
	Summary      AccessSummary           `json:"summary"`
}

// UserActivity represents user-specific activity data
type UserActivity struct {
	Username      string         `json:"username"`
	UniqueIPs     []string       `json:"uniqueIPs"`
	HourlyPattern map[string]int `json:"hourlyPattern"`
	LastAccess    time.Time      `json:"lastAccess"`
	LoginCount    int            `json:"loginCount"`
	FailedCount   int            `json:"failedCount"`
	SessionCount  int            `json:"sessionCount"`
}

// IPActivity represents IP-specific activity data
type IPActivity struct {
	IPAddress     string         `json:"ipAddress"`
	UniqueUsers   []string       `json:"uniqueUsers"`
	HourlyPattern map[string]int `json:"hourlyPattern"`
	FirstSeen     time.Time      `json:"firstSeen"`
	LastSeen      time.Time      `json:"lastSeen"`
	LoginCount    int            `json:"loginCount"`
	FailedCount   int            `json:"failedCount"`
}

// AccessAnomaly represents a detected access anomaly
type AccessAnomaly struct {
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	User        string    `json:"user,omitempty"`
	IPAddress   string    `json:"ipAddress,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
	Details     string    `json:"details"`
}

// AccessSummary represents a summary of access data
type AccessSummary struct {
	PeakHour         string  `json:"peakHour"`
	PeakHourCount    int     `json:"peakHourCount"`
	OffHoursActivity int     `json:"offHoursActivity"`
	FailureRate      float64 `json:"failureRate"`
	AnomalyCount     int     `json:"anomalyCount"`
	RiskScore        int     `json:"riskScore"`
}

// ComplianceReport represents a security compliance report
type ComplianceReport struct {
	ReportType      string           `json:"reportType"`
	DateRange       string           `json:"dateRange"`
	AccessSummary   *AccessSummary   `json:"accessSummary,omitempty"`
	AdminSummary    *AdminSummary    `json:"adminSummary,omitempty"`
	SecuritySummary *SecuritySummary `json:"securitySummary,omitempty"`
	GeneratedAt     time.Time        `json:"generatedAt"`
}

// AdminSummary represents a summary of admin events
type AdminSummary struct {
	TotalEvents     int            `json:"totalEvents"`
	UserChanges     int            `json:"userChanges"`
	RoleChanges     int            `json:"roleChanges"`
	ClientChanges   int            `json:"clientChanges"`
	ConfigChanges   int            `json:"configChanges"`
	ByOperationType map[string]int `json:"byOperationType"`
	ByResourceType  map[string]int `json:"byResourceType"`
	TopAdmins       map[string]int `json:"topAdmins"`
}

// SecuritySummary represents a summary of security events
type SecuritySummary struct {
	TotalEvents int            `json:"totalEvents"`
	BySeverity  map[string]int `json:"bySeverity"`
	ByType      map[string]int `json:"byType"`
	TopRisks    []string       `json:"topRisks"`
}
