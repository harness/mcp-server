package utils

import (
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	"github.com/hashicorp/go-retryablehttp"
)

// CreateLicenseClient creates a license client with the appropriate authentication method based on the config
// It handles both internal and external modes with the correct authentication
func CreateLicenseClient(config *config.Config, licenseBaseURL, baseURL, path, secret string) (*nextgen.LicensesApiService, error) {
	// Create a standard HTTP client
	httpClient := retryablehttp.NewClient()
	httpClient.RetryMax = 10

	cfg := nextgen.Configuration{
		AccountId:     config.AccountID,
		ApiKey:        config.APIKey,
		BasePath:      config.BaseURL,
		HTTPClient:    httpClient,
		DebugLogging:  true,
		DefaultHeader: map[string]string{"X-Api-Key": config.APIKey},
	}
	ngClient := nextgen.NewAPIClient(&cfg)

	return ngClient.LicensesApi, nil
}
