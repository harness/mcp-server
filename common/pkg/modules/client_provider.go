package modules

import (
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
)

// ClientProvider defines the interface for creating module clients
// Different implementations can be provided for internal and external modes
type ClientProvider interface {
	CreateClient(config *config.Config, servicePath string, timeout ...time.Duration) (*client.Client, error)
}

// DefaultClientProvider holds the active client provider implementation
// This will be set by the external or internal package during initialization
var DefaultClientProvider ClientProvider
