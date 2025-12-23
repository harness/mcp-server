package errors

import (
	"context"
	"fmt"
)

// ToolError represents an error that occurred during tool execution
type ToolError struct {
	BaseError
}

// NewToolError creates a new ToolError with context extraction
func NewToolError(ctx context.Context, code string, message string) *ToolError {
	errorCtx := ExtractErrorContext(ctx)
	return &ToolError{
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

// NewToolErrorf creates a new ToolError with formatted message
func NewToolErrorf(ctx context.Context, code string, format string, args ...interface{}) *ToolError {
	return NewToolError(ctx, code, fmt.Sprintf(format, args...))
}

// WrapToolError wraps an existing error as a ToolError
func WrapToolError(ctx context.Context, err error, code string, message string) *ToolError {
	errorCtx := ExtractErrorContext(ctx)
	return &ToolError{
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

// WrapToolErrorf wraps an existing error as a ToolError with formatted message
func WrapToolErrorf(ctx context.Context, err error, code string, format string, args ...interface{}) *ToolError {
	return WrapToolError(ctx, err, code, fmt.Sprintf(format, args...))
}

