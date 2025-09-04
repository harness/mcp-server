package utils

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
)

// ServiceIdentity Service identity for JWT auth
const ServiceIdentity = "genaiservice" // TODO: can change once we have our own service, not needed at the moment
const AiServiceIdentity = "aifoundation"

// DefaultJWTLifetime Default JWT token lifetime
var DefaultJWTLifetime = 1 * time.Hour

// CreateServiceClient is a helper function to create a service client with the given parameters
func CreateServiceClient(config *config.Config, serviceBaseURL, baseURL, path, secret string, timeouts ...time.Duration) (*client.Client, error) {
	url := BuildServiceURL(config, serviceBaseURL, baseURL, path)
	return CreateClient(url, config, secret, timeouts...)
}

func BuildServiceURL(config *config.Config, internalBaseURL, externalBaseURL string, externalPathPrefix string) string {
	if config.Internal {
		return internalBaseURL
	}
	return externalBaseURL + "/" + externalPathPrefix
}

// CreateClient creates a client with the appropriate authentication method based on the config
// An optional customTimeout can be provided to override the config's DefaultTimeout
// An optional custom service identity can be provided to override the default service identity
func CreateClient(baseURL string, config *config.Config, secret string, timeout ...time.Duration) (*client.Client, error) {
	return CreateClientWithIdentity(baseURL, config, secret, ServiceIdentity, timeout...)
}

// CreateClientWithIdentity is like CreateClient but allows specifying a custom service identity
func CreateClientWithIdentity(baseURL string, config *config.Config, secret string, serviceIdentity string, timeout ...time.Duration) (*client.Client, error) {
	var authProvider auth.Provider
	var err error

	if config.Internal {
		// Use JWT auth for internal mode
		authProvider = auth.NewJWTProvider(secret, serviceIdentity, &DefaultJWTLifetime)
	} else {
		// Use API key auth for external mode
		authProvider = auth.NewAPIKeyProvider(config.APIKey)
	}

	client, err := client.NewWithAuthProvider(baseURL, authProvider, config.Version, timeout...)
	if err != nil {
		slog.Error("Failed to create client", "error", err)
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	return client, nil
}
