package tools

import (
	"context"
	"testing"

	config "github.com/harness/mcp-server/common"
)

func TestInitToolsets_WithoutLicenseValidation(t *testing.T) {
	cfg := &config.McpServerConfig{
		BaseURL: "https://app.harness.io",
		ReadOnly: false,
		Toolsets: []string{"all"},
	}

	ctx := context.Background()
	tsg, err := InitToolsets(ctx, cfg)

	if err != nil {
		t.Errorf("InitToolsets() error = %v, want nil", err)
	}

	if tsg == nil {
		t.Fatal("Expected toolset group, got nil")
	}

	// Verify toolsets were registered
	if len(tsg.Toolsets) == 0 {
		t.Error("Expected toolsets to be registered, got empty list")
	}

	// Should not fail even with no API key or account ID
	t.Log("Successfully initialized toolsets without license validation")
}

func TestInitToolsets_RegistersAllModules(t *testing.T) {
	cfg := &config.McpServerConfig{
		BaseURL: "https://app.harness.io",
		ReadOnly: false,
	}

	ctx := context.Background()
	tsg, err := InitToolsets(ctx, cfg)

	if err != nil {
		t.Fatalf("InitToolsets() error = %v", err)
	}

	// Verify we have a reasonable number of toolsets
	if len(tsg.Toolsets) < 10 {
		t.Errorf("Expected at least 10 toolsets, got %d", len(tsg.Toolsets))
	}
}

