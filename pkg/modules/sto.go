package modules

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/harness/harness-mcp/client"
	sto "github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// STOModule implements the Module interface for Security Test Orchestration
type STOModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewSTOModule creates a new instance of STOModule
func NewSTOModule(config *config.Config, tsg *toolsets.ToolsetGroup) *STOModule {
	return &STOModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *STOModule) ID() string {
	return "STO"
}

// Name returns the name of module
func (m *STOModule) Name() string {
	return "Security Test Orchestration"
}

// Toolsets returns the names of toolsets provided by this module
func (m *STOModule) Toolsets() []string {
	return []string{
		"sto",
	}
}

// RegisterToolsets registers all toolsets in the STO module
func (m *STOModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "sto":
			if err := RegisterSTO(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the STO module
func (m *STOModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *STOModule) IsDefault() bool {
	return false
}

// RegisterSTO registers the Security Test Orchestration toolset
func RegisterSTO(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.STOSvcBaseURL, config.BaseURL, "sto")
	secret := config.STOSvcSecret
	c := &http.Client{
		Timeout: 30 * time.Second,
	}

	baseURLPrincipal := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	principalSecret := config.NgManagerSecret

	cPrincipal, err := utils.CreateClient(baseURLPrincipal, config, principalSecret)
	if err != nil {
		slog.Warn("Failed to create principal client for STO toolset", "error", err)
		return nil
	}
	principalClient := &client.PrincipalService{Client: cPrincipal}

	stoAPIKey := ""
	tokenURL := fmt.Sprintf("%s/api/v2/token?accountId=%s&audience=sto-plugin", baseURL, config.AccountID)
	if config.Internal {
		stoAPIKey, err = retrieveSTOToken(tokenURL, secret)
		if err != nil {
			slog.Warn("Failed to retrieve STO token. STO toolset will be partially operational", "error", err)
			// Continue without the token
		}
	}

	requestEditorFn := createSTORequestEditor(config, stoAPIKey)
	stoClient, err := sto.NewClientWithResponses(baseURL, sto.WithHTTPClient(c),
		sto.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		slog.Warn("Failed to create generated STO client. STO toolset will not be available", "error", err)
		return nil
	}
	sto := toolsets.NewToolset("sto", "Harness Security Test Orchestration tools").
		AddReadTools(
			toolsets.NewServerTool(tools.StoAllIssuesListTool(config, stoClient)),
			toolsets.NewServerTool(tools.StoGlobalExemptionsTool(config, stoClient, principalClient)),
			toolsets.NewServerTool(tools.ExemptionsPromoteExemptionTool(config, stoClient, principalClient)),
			toolsets.NewServerTool(tools.ExemptionsApproveExemptionTool(config, stoClient, principalClient)),
		)
	tsg.AddToolset(sto)
	return nil
}

// createSTORequestEditor creates a request editor function for STO API requests
func createSTORequestEditor(config *config.Config, stoAPIKey string) func(context.Context, *http.Request) error {
	return func(ctx context.Context, req *http.Request) error {
		//Add STO plugin token as Authorization header if internal mode
		if config.Internal && stoAPIKey != "" {
			req.Header.Set("Authorization", "ApiKey "+stoAPIKey)
		} else {
			req.Header.Set("x-api-key", config.APIKey)
		}
		return nil
	}
}

// retrieveSTOToken retrieves the STO plugin token from the token endpoint
func retrieveSTOToken(tokenURL, secret string) (string, error) {
	stoTokenReq, err := http.NewRequestWithContext(context.Background(), http.MethodGet, tokenURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create STO token request: %w", err)
	}

	stoTokenReq.Header.Set("X-Harness-Token", secret)

	// Try with a fresh HTTP client to avoid any client configuration issues
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	stoTokenResp, err := httpClient.Do(stoTokenReq)
	if err != nil {
		return "", fmt.Errorf("failed to call STO token endpoint: %w", err)
	}

	defer stoTokenResp.Body.Close()

	if stoTokenResp.StatusCode >= 300 {
		return "", fmt.Errorf("failed to retrieve STO token, status: %s", stoTokenResp.Status)
	}

	bodyBytes, err := io.ReadAll(stoTokenResp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read STO token response: %w", err)
	}

	var tokenJSON map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &tokenJSON); err == nil {
		if v, ok := tokenJSON["token"].(string); ok && v != "" {
			return v, nil
		} else if v, ok := tokenJSON["apiKey"].(string); ok && v != "" {
			return v, nil
		}
	}

	return "", nil
}
