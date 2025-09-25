package enum

// LogFormatType defines the log format for the MCP server
type LogFormatType string

const (
	// LogFormatText represents text log format
	LogFormatText LogFormatType = "text"
	// LogFormatJSON represents JSON log format
	LogFormatJSON LogFormatType = "json"
)

// String returns the string representation of the log format type
func (t LogFormatType) String() string {
	return string(t)
}

// ParseLogFormatType converts a string to a LogFormatType
func ParseLogFormatType(s string) LogFormatType {
	switch s {
	case "json":
		return LogFormatJSON
	default:
		return LogFormatText
	}
}
