package tools

import (
	"fmt"

	"github.com/harness/harness-mcp/client/scs"
	generated "github.com/harness/harness-mcp/client/scs/generated"

	"github.com/mark3labs/mcp-go/mcp"
)

func bindParam[T any](
	r mcp.CallToolRequest,
	key string,
	setter func(T),
) error {
	v, err := ExtractParam[T](r, key)
	if err != nil {
		return fmt.Errorf("%s invalid: %w", key, err)
	}
	setter(v)
	return nil
}

// ParseArtifactListParams extracts and normalizes order, sort, page, size, and returns a sortVal interface{} for use in ListArtifactSourcesParams.
func ParseArtifactListParams(request mcp.CallToolRequest) (order string, sort string, page int, size int, sortVal interface{}) {
	order, _ = OptionalParam[string](request, "order")
	if order != "ASC" && order != "DESC" {
		order = "DESC"
	}
	sort, _ = OptionalParam[string](request, "sort")
	page, size, _ = FetchPagination(request)
	size = 5
	sortVal = interface{}(sort)
	return
}

// BuildArtifactListingBody builds the request body for listing artifact sources using bindParam and the builder pattern.
func BuildArtifactListingBody(request mcp.CallToolRequest) (generated.ArtifactListingRequestBody, error) {
	bb := scs.ArtifactListingRequestBodyBuilder()
	if err := bindParam(request, "artifact_type", func(v []generated.ArtifactType) { bb.WithArtifactType(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	if err := bindParam(request, "component_filter", func(v []generated.ComponentFilter) { bb.WithComponentFilter(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	if err := bindParam(request, "environment_type", func(v generated.ArtifactListingRequestBodyEnvironmentType) { bb.WithEnvironmentType(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	if err := bindParam(request, "license_filter", func(v generated.LicenseFilter) { bb.WithLicenseFilter(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	if err := bindParam(request, "license_filter_list", func(v []generated.LicenseFilter) { bb.WithLicenseFilterList(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	if err := bindParam(request, "policy_violation", func(v generated.ArtifactListingRequestBodyPolicyViolation) { bb.WithPolicyViolation(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	if err := bindParam(request, "search_term", func(v string) { bb.WithSearchTerm(v) }); err != nil {
		return generated.ArtifactListingRequestBody{}, err
	}
	return bb.Build(), nil
}

// buildCodeRepositoryListingBody builds the request body for listing code repositories using bindParam and the builder pattern.
func buildCodeRepositoryListingBody(request mcp.CallToolRequest) (generated.CodeRepositoryListingRequestBody, error) {
	bb := scs.CodeRepositoryListingRequestBodyBuilder()
	if err := bindParam(request, "dependency_filter", func(v []generated.ComponentFilter) { bb.WithDependencyFilter(v) }); err != nil {
		return generated.CodeRepositoryListingRequestBody{}, err
	}
	if err := bindParam(request, "license_filter", func(v generated.LicenseFilter) { bb.WithLicenseFilter(v) }); err != nil {
		return generated.CodeRepositoryListingRequestBody{}, err
	}
	if err := bindParam(request, "search_term", func(v string) { bb.WithSearchTerm(v) }); err != nil {
		return generated.CodeRepositoryListingRequestBody{}, err
	}
	return bb.Build(), nil
}

// BuildComplianceResultByArtifactFilter builds the request body for compliance results by artifact using bindParam and the builder pattern.
func BuildComplianceResultByArtifactFilter(request mcp.CallToolRequest) (generated.ComplianceResultByArtifactFilter, error) {
	bb := scs.ComplianceResultByArtifactFilterBuilder()
	if err := bindParam(request, "compliance_id", func(v string) { bb.WithComplianceId(v) }); err != nil {
		return generated.ComplianceResultByArtifactFilter{}, err
	}
	if err := bindParam(request, "search_term", func(v string) { bb.WithSearchTerm(v) }); err != nil {
		return generated.ComplianceResultByArtifactFilter{}, err
	}
	if err := bindParam(request, "severity", func(v generated.ComplianceCheckSeverity) { bb.WithSeverity(v) }); err != nil {
		return generated.ComplianceResultByArtifactFilter{}, err
	}
	if err := bindParam(request, "standards", func(v []generated.ComplianceStandardType) { bb.WithStandards(v) }); err != nil {
		return generated.ComplianceResultByArtifactFilter{}, err
	}
	if err := bindParam(request, "status", func(v []generated.ComplianceResultStatus) { bb.WithStatus(v) }); err != nil {
		return generated.ComplianceResultByArtifactFilter{}, err
	}
	return bb.Build(), nil
}
