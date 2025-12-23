package errors

// Error codes for Tool errors
const (
	// Tool execution errors
	TOOL_ERROR_INVALID_PARAM      = "TOOL_ERROR_INVALID_PARAM"
	TOOL_ERROR_EXECUTION_FAILED    = "TOOL_ERROR_EXECUTION_FAILED"
	TOOL_ERROR_TIMEOUT             = "TOOL_ERROR_TIMEOUT"
	TOOL_ERROR_NOT_FOUND           = "TOOL_ERROR_NOT_FOUND"
	TOOL_ERROR_UNAUTHORIZED        = "TOOL_ERROR_UNAUTHORIZED"
	TOOL_ERROR_INTERNAL            = "TOOL_ERROR_INTERNAL"
	TOOL_ERROR_UNSUPPORTED_REQUEST = "TOOL_ERROR_UNSUPPORTED_REQUEST"
)

// Error codes for Client errors
const (
	// Client/API errors
	CLIENT_ERROR_NOT_FOUND         = "CLIENT_ERROR_NOT_FOUND"
	CLIENT_ERROR_BAD_REQUEST       = "CLIENT_ERROR_BAD_REQUEST"
	CLIENT_ERROR_UNAUTHORIZED      = "CLIENT_ERROR_UNAUTHORIZED"
	CLIENT_ERROR_FORBIDDEN         = "CLIENT_ERROR_FORBIDDEN"
	CLIENT_ERROR_INTERNAL          = "CLIENT_ERROR_INTERNAL"
	CLIENT_ERROR_TIMEOUT           = "CLIENT_ERROR_TIMEOUT"
	CLIENT_ERROR_NETWORK           = "CLIENT_ERROR_NETWORK"
	CLIENT_ERROR_RETRYABLE         = "CLIENT_ERROR_RETRYABLE"
	CLIENT_ERROR_UNMARSHAL         = "CLIENT_ERROR_UNMARSHAL"
	CLIENT_ERROR_REQUEST_FAILED    = "CLIENT_ERROR_REQUEST_FAILED"
)

// Error codes for Validation errors
const (
	// Validation errors
	VALIDATION_ERROR_MISSING_PARAM     = "VALIDATION_ERROR_MISSING_PARAM"
	VALIDATION_ERROR_INVALID_TYPE      = "VALIDATION_ERROR_INVALID_TYPE"
	VALIDATION_ERROR_INVALID_VALUE     = "VALIDATION_ERROR_INVALID_VALUE"
	VALIDATION_ERROR_INVALID_FORMAT     = "VALIDATION_ERROR_INVALID_FORMAT"
	VALIDATION_ERROR_OUT_OF_RANGE      = "VALIDATION_ERROR_OUT_OF_RANGE"
	VALIDATION_ERROR_DUPLICATE_VALUE    = "VALIDATION_ERROR_DUPLICATE_VALUE"
	VALIDATION_ERROR_INVALID_SCOPE      = "VALIDATION_ERROR_INVALID_SCOPE"
	VALIDATION_ERROR_MISSING_SCOPE      = "VALIDATION_ERROR_MISSING_SCOPE"
)

// Error codes for Auth errors
const (
	// Authentication errors
	AUTH_ERROR_INVALID_TOKEN      = "AUTH_ERROR_INVALID_TOKEN"
	AUTH_ERROR_UNAUTHORIZED        = "AUTH_ERROR_UNAUTHORIZED"
	AUTH_ERROR_TOKEN_EXPIRED       = "AUTH_ERROR_TOKEN_EXPIRED"
	AUTH_ERROR_MISSING_CREDENTIALS = "AUTH_ERROR_MISSING_CREDENTIALS"
	AUTH_ERROR_INVALID_CREDENTIALS = "AUTH_ERROR_INVALID_CREDENTIALS"
	AUTH_ERROR_FORBIDDEN           = "AUTH_ERROR_FORBIDDEN"
	AUTH_ERROR_SESSION_EXPIRED     = "AUTH_ERROR_SESSION_EXPIRED"
)

// GetErrorCodeDescription returns a human-readable description for an error code
func GetErrorCodeDescription(code string) string {
	descriptions := map[string]string{
		// Tool errors
		TOOL_ERROR_INVALID_PARAM:      "Invalid parameter provided to tool",
		TOOL_ERROR_EXECUTION_FAILED:    "Tool execution failed",
		TOOL_ERROR_TIMEOUT:             "Tool execution timed out",
		TOOL_ERROR_NOT_FOUND:           "Tool or resource not found",
		TOOL_ERROR_UNAUTHORIZED:        "Unauthorized to execute tool",
		TOOL_ERROR_INTERNAL:             "Internal tool error",
		TOOL_ERROR_UNSUPPORTED_REQUEST: "Unsupported request type",
		
		// Client errors
		CLIENT_ERROR_NOT_FOUND:      "Resource not found",
		CLIENT_ERROR_BAD_REQUEST:    "Bad request",
		CLIENT_ERROR_UNAUTHORIZED:   "Unauthorized request",
		CLIENT_ERROR_FORBIDDEN:      "Forbidden request",
		CLIENT_ERROR_INTERNAL:       "Internal server error",
		CLIENT_ERROR_TIMEOUT:        "Request timeout",
		CLIENT_ERROR_NETWORK:        "Network error",
		CLIENT_ERROR_RETRYABLE:      "Retryable error",
		CLIENT_ERROR_UNMARSHAL:      "Failed to unmarshal response",
		CLIENT_ERROR_REQUEST_FAILED: "Request failed",
		
		// Validation errors
		VALIDATION_ERROR_MISSING_PARAM:  "Missing required parameter",
		VALIDATION_ERROR_INVALID_TYPE:   "Invalid parameter type",
		VALIDATION_ERROR_INVALID_VALUE:   "Invalid parameter value",
		VALIDATION_ERROR_INVALID_FORMAT: "Invalid parameter format",
		VALIDATION_ERROR_OUT_OF_RANGE:   "Parameter value out of range",
		VALIDATION_ERROR_DUPLICATE_VALUE: "Duplicate parameter value",
		VALIDATION_ERROR_INVALID_SCOPE:  "Invalid scope",
		VALIDATION_ERROR_MISSING_SCOPE:  "Missing required scope",
		
		// Auth errors
		AUTH_ERROR_INVALID_TOKEN:       "Invalid authentication token",
		AUTH_ERROR_UNAUTHORIZED:        "Unauthorized access",
		AUTH_ERROR_TOKEN_EXPIRED:        "Authentication token expired",
		AUTH_ERROR_MISSING_CREDENTIALS:  "Missing authentication credentials",
		AUTH_ERROR_INVALID_CREDENTIALS: "Invalid authentication credentials",
		AUTH_ERROR_FORBIDDEN:            "Forbidden access",
		AUTH_ERROR_SESSION_EXPIRED:      "Session expired",
	}
	
	if desc, ok := descriptions[code]; ok {
		return desc
	}
	return "Unknown error"
}

