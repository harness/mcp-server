package dto

// Entity represents a pipeline in the system
type Entity[T any] struct {
	Status string `json:"status,omitempty"`
	Data   T      `json:"data,omitempty"`
}

// PipelineData represents the data field of a pipeline response
type PipelineData struct {
	YamlPipeline                  string                `json:"yamlPipeline,omitempty"`
	ResolvedTemplatesPipelineYaml string                `json:"resolvedTemplatesPipelineYaml,omitempty"`
	GitDetails                    GitDetails            `json:"gitDetails,omitempty"`
	EntityValidityDetails         EntityValidityDetails `json:"entityValidityDetails,omitempty"`
	Modules                       []string              `json:"modules,omitempty"`
	StoreType                     string                `json:"storeType,omitempty"`
	ConnectorRef                  string                `json:"connectorRef,omitempty"`
	AllowDynamicExecutions        bool                  `json:"allowDynamicExecutions,omitempty"`
	IsInlineHCEntity              bool                  `json:"isInlineHCEntity,omitempty"`
}

// GitDetails represents the git details of a pipeline
type GitDetails struct {
	Valid       bool   `json:"valid,omitempty"`
	InvalidYaml string `json:"invalidYaml,omitempty"`
}

// EntityValidityDetails represents the entity validity details of a pipeline
type EntityValidityDetails struct {
	Valid       bool   `json:"valid,omitempty"`
	InvalidYaml string `json:"invalidYaml,omitempty"`
}

// ListOutput represents a generic listing response
type ListOutput[T any] struct {
	Status string            `json:"status,omitempty"`
	Data   ListOutputData[T] `json:"data,omitempty"`
}

// ListOutputData represents the data field of a list response
type ListOutputData[T any] struct {
	TotalElements    int          `json:"totalElements,omitempty"`
	TotalItems       int          `json:"totalItems,omitempty"`
	TotalPages       int          `json:"totalPages,omitempty"`
	Size             int          `json:"size,omitempty"`
	PageSize         int          `json:"pageSize,omitempty"`
	Content          []T          `json:"content,omitempty"`
	Number           int          `json:"number,omitempty"`
	PageIndex        int          `json:"pageIndex,omitempty"`
	PageItemCount    int          `json:"pageItemCount,omitempty"`
	Sort             SortInfo     `json:"sort,omitempty"`
	First            bool         `json:"first,omitempty"`
	Pageable         PageableInfo `json:"pageable,omitempty"`
	NumberOfElements int          `json:"numberOfElements,omitempty"`
	Last             bool         `json:"last,omitempty"`
	Empty            bool         `json:"empty,omitempty"`
}

type PaginationOptions struct {
	Page int `json:"page,omitempty"`
	Size int `json:"size,omitempty"`
}

// PipelineListOptions represents the options for listing pipelines
type PipelineListOptions struct {
	PaginationOptions
	SearchTerm string `json:"searchTerm,omitempty"`
}

// PipelineSummary represents a summary of a pipeline
type PipelineSummary struct {
	Identifier           string                `json:"identifier,omitempty"`
	Name                 string                `json:"name,omitempty"`
	Description          string                `json:"description,omitempty"`
	Tags                 map[string]string     `json:"tags,omitempty"`
	OrgIdentifier        string                `json:"orgIdentifier,omitempty"`
	ProjectIdentifier    string                `json:"projectIdentifier,omitempty"`
	Version              int                   `json:"version,omitempty"`
	NumOfStages          int                   `json:"numOfStages,omitempty"`
	CreatedAt            int64                 `json:"createdAt,omitempty"`
	LastUpdatedAt        int64                 `json:"lastUpdatedAt,omitempty"`
	Modules              []string              `json:"modules,omitempty"`
	ExecutionSummaryInfo *ExecutionSummaryInfo `json:"executionSummaryInfo,omitempty"`
	StageNames           []string              `json:"stageNames,omitempty"`
	YamlVersion          string                `json:"yamlVersion,omitempty"`
}

// PipelineListItem represents an item in the pipeline list
type PipelineListItem struct {
	Name                 string                 `json:"name,omitempty"`
	Identifier           string                 `json:"identifier,omitempty"`
	Description          string                 `json:"description,omitempty"`
	Tags                 map[string]string      `json:"tags,omitempty"`
	Version              int                    `json:"version,omitempty"`
	NumOfStages          int                    `json:"numOfStages,omitempty"`
	CreatedAt            int64                  `json:"createdAt,omitempty"`
	LastUpdatedAt        int64                  `json:"lastUpdatedAt,omitempty"`
	Modules              []string               `json:"modules,omitempty"`
	ExecutionSummaryInfo ExecutionSummaryInfo   `json:"executionSummaryInfo,omitempty"`
	Filters              map[string]interface{} `json:"filters,omitempty"`
	StageNames           []string               `json:"stageNames,omitempty"`
	StoreType            string                 `json:"storeType,omitempty"`
	ConnectorRef         string                 `json:"connectorRef,omitempty"`
	IsDraft              bool                   `json:"isDraft,omitempty"`
	YamlVersion          string                 `json:"yamlVersion,omitempty"`
	IsInlineHCEntity     bool                   `json:"isInlineHCEntity,omitempty"`
}

// ExecutionSummaryInfo represents summary information about pipeline executions
type ExecutionSummaryInfo struct {
	NumOfErrors         []int  `json:"numOfErrors,omitempty"`
	Deployments         []int  `json:"deployments,omitempty"`
	LastExecutionTs     int64  `json:"lastExecutionTs,omitempty"`
	LastExecutionTsTime string `json:"lastExecutionTsTime,omitempty"`
	LastExecutionStatus string `json:"lastExecutionStatus,omitempty"`
	LastExecutionId     string `json:"lastExecutionId,omitempty"`
}

// FormatTimestamps formats the Unix timestamps into human-readable format
func (e *ExecutionSummaryInfo) FormatTimestamps() {
	if e.LastExecutionTs > 0 {
		e.LastExecutionTsTime = FormatUnixMillisToRFC3339(e.LastExecutionTs)
	}
}

// SortInfo represents sorting information
type SortInfo struct {
	Empty    bool `json:"empty,omitempty"`
	Unsorted bool `json:"unsorted,omitempty"`
	Sorted   bool `json:"sorted,omitempty"`
}

// PageableInfo represents pagination information
type PageableInfo struct {
	Offset     int      `json:"offset,omitempty"`
	Sort       SortInfo `json:"sort,omitempty"`
	Paged      bool     `json:"paged,omitempty"`
	Unpaged    bool     `json:"unpaged,omitempty"`
	PageSize   int      `json:"pageSize,omitempty"`
	PageNumber int      `json:"pageNumber,omitempty"`
}

// PipelineTag represents a key-value tag for filtering pipelines
type PipelineTag struct {
	Key   string `json:"key,omitempty"`
	Value string `json:"value,omitempty"`
}

// PipelineExecutionOptions represents the options for listing pipeline executions
type PipelineExecutionOptions struct {
	PaginationOptions
	Status             string        `json:"status,omitempty"`
	MyDeployments      bool          `json:"myDeployments,omitempty"`
	Branch             string        `json:"branch,omitempty"`
	SearchTerm         string        `json:"searchTerm,omitempty"`
	PipelineIdentifier string        `json:"pipelineIdentifier,omitempty"`
	PipelineTags       []PipelineTag `json:"pipelineTags,omitempty"`
}

// PipelineExecutionResponse represents the full response structure for pipeline execution details
type PipelineExecutionResponse struct {
	PipelineExecutionSummary PipelineExecution `json:"pipelineExecutionSummary,omitempty"`
	ExecutionGraph           ExecutionGraph    `json:"executionGraph,omitempty"`
	ChildGraph               ChildGraph        `json:"childGraph,omitempty"`
}

type ChildGraph struct {
	PipelineExecutionSummary PipelineExecution `json:"pipelineExecutionSummary,omitempty"`
	ExecutionGraph           ExecutionGraph    `json:"executionGraph,omitempty"`
}

type FinalLogKeys struct {
	StepLogBaseKeys []string `json:"stepLogBaseKeys,omitempty"`
}

// PipelineExecution represents a pipeline execution
type PipelineExecution struct {
	PipelineIdentifier         string               `json:"pipelineIdentifier,omitempty"`
	ProjectIdentifier          string               `json:"projectIdentifier,omitempty"`
	OrgIdentifier              string               `json:"orgIdentifier,omitempty"`
	PlanExecutionId            string               `json:"planExecutionId,omitempty"`
	Name                       string               `json:"name,omitempty"`
	Status                     string               `json:"status,omitempty"`
	FailureInfo                ExecutionFailureInfo `json:"failureInfo,omitempty"`
	StartTs                    int64                `json:"startTs,omitempty"`
	StartTsTime                string               `json:"startTsTime,omitempty"`
	EndTs                      int64                `json:"endTs,omitempty"`
	EndTsTime                  string               `json:"endTsTime,omitempty"`
	CreatedAt                  int64                `json:"createdAt,omitempty"`
	CreatedAtTime              string               `json:"createdAtTime,omitempty"`
	ConnectorRef               string               `json:"connectorRef,omitempty"`
	SuccessfulStagesCount      int                  `json:"successfulStagesCount,omitempty"`
	FailedStagesCount          int                  `json:"failedStagesCount,omitempty"`
	RunningStagesCount         int                  `json:"runningStagesCount,omitempty"`
	TotalStagesRunningCount    int                  `json:"totalStagesRunningCount,omitempty"`
	StagesExecuted             []string             `json:"stagesExecuted,omitempty"`
	AbortedBy                  User                 `json:"abortedBy,omitempty"`
	QueuedType                 string               `json:"queuedType,omitempty"`
	RunSequence                int32                `json:"runSequence,omitempty"`
	ShouldUseSimplifiedBaseKey bool                 `json:"shouldUseSimplifiedKey,omitempty"`
}

// FormatTimestamps formats the Unix timestamps into human-readable format
func (p *PipelineExecution) FormatTimestamps() {
	if p.StartTs > 0 {
		p.StartTsTime = FormatUnixMillisToRFC3339(p.StartTs)
	}
	if p.EndTs > 0 {
		p.EndTsTime = FormatUnixMillisToRFC3339(p.EndTs)
	}
	if p.CreatedAt > 0 {
		p.CreatedAtTime = FormatUnixMillisToRFC3339(p.CreatedAt)
	}
}

// ExecutionFailureInfo represents the failure information of a pipeline execution
type ExecutionFailureInfo struct {
	Message          string                     `json:"message,omitempty"`
	FailureTypeList  []string                   `json:"failureTypeList,omitempty"`
	ResponseMessages []ExecutionResponseMessage `json:"responseMessages,omitempty"`
}

type ExecutionResponseMessage struct {
	Code      string             `json:"code,omitempty"`
	Message   string             `json:"message,omitempty"`
	Level     string             `json:"level,omitempty"`
	Exception ExecutionException `json:"exception,omitempty"`
}

type ExecutionException struct {
	Message string `json:"message,omitempty"`
}

type ExecutionGraph struct {
	RootNodeId string                   `json:"rootNodeId,omitempty"`
	NodeMap    map[string]ExecutionNode `json:"nodeMap,omitempty"`
}

type ExecutionNode struct {
	Uuid           string         `json:"uuid,omitempty"`
	SetupId        string         `json:"setupId,omitempty"`
	Name           string         `json:"name,omitempty"`
	Identifier     string         `json:"identifier,omitempty"`
	BaseFqn        string         `json:"baseFqn,omitempty"`
	StepType       string         `json:"stepType,omitempty"`
	Status         string         `json:"status,omitempty"`
	UnitProgresses []UnitProgress `json:"unitProgresses,omitempty"`
	LogBaseKey     string         `json:"logBaseKey,omitempty"`
}

type UnitProgress struct {
	UnitName  string `json:"unitName,omitempty"`
	Status    string `json:"status,omitempty"`
	StartTime string `json:"startTime,omitempty"`
	EndTime   string `json:"endTime,omitempty"`
}

type User struct {
	Email     string `json:"email,omitempty"`
	UserName  string `json:"userName,omitempty"`
	CreatedAt int64  `json:"createdAt,omitempty"`
}

// InputSetListOptions represents the options for listing input sets
type InputSetListOptions struct {
	PaginationOptions
	PipelineIdentifier string `json:"pipelineIdentifier,omitempty"`
	SearchTerm         string `json:"searchTerm,omitempty"`
}

// InputSetListItem represents an item in the input set list
type InputSetListItem struct {
	Identifier             string                `json:"identifier,omitempty"`
	Name                   string                `json:"name,omitempty"`
	PipelineIdentifier     string                `json:"pipelineIdentifier,omitempty"`
	Description            string                `json:"description,omitempty"`
	InputSetType           string                `json:"inputSetType,omitempty"`
	Tags                   map[string]string     `json:"tags,omitempty"`
	GitDetails             GitDetails            `json:"gitDetails,omitempty"`
	CreatedAt              int64                 `json:"createdAt,omitempty"`
	LastUpdatedAt          int64                 `json:"lastUpdatedAt,omitempty"`
	IsOutdated             bool                  `json:"isOutdated,omitempty"`
	InputSetErrorDetails   InputSetErrorDetails  `json:"inputSetErrorDetails,omitempty"`
	OverlaySetErrorDetails map[string]string     `json:"overlaySetErrorDetails,omitempty"`
	EntityValidityDetails  EntityValidityDetails `json:"entityValidityDetails,omitempty"`
	Modules                []string              `json:"modules,omitempty"`
}

// InputSetErrorDetails represents error details for input sets
type InputSetErrorDetails struct {
	ErrorPipelineYaml         string                 `json:"errorPipelineYaml,omitempty"`
	UuidToErrorResponseMap    map[string]interface{} `json:"uuidToErrorResponseMap,omitempty"`
	InvalidInputSetReferences []string               `json:"invalidInputSetReferences,omitempty"`
	Type                      string                 `json:"type,omitempty"`
}

// InputSetListResponse represents the full response structure for listing input sets
type InputSetListResponse struct {
	Status        string                 `json:"status,omitempty"`
	Data          InputSetListData       `json:"data,omitempty"`
	MetaData      map[string]interface{} `json:"metaData,omitempty"`
	CorrelationId string                 `json:"correlationId,omitempty"`
}

// InputSetListData represents the data field of input set list response
type InputSetListData struct {
	TotalPages    int                `json:"totalPages,omitempty"`
	TotalItems    int                `json:"totalItems,omitempty"`
	PageItemCount int                `json:"pageItemCount,omitempty"`
	PageSize      int                `json:"pageSize,omitempty"`
	Content       []InputSetListItem `json:"content,omitempty"`
	PageIndex     int                `json:"pageIndex,omitempty"`
	Empty         bool               `json:"empty,omitempty"`
	PageToken     string             `json:"pageToken,omitempty"`
}

// InputSetDetail represents the detailed information of a specific input set
type InputSetDetail struct {
	AccountId             string                `json:"accountId,omitempty"`
	OrgIdentifier         string                `json:"orgIdentifier,omitempty"`
	ProjectIdentifier     string                `json:"projectIdentifier,omitempty"`
	PipelineIdentifier    string                `json:"pipelineIdentifier,omitempty"`
	Identifier            string                `json:"identifier,omitempty"`
	InputSetYaml          string                `json:"inputSetYaml,omitempty"`
	Name                  string                `json:"name,omitempty"`
	Description           string                `json:"description,omitempty"`
	Tags                  map[string]string     `json:"tags,omitempty"`
	InputSetErrorWrapper  InputSetErrorWrapper  `json:"inputSetErrorWrapper,omitempty"`
	GitDetails            GitDetails            `json:"gitDetails,omitempty"`
	EntityValidityDetails EntityValidityDetails `json:"entityValidityDetails,omitempty"`
	Outdated              bool                  `json:"outdated,omitempty"`
	ErrorResponse         bool                  `json:"errorResponse,omitempty"`
}

// InputSetErrorWrapper represents the error wrapper for input sets
type InputSetErrorWrapper struct {
	ErrorPipelineYaml         string                 `json:"errorPipelineYaml,omitempty"`
	UuidToErrorResponseMap    map[string]interface{} `json:"uuidToErrorResponseMap,omitempty"`
	InvalidInputSetReferences []string               `json:"invalidInputSetReferences,omitempty"`
	Type                      string                 `json:"type,omitempty"`
}

// InputSetResponse represents the full response structure for getting a specific input set
type InputSetResponse struct {
	Status        string                 `json:"status,omitempty"`
	Data          InputSetDetail         `json:"data,omitempty"`
	MetaData      map[string]interface{} `json:"metaData,omitempty"`
	CorrelationId string                 `json:"correlationId,omitempty"`
}

// TriggerListOptions represents the options for listing triggers
type TriggerListOptions struct {
	PaginationOptions
	TriggerNames       []string          `json:"triggerNames,omitempty"`
	TriggerIdentifiers []string          `json:"triggerIdentifiers,omitempty"`
	TriggerTypes       []string          `json:"triggerTypes,omitempty"`
	Tags               map[string]string `json:"tags,omitempty"`
	SearchTerm         string            `json:"searchTerm,omitempty"`
	TargetIdentifier   string            `json:"targetIdentifier,omitempty"`
	Filter             string            `json:"filter,omitempty"`
}

// WebhookDetails contains webhook configuration details
type WebhookDetails struct {
	WebhookSecret     string `json:"webhookSecret,omitempty"`
	WebhookSourceRepo string `json:"webhookSourceRepo,omitempty"`
}

// ValidationStatus represents the validation status of a trigger
type ValidationStatus struct {
	StatusResult    string `json:"statusResult,omitempty"`
	DetailedMessage string `json:"detailedMessage,omitempty"`
}

// WebhookAutoRegistrationStatus represents the webhook registration status
type WebhookAutoRegistrationStatus struct {
	RegistrationResult string `json:"registrationResult,omitempty"`
	DetailedMessage    string `json:"detailedMessage,omitempty"`
}

// WebhookInfo contains webhook identification information
type WebhookInfo struct {
	WebhookId string `json:"webhookId,omitempty"`
}

// TriggerStatus contains the status information for a trigger
type TriggerStatus struct {
	PollingSubscriptionStatus     interface{}                    `json:"pollingSubscriptionStatus,omitempty"`
	ValidationStatus              *ValidationStatus              `json:"validationStatus,omitempty"`
	WebhookAutoRegistrationStatus *WebhookAutoRegistrationStatus `json:"webhookAutoRegistrationStatus,omitempty"`
	WebhookInfo                   *WebhookInfo                   `json:"webhookInfo,omitempty"`
	Status                        string                         `json:"status,omitempty"`
	DetailMessages                []string                       `json:"detailMessages,omitempty"`
	LastPollingUpdate             interface{}                    `json:"lastPollingUpdate,omitempty"`
	LastPolled                    interface{}                    `json:"lastPolled,omitempty"`
}

type TriggerListItem struct {
	Name                  string            `json:"name,omitempty"`
	Identifier            string            `json:"identifier,omitempty"`
	Description           string            `json:"description,omitempty"`
	Tags                  map[string]string `json:"tags,omitempty"`
	Type                  string            `json:"type,omitempty"`
	Enabled               bool              `json:"enabled,omitempty"`
	Yaml                  string            `json:"yaml,omitempty"`
	WebhookUrl            string            `json:"webhookUrl,omitempty"`
	RegistrationStatus    string            `json:"registrationStatus,omitempty"`
	YamlVersion           string            `json:"yamlVersion,omitempty"`
	TriggerStatus         *TriggerStatus    `json:"triggerStatus,omitempty"`
	WebhookDetails        *WebhookDetails   `json:"webhookDetails,omitempty"`
	Executions            []int             `json:"executions,omitempty"`
	WebhookCurlCommand    string            `json:"webhookCurlCommand,omitempty"`
	PipelineInputOutdated bool              `json:"pipelineInputOutdated,omitempty"`
	// Keeping these fields for backward compatibility
	CreatedAt          int64  `json:"createdAt,omitempty"`
	LastUpdatedAt      int64  `json:"lastUpdatedAt,omitempty"`
	TargetIdentifier   string `json:"targetIdentifier,omitempty"`
	PipelineIdentifier string `json:"pipelineIdentifier,omitempty"`
}
