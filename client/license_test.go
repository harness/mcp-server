package client

import (
	"context"
	"testing"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	config "github.com/harness/mcp-server/common"
	commonAuth "github.com/harness/mcp-server/common/pkg/auth"
)

func TestExternalProvider_ConfigureAuth_WithContextJWT(t *testing.T) {
	provider := &ExternalProvider{}
	cfg := &nextgen.Configuration{}
	mcpConfig := &config.McpServerConfig{}

	// Add JWT to context
	ctx := context.Background()
	ctx = commonAuth.WithAuthInContext(ctx, "Authorization", "IdentityService test-jwt-token")

	err := provider.ConfigureAuth(ctx, cfg, mcpConfig, "")
	if err != nil {
		t.Errorf("ConfigureAuth() error = %v", err)
	}

	if cfg.DefaultHeader["Authorization"] != "IdentityService test-jwt-token" {
		t.Errorf("Expected Authorization header to be set, got %v", cfg.DefaultHeader)
	}
}

func TestExternalProvider_ConfigureAuth_WithContextAPIKey(t *testing.T) {
	provider := &ExternalProvider{}
	cfg := &nextgen.Configuration{}
	mcpConfig := &config.McpServerConfig{}

	// Add API key to context
	ctx := context.Background()
	ctx = commonAuth.WithAuthInContext(ctx, "x-api-key", "pat.account.token")

	err := provider.ConfigureAuth(ctx, cfg, mcpConfig, "")
	if err != nil {
		t.Errorf("ConfigureAuth() error = %v", err)
	}

	if cfg.ApiKey != "pat.account.token" {
		t.Errorf("Expected ApiKey to be set to pat.account.token, got %v", cfg.ApiKey)
	}

	if cfg.DefaultHeader["x-api-key"] != "pat.account.token" {
		t.Errorf("Expected x-api-key header to be set, got %v", cfg.DefaultHeader)
	}
}

func TestExternalProvider_ConfigureAuth_WithConfigFallback(t *testing.T) {
	provider := &ExternalProvider{}
	cfg := &nextgen.Configuration{}
	mcpConfig := &config.McpServerConfig{
		APIKey: "pat.fallback.token",
	}

	// Empty context (no auth)
	ctx := context.Background()

	err := provider.ConfigureAuth(ctx, cfg, mcpConfig, "")
	if err != nil {
		t.Errorf("ConfigureAuth() error = %v", err)
	}

	if cfg.ApiKey != "pat.fallback.token" {
		t.Errorf("Expected ApiKey to be set to fallback, got %v", cfg.ApiKey)
	}
}

func TestExternalProvider_ConfigureAuth_ContextOverridesConfig(t *testing.T) {
	provider := &ExternalProvider{}
	cfg := &nextgen.Configuration{}
	mcpConfig := &config.McpServerConfig{
		APIKey: "pat.config.token",
	}

	// Add different API key to context
	ctx := context.Background()
	ctx = commonAuth.WithAuthInContext(ctx, "x-api-key", "pat.context.token")

	err := provider.ConfigureAuth(ctx, cfg, mcpConfig, "")
	if err != nil {
		t.Errorf("ConfigureAuth() error = %v", err)
	}

	// Should use context auth, not config
	if cfg.ApiKey != "pat.context.token" {
		t.Errorf("Expected context auth to override config, got %v", cfg.ApiKey)
	}
}
