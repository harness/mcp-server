package license

import (
	"context"
	"log/slog"
	"sync"

	"github.com/harness/harness-mcp/client/license"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
)

// ClientFactory provides a centralized way to create license clients
// This eliminates DRY violations by providing a single source of truth for license client creation
type ClientFactory struct {
	config *config.Config
	logger *slog.Logger

	// Single instance of license client
	client      *license.CustomLicensesApiService
	clientMu    sync.RWMutex
	initialized bool
}

// NewClientFactory creates a new license client factory
func NewClientFactory(config *config.Config, logger *slog.Logger) *ClientFactory {
	return &ClientFactory{
		config:      config,
		logger:      logger,
		initialized: false,
	}
}

// CreateLicenseClient creates a license client using the standard configuration
// This method encapsulates the common license client creation logic used across the application
// It reuses a single client instance if already created
func (f *ClientFactory) CreateLicenseClient(ctx context.Context) (*license.CustomLicensesApiService, error) {
	// Check if we already have a client instance
	f.clientMu.RLock()
	if f.initialized && f.client != nil {
		client := f.client
		f.clientMu.RUnlock()
		return client, nil
	}
	f.clientMu.RUnlock()

	// Need to create a new client, acquire write lock
	f.clientMu.Lock()
	defer f.clientMu.Unlock()

	// Double-check that another goroutine hasn't created the client while we were waiting
	if f.initialized && f.client != nil {
		f.logger.Debug("Using existing license client (after lock)")
		return f.client, nil
	}

	f.logger.Debug("Creating new license client")

	// Use the NGManager service for license validation - same pattern as tools.go
	licenseClient, err := license.CreateCustomLicenseClientWithContext(
		ctx,
		f.config,
		f.config.NgManagerBaseURL,
		f.config.BaseURL,
		"ng/api",
		f.config.NgManagerSecret,
	)
	if err != nil {
		f.logger.Error("Failed to create license client", "error", err)
		return nil, err
	}

	// Store the client instance
	f.client = licenseClient
	f.initialized = true

	f.logger.Debug("Successfully created license client")
	return licenseClient, nil
}
