package utils

import (
	"fmt"
	"time"

	stogenerated "github.com/harness/mcp-server/common/client/sto/generated"
	"github.com/mark3labs/mcp-go/mcp"
)

// StoResponseFormatter defines the interface for formatting STO tool responses
// Different implementations can be used for external (text) vs internal (table events) modes
type StoResponseFormatter interface {
	// FormatStoIssuesResponse formats STO security issues
	FormatStoIssuesResponse(response *stogenerated.FrontendAllIssuesListResponseBody) ([]mcp.Content, error)
	// FormatStoExemptionsResponse formats STO global exemptions with user info
	FormatStoExemptionsResponse(response *stogenerated.SecurityReviewResult, userNameMap map[string]string) ([]mcp.Content, error)
}

// DefaultStoResponseFormatter holds the active STO response formatter implementation
// This should be set during initialization based on deployment mode
var DefaultStoResponseFormatter StoResponseFormatter

// SetStoResponseFormatter sets the global STO response formatter
func SetStoResponseFormatter(formatter StoResponseFormatter) {
	DefaultStoResponseFormatter = formatter
}

// buildIssueRow creates a table row from an STO issue
func BuildIssueRow(issue stogenerated.AllIssueSummary) map[string]interface{} {
	var formattedDate interface{} = issue.LastDetected
	if tsInt, ok := formattedDate.(int64); ok {
		t := time.Unix(tsInt, 0)
		formattedDate = t.Format("02/01/2006 15:04")
	}
	row := map[string]interface{}{
		"SEVERITY":         issue.SeverityCode,
		"ISSUE_TYPE":       issue.IssueType,
		"TITLE":            issue.Title,
		"TARGETS_IMPACTED": issue.NumTargetsImpacted,
		"OCCURRENCES":      issue.NumOccurrences,
		"LAST_DETECTED":    formattedDate,
		"EXEMPTION_STATUS": issue.ExemptionStatus,
	}

	return row
}

// buildExemptionRow creates a table row from an STO exemption
func BuildExemptionRow(e stogenerated.FrontendExemption, userNameMap map[string]string) map[string]interface{} {
	duration := ""
	if e.Expiration != nil {
		seconds := *e.Expiration - e.Created
		days := seconds / 86400
		duration = fmt.Sprintf("%dd", days)
	} else if e.PendingChanges.DurationDays != nil {
		duration = fmt.Sprintf("%dd", *e.PendingChanges.DurationDays)
	}

	row := map[string]interface{}{
		"ExemptionId":        e.Id,
		"SEVERITY":           e.IssueSummary.SeverityCode,
		"ISSUE":              e.IssueSummary.Title,
		"SCOPE":              e.Scope,
		"REASON":             e.Reason,
		"EXEMPTION_DURATION": duration,
		"OrgId":              e.OrgId,
		"ProjectId":          e.ProjectId,
		"PipelineId":         e.PipelineId,
		"TargetId":           e.TargetId,
		"STATUS":             e.Status,
	}
	row["REQUESTED_BY"] = userNameMap[e.RequesterId]
	if e.ApproverId != nil && *e.ApproverId != "" {
		row["APPROVED_BY"] = userNameMap[*e.ApproverId]
	}

	return row
}