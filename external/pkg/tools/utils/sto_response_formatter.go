package utils

import (
	"encoding/json"
	"fmt"
	"time"

	stogenerated "github.com/harness/mcp-server/common/client/sto/generated"
	"github.com/harness/mcp-server/common/pkg/event/types"
	commonUtils "github.com/harness/mcp-server/common/pkg/tools/utils"
	"github.com/mark3labs/mcp-go/mcp"
)

// TextStoResponseFormatter formats STO responses as plain text/JSON (for external mode)
type TextStoResponseFormatter struct{}

// NewTextStoResponseFormatter creates a new text-based STO response formatter
func NewTextStoResponseFormatter() commonUtils.StoResponseFormatter {
	return &TextStoResponseFormatter{}
}

// FormatStoIssuesResponse formats STO security issues as JSON text
func (f *TextStoResponseFormatter) FormatStoIssuesResponse(response *stogenerated.FrontendAllIssuesListResponseBody) ([]mcp.Content, error) {
	contents := []mcp.Content{}

	// Create table columns
	columns := []types.TableColumn{
		{Key: "TITLE", Label: "Title"},
		{Key: "SEVERITY", Label: "Severity"},
		{Key: "ISSUE_TYPE", Label: "Issue Type"},
		{Key: "TARGETS_IMPACTED", Label: "Targets Impacted"},
		{Key: "OCCURRENCES", Label: "Occurrences"},
		{Key: "LAST_DETECTED", Label: "Last Detected"},
		{Key: "EXEMPTION_STATUS", Label: "Exemption Status"},
	}

	// Build rows from issues
	rows := []map[string]interface{}{}
	for _, issue := range response.Issues {
		row := buildIssueRow(issue)
		rows = append(rows, row)
	}

	// Create table event
	tableData := types.TableData{
		Columns: columns,
		Rows:    rows,
	}

	tableJSON, err := json.Marshal(tableData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal table data: %w", err)
	}
	raw, err := json.Marshal(response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal response: %w", err)
	}
	contents = append(contents, mcp.NewTextContent(string(tableJSON)))
	contents = append(contents, mcp.NewTextContent(string(raw)))

	return contents, nil
}

// FormatStoExemptionsResponse formats STO global exemptions as JSON text
func (f *TextStoResponseFormatter) FormatStoExemptionsResponse(response *stogenerated.SecurityReviewResult, userNameMap map[string]string) ([]mcp.Content, error) {
	contents := []mcp.Content{}

	// Determine if we're showing approved exemptions (affects columns)
	showingApprovedExemptions := false
	for _, e := range response.Exemptions {
		if e.ApproverId != nil && *e.ApproverId != "" {
			showingApprovedExemptions = true
			break
		}
	}

	// Create table columns
	var columns []types.TableColumn
	if showingApprovedExemptions {
		columns = []types.TableColumn{
			{Key: "ISSUE", Label: "Issue"},
			{Key: "SEVERITY", Label: "Severity"},
			{Key: "SCOPE", Label: "Scope"},
			{Key: "REASON", Label: "Reason"},
			{Key: "EXEMPTION_DURATION", Label: "Exemption Duration"},
			{Key: "REQUESTED_BY", Label: "Requested By"},
			{Key: "APPROVED_BY", Label: "Approved By"},
			{Key: "STATUS", Label: "Status"},
		}
	} else {
		columns = []types.TableColumn{
			{Key: "ISSUE", Label: "Issue"},
			{Key: "SEVERITY", Label: "Severity"},
			{Key: "SCOPE", Label: "Scope"},
			{Key: "REASON", Label: "Reason"},
			{Key: "EXEMPTION_DURATION", Label: "Exemption Duration"},
			{Key: "REQUESTED_BY", Label: "Requested By"},
			{Key: "STATUS", Label: "Status"},
		}
	}

	// Build rows from exemptions
	rows := []map[string]interface{}{}
	for _, exemption := range response.Exemptions {
		row := buildExemptionRow(exemption, userNameMap)
		rows = append(rows, row)
	}

	// Create table event
	tableData := types.TableData{
		Columns: columns,
		Rows:    rows,
	}

	tableJSON, err := json.Marshal(tableData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal table data: %w", err)
	}
	contents = append(contents, mcp.NewTextContent(string(tableJSON)))

	rawJSON, err := json.Marshal(response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal response: %w", err)
	}
	contents = append(contents, mcp.NewTextContent(string(rawJSON)))

	return contents, nil
}

// buildIssueRow creates a table row from an STO issue
func buildIssueRow(issue stogenerated.AllIssueSummary) map[string]interface{} {
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
func buildExemptionRow(e stogenerated.FrontendExemption, userNameMap map[string]string) map[string]interface{} {
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

// init registers the external STO response formatter
func init() {
	commonUtils.SetStoResponseFormatter(NewTextStoResponseFormatter())
}
