package utils

import (
	"context"

	"github.com/harness/harness-mcp/client/license"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
)

// CreateLicenseClient creates a license client with the appropriate authentication method based on the config
// It handles both internal and external modes with the correct authentication
func CreateLicenseClient(config *config.Config, licenseBaseURL, baseURL, path, secret string) (*license.CustomLicensesApiService, error) {
	return license.CreateCustomLicenseClient(config, licenseBaseURL, baseURL, path, secret)
}

// CreateLicenseClientWithContext creates a license client with the appropriate authentication method based on the config
// It handles both internal and external modes with the correct authentication
// The context is used for JWT authentication in internal mode
func CreateLicenseClientWithContext(ctx context.Context, config *config.Config, licenseBaseURL, baseURL, path, secret string) (*license.CustomLicensesApiService, error) {
	return license.CreateCustomLicenseClientWithContext(ctx, config, licenseBaseURL, baseURL, path, secret)
}
