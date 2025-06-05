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
	TotalPages       int          `json:"totalPages,omitempty"`
	Size             int          `json:"size,omitempty"`
	Content          []T          `json:"content,omitempty"`
	Number           int          `json:"number,omitempty"`
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
	LastExecutionStatus string `json:"lastExecutionStatus,omitempty"`
	LastExecutionId     string `json:"lastExecutionId,omitempty"`
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
}

// PipelineExecution represents a pipeline execution
type PipelineExecution struct {
	PipelineIdentifier         string                 `json:"pipelineIdentifier,omitempty"`
	ProjectIdentifier          string                 `json:"projectIdentifier,omitempty"`
	OrgIdentifier              string                 `json:"orgIdentifier,omitempty"`
	PlanExecutionId            string                 `json:"planExecutionId,omitempty"`
	Name                       string                 `json:"name,omitempty"`
	Status                     string                 `json:"status,omitempty"`
	FailureInfo                ExecutionFailureInfo   `json:"failureInfo,omitempty"`
	StartTs                    int64                  `json:"startTs,omitempty"`
	EndTs                      int64                  `json:"endTs,omitempty"`
	CreatedAt                  int64                  `json:"createdAt,omitempty"`
	ConnectorRef               string                 `json:"connectorRef,omitempty"`
	SuccessfulStagesCount      int                    `json:"successfulStagesCount,omitempty"`
	FailedStagesCount          int                    `json:"failedStagesCount,omitempty"`
	RunningStagesCount         int                    `json:"runningStagesCount,omitempty"`
	TotalStagesRunningCount    int                    `json:"totalStagesRunningCount,omitempty"`
	StagesExecuted             []string               `json:"stagesExecuted,omitempty"`
	AbortedBy                  User                   `json:"abortedBy,omitempty"`
	QueuedType                 string                 `json:"queuedType,omitempty"`
	RunSequence                int32                  `json:"runSequence,omitempty"`
	ShouldUseSimplifiedBaseKey bool                   `json:"shouldUseSimplifiedBaseKey,omitempty"`
	ModuleInfo                 map[string]interface{} `json:"moduleInfo,omitempty"`
}

// ExecutionFailureInfo represents the failure information of a pipeline execution
type ExecutionFailureInfo struct {
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

type User struct {
	Email     string `json:"email,omitempty"`
	UserName  string `json:"userName,omitempty"`
	CreatedAt int64  `json:"createdAt,omitempty"`
}
