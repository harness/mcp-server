package dto

// ExecutionGraphResponse represents the execution graph response
type ExecutionGraphResponse struct {
	RootNodeID string                   `json:"rootNodeId,omitempty"`
	NodeMap    map[string]ExecutionNode `json:"nodeMap,omitempty"`
}

// ExecutionNode represents a node in the execution graph
type ExecutionNode struct {
	UUID                string                 `json:"uuid,omitempty"`
	SetupID             string                 `json:"setupId,omitempty"`
	Name                string                 `json:"name,omitempty"`
	Identifier          string                 `json:"identifier,omitempty"`
	BaseFqn             string                 `json:"baseFqn,omitempty"`
	Status              string                 `json:"status,omitempty"`
	StepParameters      map[string]interface{} `json:"stepParameters,omitempty"`
	LogBaseKey          string                 `json:"logBaseKey,omitempty"`
	ExecutableResponses []ExecutableResponse   `json:"executableResponses,omitempty"`
}

// ExecutableResponse represents the executable response in a node
type ExecutableResponse struct {
	Async ExecutableAsync `json:"async,omitempty"`
	Child *ChildResponse  `json:"child,omitempty"`
}

// ChildResponse represents child node information
type ChildResponse struct {
	ChildNodeID string   `json:"childNodeId,omitempty"`
	LogKeys     []string `json:"logKeys,omitempty"`
}

// ExecutableAsync contains async information including log keys
type ExecutableAsync struct {
	LogKeys     []string `json:"logKeys,omitempty"`
	CallbackIds []string `json:"callbackIds,omitempty"`
	Status      string   `json:"status,omitempty"`
}

// FailedNodeInfo contains information about a failed node
type FailedNodeInfo struct {
	StageID        string `json:"stageId,omitempty"`
	StepID         string `json:"stepId,omitempty"`
	FailureMessage string `json:"failureMessage,omitempty"`
	NodeID         string `json:"nodeId,omitempty"`
}

// GitContext contains git-related information for a pipeline execution
type GitContext struct {
	RepoURL       string `json:"repoUrl,omitempty"`
	Branch        string `json:"branch,omitempty"`
	Tag           string `json:"tag,omitempty"`
	CommitHash    string `json:"commitHash,omitempty"`
	CommitMessage string `json:"commitMessage,omitempty"`
}

// FailureLogResponse represents the response for pipeline failure logs
type FailureLogResponse struct {
	PipelineID  string           `json:"pipelineId,omitempty"`
	ExecutionID string           `json:"executionId,omitempty"`
	Status      string           `json:"status,omitempty"`
	GitContext  GitContext       `json:"gitContext,omitempty"`
	Failures    []FailureDetails `json:"failures,omitempty"`
}

// FailureDetails contains details about a specific failure
type FailureDetails struct {
	Stage   string `json:"stage,omitempty"`
	Step    string `json:"step,omitempty"`
	Message string `json:"message,omitempty"`
	Logs    string `json:"logs,omitempty"`
}
