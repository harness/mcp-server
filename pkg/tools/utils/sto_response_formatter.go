package utils

import (
	"encoding/json"
	"fmt"

	stogenerated "github.com/harness/mcp-server/common/client/sto/generated"
	"github.com/harness/mcp-server/common/pkg/event/types"
	commonUtils "github.com/harness/mcp-server/common/pkg/tools/utils"
	"github.com/mark3labs/mcp-go/mcp"
)

// StoTextResponseFormatter formats STO responses as plain text/JSON (for external mode)
type StoTextResponseFormatter struct{}

// NewStoTextResponseFormatter creates a new text-based STO response formatter
func NewStoTextResponseFormatter() commonUtils.StoResponseFormatter {
	return &StoTextResponseFormatter{}
}

// FormatStoIssuesResponse formats STO security issues as JSON text
func (f *StoTextResponseFormatter) FormatStoIssuesResponse(response *stogenerated.FrontendAllIssuesListResponseBody) ([]mcp.Content, error) {
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
		row := commonUtils.BuildIssueRow(issue)
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
func (f *StoTextResponseFormatter) FormatStoExemptionsResponse(response *stogenerated.SecurityReviewResult, userNameMap map[string]string) ([]mcp.Content, error) {
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
		row := commonUtils.BuildExemptionRow(exemption, userNameMap)
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

// init registers the external STO response formatter
func init() {
	commonUtils.SetStoResponseFormatter(NewStoTextResponseFormatter())
}
