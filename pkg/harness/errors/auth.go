package errors

import (
	"context"
	"fmt"
)

// AuthError represents an error that occurred during authentication
type AuthError struct {
	BaseError
}

// NewAuthError creates a new AuthError with context extraction
func NewAuthError(ctx context.Context, code string, message string) *AuthError {
	errorCtx := ExtractErrorContext(ctx)
	return &AuthError{
		BaseError: BaseError{
			Code:      code,
			Message:   message,
			RequestID: errorCtx.RequestID,
			TraceID:   errorCtx.TraceID,
			ToolName:  errorCtx.ToolName,
			Context:   errorCtx.Context,
		},
	}
}

// NewAuthErrorf creates a new AuthError with formatted message
func NewAuthErrorf(ctx context.Context, code string, format string, args ...interface{}) *AuthError {
	return NewAuthError(ctx, code, fmt.Sprintf(format, args...))
}

// WrapAuthError wraps an existing error as an AuthError
func WrapAuthError(ctx context.Context, err error, code string, message string) *AuthError {
	errorCtx := ExtractErrorContext(ctx)
	return &AuthError{
		BaseError: BaseError{
			Code:      code,
			Message:   message,
			RequestID: errorCtx.RequestID,
			TraceID:   errorCtx.TraceID,
			ToolName:  errorCtx.ToolName,
			Context:   errorCtx.Context,
			Err:       err,
		},
	}
}

// WrapAuthErrorf wraps an existing error as an AuthError with formatted message
func WrapAuthErrorf(ctx context.Context, err error, code string, format string, args ...interface{}) *AuthError {
	return WrapAuthError(ctx, err, code, fmt.Sprintf(format, args...))
}

