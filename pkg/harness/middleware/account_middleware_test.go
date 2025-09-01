package middleware

import (
	"context"
	"testing"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestWithHarnessScope_AddsScopeToContext(t *testing.T) {
	cfg := &config.Config{AccountID: "acc", DefaultOrgID: "org", DefaultProjectID: "proj"}

	// Build a request that overrides org/project
	req := mcp.CallToolRequest{}
	req.Params.Arguments = map[string]any{"org_id": "o2", "project_id": "p2"}

	var sawScope dto.Scope
	var nextCalled bool

	next := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		nextCalled = true
		scope, err := common.GetScopeFromContext(ctx)
		if err != nil {
			t.Fatalf("expected scope in context, got error: %v", err)
		}
		sawScope = scope
		return &mcp.CallToolResult{IsError: false}, nil
	}

	mw := WithHarnessScope(cfg)
	handler := mw(next)

	_, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if !nextCalled {
		t.Fatalf("expected next to be called")
	}
	if sawScope.AccountID != "acc" || sawScope.OrgID != "o2" || sawScope.ProjectID != "p2" {
		t.Fatalf("unexpected scope set in context: %+v", sawScope)
	}
}

func TestWithHarnessScope_ContinuesWhenFetchScopeError(t *testing.T) {
	// Missing AccountID will make FetchScope return error
	cfg := &config.Config{AccountID: ""}
	req := mcp.CallToolRequest{}

	var nextCalled bool
	next := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Ensure no scope in context
		if _, err := common.GetScopeFromContext(ctx); err == nil {
			t.Fatalf("expected no scope in context when FetchScope fails")
		}
		nextCalled = true
		return &mcp.CallToolResult{IsError: false}, nil
	}

	mw := WithHarnessScope(cfg)
	handler := mw(next)

	_, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if !nextCalled {
		t.Fatalf("expected next to be called even when FetchScope fails")
	}
}
