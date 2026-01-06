package common

import (
	"context"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/types/enum"
	"github.com/mark3labs/mcp-go/mcp"
)

// NoopPropertyOption is a property option that does nothing.
func NoopPropertyOption() mcp.PropertyOption {
	return func(schema map[string]interface{}) {}
}

// WithScope adds org_id and project_id as optional/required parameters, based  on
// what is set in the env variables.
func WithScope(config *config.McpServerConfig, required bool) mcp.ToolOption {
	opt := NoopPropertyOption()
	verbiage := "Optional" // this helps with having the client not pass in bogus parameters
	if required {
		opt = mcp.Required()
		verbiage = "Required"
	}
	return func(tool *mcp.Tool) {
		defaultProjectOpt := NoopPropertyOption()
		defaultOrgOpt := NoopPropertyOption()
		if config.DefaultOrgID != "" {
			defaultOrgOpt = mcp.DefaultString(config.DefaultOrgID)
		}
		if config.DefaultProjectID != "" {
			defaultProjectOpt = mcp.DefaultString(config.DefaultProjectID)
		}
		mcp.WithString("org_id",
			mcp.Description(fmt.Sprintf("%s ID of the organization.", verbiage)),
			defaultOrgOpt,
			opt,
		)(tool)
		mcp.WithString("project_id",
			mcp.Description(fmt.Sprintf("%s ID of the project.", verbiage)),
			defaultProjectOpt,
			opt,
		)(tool)
	}
}

// FetchScope fetches the scope from the config and MCP request.
// If the transport type is HTTP, it fetches the scope from the context.
// Otherwise, it looks in the config first and then in the request (if it was defined). The request is given preference
// so anything passed by the user in the request will override the config.
// If orgID and projectID are required fields, it will return an error if they are not present.
func FetchScope(ctx context.Context, config *config.McpServerConfig, request mcp.CallToolRequest, required bool) (dto.Scope, error) {
	// If transport type is HTTP, fetch scope from context
	if config.Transport == enum.TransportHTTP {
		scope, err := GetScopeFromContext(ctx)
		if err != nil {
			return dto.Scope{}, fmt.Errorf("failed to get scope from context: %w", err)
		}

		scope, err = enrichScopeWithOrgProjectFromRequest(scope, request, required)
		if err != nil {
			return scope, err
		}

		return scope, nil
	}

	// account ID is always required
	if config.AccountID == "" {
		return dto.Scope{}, fmt.Errorf("account ID is required")
	}

	scope := dto.Scope{
		AccountID: config.AccountID,
		OrgID:     config.DefaultOrgID,
		ProjectID: config.DefaultProjectID,
	}

	scope, err := enrichScopeWithOrgProjectFromRequest(scope, request, required)
	if err != nil {
		return scope, err
	}

	return scope, nil
}

func enrichScopeWithOrgProjectFromRequest(scope dto.Scope, request mcp.CallToolRequest, required bool) (dto.Scope, error) {
	org, _ := OptionalParam[string](request, "org_id")
	if org != "" {
		scope.OrgID = org
	}
	project, _ := OptionalParam[string](request, "project_id")
	if project != "" {
		scope.ProjectID = project
	}

	// org ID and project ID may or may not be required for APIs. If they are required, we return an error
	// if not present.
	if required {
		if scope.OrgID == "" {
			return scope, fmt.Errorf("org ID is required")
		}
		if scope.ProjectID == "" {
			return scope, fmt.Errorf("project ID is required")
		}
	}
	return scope, nil
}

// OptionalParam is a helper function that can be used to fetch an optional parameter from the request.
func OptionalParam[T any](r mcp.CallToolRequest, p string) (T, error) {
	var zero T

	// Check if the parameter is present in the request
	if _, ok := r.GetArguments()[p]; !ok {
		return zero, nil
	}

	// Check if the parameter is of the expected type
	if _, ok := r.GetArguments()[p].(T); !ok {
		return zero, fmt.Errorf("parameter %s is not of type %T, is %T", p, zero, r.GetArguments()[p])
	}

	return r.GetArguments()[p].(T), nil
}

// ScopeKey is the context key for storing the scope
type ScopeKey struct{}

// GetScopeFromContext retrieves the scope from the context
func GetScopeFromContext(ctx context.Context) (dto.Scope, error) {
	scope, ok := ctx.Value(ScopeKey{}).(dto.Scope)
	if !ok {
		return dto.Scope{}, fmt.Errorf("scope not found in context")
	}
	return scope, nil
}

// WithScopeContext adds the scope to the context
func WithScopeContext(ctx context.Context, scope dto.Scope) context.Context {
	return context.WithValue(ctx, ScopeKey{}, scope)
}
