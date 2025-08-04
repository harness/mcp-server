package modules

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dbops/generated"
	"net/http"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dbops"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// DbOpsModule implements the Module interface for "Unlicensed Module"
type DbOpsModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewDbOpsModule creates a new instance of DbOpsModule
func NewDbOpsModule(config *config.Config, tsg *toolsets.ToolsetGroup) *DbOpsModule {
	return &DbOpsModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *DbOpsModule) ID() string {
	return "DBOPS"
}

// Name returns the name of module
func (m *DbOpsModule) Name() string {
	return "DBOPS Module"
}

// Toolsets returns the names of toolsets provided by this module
func (m *DbOpsModule) Toolsets() []string {
	return []string{
		"dbops",
	}
}

// RegisterToolsets registers all toolsets in the Unlicensed module
func (m *DbOpsModule) RegisterToolsets() error {
	for _, i := range m.Toolsets() {
		switch i {
		case "dbops":
			err := RegisterDbops(m.config, m.tsg)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the Unlicensed module
func (m *DbOpsModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *DbOpsModule) IsDefault() bool {
	return false
}

// RegisterDbops registers the database operations toolset
func RegisterDbops(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for dbops service
	baseURL := utils.BuildServiceURL(config, config.DBOpsSvcBaseURL, config.BaseURL, "dbops")
	secret := config.DBOpsSvcSecret

	// Create base client for dbops
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return fmt.Errorf("failed to create client for dbops: %w", err)
	}

	// Create the generated client for dbops
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

	dbopsGenClient, err := generated.NewClientWithResponses(baseURL, generated.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return err
	}

	// Create connector client for JDBC connector operations
	connectorClient, err := utils.CreateServiceClient(config, config.NgManagerBaseURL, config.BaseURL, "ng/api", config.NgManagerSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create the dbops client
	dbopsClient := dbops.NewClient(dbopsGenClient, connectorServiceClient)

	// Create the dbops toolset
	dbopsToolset := toolsets.NewToolset("dbops", "Database operations related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetDatabaseInfoTool(config, dbopsClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(dbopsToolset)
	return nil
}
