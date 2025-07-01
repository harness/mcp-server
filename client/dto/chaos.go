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

type ChaosExecutionResponse struct {
	Name            string               `json:"stepName"`
	ExperimentID    string               `json:"experimentID"`
	ExperimentRunID string               `json:"experimentRunID"`
	Status          string               `json:"status"`
	StepType        string               `json:"stepType"`
	RunSequence     int                  `json:"runSequence"`
	StartedAt       int64                `json:"startedAt"`
	LastUpdatedAt   int64                `json:"lastUpdatedAt"`
	FinishedAt      int64                `json:"finishedAt"`
	Duration        int64                `json:"duration"`
	Nodes           []ChaosExecutionNode `json:"nodes"`
	InfraID         string               `json:"infraID"`
	ResiliencyScore *float64             `json:"resiliencyScore"`
	ManifestVersion string               `json:"manifestVersion"`
}

type ChaosExecutionNode struct {
	Name          string     `json:"stepName" bson:"name"`
	StreamID      string     `json:"streamID" bson:"stream_id"`
	Status        string     `json:"status" bson:"status"`
	StepType      string     `json:"stepType" bson:"step_type"`
	Spec          string     `json:"spec" bson:"spec"`
	ChaosData     *ChaosData `json:"chaosData,omitempty" bson:"chaos_data"`
	ErrorData     *ErrorData `json:"errorData,omitempty" bson:"error_data,omitempty"`
	EstimatedTime int        `json:"estimatedTime" bson:"estimated_time"`
	StartedAt     int64      `json:"startedAt" bson:"started_at"`
	LastUpdatedAt int64      `json:"lastUpdatedAt" bson:"last_updated_at"`
	FinishedAt    int64      `json:"finishedAt" bson:"finished_at"`
	Duration      int64      `json:"duration"`
}

type ErrorData struct {
	ErrorCode    string `json:"code" bson:"error_code"`
	ErrorMessage string `json:"message" bson:"error_message"`
}

type ChaosData struct {
	FaultData  *FaultData  `json:"faultData,omitempty" bson:"fault_data,omitempty"`
	ProbeData  *ProbeData  `json:"probeData,omitempty" bson:"probe_data,omitempty"`
	ActionData *ActionData `json:"actionData,omitempty" bson:"action_data,omitempty"`
}

type FaultData struct {
	Namespace        string             `json:"namespace" bson:"namespace"`
	Name             string             `json:"name" bson:"name"`
	HelperPodDetails []HelperPodDetails `json:"helperPodDetails" bson:"helper_pod_details"`
	Targets          []Targets          `json:"targets,omitempty" bson:"targets,omitempty"`
}

type HelperPodDetails struct {
	Name        string `json:"name" bson:"name"`
	LogStreamID string `json:"logStreamID" bson:"log_stream_id"`
}

type ProbeData struct {
	Name            string            `json:"name" bson:"name"`
	ProbeType       string            `json:"probeType" bson:"probe_type"`
	Weightage       int               `json:"weightage" bson:"weightage"`
	Description     string            `json:"description" bson:"description"`
	Iterations      []ProbeIterations `json:"iterations" bson:"iterations"`
	ResiliencyScore int               `json:"resiliencyScore" bson:"resiliency_score"`
	FaultName       string            `json:"faultName" bson:"fault_name"`
}

type ProbeIterations struct {
	Duration     int           `json:"duration"`
	Phase        string        `json:"phase"`
	Timestamp    int64         `json:"timestamp"`
	HTTPProbe    *HTTPProbe    `json:"httpProbe"`
	CommandProbe *CommandProbe `json:"commandProbe"`
	PromProbe    *PromProbe    `json:"promProbe"`
}

type HTTPProbe struct {
	StatusCode   int    `json:"statusCode"`
	ResponseBody []byte `json:"responseBody"`
	ResponseTime int    `json:"responseTime"`
}

type CommandProbe struct {
	Output []byte `json:"output"`
}

type PromProbe struct {
	Metrics string `json:"metrics"`
}

type ActionData struct {
	Name string `json:"name"`
}

type Targets struct {
	ID        string `json:"ID"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	SubType   string `json:"subType"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
}
