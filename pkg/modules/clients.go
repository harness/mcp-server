package modules

import (
	"fmt"
	"strings"
	"time"

	config "github.com/harness/mcp-server/common"
	commonClient "github.com/harness/mcp-server/common/client"
	commonAuth "github.com/harness/mcp-server/common/pkg/auth"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
)

var ServiceToPathMap = map[string]string{
	"acm":                 "autoai",
	"ngMan":               "ng/api",
	"nextgen":             "",
	"commOrch":            "lw/co/api",
	"chaos":               "chaos/manager/api",
	"code":                "code",
	"pipelines":           "pipeline",
	"dashboards":          "dashboard",
	"audit":               "audit",
	"gateway/log-service": "gateway/log-service",
	"log-service":         "log-service",
	"templates":           "template",
	"acl":                 "authz",
	"resourcegroup":       "resourcegroup",
	"ar":                  "har/api/v1",
	"idp":                 "",
	"sei":                 "/gateway/sei/api/",
	"scs":                 "ssca-manager",
	"sto":                 "sto",
}

// ExternalClientProvider implements ClientProvider for external mode
type ExternalClientProvider struct{}

func (p *ExternalClientProvider) CreateClient(config *config.McpServerConfig, service string, timeout ...time.Duration) (*commonClient.Client, error) {
	servicePath, ok := ServiceToPathMap[service]
	if !ok {
		return nil, fmt.Errorf("unknown service: %s", service)
	}
	var serviceUrl string
	if servicePath == "" {
		serviceUrl = config.BaseURL
	} else {
		//if does have api key, we remove the gateway prefix
		if config.APIKey == "" {
			servicePath = strings.ReplaceAll(servicePath, "gateway/", "")
		}
		serviceUrl = config.BaseURL + "/" + servicePath
	}
	// Create auth provider that reads from context (HTTP request headers)
	// with fallback to config for CLI/stdio mode
	var fallbackProvider commonAuth.Provider
	if config.APIKey != "" {
		fallbackProvider = commonAuth.NewAPIKeyProvider(config.APIKey)
	}
	// ContextProvider will:
	// 1. First try to read auth from context (populated by HTTP middleware)
	// 2. Fall back to config.APIKey if no auth in context (CLI/stdio mode)
	authProvider := commonAuth.NewContextProvider(fallbackProvider)

	client, err := commonClient.NewWithAuthProvider(serviceUrl, authProvider, config.Version, timeout...)
	if err != nil {
		return nil, err
	}
	return client, nil
}

func (p *ExternalClientProvider) CreateClientWithIdentity(config *config.McpServerConfig, service string, serviceIdentity string, timeout ...time.Duration) (*commonClient.Client, error) {
	return nil, fmt.Errorf("not implemented")
}

// init registers the external client provider
func init() {
	commonModules.DefaultClientProvider = &ExternalClientProvider{}
}
