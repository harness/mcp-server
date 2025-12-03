package utils

import (
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