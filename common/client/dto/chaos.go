package dto

type ListExperimentResponse struct {
	Data       []ExperimentV2 `json:"data"`
	Pagination Pagination     `json:"pagination"`
}

type StopChaosV2ExperimentResponse struct {
	IsStopped      bool   `json:"isStopped"`
	ExperimentID   string `json:"experimentId"`
	ExperimentName string `json:"experimentName"`
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
	Name          string     `json:"stepName"`
	StreamID      string     `json:"streamID"`
	Status        string     `json:"status"`
	StepType      string     `json:"stepType"`
	Spec          string     `json:"spec"`
	ChaosData     *ChaosData `json:"chaosData,omitempty"`
	ErrorData     *ErrorData `json:"errorData,omitempty"`
	EstimatedTime int        `json:"estimatedTime"`
	StartedAt     int64      `json:"startedAt"`
	LastUpdatedAt int64      `json:"lastUpdatedAt"`
	FinishedAt    int64      `json:"finishedAt"`
	Duration      int64      `json:"duration"`
}
type ErrorData struct {
	ErrorCode    string `json:"code"`
	ErrorMessage string `json:"message"`
}

type ChaosData struct {
	FaultData  *FaultData  `json:"faultData,omitempty"`
	ProbeData  *ProbeData  `json:"probeData,omitempty"`
	ActionData *ActionData `json:"actionData,omitempty"`
}
type FaultData struct {
	Namespace        string             `json:"namespace"`
	Name             string             `json:"name"`
	HelperPodDetails []HelperPodDetails `json:"helperPodDetails"`
	Targets          []Targets          `json:"targets,omitempty"`
}
type HelperPodDetails struct {
	Name        string `json:"name"`
	LogStreamID string `json:"logStreamID"`
}
type ProbeData struct {
	Name            string            `json:"name"`
	ProbeType       string            `json:"probeType"`
	Weightage       int               `json:"weightage"`
	Description     string            `json:"description"`
	Iterations      []ProbeIterations `json:"iterations"`
	ResiliencyScore int               `json:"resiliencyScore"`
	FaultName       string            `json:"faultName"`
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

type ListProbeResponse struct {
	TotalNoOfProbes int                `json:"totalNoOfProbes"`
	Probes          []GetProbeResponse `json:"data"`
}
type GetProbeResponse struct {
	ProbeRequest `json:",inline"`
	CreatedAt    int64 `json:"createdAt"`
	UpdatedAt    int64 `json:"updatedAt"`
}

type ProbeRequest struct {
	Identity            string                     `json:"identity"`
	ProbeID             string                     `json:"probeId"`
	Name                string                     `json:"name"`
	Description         *string                    `json:"description,omitempty"`
	Tags                []string                   `json:"tags,omitempty"`
	Type                string                     `json:"type"`
	IsEnabled           *bool                      `json:"isEnabled"`
	InfrastructureType  string                     `json:"infrastructureType"`
	RunProperties       ProbeTemplateRunProperties `json:"runProperties,omitempty"`
	RecentProbeRuns     []*ProbeRecentExecutions   `json:"recentProbeRuns,omitempty"`
	ProbeReferenceCount *int64                     `json:"probeReferenceCount,omitempty"`
}
type ProbeRecentExecutions struct {
	FaultName            string                `json:"faultName"`
	Status               *Status               `json:"status"`
	ExecutedByExperiment *ExecutedByExperiment `json:"executedByExperiment"`
}
type Status struct {
	Verdict     string  `json:"verdict"`
	Description *string `json:"description"`
}

type ExecutedByExperiment struct {
	ExperimentID    string `json:"experimentID"`
	ExperimentRunID string `json:"experimentRunID"`
	NotifyID        string `json:"notifyID"`
	ExperimentName  string `json:"experimentName"`
	ExperimentType  string `json:"experimentType"`
	UpdatedAt       int    `json:"updatedAt"`
}
type ProbeTemplateRunProperties struct {
	ProbeTimeout         string       `json:"timeout,omitempty"`
	Interval             string       `json:"interval,omitempty"`
	Attempt              interface{}  `json:"attempt,omitempty"`
	ProbePollingInterval string       `json:"pollingInterval,omitempty"`
	InitialDelay         string       `json:"initialDelay,omitempty"`
	StopOnFailure        bool         `json:"stopOnFailure,omitempty"`
	Verbosity            *string      `json:"verbosity,omitempty"`
	Retry                *interface{} `json:"retry,omitempty"`
}

type ListExperimentTemplateResponse struct {
	Data       []ChaosExperimentTemplate `json:"data"`
	Pagination Pagination                `json:"pagination"`
}

type ChaosExperimentTemplate struct {
	Identity     string     `json:"identity"`
	HubIdentity  string     `json:"hubIdentity"`
	Template     string     `json:"template"`
	Variables    []Variable `json:"variables"`
	Revision     string     `json:"revision"`
	IsDefault    bool       `json:"isDefault"`
	IsEnterprise bool       `json:"isEnterprise"`
	InfraType    string     `json:"infraType"`
	Infras       []string   `json:"infras"`
}

type Variable struct {
	VariableMinimum `json:",inline"`
	Path            string        `json:"path"`
	Category        string        `json:"category"`
	Description     string        `json:"description"`
	TooltipID       string        `json:"tooltipId"`
	Type            string        `json:"type"`
	Stringify       bool          `json:"stringify"`
	Required        bool          `json:"required"`
	AllowedValues   []interface{} `json:"allowedValues"`
	Default         interface{}   `json:"default"`
	Tags            []string      `json:"tags"`
	Validator       string        `json:"validator"`
}

type VariableMinimum struct {
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

type CreateExperimentFromTemplateRequest struct {
	IdentifiersQuery `json:",inline"`
	Name             string `json:"name"`
	Identity         string `json:"identity"`
	InfraRef         string `json:"infraRef"`
}

type IdentifiersQuery struct {
	AccountIdentifier      string `json:"accountIdentifier" validate:"required"`
	OrganizationIdentifier string `json:"organizationIdentifier"`
	ProjectIdentifier      string `json:"projectIdentifier"`
}

type Pagination struct {
	Index      int64 `json:"index"`
	Limit      int64 `json:"limit"`
	TotalPages int64 `json:"totalPages"`
	TotalItems int64 `json:"totalItems"`
}

type ListExperimentVariables struct {
	Experiment []Variable            `json:"experiment" yaml:"experiment"`
	Tasks      map[string][]Variable `json:"tasks" yaml:"tasks"`
}

type ExperimentRunRequest struct {
	InputsetIdentity string                       `json:"inputsetIdentity"`
	RuntimeInputs    *ChaosExperimentInputsetSpec `json:"runtimeInputs"`
}

type ChaosExperimentInputsetSpec struct {
	Experiment []VariableMinimum            `json:"experiment" yaml:"experiment"`
	Tasks      map[string][]VariableMinimum `json:"tasks" yaml:"tasks"`
}

type ExperimentCreationResponse struct {
	Data ExperimentCreationRequest `json:"data"`
}

type ExperimentCreationRequest struct {
	InfraType              string   `json:"infraType"`
	ExperimentID           string   `json:"id"`
	Identity               string   `json:"identity"`
	ExperimentName         string   `json:"name"`
	ExperimentDescription  string   `json:"description"`
	Manifest               string   `json:"manifest"`
	InfraID                string   `json:"infraId"`
	CronSyntax             *string  `json:"cronSyntax"`
	IsSingleRunCronEnabled *bool    `json:"isSingleRunCronEnabled"`
	Tags                   []string `json:"tags"`
	ValidateManifest       bool     `json:"validateManifest"`
	ExperimentType         string   `json:"experimentType"`
}

// ListLinuxInfraResponse represents the REST response for listing Linux infrastructures
type ListLinuxInfraResponse struct {
	TotalNoOfInfras int          `json:"totalNoOfInfras"`
	Infras          []LinuxInfra `json:"infras"`
}

// LinuxInfra represents a Linux infrastructure (load runner)
type LinuxInfra struct {
	InfraID          string      `json:"infraID"`
	Name             string      `json:"name"`
	Description      string      `json:"description"`
	Tags             []string    `json:"tags"`
	EnvironmentID    string      `json:"environmentID"`
	IsActive         bool        `json:"isActive"`
	IsInfraConfirmed bool        `json:"isInfraConfirmed"`
	IsRegistered     bool        `json:"isRegistered"`
	UpdatedAt        string      `json:"updatedAt"`
	CreatedAt        string      `json:"createdAt"`
	StartTime        string      `json:"startTime"`
	Version          string      `json:"version"`
	LastHeartbeat    string      `json:"lastHeartbeat"`
	Hostname         string      `json:"hostname"`
	Status           string      `json:"status"`
	CreatedBy        *UserDetail `json:"createdBy,omitempty"`
	UpdatedBy        *UserDetail `json:"updatedBy,omitempty"`
}

// UserDetail represents user information in chaos responses
type UserDetail struct {
	UserID   string `json:"userID"`
	Username string `json:"username"`
	Email    string `json:"email"`
}
