package dto

const (
	EntityKindApi                  string = "api"
	EntityKindComponent            string = "component"
	EntityKindEnvironment          string = "environment"
	EntityKindEnvironmentblueprint string = "environmentblueprint"
	EntityKindGroup                string = "group"
	EntityKindResource             string = "resource"
	EntityKindUser                 string = "user"
	EntityKindWorkflow             string = "workflow"
)

const (
	ScorecardDetailsWeightageStrategyCUSTOM       string = "CUSTOM"
	ScorecardDetailsWeightageStrategyEQUALWEIGHTS string = "EQUAL_WEIGHTS"
)

type GetEntityParams struct {
	BranchName             string `form:"branch_name,omitempty" json:"branch_name,omitempty"`
	ConnectorRef           string `form:"connector_ref,omitempty" json:"connector_ref,omitempty"`
	RepoName               string `form:"repo_name,omitempty" json:"repo_name,omitempty"`
	LoadFromFallbackBranch bool   `form:"load_from_fallback_branch,omitempty" json:"load_from_fallback_branch,omitempty"`
	OrgIdentifier          string `form:"orgIdentifier,omitempty" json:"orgIdentifier,omitempty"`
	ProjectIdentifier      string `form:"projectIdentifier,omitempty" json:"projectIdentifier,omitempty"`
	HarnessAccount         string `json:"Harness-Account,omitempty"`
}

type EntityResponse struct {
	Description           string `json:"description,omitempty"`
	EntityRef             string `json:"entity_ref"`
	EntityValidityDetails struct {
		ErrorMessages []string `json:"error_messages,omitempty"`
		IsValid       bool     `json:"is_valid,omitempty"`
	} `json:"entity_validity_details,omitempty"`
	GitDetails struct {
		BaseBranch        string `json:"base_branch,omitempty"`
		BranchName        string `json:"branch_name,omitempty"`
		CommitId          string `json:"commit_id,omitempty"`
		CommitMessage     string `json:"commit_message,omitempty"`
		ConnectorRef      string `json:"connector_ref,omitempty"`
		FilePath          string `json:"file_path,omitempty"`
		FileUrl           string `json:"file_url,omitempty"`
		IsHarnessCodeRepo bool   `json:"is_harness_code_repo,omitempty"`
		ObjectId          string `json:"object_id,omitempty"`
		RepoName          string `json:"repo_name,omitempty"`
		RepoUrl           string `json:"repo_url,omitempty"`
		StoreType         string `json:"store_type,omitempty"`
	} `json:"git_details,omitempty"`
	Groups []struct {
		GroupDescription  string `json:"group_description,omitempty"`
		GroupIcon         string `json:"group_icon,omitempty"`
		GroupIdentifier   string `json:"group_identifier,omitempty"`
		GroupName         string `json:"group_name,omitempty"`
		OrgIdentifier     string `json:"org_identifier,omitempty"`
		OrgName           string `json:"org_name,omitempty"`
		ProjectIdentifier string `json:"project_identifier,omitempty"`
		ProjectName       string `json:"project_name,omitempty"`
		Scope             string `json:"scope,omitempty"`
	} `json:"groups,omitempty"`
	Identifier        string         `json:"identifier"`
	Kind              string         `json:"kind"`
	Lifecycle         string         `json:"lifecycle,omitempty"`
	Metadata          map[string]any `json:"metadata,omitempty"`
	Name              string         `json:"name,omitempty"`
	OrgIdentifier     string         `json:"orgIdentifier,omitempty"`
	OrgName           string         `json:"org_name,omitempty"`
	Owner             string         `json:"owner,omitempty"`
	ProjectIdentifier string         `json:"projectIdentifier,omitempty"`
	ProjectName       string         `json:"project_name,omitempty"`
	ReferenceType     string         `json:"referenceType"`
	Scope             string         `json:"scope"`
	Scorecards        struct {
		Average float32 `json:"average,omitempty"`
		Scores  []struct {
			PassedChecks float32 `json:"passed_checks,omitempty"`
			Score        float32 `json:"score,omitempty"`
			Scorecard    string  `json:"scorecard,omitempty"`
			TotalChecks  float32 `json:"total_checks,omitempty"`
		} `json:"scores,omitempty"`
	} `json:"scorecards,omitempty"`
	Starred bool `json:"starred,omitempty"`
	Status  []struct {
		Level   string `json:"level,omitempty"`
		Message string `json:"message,omitempty"`
		Type    string `json:"type,omitempty"`
	} `json:"status,omitempty"`
	Tags []string `json:"tags,omitempty"`
	Type string   `json:"type,omitempty"`
	Yaml string   `json:"yaml"`
}

type GetEntitiesParams struct {
	Page           int32  `form:"page,omitempty" json:"page,omitempty"`
	Limit          int32  `form:"limit,omitempty" json:"limit,omitempty"`
	Sort           string `form:"sort,omitempty" json:"sort,omitempty"`
	SearchTerm     string `form:"search_term,omitempty" json:"search_term,omitempty"`
	Scopes         string `form:"scopes,omitempty" json:"scopes,omitempty"`
	EntityRefs     string `form:"entity_refs,omitempty" json:"entity_refs,omitempty"`
	OwnedByMe      bool   `form:"owned_by_me,omitempty" json:"owned_by_me,omitempty"`
	Favorites      bool   `form:"favorites,omitempty" json:"favorites,omitempty"`
	Kind           string `form:"kind,omitempty" json:"kind,omitempty"`
	Type           string `form:"type,omitempty" json:"type,omitempty"`
	Owner          string `form:"owner,omitempty" json:"owner,omitempty"`
	Lifecycle      string `form:"lifecycle,omitempty" json:"lifecycle,omitempty"`
	Tags           string `form:"tags,omitempty" json:"tags,omitempty"`
	HarnessAccount string `json:"Harness-Account,omitempty"`
}

type GetScorecardsParams struct {
	HarnessAccount string `json:"Harness-Account,omitempty"`
}

type ScorecardDetailsResponse struct {
	Checks    []ScorecardChecksDetails `json:"checks"`
	Scorecard ScorecardDetails         `json:"scorecard"`
}

type ScorecardDetails struct {
	ChecksMissing []string `json:"checks_missing,omitempty"`
	Components    int      `json:"components,omitempty"`
	Description   string   `json:"description,omitempty"`
	Filter        struct {
		Kind      string   `json:"kind"`
		Lifecycle []string `json:"lifecycle,omitempty"`
		Owners    []string `json:"owners,omitempty"`
		Scopes    []string `json:"scopes,omitempty"`
		Tags      []string `json:"tags,omitempty"`
		Type      string   `json:"type,omitempty"`
	} `json:"filter"`
	Identifier        string  `json:"identifier"`
	Name              string  `json:"name"`
	OnDemand          bool    `json:"on_demand,omitempty"`
	Percentage        float64 `json:"percentage,omitempty"`
	Published         bool    `json:"published"`
	WeightageStrategy string  `json:"weightage_strategy,omitempty"`
}

type ScorecardChecksDetails struct {
	Custom      bool    `json:"custom"`
	Description string  `json:"description,omitempty"`
	Identifier  string  `json:"identifier"`
	Name        string  `json:"name"`
	Weightage   float64 `json:"weightage,omitempty"`
}

type ScorecardResponse struct {
	Scorecard Scorecard `json:"scorecard,omitempty"`
}

type Scorecard struct {
	Checks        []Check  `json:"checks"`
	ChecksMissing []string `json:"checks_missing,omitempty"`
	Components    int      `json:"components,omitempty"`
	Description   string   `json:"description,omitempty"`
	Identifier    string   `json:"identifier"`
	Name          string   `json:"name"`
	Percentage    float64  `json:"percentage,omitempty"`
	Published     bool     `json:"published,omitempty"`
}

type Check struct {
	Custom      bool     `json:"custom"`
	Description string   `json:"description,omitempty"`
	Expression  string   `json:"expression,omitempty"`
	Identifier  string   `json:"identifier"`
	Name        string   `json:"name"`
	Tags        []string `json:"tags,omitempty"`
}

type GetAllScorecardSummaryParams struct {
	EntityIdentifier string `form:"entity_identifier" json:"entity_identifier"`
	HarnessAccount   string `json:"Harness-Account,omitempty"`
}

type ScorecardSummaryResponse struct {
	ScorecardsSummary []ScorecardSummaryInfo `json:"scorecards_summary"`
}

type ScorecardSummaryInfo struct {
	ChecksStatuses      []CheckStatus            `json:"checks_statuses"`
	Description         string                   `json:"description"`
	RecalibrateInfo     ScorecardRecalibrateInfo `json:"recalibrate_info,omitempty"`
	Score               int                      `json:"score"`
	ScorecardIdentifier string                   `json:"scorecard_identifier"`
	ScorecardName       string                   `json:"scorecard_name"`
	Timestamp           int64                    `json:"timestamp"`
}

type CheckStatus struct {
	Custom     bool   `json:"custom,omitempty"`
	Identifier string `json:"identifier,omitempty"`
	Name       string `json:"name"`
	Reason     string `json:"reason,omitempty"`
	Status     string `json:"status"`
	Weight     int    `json:"weight"`
}

type ScorecardRecalibrateInfo struct {
	StartTime int64   `json:"start_time,omitempty"`
	StartedBy IDPUser `json:"started_by,omitempty"`
}

type IDPUser struct {
	Email string `json:"email,omitempty"`
	Name  string `json:"name,omitempty"`
	Uuid  string `json:"uuid,omitempty"`
}

type ScorecardScoreResponse struct {
	OverallScore    int              `json:"overall_score"`
	ScorecardScores []ScorecardScore `json:"scorecard_scores"`
}

type ScorecardScore struct {
	Description   string `json:"description"`
	Score         int    `json:"score"`
	ScorecardName string `json:"scorecard_name"`
}

// ScorecardStats ScorecardStats
type ScorecardStats struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Owner     string `json:"owner"`
	Score     int    `json:"score"`
	System    string `json:"system"`
	Type      string `json:"type"`
}

// ScorecardStatsResponse ScorecardStatsResponse
type ScorecardStatsResponse struct {
	Name      string           `json:"name"`
	Stats     []ScorecardStats `json:"stats"`
	Timestamp *int64           `json:"timestamp,omitempty"`
}

type GetChecksParams struct {
	Page       int32
	Limit      int32
	Sort       string
	SearchTerm string
}

type CheckResponseList = []CheckResponse

type CheckListItem struct {
	Custom      bool      `json:"custom"`
	DataSource  []string  `json:"data_source"`
	Description *string   `json:"description,omitempty"`
	Expression  *string   `json:"expression,omitempty"`
	Identifier  string    `json:"identifier"`
	Name        string    `json:"name"`
	Percentage  *float64  `json:"percentage,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`
}

type CheckResponse struct {
	Check *CheckListItem `json:"check,omitempty"`
}

type CheckDetails struct {
	Custom           bool      `json:"custom"`
	DefaultBehaviour string    `json:"default_behaviour"`
	Description      *string   `json:"description,omitempty"`
	Expression       *string   `json:"expression,omitempty"`
	FailMessage      *string   `json:"fail_message,omitempty"`
	HarnessManaged   *bool     `json:"harness_managed,omitempty"`
	Identifier       string    `json:"identifier"`
	Name             string    `json:"name"`
	Percentage       *float64  `json:"percentage,omitempty"`
	RuleStrategy     string    `json:"rule_strategy"`
	Rules            []Rule    `json:"rules"`
	Tags             *[]string `json:"tags,omitempty"`
}

type Rule struct {
	DataPointIdentifier  string        `json:"data_point_identifier"`
	DataSourceIdentifier string        `json:"data_source_identifier"`
	Identifier           *string       `json:"identifier,omitempty"`
	InputValues          *[]InputValue `json:"input_values,omitempty"`
	Operator             string        `json:"operator"`
	Value                *string       `json:"value,omitempty"`
}

type InputValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CheckDetailsResponse struct {
	CheckDetails CheckDetails `json:"check_details"`
}

type CheckStats struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Owner     string `json:"owner"`
	Status    string `json:"status"`
	System    string `json:"system"`
	Type      string `json:"type"`
}

type CheckStatsResponse struct {
	Name      string       `json:"name"`
	Stats     []CheckStats `json:"stats"`
	Timestamp *int64       `json:"timestamp,omitempty"`
}

type ExecuteWorkflowRequest struct {
	Identifier string      `json:"identifier"`
	Values     interface{} `json:"values,omitempty"`
}

type ExecuteWorkflowResponse struct {
	ExecutionID string `json:"id"`
}
