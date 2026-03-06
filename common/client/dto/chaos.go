package dto

type ListExperimentResponse struct {
	Data       []ExperimentV2 `json:"data"`
	Pagination Pagination     `json:"pagination"`
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
	Data          []ChaosExperimentTemplate `json:"data"`
	Pagination    Pagination                `json:"pagination"`
	CorrelationID string                    `json:"correlationID"`
}

// ChaosExperimentTemplate mirrors the MongoDB schema chaosexperimenttemplate.ChaosExperimentTemplate.
type ChaosExperimentTemplate struct {
	AccountID    string     `json:"accountID"`
	OrgID        string     `json:"orgID"`
	ProjectID    string     `json:"projectID"`
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	Tags         []string   `json:"tags"`
	CreatedBy    string     `json:"createdBy"`
	UpdatedBy    string     `json:"updatedBy"`
	UpdatedAt    int64      `json:"updatedAt"`
	CreatedAt    int64      `json:"createdAt"`
	IsRemoved    bool       `json:"isRemoved"`
	Identity     string     `json:"identity"`
	HubIdentity  string     `json:"hubIdentity"`
	Template     string     `json:"template"`
	Variables    []Variable `json:"variables"`
	Revision     string     `json:"revision"`
	IsDefault    bool       `json:"isDefault"`
	IsEnterprise bool       `json:"isEnterprise"`
	InfraType    string     `json:"infraType"`
	Infras       []string   `json:"infras"`
	EditCounter  int        `json:"editCounter"`
}

// GetExperimentTemplateResponse mirrors hce-saas chaosexperimenttemplate.GetExperimentTemplateResponse.
type GetExperimentTemplateResponse struct {
	ExperimentTemplate `json:",inline"`
	CorrelationID      string `json:"correlationID"`
	HubIdentity        string `json:"hubIdentity"`
}

// ExperimentTemplate mirrors hce-sdk experimenttemplate.ExperimentTemplate.
type ExperimentTemplate struct {
	ResourceDetails `json:",inline"`
	MetaData        `json:",inline"`
	Spec            ExperimentTemplateSpec `json:"spec"`
	Revision        string                 `json:"revision"`
	IsDefault       bool                   `json:"isDefault"`
}

type ResourceDetails struct {
	Name        string   `json:"name"`
	Identity    string   `json:"identity"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

type MetaData struct {
	Kind       string `json:"kind"`
	APIVersion string `json:"apiVersion"`
}

type ExperimentTemplateSpec struct {
	InfraType           string                     `json:"infraType"`
	InfraID             string                     `json:"infraId,omitempty"`
	Faults              []ExperimentTemplateFault  `json:"faults,omitempty"`
	Probes              []ExperimentTemplateProbe  `json:"probes,omitempty"`
	Actions             []ExperimentTemplateAction `json:"actions,omitempty"`
	Vertices            []Vertex                   `json:"vertices"`
	CleanupPolicy       string                     `json:"cleanupPolicy"`
	StatusCheckTimeouts *StatusCheckTimeout        `json:"statusCheckTimeouts,omitempty"`
}

type ExperimentTemplateFault struct {
	Name         string            `json:"name"`
	Identity     string            `json:"identity"`
	Revision     string            `json:"revision,omitempty"`
	IsEnterprise bool              `json:"isEnterprise"`
	InfraID      string            `json:"infraId,omitempty"`
	Values       []VariableMinimum `json:"values"`
	AuthEnabled  *bool             `json:"authEnabled,omitempty"`
}

type ExperimentTemplateProbe struct {
	Name                 string            `json:"name"`
	Identity             string            `json:"identity"`
	Revision             int64             `json:"revision,omitempty"`
	IsEnterprise         bool              `json:"isEnterprise"`
	InfraID              string            `json:"infraId,omitempty"`
	Weightage            int               `json:"weightage,omitempty"`
	Duration             string            `json:"duration,omitempty"`
	Conditions           []ProbeConditions `json:"conditions,omitempty"`
	EnableDataCollection bool              `json:"enableDataCollection,omitempty"`
	Values               []VariableMinimum `json:"values"`
}

type ProbeConditions struct {
	ExecuteUpon *string `json:"executeUpon,omitempty"`
}

type ExperimentTemplateAction struct {
	Name                 string            `json:"name"`
	Identity             string            `json:"identity"`
	Revision             int64             `json:"revision,omitempty"`
	IsEnterprise         bool              `json:"isEnterprise"`
	InfraID              string            `json:"infraId,omitempty"`
	ContinueOnCompletion bool              `json:"continueOnCompletion"`
	Values               []VariableMinimum `json:"values"`
}

type Vertex struct {
	Name  string      `json:"name"`
	Start VertexChild `json:"start"`
	End   VertexChild `json:"end"`
}

type VertexChild struct {
	Probes  []VertexResource `json:"probes,omitempty"`
	Faults  []VertexResource `json:"faults,omitempty"`
	Actions []VertexResource `json:"actions,omitempty"`
}

type VertexResource struct {
	Name string `json:"name"`
}

type StatusCheckTimeout struct {
	Delay   int `json:"delay"`
	Timeout int `json:"timeout"`
}

// ExperimentTemplateVariablesResponse mirrors chaosexperimenttemplate.ExperimentTemplateVariables.
type ExperimentTemplateVariablesResponse struct {
	Faults        []ExperimentTemplateVariableGroup `json:"faults"`
	Probes        []ExperimentTemplateVariableGroup `json:"probes"`
	Actions       []ExperimentTemplateVariableGroup `json:"actions"`
	CorrelationID string                            `json:"correlationID"`
}

type ExperimentTemplateVariableGroup struct {
	Name      string     `json:"name"`
	Variables []Variable `json:"variables"`
}

// ExperimentTemplateYamlResponse mirrors chaosexperimenttemplate.ExperimentTemplateYaml.
type ExperimentTemplateYamlResponse struct {
	CorrelationID string `json:"correlationID"`
	Template      string `json:"template"`
}

// CompareRevisionsResponse mirrors chaosexperimenttemplate.CompareRevisions.
type CompareRevisionsResponse struct {
	CorrelationID string `json:"correlationID"`
	Template1     string `json:"template1"`
	Template2     string `json:"template2"`
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

// ChaosFaultTemplate mirrors the MongoDB schema chaosfaulttemplate.ChaosFaultTemplate.
type ChaosFaultTemplate struct {
	AccountID            string      `json:"accountID"`
	OrgID                string      `json:"orgID"`
	ProjectID            string      `json:"projectID"`
	Name                 string      `json:"name"`
	Description          string      `json:"description"`
	Tags                 []string    `json:"tags"`
	CreatedBy            string      `json:"createdBy"`
	UpdatedBy            string      `json:"updatedBy"`
	UpdatedAt            int64       `json:"updatedAt"`
	CreatedAt            int64       `json:"createdAt"`
	IsRemoved            bool        `json:"isRemoved"`
	Identity             string      `json:"identity"`
	HubIdentity          string      `json:"hubRef"`
	Category             []string    `json:"category"`
	InfraType            string      `json:"infraType"`
	Infras               []string    `json:"infras"`
	Type                 string      `json:"type"`
	Template             string      `json:"template"`
	Variables            []Variable  `json:"variables"`
	PermissionsRequired  string      `json:"permissionsRequired"`
	Links                []FaultLink `json:"links"`
	Revision             string      `json:"revision"`
	IsDefault            bool        `json:"isDefault"`
	IsEnterprise         bool        `json:"isEnterprise"`
	CreatedByUserDetails *UserDetail `json:"createdByUserDetails"`
	UpdatedByUserDetails *UserDetail `json:"updatedByUserDetails"`
}

type FaultLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type FaultTemplateCategoriesCount struct {
	Linux          int `json:"Linux"`
	CloudFoundry   int `json:"Cloud Foundry"`
	Windows        int `json:"Windows"`
	AWS            int `json:"AWS"`
	Azure          int `json:"Azure"`
	GCP            int `json:"GCP"`
	KubeResilience int `json:"Kube Resilience"`
	Kubernetes     int `json:"Kubernetes"`
	VMWare         int `json:"VMWare"`
	Load           int `json:"Load"`
	SSH            int `json:"SSH"`
	BYOC           int `json:"BYOC"`
	SpringBoot     int `json:"Spring Boot"`
}

// ListFaultTemplateResponse mirrors chaosfaulttemplate.ListFaultTemplateResponse.
type ListFaultTemplateResponse struct {
	Data                         []ChaosFaultTemplate         `json:"data"`
	Pagination                   Pagination                   `json:"pagination"`
	CorrelationID                string                       `json:"correlationID"`
	FaultTemplateCategoriesCount FaultTemplateCategoriesCount `json:"categoriesCount"`
}

// GetFaultTemplateResponse mirrors chaosfaulttemplate.GetFaultTemplateResponse.
type GetFaultTemplateResponse struct {
	Data          ChaosFaultTemplate `json:"data"`
	Fault         interface{}        `json:"fault"`
	CorrelationID string             `json:"correlationID"`
}

// FaultTemplateVariablesResponse mirrors chaosfaulttemplate.FaultTemplateVariables.
type FaultTemplateVariablesResponse struct {
	CorrelationID       string     `json:"correlationID"`
	Variables           []Variable `json:"variables"`
	FaultTargets        []Variable `json:"faultTargets"`
	FaultTunable        []Variable `json:"faultTunable"`
	FaultAuthentication []Variable `json:"faultAuthentication"`
}

// FaultTemplateYamlResponse mirrors chaosfaulttemplate.FaultTemplateYaml.
type FaultTemplateYamlResponse struct {
	CorrelationID string `json:"correlationID"`
	Template      string `json:"template"`
}

// FaultTemplateCompareRevisionsResponse mirrors chaosfaulttemplate.CompareRevisions.
type FaultTemplateCompareRevisionsResponse struct {
	CorrelationID string `json:"correlationID"`
	Template1     string `json:"template1"`
	Template2     string `json:"template2"`
}

type ChaosProbeTemplate struct {
	ID                   string      `json:"id,omitempty"`
	AccountID            string      `json:"accountID"`
	OrgID                string      `json:"orgID"`
	ProjectID            string      `json:"projectID"`
	Name                 string      `json:"name"`
	Description          string      `json:"description"`
	Tags                 []string    `json:"tags"`
	CreatedBy            string      `json:"createdBy"`
	UpdatedBy            string      `json:"updatedBy"`
	UpdatedAt            int64       `json:"updatedAt"`
	CreatedAt            int64       `json:"createdAt"`
	IsRemoved            bool        `json:"isRemoved"`
	Identity             string      `json:"identity"`
	HubRef               string      `json:"hubRef"`
	InfrastructureType   string      `json:"infrastructureType"`
	Type                 string      `json:"type"`
	Template             string      `json:"template"`
	Variables            []Variable  `json:"variables"`
	Revision             int64       `json:"revision"`
	IsDefault            bool        `json:"isDefault"`
	IsEnterprise         bool        `json:"isEnterprise"`
	ProbeProperties      interface{} `json:"probeProperties"`
	RunProperties        interface{} `json:"runProperties"`
	CreatedByUserDetails *UserDetail `json:"createdByUserDetails"`
	UpdatedByUserDetails *UserDetail `json:"updatedByUserDetails"`
}

type ProbeTemplateCount struct {
	Type  string `json:"type"`
	Count int64  `json:"count"`
}

type ListProbeTemplateResponse struct {
	Data          []ChaosProbeTemplate `json:"data"`
	Pagination    Pagination           `json:"pagination"`
	CountDetails  []ProbeTemplateCount `json:"countDetails"`
	CorrelationID string               `json:"correlationID"`
}

type GetProbeTemplateResponse struct {
	Data          ChaosProbeTemplate `json:"data"`
	CorrelationID string             `json:"correlationID"`
}

type ProbeTemplateVariablesResponse struct {
	Variables       []Variable `json:"variables"`
	RunProperty     []Variable `json:"probeRunProperty"`
	ProbeProperties []Variable `json:"probeProperties"`
}

type ChaosActionTemplate struct {
	ID                   string      `json:"id,omitempty"`
	AccountID            string      `json:"accountID"`
	OrgID                string      `json:"orgID"`
	ProjectID            string      `json:"projectID"`
	Name                 string      `json:"name"`
	Description          string      `json:"description"`
	Tags                 []string    `json:"tags"`
	CreatedBy            string      `json:"createdBy"`
	UpdatedBy            string      `json:"updatedBy"`
	UpdatedAt            int64       `json:"updatedAt"`
	CreatedAt            int64       `json:"createdAt"`
	IsRemoved            bool        `json:"isRemoved"`
	Identity             string      `json:"identity"`
	HubRef               string      `json:"hubRef"`
	InfrastructureType   string      `json:"infrastructureType"`
	Type                 string      `json:"type"`
	Template             string      `json:"template"`
	Variables            []Variable  `json:"variables"`
	Revision             int64       `json:"revision"`
	IsDefault            bool        `json:"isDefault"`
	IsEnterprise         bool        `json:"isEnterprise"`
	ActionProperties     interface{} `json:"actionProperties"`
	RunProperties        interface{} `json:"runProperties"`
	CreatedByUserDetails *UserDetail `json:"createdByUserDetails"`
	UpdatedByUserDetails *UserDetail `json:"updatedByUserDetails"`
}

type ActionTemplateCount struct {
	Type  string `json:"type"`
	Count int64  `json:"count"`
}

type ListActionTemplateResponse struct {
	Data          []ChaosActionTemplate `json:"data"`
	Pagination    Pagination            `json:"pagination"`
	CountDetails  []ActionTemplateCount `json:"countDetails"`
	CorrelationID string                `json:"correlationID"`
}

type GetActionTemplateResponse struct {
	Data          ChaosActionTemplate `json:"data"`
	CorrelationID string              `json:"correlationID"`
}

type ActionTemplateVariablesResponse struct {
	Variables        []Variable `json:"variables"`
	RunProperty      []Variable `json:"actionRunProperty"`
	ActionProperties []Variable `json:"actionProperties"`
}

type ChaosGuardRule struct {
	RuleID       string           `json:"ruleId"`
	Name         string           `json:"name"`
	Description  string           `json:"description"`
	UserGroupIds []string         `json:"userGroupIds"`
	ConditionIds []string         `json:"conditionIds"`
	Tags         []string         `json:"tags"`
	TimeWindows  []RuleTimeWindow `json:"timeWindows"`
	IsEnabled    bool             `json:"isEnabled"`
}

type RuleTimeWindow struct {
	TimeZone   string         `json:"timeZone"`
	Duration   string         `json:"duration"`
	Recurrence RuleRecurrence `json:"recurrence,omitempty"`
	StartTime  int64          `json:"startTime"`
	EndTime    int64          `json:"endTime"`
}

type RuleRecurrence struct {
	RecurrenceType string `json:"type"`
}

type ChaosGuardCondition struct {
	ConditionID string      `json:"conditionId,omitempty"`
	Name        string      `json:"name,omitempty"`
	Description string      `json:"description,omitempty"`
	Tags        []string    `json:"tags,omitempty"`
	InfraType   string      `json:"infraType"`
	FaultSpec   interface{} `json:"faultSpec"`
	K8sSpec     interface{} `json:"k8sSpec,omitempty"`
	MachineSpec interface{} `json:"machineSpec,omitempty"`
}

type ChaosGuardRuleResponse struct {
	ChaosGuardRule `json:",inline"`
	Conditions     []ChaosGuardCondition `json:"conditions"`
	UpdatedBy      UserDetail            `json:"updatedBy"`
	CreatedBy      UserDetail            `json:"createdBy"`
	CreatedAt      int64                 `json:"createdAt"`
	UpdatedAt      int64                 `json:"updatedAt"`
	CorrelationID  string                `json:"correlationID"`
}

type ListChaosGuardRulesResponse struct {
	Rules         []ChaosGuardRuleResponse `json:"rules"`
	Pagination    Pagination               `json:"pagination"`
	CorrelationID string                   `json:"correlationID"`
}

type GetChaosGuardRuleResponse struct {
	ChaosGuardRuleResponse `json:",inline"`
}

type DeleteChaosGuardRuleResponse struct {
	Success       bool   `json:"success"`
	Message       string `json:"message,omitempty"`
	CorrelationID string `json:"correlationID"`
}
