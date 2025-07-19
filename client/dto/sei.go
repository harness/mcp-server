package dto

import (
	"encoding/json"
	"time"
)

// DORAMetricsResponse represents the response for DORA metrics endpoint
type DORAMetricsResponse struct {
	DeploymentFrequency    DORAMetric `json:"deploymentFrequency"`
	LeadTimeForChanges     DORAMetric `json:"leadTimeForChanges"`
	ChangeFailureRate      DORAMetric `json:"changeFailureRate"`
	TimeToRestore          DORAMetric `json:"timeToRestore"`
	OrganizationPerformance string     `json:"organizationPerformance"`
}

// DORAMetric represents a single DORA metric with its statistics
type DORAMetric struct {
	Value     float64 `json:"value"`
	P50       float64 `json:"p50"`
	P90       float64 `json:"p90"`
	P95       float64 `json:"p95"`
	Mean      float64 `json:"mean"`
	Count     int     `json:"count"`
	Unit      string  `json:"unit"`
	Benchmark string  `json:"benchmark"`
}

// BusinessAlignmentResponse represents the response for Business Alignment metrics
type BusinessAlignmentResponse struct {
	Metrics         []BusinessAlignmentMetric `json:"metrics"`
	TotalTickets    int                      `json:"totalTickets"`
	TimeRange       DateRange                `json:"timeRange"`
	IntegrationID   string                   `json:"integrationId"`
}

// BusinessAlignmentMetric represents a specific Business Alignment metric
type BusinessAlignmentMetric struct {
	Name           string  `json:"name"`
	Value          float64 `json:"value"`
	TotalTime      float64 `json:"totalTime"`        // total_time_start_to_end (renamed from total_effort_per_ticket)
	TotalEffort    float64 `json:"totalEffort"`      // total effort (renamed from in_progress_duration_seconds)
	TicketCount    int     `json:"ticketCount"`
	Unit           string  `json:"unit"`
	Benchmark      string  `json:"benchmark"`
}

// BusinessAlignmentDrilldownResponse represents the detailed drilldown data for BA metrics
type BusinessAlignmentDrilldownResponse struct {
	Items          []BADrilldownItem `json:"items"`
	Total          int              `json:"total"`
	TimeRange      DateRange         `json:"timeRange"`
	IntegrationID  string           `json:"integrationId"`
}

// BADrilldownItem represents a single item in the Business Alignment drilldown
type BADrilldownItem struct {
	ID              string          `json:"id"`
	Key             string          `json:"key"`
	Title           string          `json:"title"`
	Status          string          `json:"status"`
	Project         string          `json:"project"`
	Epic            string          `json:"epic"`
	IssueType       string          `json:"issueType"`
	Assignee        string          `json:"assignee"`
	TotalTime       float64         `json:"totalTime"`        // total_time_start_to_end (renamed)
	TotalEffort     float64         `json:"totalEffort"`      // total effort (renamed)
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
	ResolvedAt      *time.Time      `json:"resolvedAt,omitempty"`
	Metadata        json.RawMessage `json:"metadata"`       // Using JSON raw message instead of pgtype.JSONB
}

// BAExpressionLeaf entity for BA filtering system with JsonNode metadata
type BAExpressionLeaf struct {
	Field    string          `json:"field"`
	Operator string          `json:"operator"`
	Value    interface{}     `json:"value"`
	Metadata json.RawMessage `json:"metadata"`  // Using JSON raw message instead of pgtype.JSONB
}

// DateRange represents a time range for queries
type DateRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// SortByField enum for sorting Business Alignment data
type SortByField string

const (
	SortByTotalTime      SortByField = "totalTime"
	SortByTotalEffort    SortByField = "totalEffort"
	SortByKey            SortByField = "key"
	SortByTitle          SortByField = "title"
	SortByStatus         SortByField = "status"
	SortByProject        SortByField = "project"
	SortByEpic           SortByField = "epic"
	SortByIssueType      SortByField = "issueType"
	SortByAssignee       SortByField = "assignee"
	SortByCreatedAt      SortByField = "createdAt"
	SortByUpdatedAt      SortByField = "updatedAt"
	SortByResolvedAt     SortByField = "resolvedAt"
)

// SortByCriteria enum for sort direction
type SortByCriteria string

const (
	SortAscending  SortByCriteria = "asc"
	SortDescending SortByCriteria = "desc"
)

// ProductivityFeatureType represents the type of productivity feature
type ProductivityFeatureType string

const (
	PRVelocity       ProductivityFeatureType = "PR_VELOCITY"
	StoryVelocity    ProductivityFeatureType = "STORY_VELOCITY"
	BugCount         ProductivityFeatureType = "BUG_COUNT"
	CodeChurn        ProductivityFeatureType = "CODE_CHURN"
	CodeOwnership    ProductivityFeatureType = "CODE_OWNERSHIP"
	CodeComplexity   ProductivityFeatureType = "CODE_COMPLEXITY"
)

// ProductivityStackBy represents the way to stack productivity data
type ProductivityStackBy string

const (
	StackByRepo       ProductivityStackBy = "REPOSITORY"
	StackByUser       ProductivityStackBy = "CONTRIBUTOR"
	StackByTeam       ProductivityStackBy = "TEAM"
	StackByLabel      ProductivityStackBy = "LABEL"
)

// Granularity represents the time granularity for metrics
type Granularity string

const (
	Day   Granularity = "DAY"
	Week  Granularity = "WEEK"
	Month Granularity = "MONTH"
)

// ProductivitySection represents a section of productivity metrics
type ProductivitySection string

const (
	FeatureSection ProductivitySection = "FEATURE"
	CodeSection    ProductivitySection = "CODE"
)

// ProductivityFeatureRequest represents the request for productivity metrics
type ProductivityFeatureRequest struct {
	StartDate        time.Time           `json:"startDate"`
	EndDate          time.Time           `json:"endDate"`
	Granularity      Granularity         `json:"granularity,omitempty"`
	ContributorUUIDs []string            `json:"contributorUUIDs,omitempty"`
	ContributorRefIds []string           `json:"contributorRefIds,omitempty"`
	CollectionRefIds []string            `json:"collectionRefIds,omitempty"`
	CollectionUUIDs  []string            `json:"collectionUUIDs,omitempty"`
	CollectionID     string              `json:"collectionId,omitempty"`
	FeatureType      ProductivityFeatureType `json:"featureType"`
	StackBy          ProductivityStackBy `json:"stackBy,omitempty"`
	Page             int                `json:"page,omitempty"`
	PageSize         int                `json:"page_size,omitempty"`
	SortBy           string              `json:"sortBy,omitempty"`
	SortByCriteria   SortByCriteria      `json:"sortByCriteria,omitempty"`
}

// ProductivityDataPoint represents a data point in the productivity metrics response
type ProductivityDataPoint struct {
	Value     float64                  `json:"value"`
	TimeSeries []ProductivityTimePoint `json:"timeSeries,omitempty"`
}

// ProductivityTimePoint represents a single time point in a productivity time series
type ProductivityTimePoint struct {
	Date  time.Time `json:"date"`
	Value float64   `json:"value"`
}

// ProductivityFeatureResponse represents the response for productivity feature metrics
type ProductivityFeatureResponse struct {
	StartDate    time.Time            `json:"startDate"`
	EndDate      time.Time            `json:"endDate"`
	Section      ProductivitySection  `json:"section"`
	FeatureType  ProductivityFeatureType `json:"featureType"`
	Granularity  Granularity          `json:"granularity"`
	StackBy      ProductivityStackBy  `json:"stackBy"`
	CurrentData  *ProductivityDataPoint `json:"currentData"`
	PreviousData *ProductivityDataPoint `json:"previousData"`
}

// ProductivityBreakdownDataPoint represents a breakdown data point for productivity metrics
type ProductivityBreakdownDataPoint struct {
	Name       string  `json:"name"`
	Value      float64 `json:"value"`
	Percentage float64 `json:"percentage"`
	Count      int     `json:"count"`
}

// ProductivityFeatureBreakdownResponse represents the response for productivity feature breakdown
type ProductivityFeatureBreakdownResponse struct {
	StartDate   time.Time                    `json:"startDate"`
	EndDate     time.Time                    `json:"endDate"`
	Section     ProductivitySection          `json:"section"`
	FeatureType ProductivityFeatureType      `json:"featureType"`
	StackBy     ProductivityStackBy          `json:"stackBy"`
	Data        []ProductivityBreakdownDataPoint `json:"data"`
	Total       int                          `json:"total"`
	Average     float64                      `json:"average,omitempty"`
}

// ProductivityFeatureDrilldownItem represents an item in the drilldown response
type ProductivityFeatureDrilldownItem struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Author      string          `json:"author"`
	Repository  string          `json:"repository"`
	Value       float64         `json:"value"`
	Type        string          `json:"type"`
	CreatedAt   time.Time       `json:"createdAt"`
	ClosedAt    *time.Time      `json:"closedAt,omitempty"`
	Url         string          `json:"url"`
	Metadata    json.RawMessage `json:"metadata"`
}

// ProductivityFeatureDrilldownResponse represents the response for productivity feature drilldown
type ProductivityFeatureDrilldownResponse struct {
	StartDate   time.Time                      `json:"startDate"`
	EndDate     time.Time                      `json:"endDate"`
	Section     ProductivitySection            `json:"section"`
	FeatureType ProductivityFeatureType        `json:"featureType"`
	Items       []ProductivityFeatureDrilldownItem `json:"items"`
	Total       int                            `json:"total"`
	Page        int                            `json:"page"`
	PageSize    int                            `json:"pageSize"`
}

// ProductivityFeatureIndividualDrilldownResponse represents the response for individual user productivity drilldown
type ProductivityFeatureIndividualDrilldownResponse struct {
	StartDate   time.Time                       `json:"startDate"`
	EndDate     time.Time                       `json:"endDate"`
	Section     ProductivitySection             `json:"section"`
	FeatureType ProductivityFeatureType         `json:"featureType"`
	Contributor string                          `json:"contributor"`
	Items       []ProductivityFeatureDrilldownItem  `json:"items"`
	Total       int                             `json:"total"`
	Page        int                             `json:"page"`
	PageSize    int                             `json:"pageSize"`
}
