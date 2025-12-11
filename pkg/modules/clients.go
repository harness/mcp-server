package modules

import (
	"time"

	config "github.com/harness/mcp-server/common"
	commonClient "github.com/harness/mcp-server/common/client"
	commonAuth "github.com/harness/mcp-server/common/pkg/auth"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
)

// ExternalClientProvider implements ClientProvider for external mode
type ExternalClientProvider struct{}

func (p *ExternalClientProvider) CreateClient(config *config.McpServerConfig, servicePath string, timeout ...time.Duration) (*commonClient.Client, error) {
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

// init registers the external client provider
func init() {
	commonModules.DefaultClientProvider = &ExternalClientProvider{}
}
