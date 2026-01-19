package test

import (
	"context"
	"net/url"
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/auth"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
)

type noOpAuthProvider struct{}

func (p *noOpAuthProvider) GetHeader(_ context.Context) (string, string, error) {
	return "x-api-key", "test-key", nil
}

type noOpClientProvider struct{}

func (p *noOpClientProvider) CreateClient(
	_ *config.McpServerConfig, _ string, _ ...time.Duration,
) (*client.Client, error) {
	return &client.Client{
		BaseURL:      &url.URL{Scheme: "http", Host: "localhost"},
		AuthProvider: &noOpAuthProvider{},
	}, nil
}

func (p *noOpClientProvider) CreateClientWithIdentity(
	_ *config.McpServerConfig, _ string, _ string, timeout ...time.Duration,
) (*client.Client, error) {
	return p.CreateClient(nil, "", timeout...)
}

// useNoOpProviders swaps global providers with no-ops and returns a cleanup function.
func useNoOpProviders() func() {
	origClient := commonModules.DefaultClientProvider
	origCode := commonModules.DefaultCodeClientFactory
	origNgManager := commonModules.DefaultNgManagerAuthProviderFactory

	commonModules.DefaultClientProvider = &noOpClientProvider{}
	commonModules.DefaultCodeClientFactory = func(_ *config.McpServerConfig) (*client.Client, error) {
		return (&noOpClientProvider{}).CreateClient(nil, "")
	}
	commonModules.DefaultNgManagerAuthProviderFactory = func(_ *config.McpServerConfig) auth.Provider {
		return &noOpAuthProvider{}
	}

	return func() {
		commonModules.DefaultClientProvider = origClient
		commonModules.DefaultCodeClientFactory = origCode
		commonModules.DefaultNgManagerAuthProviderFactory = origNgManager
	}
}
