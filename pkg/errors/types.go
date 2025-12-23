package errors

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
)

// ErrorCode represents a structured error code
type ErrorCode string

// Error categories and codes
const (
	// Tool Errors (TOOL_xxx)
	ErrCodeToolNotFound         ErrorCode = "TOOL_NOT_FOUND"
	ErrCodeToolExecutionFailed  ErrorCode = "TOOL_EXECUTION_FAILED"
	ErrCodeToolValidationError  ErrorCode = "TOOL_VALIDATION_ERROR"
	ErrCodeToolPermissionDenied ErrorCode = "TOOL_PERMISSION_DENIED"

	// Client Errors (CLIENT_xxx)
	ErrCodeClientNetworkError ErrorCode = "CLIENT_NETWORK_ERROR"
	ErrCodeClientTimeout      ErrorCode = "CLIENT_TIMEOUT"
	ErrCodeClientBadRequest   ErrorCode = "CLIENT_BAD_REQUEST"
	ErrCodeClientUnauthorized ErrorCode = "CLIENT_UNAUTHORIZED"
	ErrCodeClientForbidden    ErrorCode = "CLIENT_FORBIDDEN"
	ErrCodeClientNotFound     ErrorCode = "CLIENT_NOT_FOUND"
	ErrCodeClientRateLimited  ErrorCode = "CLIENT_RATE_LIMITED"
	ErrCodeClientServerError  ErrorCode = "CLIENT_SERVER_ERROR"

	// Validation Errors (VALIDATION_xxx)
	ErrCodeValidationRequired      ErrorCode = "VALIDATION_REQUIRED"
	ErrCodeValidationInvalidFormat ErrorCode = "VALIDATION_INVALID_FORMAT"
	ErrCodeValidationOutOfRange    ErrorCode = "VALIDATION_OUT_OF_RANGE"
	ErrCodeValidationInvalidValue  ErrorCode = "VALIDATION_INVALID_VALUE"

	// Authentication/Authorization Errors (AUTH_xxx)
	ErrCodeAuthInvalidToken       ErrorCode = "AUTH_INVALID_TOKEN"
	ErrCodeAuthExpiredToken       ErrorCode = "AUTH_EXPIRED_TOKEN"
	ErrCodeAuthMissingCredentials ErrorCode = "AUTH_MISSING_CREDENTIALS"
	ErrCodeAuthInsufficientScope  ErrorCode = "AUTH_INSUFFICIENT_SCOPE"
	ErrCodeAuthAccountNotFound    ErrorCode = "AUTH_ACCOUNT_NOT_FOUND"

	// Internal Errors (INTERNAL_xxx)
	ErrCodeInternalError         ErrorCode = "INTERNAL_ERROR"
	ErrCodeInternalConfiguration ErrorCode = "INTERNAL_CONFIGURATION"
	ErrCodeInternalDatabase      ErrorCode = "INTERNAL_DATABASE"
)

// ErrorContext holds contextual information about an error
type ErrorContext struct {
	RequestID  string            `json:"request_id,omitempty"`
	TraceID    string            `json:"trace_id,omitempty"`
	ToolName   string            `json:"tool_name,omitempty"`
	UserID     string            `json:"user_id,omitempty"`
	AccountID  string            `json:"account_id,omitempty"`
	Operation  string            `json:"operation,omitempty"`
	Parameters map[string]any    `json:"parameters,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// BaseError is the common interface for all typed errors
type BaseError interface {
	error
	Code() ErrorCode
	Message() string
	Context() *ErrorContext
	Cause() error
	WithContext(ctx *ErrorContext) BaseError
	WithCause(cause error) BaseError
	WithMetadata(key, value string) BaseError
	WithParameter(key string, value any) BaseError
	GetUserMessage() string
	GetSuggestedActions() []string
	IsRetryable() bool
	GetHTTPStatus() int
	FormatErrorResponse() map[string]any
}

// harnessError implements the BaseError interface
type harnessError struct {
	code    ErrorCode
	message string
	context *ErrorContext
	cause   error
}

// Error implements the error interface
func (e *harnessError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.code, e.message, e.cause)
	}
	return fmt.Sprintf("[%s] %s", e.code, e.message)
}

// Code returns the error code
func (e *harnessError) Code() ErrorCode {
	return e.code
}

// Message returns the error message
func (e *harnessError) Message() string {
	return e.message
}

// Context returns the error context
func (e *harnessError) Context() *ErrorContext {
	return e.context
}

// Cause returns the underlying cause
func (e *harnessError) Cause() error {
	return e.cause
}

// WithContext adds context to the error
func (e *harnessError) WithContext(ctx *ErrorContext) BaseError {
	e.context = ctx
	return e
}

// WithCause adds an underlying cause to the error
func (e *harnessError) WithCause(cause error) BaseError {
	e.cause = cause
	return e
}

// WithMetadata adds metadata to the error context
func (e *harnessError) WithMetadata(key, value string) BaseError {
	if e.context == nil {
		e.context = &ErrorContext{}
	}
	if e.context.Metadata == nil {
		e.context.Metadata = make(map[string]string)
	}
	e.context.Metadata[key] = value
	return e
}

// WithParameter adds a parameter to the error context
func (e *harnessError) WithParameter(key string, value any) BaseError {
	if e.context == nil {
		e.context = &ErrorContext{}
	}
	if e.context.Parameters == nil {
		e.context.Parameters = make(map[string]any)
	}
	e.context.Parameters[key] = value
	return e
}

// GetUserMessage returns a user-friendly message for the error
func (e *harnessError) GetUserMessage() string {
	return GetUserMessage(e)
}

// GetSuggestedActions returns suggested actions for resolving the error
func (e *harnessError) GetSuggestedActions() []string {
	return GetSuggestedActions(e)
}

// IsRetryable returns whether the error is retryable
func (e *harnessError) IsRetryable() bool {
	return IsRetryable(e)
}

// GetHTTPStatus returns the appropriate HTTP status code for the error
func (e *harnessError) GetHTTPStatus() int {
	return GetHTTPStatus(e)
}

// FormatErrorResponse formats an error for API responses
func (e *harnessError) FormatErrorResponse() map[string]any {
	return FormatErrorResponse(e)
}

// ToolError represents errors related to tool execution
type ToolError struct {
	*harnessError
}

// NewToolError creates a new ToolError
func NewToolError(code ErrorCode, message string) *ToolError {
	return &ToolError{
		harnessError: &harnessError{
			code:    code,
			message: message,
		},
	}
}

// ClientError represents errors related to API client operations
type ClientError struct {
	*harnessError
}

// NewClientError creates a new ClientError
func NewClientError(code ErrorCode, message string) *ClientError {
	return &ClientError{
		harnessError: &harnessError{
			code:    code,
			message: message,
		},
	}
}

// ValidationError represents errors related to input validation
type ValidationError struct {
	*harnessError
	Field string `json:"field,omitempty"`
}

// NewValidationError creates a new ValidationError
func NewValidationError(code ErrorCode, message string, field string) *ValidationError {
	return &ValidationError{
		harnessError: &harnessError{
			code:    code,
			message: message,
		},
		Field: field,
	}
}

// AuthError represents errors related to authentication and authorization
type AuthError struct {
	*harnessError
}

// NewAuthError creates a new AuthError
func NewAuthError(code ErrorCode, message string) *AuthError {
	return &AuthError{
		harnessError: &harnessError{
			code:    code,
			message: message,
		},
	}
}

// NewErrorFromContext creates an error with context extracted from the given context
func NewErrorFromContext(ctx context.Context, errType string, code ErrorCode, message string) BaseError {
	errorCtx := &ErrorContext{
		RequestID: getRequestID(ctx),
		TraceID:   getTraceID(ctx),
	}

	var err BaseError
	switch errType {
	case "tool":
		err = NewToolError(code, message)
	case "client":
		err = NewClientError(code, message)
	case "validation":
		err = NewValidationError(code, message, "")
	case "auth":
		err = NewAuthError(code, message)
	default:
		err = &harnessError{
			code:    code,
			message: message,
		}
	}

	return err.WithContext(errorCtx)
}

// Helper functions to extract context values
func getRequestID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	// Try different keys that might contain request ID
	if id, ok := ctx.Value("request_id").(string); ok {
		return id
	}
	if id, ok := ctx.Value("conversation_id").(string); ok {
		return id
	}
	return ""
}

func getTraceID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if id, ok := ctx.Value("trace_id").(string); ok {
		return id
	}
	// Generate a new trace ID if none exists
	return uuid.New().String()
}

// LogError logs an error with structured context
func LogError(ctx context.Context, err error, logger *slog.Logger) {
	if err == nil {
		return
	}

	// Check if it's a BaseError with context
	var baseErr BaseError
	if b, ok := err.(BaseError); ok {
		baseErr = b
	} else {
		// Create a generic error with context
		baseErr = NewErrorFromContext(ctx, "internal", ErrCodeInternalError, err.Error())
	}

	errorContext := baseErr.Context()
	if errorContext == nil {
		errorContext = &ErrorContext{}
	}

	// Build log attributes
	attrs := []any{
		slog.String("error_code", string(baseErr.Code())),
		slog.String("error_message", baseErr.Message()),
	}

	if errorContext.RequestID != "" {
		attrs = append(attrs, slog.String("request_id", errorContext.RequestID))
	}
	if errorContext.TraceID != "" {
		attrs = append(attrs, slog.String("trace_id", errorContext.TraceID))
	}
	if errorContext.ToolName != "" {
		attrs = append(attrs, slog.String("tool_name", errorContext.ToolName))
	}
	if errorContext.Operation != "" {
		attrs = append(attrs, slog.String("operation", errorContext.Operation))
	}

	// Add cause if present
	if cause := baseErr.Cause(); cause != nil {
		attrs = append(attrs, slog.String("cause", cause.Error()))
	}

	logger.Error("Error occurred", attrs...)
}
