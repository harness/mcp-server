package common

import (
	"context"
	"testing"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/types/enum"
	"github.com/mark3labs/mcp-go/mcp"
)

func newRequest(args map[string]any) mcp.CallToolRequest {
	r := mcp.CallToolRequest{}
	r.Params.Arguments = args
	return r
}

func TestFetchScope_ErrorWhenNoAccountID(t *testing.T) {
	cfg := &config.Config{AccountID: ""}
	r := newRequest(nil)
	_, err := FetchScope(context.Background(), cfg, r, false)
	if err == nil || err.Error() != "account ID is required" {
		t.Fatalf("expected account ID required error, got: %v", err)
	}
}

func TestFetchScope_UsesConfigDefaultsWhenNotProvided(t *testing.T) {
	cfg := &config.Config{AccountID: "acc", DefaultOrgID: "org", DefaultProjectID: "proj"}
	r := newRequest(nil)
	scope, err := FetchScope(context.Background(), cfg, r, false)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if scope.AccountID != "acc" || scope.OrgID != "org" || scope.ProjectID != "proj" {
		t.Fatalf("unexpected scope: %+v", scope)
	}
}

func TestFetchScope_RequestOverridesConfig(t *testing.T) {
	cfg := &config.Config{AccountID: "acc", DefaultOrgID: "org", DefaultProjectID: "proj"}
	args := map[string]any{"org_id": "o2", "project_id": "p2"}
	r := newRequest(args)
	scope, err := FetchScope(context.Background(), cfg, r, false)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if scope.OrgID != "o2" || scope.ProjectID != "p2" {
		t.Fatalf("expected overrides (o2,p2), got: (%s,%s)", scope.OrgID, scope.ProjectID)
	}
}

func TestFetchScope_RequiredMissingOrg(t *testing.T) {
	cfg := &config.Config{AccountID: "acc", DefaultOrgID: "", DefaultProjectID: "proj"}
	r := newRequest(nil)
	_, err := FetchScope(context.Background(), cfg, r, true)
	if err == nil || err.Error() != "org ID is required" {
		t.Fatalf("expected org ID required error, got: %v", err)
	}
}

func TestFetchScope_RequiredMissingProject(t *testing.T) {
	cfg := &config.Config{AccountID: "acc", DefaultOrgID: "org", DefaultProjectID: ""}
	r := newRequest(nil)
	_, err := FetchScope(context.Background(), cfg, r, true)
	if err == nil || err.Error() != "project ID is required" {
		t.Fatalf("expected project ID required error, got: %v", err)
	}
}

func TestFetchScope_HTTPTransport_EnrichesFromRequest(t *testing.T) {
	// Setup config with HTTP transport
	cfg := &config.Config{AccountID: "acc", Transport: enum.TransportHTTP}

	// Create a context with scope
	ctx := context.Background()
	ctx = WithScopeContext(ctx, dto.Scope{
		AccountID: "ctx-acc",
		OrgID:     "ctx-org",
		ProjectID: "ctx-proj",
	})

	// Create request with different org and project
	args := map[string]any{"org_id": "req-org", "project_id": "req-proj"}
	r := newRequest(args)

	// Call FetchScope
	scope, err := FetchScope(ctx, cfg, r, false)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}

	// Verify that request values override context values
	if scope.AccountID != "ctx-acc" || scope.OrgID != "req-org" || scope.ProjectID != "req-proj" {
		t.Fatalf("expected scope (ctx-acc,req-org,req-proj), got: (%s,%s,%s)",
			scope.AccountID, scope.OrgID, scope.ProjectID)
	}
}

func TestFetchScope_HTTPTransport_RequiredMissingOrg(t *testing.T) {
	// Setup config with HTTP transport
	cfg := &config.Config{AccountID: "acc", Transport: enum.TransportHTTP}

	// Create a context with scope missing org
	ctx := context.Background()
	ctx = WithScopeContext(ctx, dto.Scope{
		AccountID: "ctx-acc",
		OrgID:     "", // Missing org
		ProjectID: "ctx-proj",
	})

	// Call FetchScope with required=true
	r := newRequest(nil)
	_, err := FetchScope(ctx, cfg, r, true)

	// Verify error
	if err == nil || err.Error() != "org ID is required" {
		t.Fatalf("expected org ID required error, got: %v", err)
	}
}

func TestFetchScope_HTTPTransport_RequiredMissingProject(t *testing.T) {
	// Setup config with HTTP transport
	cfg := &config.Config{AccountID: "acc", Transport: enum.TransportHTTP}

	// Create a context with scope missing project
	ctx := context.Background()
	ctx = WithScopeContext(ctx, dto.Scope{
		AccountID: "ctx-acc",
		OrgID:     "ctx-org",
		ProjectID: "", // Missing project
	})

	// Call FetchScope with required=true
	r := newRequest(nil)
	_, err := FetchScope(ctx, cfg, r, true)

	// Verify error
	if err == nil || err.Error() != "project ID is required" {
		t.Fatalf("expected project ID required error, got: %v", err)
	}
}

func TestOptionalParam_MissingReturnsZero(t *testing.T) {
	r := newRequest(nil)
	val, err := OptionalParam[string](r, "missing")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if val != "" {
		t.Fatalf("expected zero value, got %q", val)
	}
}

func TestOptionalParam_TypeMismatch(t *testing.T) {
	r := newRequest(map[string]any{"n": 123})
	_, err := OptionalParam[string](r, "n")
	if err == nil {
		t.Fatalf("expected type mismatch error, got nil")
	}
}

func TestOptionalParam_Success(t *testing.T) {
	r := newRequest(map[string]any{"s": "ok"})
	val, err := OptionalParam[string](r, "s")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if val != "ok" {
		t.Fatalf("expected 'ok', got %q", val)
	}
}
