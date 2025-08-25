package enum

// TransportType defines the transport protocol for the MCP server
type TransportType string

const (
    // TransportStdio represents standard input/output transport
    TransportStdio TransportType = "stdio"
    // TransportHTTP represents HTTP transport
    TransportHTTP TransportType = "http"
)

// String returns the string representation of the transport type
func (t TransportType) String() string {
    return string(t)
}

// ParseTransportType converts a string to a TransportType
func ParseTransportType(s string) TransportType {
    switch s {
    case "http":
        return TransportHTTP
    default:
        return TransportStdio
    }
}