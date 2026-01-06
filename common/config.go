package config

import (
	"github.com/harness/mcp-server/common/pkg/types/enum"
)

type McpServerConfig struct {
	AccountID        string
	APIKey           string
	BaseURL          string
	Debug            bool
	DefaultOrgID     string
	DefaultProjectID string
	HTTP             struct {
		Port int    `envconfig:"MCP_HTTP_PORT" default:"8080"`
		Path string `envconfig:"MCP_HTTP_PATH" default:"/mcp"`
	}
	LogFilePath string
	LogFormat   enum.LogFormatType
	OutputDir   string
	ReadOnly    bool
	Toolsets    []string
	Transport   enum.TransportType
	Version     string
}
