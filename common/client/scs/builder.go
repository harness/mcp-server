package scs

import "github.com/harness/mcp-server/common/client/scs/generated"

type artifactListingRequestBodyBuilder struct {
	b generated.ArtifactListingRequestBody
}

func ArtifactListingRequestBodyBuilder() *artifactListingRequestBodyBuilder {
	return &artifactListingRequestBodyBuilder{b: generated.ArtifactListingRequestBody{}}
}

func (bb *artifactListingRequestBodyBuilder) WithArtifactType(v []generated.ArtifactType) *artifactListingRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.ArtifactType = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithComponentFilter(v []generated.ComponentFilter) *artifactListingRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.ComponentFilter = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithEnvironmentType(v generated.ArtifactListingRequestBodyEnvironmentType) *artifactListingRequestBodyBuilder {
	if v != "" {
		bb.b.EnvironmentType = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithLicenseFilter(v generated.LicenseFilter) *artifactListingRequestBodyBuilder {
	// assuming LicenseFilter is a struct with zero-value checkable
	var zero generated.LicenseFilter
	if v != zero {
		bb.b.LicenseFilter = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithLicenseFilterList(v []generated.LicenseFilter) *artifactListingRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.LicenseFilterList = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithPolicyViolation(v generated.ArtifactListingRequestBodyPolicyViolation) *artifactListingRequestBodyBuilder {
	if v != "" {
		bb.b.PolicyViolation = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithSearchTerm(v string) *artifactListingRequestBodyBuilder {
	if v != "" {
		bb.b.SearchTerm = &v
	}
	return bb
}
func (bb *artifactListingRequestBodyBuilder) WithVerificationStatus(v generated.VerificationStatus) *artifactListingRequestBodyBuilder {
	if v != "" {
		bb.b.VerificationStatus = &v
	}
	return bb
}

func (bb *artifactListingRequestBodyBuilder) Build() generated.ArtifactListingRequestBody {
	return bb.b
}

type codeRepositoryListingRequestBodyBuilder struct {
	b generated.CodeRepositoryListingRequestBody
}

type complianceResultByArtifactFilterBuilder struct {
	b generated.ComplianceResultByArtifactFilter
}

func ComplianceResultByArtifactFilterBuilder() *complianceResultByArtifactFilterBuilder {
	return &complianceResultByArtifactFilterBuilder{b: generated.ComplianceResultByArtifactFilter{}}
}

func (bb *complianceResultByArtifactFilterBuilder) WithComplianceId(v string) *complianceResultByArtifactFilterBuilder {
	if v != "" {
		bb.b.ComplianceId = &v
	}
	return bb
}

func (bb *complianceResultByArtifactFilterBuilder) WithSearchTerm(v string) *complianceResultByArtifactFilterBuilder {
	if v != "" {
		bb.b.SearchTerm = &v
	}
	return bb
}

func (bb *complianceResultByArtifactFilterBuilder) WithSeverity(v generated.ComplianceCheckSeverity) *complianceResultByArtifactFilterBuilder {
	if v != "" {
		bb.b.Severity = &v
	}
	return bb
}

func (bb *complianceResultByArtifactFilterBuilder) WithStandards(v []generated.ComplianceStandardType) *complianceResultByArtifactFilterBuilder {
	if len(v) > 0 {
		bb.b.Standards = &v
	}
	return bb
}

func (bb *complianceResultByArtifactFilterBuilder) WithStatus(v []generated.ComplianceResultStatus) *complianceResultByArtifactFilterBuilder {
	if len(v) > 0 {
		bb.b.Status = &v
	}
	return bb
}

func (bb *complianceResultByArtifactFilterBuilder) Build() generated.ComplianceResultByArtifactFilter {
	return bb.b
}

func CodeRepositoryListingRequestBodyBuilder() *codeRepositoryListingRequestBodyBuilder {
	return &codeRepositoryListingRequestBodyBuilder{b: generated.CodeRepositoryListingRequestBody{}}
}

func (bb *codeRepositoryListingRequestBodyBuilder) WithDependencyFilter(v []generated.ComponentFilter) *codeRepositoryListingRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.DependencyFilter = &v
	}
	return bb
}

func (bb *codeRepositoryListingRequestBodyBuilder) WithLicenseFilter(v generated.LicenseFilter) *codeRepositoryListingRequestBodyBuilder {
	var zero generated.LicenseFilter
	if v != zero {
		bb.b.LicenseFilter = &v
	}
	return bb
}

func (bb *codeRepositoryListingRequestBodyBuilder) WithSearchTerm(v string) *codeRepositoryListingRequestBodyBuilder {
	if v != "" {
		bb.b.SearchTerm = &v
	}
	return bb
}

func (bb *codeRepositoryListingRequestBodyBuilder) Build() generated.CodeRepositoryListingRequestBody {
	return bb.b
}

type artifactComponentViewRequestBodyBuilder struct {
	b generated.ArtifactComponentViewRequestBody
}

func ArtifactComponentViewRequestBodyBuilder() *artifactComponentViewRequestBodyBuilder {
	// Initialize with empty arrays for required fields
	emptyComponentFilter := []generated.ComponentFilter{}
	return &artifactComponentViewRequestBodyBuilder{b: generated.ArtifactComponentViewRequestBody{
		ComponentFilter: &emptyComponentFilter,
	}}
}

func (bb *artifactComponentViewRequestBodyBuilder) WithComponentFilter(v []generated.ComponentFilter) *artifactComponentViewRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.ComponentFilter = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) WithDependencyTypeFilter(v []generated.DependencyType) *artifactComponentViewRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.DependencyTypeFilter = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) WithImageLayer(v generated.LayerType) *artifactComponentViewRequestBodyBuilder {
	if v != nil {
		bb.b.ImageLayer = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) WithLicenseFilter(v generated.LicenseFilter) *artifactComponentViewRequestBodyBuilder {
	var zero generated.LicenseFilter
	if v != zero {
		bb.b.LicenseFilter = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) WithOwaspFilter(v []generated.OwaspFilter) *artifactComponentViewRequestBodyBuilder {
	if len(v) > 0 {
		bb.b.OwaspFilter = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) WithPackageManager(v string) *artifactComponentViewRequestBodyBuilder {
	if v != "" {
		bb.b.PackageManager = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) WithPackageSupplier(v string) *artifactComponentViewRequestBodyBuilder {
	if v != "" {
		bb.b.PackageSupplier = &v
	}
	return bb
}

func (bb *artifactComponentViewRequestBodyBuilder) Build() generated.ArtifactComponentViewRequestBody {
	return bb.b
}
