package dto

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
	ID                string        `json:"id"`
	Name              string        `json:"name"`
	Identifier        string        `json:"identifier"`
	Status            ReleaseStatus `json:"status"`
	Version           string        `json:"version"`
	ReleaseGroupId    string        `json:"releaseGroupId"`
	ProcessIdentifier *string       `json:"processIdentifier,omitempty"`
}

// ReleaseSummaryResponse represents the response for release summary
type ReleaseSummaryResponse struct {
	Releases []ReleaseDTO `json:"releases"`
}

// PhaseExecutionDTO represents a phase execution
type PhaseExecutionDTO struct {
	Identifier string `json:"identifier"`
	Name       string `json:"name"`
	Status     string `json:"status"`
}

// ExecutionTaskDTO represents an execution task
type ExecutionTaskDTO struct {
	Identifier       string              `json:"identifier"`
	Name             string              `json:"name"`
	Description      string              `json:"description"`
	Status           ExecutionTaskStatus `json:"status"`
	Required         interface{}         `json:"required"`   // Can be string or bool
	Users            interface{}         `json:"users"`      // Can be string or []string
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

// PhasesExecutionResponse represents response for phases
type PhasesExecutionResponse struct {
	Phases []PhaseExecutionDTO `json:"phases"`
}
