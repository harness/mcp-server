package tools

import (
	generated "github.com/harness/mcp-server/common/client/scs/generated"
)

// OPAContent represents the structure for OPA policy content
type OPAContent struct {
	Policy struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	} `json:"policy"`
	Metadata struct {
		DeniedLicenses []string `json:"denied_licenses"`
	} `json:"metadata"`
}

// SbomDownloadResponse represents the response containing SBOM download URL
type SbomDownloadResponse struct {
	OrchestrationID string `json:"orchestration_id"`
	DownloadURL     string `json:"download_url"`
	Message         string `json:"message"`
}

// PaginationInfo represents pagination metadata from response headers
type PaginationInfo struct {
	PageNumber    int `json:"page_number"`
	PageSize      int `json:"page_size"`
	TotalElements int `json:"total_elements"`
}

// CodeReposListResponse wraps the code repositories list with pagination info
type CodeReposListResponse struct {
	Pagination   PaginationInfo                               `json:"pagination"`
	Repositories *generated.CodeRepositoryListingResponseBody `json:"repositories"`
}

// ArtifactSourcesListResponse wraps the artifact sources list with pagination info
type ArtifactSourcesListResponse struct {
	Pagination PaginationInfo                        `json:"pagination"`
	Artifacts  []generated.ArtifactV2ListingResponse `json:"artifacts"`
}

// URLContent represents the content for a URL event
type URLContent struct {
	URL     string `json:"url"`
	Label   string `json:"label,omitempty"`
	Message string `json:"message,omitempty"`
}
