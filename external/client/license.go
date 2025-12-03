package client

import (
	"context"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	config "github.com/harness/mcp-server/common"
	commonlicense "github.com/harness/mcp-server/common/client/license"
	clientfactory "github.com/harness/mcp-server/common/pkg/license"
	"github.com/hashicorp/go-retryablehttp"
)

// ExternalProvider implements LicenseClientProvider for external mode
type ExternalProvider struct{}

func (p *ExternalProvider) BuildServiceURL(config *config.Config, internalBaseURL, externalBaseURL, externalPathPrefix string) string {
	// External mode: use public API endpoints
	if externalPathPrefix == "" {
		return externalBaseURL
	}
	return externalBaseURL + "/" + externalPathPrefix
}

func (p *ExternalProvider) CreateClient(ctx context.Context, config *config.Config, licenseBaseURL, baseURL, path, secret string) (*commonlicense.CustomLicensesApiService, error) {
	httpClient := retryablehttp.NewClient()
	httpClient.RetryMax = 5
	httpClient.Logger = nil

	serviceURL := p.BuildServiceURL(config, licenseBaseURL, baseURL, path)

	cfg := nextgen.Configuration{
		AccountId:    config.AccountID,
		BasePath:     serviceURL,
		HTTPClient:   httpClient,
		DebugLogging: false,
	}

	if err := p.ConfigureAuth(ctx, &cfg, config, secret); err != nil {
		return nil, err
	}

	customClient := commonlicense.NewCustomAPIClient(&cfg)
	return &commonlicense.CustomLicensesApiService{Client: customClient}, nil
}

func (p *ExternalProvider) ConfigureAuth(ctx context.Context, cfg *nextgen.Configuration, config *config.Config, secret string) error {
	// External mode: API key authentication only
	cfg.ApiKey = config.APIKey
	cfg.DefaultHeader = map[string]string{"x-api-key": config.APIKey}
	return nil
}

type ExternalFactoryProvider struct{}

// CreateLicenseClient creates a license client using the standard configuration
// This method encapsulates the common license client creation logic used across the application
// It reuses a single client instance if already created
func (p *ExternalFactoryProvider) CreateLicenseClient(ctx context.Context, factory *clientfactory.ClientFactory) (*commonlicense.CustomLicensesApiService, error) {
	// Check if we already have a client instance
	factory.ClientMu.RLock()
	if factory.Initialized && factory.Client != nil {
		client := factory.Client
		factory.ClientMu.RUnlock()
		return client, nil
	}
	factory.ClientMu.RUnlock()

	// Need to create a new client, acquire write lock
	factory.ClientMu.Lock()
	defer factory.ClientMu.Unlock()

	// Double-check that another goroutine hasn't created the client while we were waiting
	if factory.Initialized && factory.Client != nil {
		factory.Logger.Debug("Using existing license client (after lock)")
		return factory.Client, nil
	}

	factory.Logger.Debug("Creating new license client")

	// Use the NGManager service for license validation - same pattern as tools.go
	licenseClient, err := commonlicense.CreateCustomLicenseClientWithContext(
		ctx,
		factory.Config,
		"",
		factory.Config.BaseURL,
		"ng/api",
		"",
	)
	if err != nil {
		factory.Logger.Error("Failed to create license client", "error", err)
		return nil, err
	}

	// Store the client instance
	factory.Client = licenseClient
	factory.Initialized = true

	factory.Logger.Debug("Successfully created license client")
	return licenseClient, nil
}

// Register both providers
func init() {
	// Register low-level provider
	commonlicense.DefaultProvider = &ExternalProvider{}
	// Register high-level factory provider
	clientfactory.DefaultFactoryProvider = &ExternalFactoryProvider{}
}
