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
	ExpectedStartTs   int64         `json:"expectedStartTs,omitempty"`
	ExpectedEndTs     int64         `json:"expectedEndTs,omitempty"`
	ActualStartTs     int64         `json:"actualStartTs,omitempty"`
	ActualEndTs       int64         `json:"actualEndTs,omitempty"`
	Color             string        `json:"color,omitempty"`
	HasConflict       bool          `json:"hasConflict,omitempty"`
}

// ReleaseSummaryResponse represents the response for release summary
type ReleaseSummaryResponse struct {
	Releases []ReleaseDTO `json:"releases"`
}

// PhaseExecutionDTO represents a phase execution
type PhaseExecutionDTO struct {
	Identifier          string   `json:"identifier"`
	Name                string   `json:"name"`
	Status              string   `json:"status"`
	Description         string   `json:"description,omitempty"`
	StartTs             int64    `json:"start_ts,omitempty"`
	EndTs               int64    `json:"end_ts,omitempty"`
	PhaseExecutionId    string   `json:"phase_execution_id,omitempty"`
	CompletedActivities int      `json:"completed_activities,omitempty"`
	TotalActivities     int      `json:"total_activities,omitempty"`
	Owners              []string `json:"owners,omitempty"`
	DependsOn           []string `json:"depends_on,omitempty"`
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
	ActualDuration   string              `json:"actualDuration,omitempty"`
	CreatedAt        int64               `json:"createdAt,omitempty"`
	LastUpdatedAt    int64               `json:"lastUpdatedAt,omitempty"`
	TaskExecutionId  string              `json:"taskExecutionId,omitempty"`
}

// ExecutionTasksListResponse represents response for execution tasks
type ExecutionTasksListResponse struct {
	Tasks []ExecutionTaskDTO `json:"tasks"`
}

// ExecutionOutputDTO represents execution output
type ExecutionOutputDTO struct {
	Name  string `json:"name"`  // Changed from Key to Name to match API
	Value string `json:"value"` // Changed from interface{} to string to match API
	// Removed Type field as it doesn't exist in API
}

// ExecutionOutputsResponse represents response for execution outputs
type ExecutionOutputsResponse struct {
	Outputs []ExecutionOutputDTO `json:"outputs"`
}

// PhasesExecutionResponse represents response for phases
type PhasesExecutionResponse struct {
	ReleaseID          string              `json:"release_id"`
	ProcessExecutionID string              `json:"process_execution_id,omitempty"`
	TotalRunningPhases int                 `json:"total_running_phases"`
	Phases             []PhaseExecutionDTO `json:"phases"`
}

// ReleaseDetailsResponse represents response for fetching a single release by ID
type ReleaseDetailsResponse struct {
	ReleaseInfo ReleaseDTO `json:"releaseInfo"`
}

// ActivityExecutionDTO represents an activity execution
type ActivityExecutionDTO struct {
	Identifier          string                  `json:"identifier"`
	Name                string                  `json:"name"`
	Description         string                  `json:"description,omitempty"`
	Status              string                  `json:"status"`
	StartTs             int64                   `json:"start_ts,omitempty"`
	EndTs               int64                   `json:"end_ts,omitempty"`
	Yaml                string                  `json:"yaml,omitempty"`
	DependsOn           []string                `json:"depends_on,omitempty"`
	ActivityExecutionId string                  `json:"activity_execution_id,omitempty"`
	RetryIndex          int32                   `json:"retry_index,omitempty"`
	Pipeline            *PipelineActivityInfo   `json:"pipeline,omitempty"`
	Subprocess          *SubprocessActivityInfo `json:"subprocess,omitempty"`
}

// PipelineActivityInfo represents pipeline execution information for activities
type PipelineActivityInfo struct {
	ExecutionId string `json:"executionId"`
}

// SubprocessActivityInfo represents subprocess execution information for activities
type SubprocessActivityInfo struct {
	ReleaseId string `json:"releaseId"`
}

// ActivitiesExecutionResponse represents response for activities
type ActivitiesExecutionResponse struct {
	ReleaseID              string                 `json:"release_id"`
	ProcessExecutionID     string                 `json:"process_execution_id,omitempty"`
	PhaseExecutionID       string                 `json:"phase_execution_id,omitempty"`
	TotalRunningActivities int                    `json:"total_running_activities"`
	Activities             []ActivityExecutionDTO `json:"activities"`
}
