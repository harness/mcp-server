package license

import (
	"context"

	"github.com/harness/mcp-server/common/client/license"
)

// ClientFactoryProvider defines the interface for mode-specific client creation logic
// This allows different implementations for internal and external modes
type ClientFactoryProvider interface {
	// CreateLicenseClient creates a license client with mode-specific logic
	CreateLicenseClient(ctx context.Context, factory *ClientFactory) (*license.CustomLicensesApiService, error)
}

// DefaultFactoryProvider holds the active high-level factory provider implementation
var DefaultFactoryProvider ClientFactoryProvider
