package utils

import (
	"encoding/json"
	"fmt"

	generated "github.com/harness/mcp-server/common/client/scs/generated"
	commonUtils "github.com/harness/mcp-server/common/pkg/tools/utils"
	"github.com/mark3labs/mcp-go/mcp"
)

// TextResponseFormatter formats responses as plain text/JSON (for external mode)
type TextResponseFormatter struct{}

// NewTextResponseFormatter creates a new text-based response formatter
func NewTextResponseFormatter() commonUtils.ResponseFormatter {
	return &TextResponseFormatter{}
}

// FormatArtifactSourcesResponse formats artifact sources as JSON text
func (f *TextResponseFormatter) FormatArtifactSourcesResponse(artifacts []generated.ArtifactV2ListingResponse, licenseFilterList *[]generated.LicenseFilter) ([]mcp.Content, error) {
	// For external mode, return the raw data as JSON text
	rawJSON, err := json.Marshal(artifacts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal response: %w", err)
	}

	return []mcp.Content{
		mcp.NewTextContent(string(rawJSON)),
	}, nil
}

// FormatCodeRepositoriesResponse formats code repositories as JSON text
func (f *TextResponseFormatter) FormatCodeRepositoriesResponse(repositories []generated.CodeRepositoryListingResponse) ([]mcp.Content, error) {
	// For external mode, return the raw data as JSON text
	rawJSON, err := json.Marshal(repositories)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal response: %w", err)
	}

	return []mcp.Content{
		mcp.NewTextContent(string(rawJSON)),
	}, nil
}

// init registers the external SCS response formatter
func init() {
	commonUtils.SetResponseFormatter(NewTextResponseFormatter())
}
