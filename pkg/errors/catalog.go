package errors

import (
	"context"
)

// ErrorDefinition defines the structure of an error in the catalog
type ErrorDefinition struct {
	Code             ErrorCode `json:"code"`
	Category         string    `json:"category"`
	Description      string    `json:"description"`
	UserMessage      string    `json:"user_message"`
	SuggestedActions []string  `json:"suggested_actions"`
	HTTPStatus       int       `json:"http_status"`
	Retryable        bool      `json:"retryable"`
}

// ErrorCatalog contains all defined errors
var ErrorCatalog = map[ErrorCode]ErrorDefinition{
	// Tool Errors
	ErrCodeToolNotFound: {
		Code:             ErrCodeToolNotFound,
		Category:         "Tool",
		Description:      "The requested tool was not found",
		UserMessage:      "The tool you're trying to use is not available",
		SuggestedActions: []string{"Check the tool name", "Verify tool permissions", "Contact support"},
		HTTPStatus:       404,
		Retryable:        false,
	},
	ErrCodeToolExecutionFailed: {
		Code:             ErrCodeToolExecutionFailed,
		Category:         "Tool",
		Description:      "Tool execution failed due to an internal error",
		UserMessage:      "The tool failed to execute. Please try again",
		SuggestedActions: []string{"Retry the operation", "Check input parameters", "Contact support if issue persists"},
		HTTPStatus:       500,
		Retryable:        true,
	},
	ErrCodeToolValidationError: {
		Code:             ErrCodeToolValidationError,
		Category:         "Tool",
		Description:      "Input validation failed for the tool",
		UserMessage:      "The provided input is invalid",
		SuggestedActions: []string{"Check the input format", "Review parameter requirements", "See tool documentation"},
		HTTPStatus:       400,
		Retryable:        false,
	},
	ErrCodeToolPermissionDenied: {
		Code:             ErrCodeToolPermissionDenied,
		Category:         "Tool",
		Description:      "Insufficient permissions to execute the tool",
		UserMessage:      "You don't have permission to use this tool",
		SuggestedActions: []string{"Check your permissions", "Contact your administrator", "Use an alternative tool"},
		HTTPStatus:       403,
		Retryable:        false,
	},

	// Client Errors
	ErrCodeClientNetworkError: {
		Code:             ErrCodeClientNetworkError,
		Category:         "Client",
		Description:      "Network error occurred while communicating with the service",
		UserMessage:      "Network connection failed",
		SuggestedActions: []string{"Check your internet connection", "Retry the operation", "Contact support if issue persists"},
		HTTPStatus:       502,
		Retryable:        true,
	},
	ErrCodeClientTimeout: {
		Code:             ErrCodeClientTimeout,
		Category:         "Client",
		Description:      "Request timed out",
		UserMessage:      "The operation timed out. Please try again",
		SuggestedActions: []string{"Retry the operation", "Check network connectivity", "Try again later"},
		HTTPStatus:       504,
		Retryable:        true,
	},
	ErrCodeClientBadRequest: {
		Code:             ErrCodeClientBadRequest,
		Category:         "Client",
		Description:      "The request was malformed or invalid",
		UserMessage:      "Invalid request parameters",
		SuggestedActions: []string{"Check input parameters", "Review API documentation", "Correct the request format"},
		HTTPStatus:       400,
		Retryable:        false,
	},
	ErrCodeClientUnauthorized: {
		Code:             ErrCodeClientUnauthorized,
		Category:         "Client",
		Description:      "Authentication credentials are missing or invalid",
		UserMessage:      "Authentication required",
		SuggestedActions: []string{"Check your credentials", "Re-authenticate", "Verify API key"},
		HTTPStatus:       401,
		Retryable:        false,
	},
	ErrCodeClientForbidden: {
		Code:             ErrCodeClientForbidden,
		Category:         "Client",
		Description:      "Access to the requested resource is forbidden",
		UserMessage:      "Access denied",
		SuggestedActions: []string{"Check your permissions", "Contact administrator", "Verify account access"},
		HTTPStatus:       403,
		Retryable:        false,
	},
	ErrCodeClientNotFound: {
		Code:             ErrCodeClientNotFound,
		Category:         "Client",
		Description:      "The requested resource was not found",
		UserMessage:      "Resource not found",
		SuggestedActions: []string{"Check the resource identifier", "Verify the resource exists", "Check permissions"},
		HTTPStatus:       404,
		Retryable:        false,
	},
	ErrCodeClientRateLimited: {
		Code:             ErrCodeClientRateLimited,
		Category:         "Client",
		Description:      "Too many requests, rate limit exceeded",
		UserMessage:      "Too many requests. Please wait before retrying",
		SuggestedActions: []string{"Wait before retrying", "Reduce request frequency", "Contact support for higher limits"},
		HTTPStatus:       429,
		Retryable:        true,
	},
	ErrCodeClientServerError: {
		Code:             ErrCodeClientServerError,
		Category:         "Client",
		Description:      "Internal server error occurred",
		UserMessage:      "Server error occurred",
		SuggestedActions: []string{"Retry the operation", "Contact support if issue persists"},
		HTTPStatus:       500,
		Retryable:        true,
	},

	// Validation Errors
	ErrCodeValidationRequired: {
		Code:             ErrCodeValidationRequired,
		Category:         "Validation",
		Description:      "A required field or parameter is missing",
		UserMessage:      "Required field is missing",
		SuggestedActions: []string{"Provide the required field", "Check documentation for required parameters"},
		HTTPStatus:       400,
		Retryable:        false,
	},
	ErrCodeValidationInvalidFormat: {
		Code:             ErrCodeValidationInvalidFormat,
		Category:         "Validation",
		Description:      "The provided value has an invalid format",
		UserMessage:      "Invalid format",
		SuggestedActions: []string{"Check the expected format", "Correct the input value", "See documentation"},
		HTTPStatus:       400,
		Retryable:        false,
	},
	ErrCodeValidationOutOfRange: {
		Code:             ErrCodeValidationOutOfRange,
		Category:         "Validation",
		Description:      "The provided value is outside the allowed range",
		UserMessage:      "Value out of range",
		SuggestedActions: []string{"Check the allowed range", "Provide a value within limits", "See documentation"},
		HTTPStatus:       400,
		Retryable:        false,
	},
	ErrCodeValidationInvalidValue: {
		Code:             ErrCodeValidationInvalidValue,
		Category:         "Validation",
		Description:      "The provided value is not valid",
		UserMessage:      "Invalid value",
		SuggestedActions: []string{"Check allowed values", "Provide a valid value", "See documentation"},
		HTTPStatus:       400,
		Retryable:        false,
	},

	// Authentication/Authorization Errors
	ErrCodeAuthInvalidToken: {
		Code:             ErrCodeAuthInvalidToken,
		Category:         "Authentication",
		Description:      "The provided authentication token is invalid",
		UserMessage:      "Invalid authentication token",
		SuggestedActions: []string{"Re-authenticate", "Check token validity", "Generate new token"},
		HTTPStatus:       401,
		Retryable:        false,
	},
	ErrCodeAuthExpiredToken: {
		Code:             ErrCodeAuthExpiredToken,
		Category:         "Authentication",
		Description:      "The authentication token has expired",
		UserMessage:      "Authentication token expired",
		SuggestedActions: []string{"Re-authenticate", "Refresh token", "Generate new token"},
		HTTPStatus:       401,
		Retryable:        false,
	},
	ErrCodeAuthMissingCredentials: {
		Code:             ErrCodeAuthMissingCredentials,
		Category:         "Authentication",
		Description:      "Authentication credentials are missing",
		UserMessage:      "Authentication credentials required",
		SuggestedActions: []string{"Provide authentication credentials", "Check authentication setup"},
		HTTPStatus:       401,
		Retryable:        false,
	},
	ErrCodeAuthInsufficientScope: {
		Code:             ErrCodeAuthInsufficientScope,
		Category:         "Authorization",
		Description:      "The token does not have sufficient scope for the operation",
		UserMessage:      "Insufficient permissions",
		SuggestedActions: []string{"Check token scopes", "Request additional permissions", "Contact administrator"},
		HTTPStatus:       403,
		Retryable:        false,
	},
	ErrCodeAuthAccountNotFound: {
		Code:             ErrCodeAuthAccountNotFound,
		Category:         "Authentication",
		Description:      "The specified account was not found",
		UserMessage:      "Account not found",
		SuggestedActions: []string{"Check account identifier", "Verify account exists", "Contact support"},
		HTTPStatus:       404,
		Retryable:        false,
	},

	// Internal Errors
	ErrCodeInternalError: {
		Code:             ErrCodeInternalError,
		Category:         "Internal",
		Description:      "An internal error occurred",
		UserMessage:      "An internal error occurred",
		SuggestedActions: []string{"Retry the operation", "Contact support if issue persists"},
		HTTPStatus:       500,
		Retryable:        true,
	},
	ErrCodeInternalConfiguration: {
		Code:             ErrCodeInternalConfiguration,
		Category:         "Internal",
		Description:      "Configuration error occurred",
		UserMessage:      "Configuration error",
		SuggestedActions: []string{"Contact support", "Check system configuration"},
		HTTPStatus:       500,
		Retryable:        false,
	},
	ErrCodeInternalDatabase: {
		Code:             ErrCodeInternalDatabase,
		Category:         "Internal",
		Description:      "Database error occurred",
		UserMessage:      "Database error",
		SuggestedActions: []string{"Retry the operation", "Contact support if issue persists"},
		HTTPStatus:       500,
		Retryable:        true,
	},
}

// GetErrorDefinition returns the error definition for a given error code
func GetErrorDefinition(code ErrorCode) (ErrorDefinition, bool) {
	def, exists := ErrorCatalog[code]
	return def, exists
}

// GetUserMessage returns a user-friendly message for the error
func GetUserMessage(e BaseError) string {
	if def, exists := GetErrorDefinition(e.Code()); exists {
		return def.UserMessage
	}
	return e.Message()
}

// GetSuggestedActions returns suggested actions for resolving the error
func GetSuggestedActions(e BaseError) []string {
	if def, exists := GetErrorDefinition(e.Code()); exists {
		return def.SuggestedActions
	}
	return []string{"Contact support for assistance"}
}

// IsRetryable returns whether the error is retryable
func IsRetryable(e BaseError) bool {
	if def, exists := GetErrorDefinition(e.Code()); exists {
		return def.Retryable
	}
	return false
}

// GetHTTPStatus returns the appropriate HTTP status code for the error
func GetHTTPStatus(e BaseError) int {
	if def, exists := GetErrorDefinition(e.Code()); exists {
		return def.HTTPStatus
	}
	return 500 // Default to internal server error
}

// FormatErrorResponse formats an error for API responses
func FormatErrorResponse(e BaseError) map[string]any {
	response := map[string]any{
		"code":    string(e.Code()),
		"message": e.GetUserMessage(),
		"details": e.Message(),
	}

	if e.Context() != nil {
		if e.Context().RequestID != "" {
			response["request_id"] = e.Context().RequestID
		}
		if e.Context().TraceID != "" {
			response["trace_id"] = e.Context().TraceID
		}
	}

	if actions := e.GetSuggestedActions(); len(actions) > 0 {
		response["suggested_actions"] = actions
	}

	return response
}

// WrapError wraps an existing error with additional context
func WrapError(err error, code ErrorCode, message string) BaseError {
	var baseErr BaseError

	// If it's already a BaseError, preserve the type
	switch err.(type) {
	case *ToolError:
		baseErr = NewToolError(code, message)
	case *ClientError:
		baseErr = NewClientError(code, message)
	case *ValidationError:
		baseErr = NewValidationError(code, message, "")
	case *AuthError:
		baseErr = NewAuthError(code, message)
	default:
		baseErr = &harnessError{
			code:    code,
			message: message,
		}
	}

	return baseErr.WithCause(err)
}

// NewErrorWithContext creates an error with full context
func NewErrorWithContext(code ErrorCode, message string, ctx context.Context, toolName, operation string, params map[string]any) BaseError {
	errorCtx := &ErrorContext{
		RequestID:  getRequestID(ctx),
		TraceID:    getTraceID(ctx),
		ToolName:   toolName,
		Operation:  operation,
		Parameters: params,
	}

	return &harnessError{
		code:    code,
		message: message,
		context: errorCtx,
	}
}
