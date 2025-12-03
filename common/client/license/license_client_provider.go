package license

import (
	"context"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	config "github.com/harness/mcp-server/common"
)

// LicenseClientProvider defines the interface for creating license clients
// This allows different implementations for internal and external modes
type LicenseClientProvider interface {
	// BuildServiceURL constructs the appropriate service URL
	BuildServiceURL(config *config.Config, internalBaseURL, externalBaseURL, externalPathPrefix string) string

	// CreateClient creates a license client with appropriate authentication
	CreateClient(ctx context.Context, config *config.Config, licenseBaseURL, baseURL, path, secret string) (*CustomLicensesApiService, error)

	// ConfigureAuth sets up authentication for the client configuration
	ConfigureAuth(ctx context.Context, cfg *nextgen.Configuration, config *config.Config, secret string) error
}

// DefaultProvider holds the active provider implementation
var DefaultProvider LicenseClientProvider
