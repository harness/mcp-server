package dto

import (
	"time"
)

// ReleaseStatus represents the status of a release
type ReleaseStatus string

const (
	ReleaseStatusRunning   ReleaseStatus = "Running"
	ReleaseStatusSuccess   ReleaseStatus = "Success"
	ReleaseStatusFailed    ReleaseStatus = "Failed"
	ReleaseStatusScheduled ReleaseStatus = "Scheduled"
	ReleaseStatusPaused    ReleaseStatus = "Paused"
	ReleaseStatusAborted   ReleaseStatus = "Aborted"
)

// ExecutionTaskStatus represents the status of an execution task
type ExecutionTaskStatus string

const (
	ExecutionTaskStatusTODO       ExecutionTaskStatus = "TODO"
	ExecutionTaskStatusInProgress ExecutionTaskStatus = "IN_PROGRESS"
	ExecutionTaskStatusSucceeded  ExecutionTaskStatus = "SUCCEEDED"
	ExecutionTaskStatusFailed     ExecutionTaskStatus = "FAILED"
	ExecutionTaskStatusBlocked    ExecutionTaskStatus = "BLOCKED"
)

// ReleaseApprovalType represents the type of release approval
type ReleaseApprovalType string

const (
	ReleaseApprovalTypeHarnessApproval ReleaseApprovalType = "HarnessApproval"
	ReleaseApprovalTypeJiraApproval    ReleaseApprovalType = "JiraApproval"
)

// TimeRangeDTO represents a time range for filtering releases
type TimeRangeDTO struct {
	StartTime int64 `json:"startTime"`
	EndTime   int64 `json:"endTime"`
}

// ReleaseSummaryRequest represents the request for fetching release summary
type ReleaseSummaryRequest struct {
	TimeRanges []TimeRangeDTO `json:"timeRanges"`
}

// ReleaseDTO represents a release entity
type ReleaseDTO struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	Identifier       string        `json:"identifier"`
	ExpectedStartTs  int64         `json:"expectedStartTs"`
	ExpectedEndTs    int64         `json:"expectedEndTs"`
	ActualStartTs    int64         `json:"actualStartTs"`
	ActualEndTs      int64         `json:"actualEndTs"`
	Status           ReleaseStatus `json:"status"`
	Version          string        `json:"version"`
	Color            string        `json:"color"`
	ReleaseGroupId   string        `json:"releaseGroupId"`
	HasConflict      bool          `json:"hasConflict"`
	ProcessIdentifier *string      `json:"processIdentifier,omitempty"`
}

// ReleaseSummaryResponse represents the response for release summary
type ReleaseSummaryResponse struct {
	Releases    []ReleaseDTO     `json:"releases"`
	NextRequest []TimeRangeDTO   `json:"nextRequest"`
	Last        bool             `json:"last"`
}

// ApprovalInfoDTO represents approval information
type ApprovalInfoDTO struct {
	ApprovalTimestamp int64  `json:"approvalTimestamp"`
	Comments          string `json:"comments"`
}

// ReleaseApprovalDTO represents a release approval
type ReleaseApprovalDTO struct {
	ID           string              `json:"id"`
	Name         string              `json:"name"`
	Description  string              `json:"description"`
	Type         ReleaseApprovalType `json:"type"`
	ApprovalInfo *ApprovalInfoDTO    `json:"approvalInfo,omitempty"`
}

// ReleaseApprovalsResponse represents the response for release approvals
type ReleaseApprovalsResponse struct {
	Content []ReleaseApprovalDTO `json:"content"`
	// Add pagination fields if needed
}

// PhaseExecutionDTO represents a phase execution
type PhaseExecutionDTO struct {
	Identifier         string `json:"identifier"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Status             string `json:"status"`
	CompletedActivities int   `json:"completed_activities"`
	TotalActivities     int   `json:"total_activities"`
}

// ActivityExecutionDTO represents an activity execution
type ActivityExecutionDTO struct {
	Identifier string `json:"identifier"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Status     string `json:"status"`
	CanRetry   bool   `json:"canRetry"`
}

// ExecutionTaskDTO represents an execution task
type ExecutionTaskDTO struct {
	Identifier       string              `json:"identifier"`
	Name             string              `json:"name"`
	Description      string              `json:"description"`
	Status           ExecutionTaskStatus `json:"status"`
	Required         interface{}         `json:"required"` // Can be string or bool
	Users            interface{}         `json:"users"`    // Can be string or []string
	UserGroups       interface{}         `json:"userGroups"` // Can be string or []string
	ExpectedDuration string              `json:"expectedDuration"`
}

// ExecutionTasksListResponse represents response for execution tasks
type ExecutionTasksListResponse struct {
	Tasks []ExecutionTaskDTO `json:"tasks"`
}

// ExecutionOutputDTO represents execution output
type ExecutionOutputDTO struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	Type  string      `json:"type"`
}

// ExecutionOutputsResponse represents response for execution outputs
type ExecutionOutputsResponse struct {
	Outputs []ExecutionOutputDTO `json:"outputs"`
}

// ActivityRetryHistoryDTO represents retry history for an activity
type ActivityRetryHistoryDTO struct {
	RetryAttempt int       `json:"retryAttempt"`
	Timestamp    time.Time `json:"timestamp"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
}

// ActivityRetryHistoryResponse represents response for activity retry history
type ActivityRetryHistoryResponse struct {
	RetryHistory []ActivityRetryHistoryDTO `json:"retryHistory"`
}

// PhasesExecutionResponse represents response for phases
type PhasesExecutionResponse struct {
	Phases []PhaseExecutionDTO `json:"phases"`
}

// ActivitiesExecutionResponse represents response for activities
type ActivitiesExecutionResponse struct {
	Activities           []ActivityExecutionDTO `json:"activities"`
	TotalRunningActivities int                   `json:"total_running_activities"`
}
