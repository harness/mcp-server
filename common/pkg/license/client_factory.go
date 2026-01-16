package license

import (
	"sync"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/license"
	"log/slog"
)

// ClientFactory provides a centralized way to create license clients
// This eliminates DRY violations by providing a single source of truth for license client creation
type ClientFactory struct {
	Config *config.McpServerConfig
	Logger *slog.Logger

	// Single instance of license client
	Client      *license.CustomLicensesApiService
	ClientMu    sync.RWMutex
	Initialized bool
}

// NewClientFactory creates a new license client factory
func NewClientFactory(config *config.McpServerConfig, logger *slog.Logger) *ClientFactory {
	return &ClientFactory{
		Config:      config,
		Logger:      logger,
		Initialized: false,
	}
}
