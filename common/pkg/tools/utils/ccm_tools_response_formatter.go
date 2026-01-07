package utils

import (
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
)

// ResponseFormatter defines the interface for formatting tool responses
type CCMResponseFormatter interface {
	FormatEC2AnalysisResponse(response *dto.CommitmentEC2AnalysisResponse) ([]mcp.Content, error)
}

// DefaultCCMResponseFormatter holds the active response formatter implementation
var DefaultCCMResponseFormatter CCMResponseFormatter

// SetCCMResponseFormatter sets the global CCM response formatter
func SetCCMResponseFormatter(formatter CCMResponseFormatter) {
	DefaultCCMResponseFormatter = formatter
}
