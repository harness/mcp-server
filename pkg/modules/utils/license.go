package utils

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/hashicorp/go-retryablehttp"
)

// CreateLicenseClient creates a license client with the appropriate authentication method based on the config
// It handles both internal and external modes with the correct authentication
func CreateLicenseClient(config *config.Config, licenseBaseURL, baseURL, path, secret string) (*nextgen.LicensesApiService, error) {
	return CreateLicenseClientWithContext(context.Background(), config, licenseBaseURL, baseURL, path, secret)
}

// CreateLicenseClientWithContext creates a license client with the appropriate authentication method based on the config
// It handles both internal and external modes with the correct authentication
// The context is used for JWT authentication in internal mode
func CreateLicenseClientWithContext(ctx context.Context, config *config.Config, licenseBaseURL, baseURL, path, secret string) (*nextgen.LicensesApiService, error) {
	// Create a standard HTTP client
	httpClient := retryablehttp.NewClient()
	httpClient.RetryMax = 10

	// Build the service URL based on whether we're in internal or external mode
	serviceURL := BuildServiceURL(config, licenseBaseURL, baseURL, path)

	cfg := nextgen.Configuration{
		AccountId:    config.AccountID,
		BasePath:     serviceURL,
		HTTPClient:   httpClient,
		DebugLogging: true,
	}

	// Set up authentication based on internal/external mode
	if config.Internal {
		// Use JWT auth for internal mode
		jwtProvider := auth.NewJWTProvider(secret, ServiceIdentity, &DefaultJWTLifetime)
		headerName, headerValue, err := jwtProvider.GetHeader(ctx)
		if err != nil {
			slog.Error("Failed to get JWT token", "error", err)
			return nil, fmt.Errorf("failed to get JWT token: %w", err)
		}
		cfg.DefaultHeader = map[string]string{headerName: headerValue}
	} else {
		// Use API key auth for external mode
		cfg.ApiKey = config.APIKey
		cfg.DefaultHeader = map[string]string{"x-api-key": config.APIKey}
	}

	ngClient := nextgen.NewAPIClient(&cfg)

	return ngClient.LicensesApi, nil
}
