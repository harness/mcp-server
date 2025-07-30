package utils

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/harness/harness-mcp/client/license"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
)

// CreateLicenseClient creates a license client with the appropriate authentication method based on the config
// It handles both internal and external modes with the correct authentication
func CreateLicenseClient(config *config.Config, licenseBaseURL, baseURL, path, secret string) (*license.ClientWithResponses, error) {
	// Build the appropriate URL based on internal/external mode
	url := BuildServiceURL(config, licenseBaseURL, baseURL, path)

	// Create base client for license
	c, err := CreateClient(url, config, secret)
	if err != nil {
		return nil, fmt.Errorf("failed to create client for license: %w", err)
	}

	// Create a request editor function for authentication
	requestEditorFn := func(ctx context.Context, req *http.Request) error {
		if c.AuthProvider == nil {
			return fmt.Errorf("auth provider is not initialized")
		}
		k, v, err := c.AuthProvider.GetHeader(ctx)
		if err != nil {
			return err
		}
		req.Header.Set(k, v)
		return nil
	}

	// Create a standard HTTP client
	httpClient := &http.Client{}

	// Create the license client with the request editor function
	licenseClient, err := license.NewClientWithResponses(
		url,
		license.WithHTTPClient(httpClient),
		license.WithRequestEditorFn(requestEditorFn),
	)

	if err != nil {
		slog.Error("Failed to create license client", "error", err)
		return nil, fmt.Errorf("failed to create license client: %w", err)
	}

	return licenseClient, nil
}
