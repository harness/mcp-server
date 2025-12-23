package errors

import (
	"context"
	"fmt"
	"net/http"
)

// Common error creation helpers

// NewToolNotFoundError creates a tool not found error
func NewToolNotFoundError(toolName string) BaseError {
	return NewToolError(ErrCodeToolNotFound, fmt.Sprintf("Tool '%s' not found", toolName)).
		WithMetadata("tool_name", toolName)
}

// NewToolExecutionError creates a tool execution error
func NewToolExecutionError(toolName string, cause error) BaseError {
	return NewToolError(ErrCodeToolExecutionFailed, fmt.Sprintf("Tool '%s' execution failed", toolName)).
		WithCause(cause).
		WithMetadata("tool_name", toolName)
}

// NewToolValidationError creates a tool validation error
func NewToolValidationError(toolName, field, reason string) BaseError {
	return NewValidationError(ErrCodeToolValidationError, fmt.Sprintf("Validation failed for tool '%s': %s", toolName, reason), field).
		WithMetadata("tool_name", toolName)
}

// NewToolPermissionDeniedError creates a tool permission denied error
func NewToolPermissionDeniedError(toolName, userID string) BaseError {
	return NewToolError(ErrCodeToolPermissionDenied, fmt.Sprintf("Permission denied for tool '%s'", toolName)).
		WithMetadata("tool_name", toolName).
		WithMetadata("user_id", userID)
}

// NewClientNetworkError creates a network error
func NewClientNetworkError(operation string, cause error) BaseError {
	return NewClientError(ErrCodeClientNetworkError, fmt.Sprintf("Network error during %s", operation)).
		WithCause(cause).
		WithMetadata("operation", operation)
}

// NewClientTimeoutError creates a timeout error
func NewClientTimeoutError(operation string) BaseError {
	return NewClientError(ErrCodeClientTimeout, fmt.Sprintf("Request timeout during %s", operation)).
		WithMetadata("operation", operation)
}

// NewClientBadRequestError creates a bad request error
func NewClientBadRequestError(details string) BaseError {
	return NewClientError(ErrCodeClientBadRequest, fmt.Sprintf("Bad request: %s", details)).
		WithMetadata("details", details)
}

// NewClientUnauthorizedError creates an unauthorized error
func NewClientUnauthorizedError() BaseError {
	return NewClientError(ErrCodeClientUnauthorized, "Authentication required")
}

// NewClientForbiddenError creates a forbidden error
func NewClientForbiddenError(resource string) BaseError {
	return NewClientError(ErrCodeClientForbidden, fmt.Sprintf("Access denied to resource: %s", resource)).
		WithMetadata("resource", resource)
}

// NewClientNotFoundError creates a not found error
func NewClientNotFoundError(resource string) BaseError {
	return NewClientError(ErrCodeClientNotFound, fmt.Sprintf("Resource not found: %s", resource)).
		WithMetadata("resource", resource)
}

// NewClientRateLimitedError creates a rate limit error
func NewClientRateLimitedError() BaseError {
	return NewClientError(ErrCodeClientRateLimited, "Rate limit exceeded")
}

// NewClientServerError creates a server error
func NewClientServerError(statusCode int, details string) *ClientError {
	return NewClientError(ErrCodeClientServerError, fmt.Sprintf("Server error (%d): %s", statusCode, details)).
		WithMetadata("status_code", fmt.Sprintf("%d", statusCode)).
		WithMetadata("details", details).(*ClientError)
}

// NewValidationRequiredError creates a required field error
func NewValidationRequiredError(field string) BaseError {
	return NewValidationError(ErrCodeValidationRequired, fmt.Sprintf("Field '%s' is required", field), field)
}

// NewValidationInvalidFormatError creates an invalid format error
func NewValidationInvalidFormatError(field, expectedFormat string) BaseError {
	return NewValidationError(ErrCodeValidationInvalidFormat,
		fmt.Sprintf("Field '%s' has invalid format, expected: %s", field, expectedFormat), field).
		WithMetadata("expected_format", expectedFormat)
}

// NewValidationOutOfRangeError creates an out of range error
func NewValidationOutOfRangeError(field string, min, max any) BaseError {
	return NewValidationError(ErrCodeValidationOutOfRange,
		fmt.Sprintf("Field '%s' value out of range (%v - %v)", field, min, max), field).
		WithMetadata("min_value", fmt.Sprintf("%v", min)).
		WithMetadata("max_value", fmt.Sprintf("%v", max))
}

// NewValidationInvalidValueError creates an invalid value error
func NewValidationInvalidValueError(field string, value, allowedValues any) BaseError {
	return NewValidationError(ErrCodeValidationInvalidValue,
		fmt.Sprintf("Field '%s' has invalid value: %v", field, value), field).
		WithMetadata("provided_value", fmt.Sprintf("%v", value)).
		WithMetadata("allowed_values", fmt.Sprintf("%v", allowedValues))
}

// NewAuthInvalidTokenError creates an invalid token error
func NewAuthInvalidTokenError() BaseError {
	return NewAuthError(ErrCodeAuthInvalidToken, "Invalid authentication token")
}

// NewAuthExpiredTokenError creates an expired token error
func NewAuthExpiredTokenError() BaseError {
	return NewAuthError(ErrCodeAuthExpiredToken, "Authentication token has expired")
}

// NewAuthMissingCredentialsError creates a missing credentials error
func NewAuthMissingCredentialsError() BaseError {
	return NewAuthError(ErrCodeAuthMissingCredentials, "Authentication credentials are missing")
}

// NewAuthInsufficientScopeError creates an insufficient scope error
func NewAuthInsufficientScopeError(requiredScope string) BaseError {
	return NewAuthError(ErrCodeAuthInsufficientScope,
		fmt.Sprintf("Insufficient scope: %s required", requiredScope)).
		WithMetadata("required_scope", requiredScope)
}

// NewAuthAccountNotFoundError creates an account not found error
func NewAuthAccountNotFoundError(accountID string) BaseError {
	return NewAuthError(ErrCodeAuthAccountNotFound,
		fmt.Sprintf("Account not found: %s", accountID)).
		WithMetadata("account_id", accountID)
}

// NewInternalError creates an internal error
func NewInternalError(message string, cause error) *harnessError {
	return &harnessError{
		code:    ErrCodeInternalError,
		message: message,
		cause:   cause,
	}
}

// NewConfigurationError creates a configuration error
func NewConfigurationError(message string) *harnessError {
	return &harnessError{
		code:    ErrCodeInternalConfiguration,
		message: message,
	}
}

// NewDatabaseError creates a database error
func NewDatabaseError(operation string, cause error) *harnessError {
	return &harnessError{
		code:    ErrCodeInternalDatabase,
		message: fmt.Sprintf("Database error during %s", operation),
		cause:   cause,
	}
}

// HTTP status code helpers

// HTTPStatusFromError returns the appropriate HTTP status code for an error
func HTTPStatusFromError(err error) int {
	if baseErr, ok := err.(BaseError); ok {
		return baseErr.GetHTTPStatus()
	}
	return http.StatusInternalServerError
}

// IsRetryableError checks if an error is retryable
func IsRetryableError(err error) bool {
	if baseErr, ok := err.(BaseError); ok {
		return baseErr.IsRetryable()
	}
	return false
}

// ErrorFromHTTPStatus creates an appropriate error from HTTP status code
func ErrorFromHTTPStatus(statusCode int, details string) BaseError {
	switch statusCode {
	case http.StatusBadRequest:
		return NewClientBadRequestError(details)
	case http.StatusUnauthorized:
		return NewClientUnauthorizedError()
	case http.StatusForbidden:
		return NewClientForbiddenError(details)
	case http.StatusNotFound:
		return NewClientNotFoundError(details)
	case http.StatusTooManyRequests:
		return NewClientRateLimitedError()
	case http.StatusGatewayTimeout, http.StatusRequestTimeout:
		return NewClientTimeoutError("HTTP request")
	default:
		if statusCode >= 500 {
			return NewClientServerError(statusCode, details)
		}
	}
	return NewInternalError(fmt.Sprintf("HTTP %d: %s", statusCode, details), nil)
}

// Context helpers

// WithToolContext adds tool-specific context to an error
func WithToolContext(err BaseError, toolName, operation string) BaseError {
	return err.WithMetadata("tool_name", toolName).
		WithMetadata("operation", operation)
}

// WithUserContext adds user-specific context to an error
func WithUserContext(err BaseError, userID, accountID string) BaseError {
	return err.WithMetadata("user_id", userID).
		WithMetadata("account_id", accountID)
}

// WithRequestContext adds request-specific context to an error
func WithRequestContext(err BaseError, requestID, traceID string) BaseError {
	errorCtx := err.Context()
	if errorCtx == nil {
		errorCtx = &ErrorContext{}
	}
	errorCtx.RequestID = requestID
	errorCtx.TraceID = traceID
	return err.WithContext(errorCtx)
}

// FromContext creates an error with context extracted from the given context
func FromContext(ctx context.Context, err error, code ErrorCode, message string) BaseError {
	if baseErr, ok := err.(BaseError); ok {
		return baseErr.WithContext(&ErrorContext{
			RequestID: getRequestID(ctx),
			TraceID:   getTraceID(ctx),
		})
	}

	return NewErrorFromContext(ctx, "internal", code, message).WithCause(err)
}
