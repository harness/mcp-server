package utils

import (
	generated "github.com/harness/mcp-server/common/client/scs/generated"
	"github.com/mark3labs/mcp-go/mcp"
)

// ResponseFormatter defines the interface for formatting tool responses
// Different implementations can be used for external (text) vs internal (table events) modes
type ResponseFormatter interface {
	// FormatArtifactSourcesResponse formats the artifact sources response
	// Receives raw artifact data and returns formatted MCP content
	// Internal mode can create custom rows/columns, external mode returns JSON
	FormatArtifactSourcesResponse(artifacts []generated.ArtifactV2ListingResponse, licenseFilterList *[]generated.LicenseFilter) ([]mcp.Content, error)
	// FormatCodeRepositoriesResponse formats code repositories as table events
	FormatCodeRepositoriesResponse(repositories []generated.CodeRepositoryListingResponse) ([]mcp.Content, error)
}

// DefaultResponseFormatter holds the active response formatter implementation
// This should be set during initialization based on deployment mode
var DefaultResponseFormatter ResponseFormatter

// SetResponseFormatter sets the global response formatter
func SetResponseFormatter(formatter ResponseFormatter) {
	DefaultResponseFormatter = formatter
}
