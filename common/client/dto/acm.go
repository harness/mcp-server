package dto

// CreateACMTaskRequest represents the request to create an autonomous code maintenance task
type CreateACMTaskRequest struct {
	Name         string `json:"name"`
	Identifier   string `json:"identifier"`
	Instructions string `json:"instructions"`
	Path         string `json:"path"` // project and org path
}

// ACMTaskResponse represents the response from creating an autonomous code maintenance task
type ACMTaskResponse struct {
	ID             string        `json:"id"`
	SpaceID        string        `json:"space_id"`
	Identifier     string        `json:"identifier"`
	Name           string        `json:"name"`
	CreatedBy      TriggeredBy   `json:"created_by"`
	Created        int64         `json:"created"`
	Updated        int64         `json:"updated"`
	Instructions   string        `json:"instructions"`
	ExecutionCount int           `json:"execution_count"`
	LastRun        *ACMExecution `json:"last_run"`
}

// TriggerACMTaskExecutionRequest represents the request to trigger execution of an autonomous code maintenance task
type TriggerACMTaskExecutionRequest struct {
	TaskID       string `json:"task_id"`
	RepositoryID string `json:"repository_id"`
	SourceBranch string `json:"source_branch"`
}

// GetACMExecutionsRequest represents the request to get executions of an autonomous code maintenance task
type GetACMExecutionsRequest struct {
	TaskID string `json:"task_id"`
	Page   int    `json:"page"`
	Limit  int    `json:"limit"`
}

// ACMExecution represents a single execution of an autonomous code maintenance task
type ACMExecution struct {
	ID          string      `json:"id"`
	TaskID      string      `json:"task_id"`
	TaskType    string      `json:"task_type"`
	TriggeredBy TriggeredBy `json:"triggered_by"`
	Triggered   int64       `json:"triggered"`
	Started     int64       `json:"started"`
	Completed   int64       `json:"completed,omitempty"`
	Input       TaskInput   `json:"input"`
	Output      TaskOutput  `json:"output"`
	Status      string      `json:"status"`
}

// TriggeredBy represents the entity who triggered the execution
type TriggeredBy struct {
	UUID  string `json:"uuid"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Type  string `json:"type"`
}

// TaskInput represents the input parameters for a task execution
type TaskInput struct {
	Name         string `json:"name"`
	Instructions string `json:"instructions"`
	RepositoryID string `json:"repository_id"`
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch"`
}

type TaskOutput struct {
	// Can be expanded with specific fields as needed
}

// ACMExecutionsListResponse represents the response from listing executions of an autonomous code maintenance task
type ACMExecutionsListResponse []ACMExecution
