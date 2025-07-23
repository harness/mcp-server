package tools

import (
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
)

// NoopPropertyOption is a property option that does nothing.
func NoopPropertyOption() mcp.PropertyOption {
	return func(schema map[string]interface{}) {}
}

// WithScope adds org_id and project_id as optional/required parameters, based  on
// what is set in the env variables.
func WithScope(config *config.Config, required bool) mcp.ToolOption {
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
// It looks in the config first and then in the request (if it was defined). The request is given preference
// so anything passed by the user in the request will override the config.
// If orgID and projectID are required fields, it will return an error if they are not present.
func FetchScope(config *config.Config, request mcp.CallToolRequest, required bool) (dto.Scope, error) {
	// account ID is always required
	if config.AccountID == "" {
		return dto.Scope{}, fmt.Errorf("account ID is required")
	}

	scope := dto.Scope{
		AccountID: config.AccountID,
		OrgID:     config.DefaultOrgID,
		ProjectID: config.DefaultProjectID,
	}

	// try to fetch it from the MCP request
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
