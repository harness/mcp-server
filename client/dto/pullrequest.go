package dto

import "encoding/json"

// PullRequest represents a pull request in the system
type PullRequest struct {
	Author            PullRequestAuthor       `json:"author,omitempty"`
	CheckSummary      PullRequestCheckSummary `json:"check_summary,omitempty"`
	Closed            int64                   `json:"closed,omitempty"`
	Created           int64                   `json:"created,omitempty"`
	Description       string                  `json:"description,omitempty"`
	Edited            int64                   `json:"edited,omitempty"`
	IsDraft           bool                    `json:"is_draft,omitempty"`
	Labels            []PullRequestLabel      `json:"labels,omitempty"`
	MergeBaseSha      string                  `json:"merge_base_sha,omitempty"`
	MergeCheckStatus  string                  `json:"merge_check_status,omitempty"`
	MergeConflicts    []string                `json:"merge_conflicts,omitempty"`
	MergeMethod       string                  `json:"merge_method,omitempty"`
	MergeTargetSha    string                  `json:"merge_target_sha,omitempty"`
	Merged            int64                   `json:"merged,omitempty"`
	Merger            PullRequestAuthor       `json:"merger,omitempty"`
	Number            int                     `json:"number,omitempty"`
	RebaseCheckStatus string                  `json:"rebase_check_status,omitempty"`
	RebaseConflicts   []string                `json:"rebase_conflicts,omitempty"`
	Rules             []PullRequestRule       `json:"rules,omitempty"`
	SourceBranch      string                  `json:"source_branch,omitempty"`
	SourceRepoID      int                     `json:"source_repo_id,omitempty"`
	SourceSha         string                  `json:"source_sha,omitempty"`
	State             string                  `json:"state,omitempty"`
	Stats             PullRequestStats        `json:"stats,omitempty"`
	TargetBranch      string                  `json:"target_branch,omitempty"`
	TargetRepoID      int                     `json:"target_repo_id,omitempty"`
	Title             string                  `json:"title,omitempty"`
	Updated           int64                   `json:"updated,omitempty"`
}

// PullRequestAuthor represents a user in the pull request system
type PullRequestAuthor struct {
	Created     int64  `json:"created,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	Email       string `json:"email,omitempty"`
	ID          int    `json:"id,omitempty"`
	Type        string `json:"type,omitempty"`
	UID         string `json:"uid,omitempty"`
	Updated     int64  `json:"updated,omitempty"`
}

// PullRequestCheckSummary represents the summary of checks for a pull request
type PullRequestCheckSummary struct {
	Error   int `json:"error,omitempty"`
	Failure int `json:"failure,omitempty"`
	Pending int `json:"pending,omitempty"`
	Running int `json:"running,omitempty"`
	Success int `json:"success,omitempty"`
}

// PullRequestLabel represents a label on a pull request
type PullRequestLabel struct {
	Color      string `json:"color,omitempty"`
	ID         int    `json:"id,omitempty"`
	Key        string `json:"key,omitempty"`
	Scope      int    `json:"scope,omitempty"`
	Value      string `json:"value,omitempty"`
	ValueColor string `json:"value_color,omitempty"`
	ValueCount int    `json:"value_count,omitempty"`
	ValueID    int    `json:"value_id,omitempty"`
}

// PullRequestRule represents a rule for a pull request
type PullRequestRule struct {
	Identifier string `json:"identifier,omitempty"`
	RepoPath   string `json:"repo_path,omitempty"`
	SpacePath  string `json:"space_path,omitempty"`
	State      string `json:"state,omitempty"`
	Type       string `json:"type,omitempty"`
}

// PullRequestStats represents statistics for a pull request
type PullRequestStats struct {
	Additions       int `json:"additions,omitempty"`
	Commits         int `json:"commits,omitempty"`
	Conversations   int `json:"conversations,omitempty"`
	Deletions       int `json:"deletions,omitempty"`
	FilesChanged    int `json:"files_changed,omitempty"`
	UnresolvedCount int `json:"unresolved_count,omitempty"`
}

// CreatePullRequest represents the request body for creating a new pull request
type CreatePullRequest struct {
	Title        string `json:"title"`
	Description  string `json:"description,omitempty"`
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch,omitempty"`
	IsDraft      bool   `json:"is_draft,omitempty"`
}

// PullRequestCheckPayload represents the payload for a pull request check
type PullRequestCheckPayload struct {
	Data    interface{} `json:"data"`
	Kind    string      `json:"kind"`
	Version string      `json:"version,omitempty"`
}

// PullRequestCheckReporter represents the entity that reported a check
type PullRequestCheckReporter struct {
	Created     int64  `json:"created,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	Email       string `json:"email,omitempty"`
	ID          int    `json:"id,omitempty"`
	Type        string `json:"type,omitempty"`
	UID         string `json:"uid,omitempty"`
	Updated     int64  `json:"updated,omitempty"`
}

// PullRequestCheck represents a status check for a pull request
type PullRequestCheck struct {
	Created    int64                    `json:"created,omitempty"`
	Ended      int64                    `json:"ended,omitempty"`
	ID         int                      `json:"id,omitempty"`
	Identifier string                   `json:"identifier,omitempty"`
	Link       string                   `json:"link,omitempty"`
	Metadata   interface{}              `json:"metadata"`
	Payload    PullRequestCheckPayload  `json:"payload,omitempty"`
	ReportedBy PullRequestCheckReporter `json:"reported_by,omitempty"`
	Started    int64                    `json:"started,omitempty"`
	Status     string                   `json:"status,omitempty"`
	Summary    string                   `json:"summary,omitempty"`
	Updated    int64                    `json:"updated,omitempty"`
}

// PullRequestCheckInfo represents a check with additional information
type PullRequestCheckInfo struct {
	Bypassable bool             `json:"bypassable,omitempty"`
	Check      PullRequestCheck `json:"check,omitempty"`
	Required   bool             `json:"required,omitempty"`
}

// PullRequestChecksResponse represents the response from the checks API
type PullRequestChecksResponse struct {
	Checks    []PullRequestCheckInfo `json:"checks,omitempty"`
	CommitSha string                 `json:"commit_sha,omitempty"`
}

// PullRequestOptions represents the options for listing pull requests
type PullRequestOptions struct {
	State         []string `json:"state,omitempty"`
	SourceRepoRef string   `json:"source_repo_ref,omitempty"`
	SourceBranch  string   `json:"source_branch,omitempty"`
	TargetBranch  string   `json:"target_branch,omitempty"`
	Query         string   `json:"query,omitempty"`
	CreatedBy     []int    `json:"created_by,omitempty"`
	Order         string   `json:"order,omitempty"`
	Sort          string   `json:"sort,omitempty"`
	CreatedLt     int64    `json:"created_lt,omitempty"`
	CreatedGt     int64    `json:"created_gt,omitempty"`
	UpdatedLt     int64    `json:"updated_lt,omitempty"`
	UpdatedGt     int64    `json:"updated_gt,omitempty"`
	Page          int      `json:"page,omitempty"`
	Limit         int      `json:"limit,omitempty"`
	AuthorID      int      `json:"author_id,omitempty"`
	IncludeChecks bool     `json:"include_checks,omitempty"`
}

// PullRequestActivity represents an activity on a pull request
type PullRequestActivity struct {
	ID          int             `json:"id,omitempty"`
	Type        string          `json:"type,omitempty"`
	Created     int64           `json:"created,omitempty"`
	Updated     int64           `json:"updated,omitempty"`
	Edited      int64           `json:"edited,omitempty"`
	ParentID    int             `json:"parent_id,omitempty"`
	RepoID      int64           `json:"repo_id"`
	PullReqID   int64           `json:"pullreq_id"`
	Kind        string          `json:"kind,omitempty"`
	Text        string          `json:"text,omitempty"`
	CodeComment CodeComment     `json:"code_comment,omitempty"`
	Metadata    interface{}     `json:"metadata,omitempty"`
	Resolved    int64           `json:"resolved,omitempty"`
	PayloadRaw  json.RawMessage `json:"payload"`
}

// PullRequestActivitiesResponse represents the response from the activities API
// It's a direct slice of activities as the API returns an array
type PullRequestActivitiesResponse []PullRequestActivity

type CodeComment struct {
	Outdated     bool   `json:"outdated,omitempty"`
	MergeBaseSHA string `json:"merge_base_sha,omitempty"`
	SourceSHA    string `json:"source_sha,omitempty"`
	Path         string `json:"path,omitempty"`
	LineNew      int    `json:"line_new,omitempty"`
	SpanNew      int    `json:"span_new,omitempty"`
	LineOld      int    `json:"line_old,omitempty"`
	SpanOld      int    `json:"span_old,omitempty"`
}

// PullRequestActivityOptions defines options for listing PR activities
type PullRequestActivityOptions struct {
	AccountIdentifier string   `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string   `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string   `json:"projectIdentifier,omitempty"`
	Kind              []string `json:"kind,omitempty"`
	Type              []string `json:"type,omitempty"`
	After             int64    `json:"after,omitempty"`
	Before            int64    `json:"before,omitempty"`
	Limit             int      `json:"limit,omitempty"`
	Page              int      `json:"page,omitempty"`
}
