package modules

import (
	"fmt"
	"time"

	config "github.com/harness/mcp-server/common"
	commonClient "github.com/harness/mcp-server/common/client"
	commonAuth "github.com/harness/mcp-server/common/pkg/auth"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
)

var ServiceToPathMap = map[string]string{
	"acm":                 "autoai",
	"ngMan":               "ng/api",
	"harnessManager":      "ng/api",
	"nextgen":             "",
	"commOrch":            "lw/co/api",
	"chaos":               "chaos/manager/api",
	"loadtest":            "loadTest/manager/api",
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
	"gitops":              "gateway/gitops/api/v1",
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
		serviceUrl = config.BaseURL + "/" + servicePath
	}
	var authProvider commonAuth.Provider = commonAuth.NewAPIKeyProvider(config.APIKey)
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
