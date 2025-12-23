package errors

import (
	"context"
	"fmt"
)

// ClientError represents an error that occurred during client/API operations
type ClientError struct {
	BaseError
	StatusCode int // HTTP status code if applicable
}

// NewClientError creates a new ClientError with context extraction
func NewClientError(ctx context.Context, code string, message string) *ClientError {
	errorCtx := ExtractErrorContext(ctx)
	return &ClientError{
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

// NewClientErrorf creates a new ClientError with formatted message
func NewClientErrorf(ctx context.Context, code string, format string, args ...interface{}) *ClientError {
	return NewClientError(ctx, code, fmt.Sprintf(format, args...))
}

// NewClientErrorWithStatus creates a new ClientError with HTTP status code
func NewClientErrorWithStatus(ctx context.Context, code string, message string, statusCode int) *ClientError {
	errorCtx := ExtractErrorContext(ctx)
	return &ClientError{
		BaseError: BaseError{
			Code:      code,
			Message:   message,
			RequestID: errorCtx.RequestID,
			TraceID:   errorCtx.TraceID,
			ToolName:  errorCtx.ToolName,
			Context:   errorCtx.Context,
		},
		StatusCode: statusCode,
	}
}

// WrapClientError wraps an existing error as a ClientError
func WrapClientError(ctx context.Context, err error, code string, message string) *ClientError {
	errorCtx := ExtractErrorContext(ctx)
	return &ClientError{
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

// WrapClientErrorf wraps an existing error as a ClientError with formatted message
func WrapClientErrorf(ctx context.Context, err error, code string, format string, args ...interface{}) *ClientError {
	return WrapClientError(ctx, err, code, fmt.Sprintf(format, args...))
}

// WrapClientErrorWithStatus wraps an existing error as a ClientError with HTTP status code
func WrapClientErrorWithStatus(ctx context.Context, err error, code string, message string, statusCode int) *ClientError {
	errorCtx := ExtractErrorContext(ctx)
	return &ClientError{
		BaseError: BaseError{
			Code:      code,
			Message:   message,
			RequestID: errorCtx.RequestID,
			TraceID:   errorCtx.TraceID,
			ToolName:  errorCtx.ToolName,
			Context:   errorCtx.Context,
			Err:       err,
		},
		StatusCode: statusCode,
	}
}

