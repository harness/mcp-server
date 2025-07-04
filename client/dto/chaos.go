package dto

type ListExperimentResponse struct {
	Data []ExperimentV2 `json:"data"`
}

type GetExperimentResponse struct {
	ExperimentID               string                `json:"ExperimentID"`
	Identity                   string                `json:"Identity"`
	InfraID                    string                `json:"InfraID"`
	InfraType                  string                `json:"InfraType"`
	ExperimentType             string                `json:"ExperimentType"`
	Revision                   []WorkflowRevision    `json:"Revision"`
	RecentExperimentRunDetails []ExperimentRunDetail `json:"RecentExperimentRunDetails"`
}

type ExperimentRunDetail struct {
	ResiliencyScore float64 `json:"ResiliencyScore"`
	ExperimentRunID string  `json:"ExperimentRunID"`
	Phase           string  `json:"Phase"`
	UpdatedAt       int64   `json:"updatedAt"`
}

type WorkflowRevision struct {
	RevisionID         string `json:"RevisionID"`
	ExperimentManifest string `json:"ExperimentManifest"`
	UpdatedAt          int64  `json:"UpdatedAt"`
}

type ChaosExperimentRun struct {
	NotifyID        string  `json:"notifyID"`
	ResiliencyScore float64 `json:"resiliencyScore"`
	ExperimentType  string  `json:"experimentType"`
	InfraID         string  `json:"infraID"`
	ExperimentName  string  `json:"experimentName"`
	Phase           string  `json:"phase"`
	ExecutionData   string  `json:"executionData"`
	ErrorResponse   string  `json:"errorResponse"`
}

type RunChaosExperimentResponse struct {
	NotifyID        string `json:"notifyId"`
	DelegateTaskID  string `json:"delegateTaskId"`
	ExperimentRunID string `json:"experimentRunId"`
	ExperimentID    string `json:"experimentId"`
	ExperimentName  string `json:"experimentName"`
}

type ExperimentV2 struct {
	WorkflowType  *string       `json:"workflowType"`
	IsCronEnabled *bool         `json:"isCronEnabled"`
	Infra         *ChaosInfraV2 `json:"infra"`
	ExperimentID  string        `json:"experimentID"`
	WorkflowID    string        `json:"workflowID"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	UpdatedAt     string        `json:"updatedAt"`
	CreatedAt     string        `json:"createdAt"`
}

type ChaosInfraV2 struct {
	Name          string `json:"identity"`
	EnvironmentID string `json:"environmentId"`
}
