package errors

import (
	"context"
	"fmt"
)

// ValidationError represents an error that occurred during parameter validation
type ValidationError struct {
	BaseError
	Parameter string // The parameter that failed validation
}

// NewValidationError creates a new ValidationError with context extraction
func NewValidationError(ctx context.Context, code string, message string) *ValidationError {
	errorCtx := ExtractErrorContext(ctx)
	return &ValidationError{
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

// NewValidationErrorf creates a new ValidationError with formatted message
func NewValidationErrorf(ctx context.Context, code string, format string, args ...interface{}) *ValidationError {
	return NewValidationError(ctx, code, fmt.Sprintf(format, args...))
}

// NewValidationErrorWithParam creates a new ValidationError with parameter name
func NewValidationErrorWithParam(ctx context.Context, code string, message string, parameter string) *ValidationError {
	errorCtx := ExtractErrorContext(ctx)
	err := &ValidationError{
		BaseError: BaseError{
			Code:      code,
			Message:   message,
			RequestID: errorCtx.RequestID,
			TraceID:   errorCtx.TraceID,
			ToolName:  errorCtx.ToolName,
			Context:   errorCtx.Context,
		},
		Parameter: parameter,
	}
	if err.Context == nil {
		err.Context = make(map[string]interface{})
	}
	err.Context["parameter"] = parameter
	return err
}

// WrapValidationError wraps an existing error as a ValidationError
func WrapValidationError(ctx context.Context, err error, code string, message string) *ValidationError {
	errorCtx := ExtractErrorContext(ctx)
	return &ValidationError{
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

// WrapValidationErrorf wraps an existing error as a ValidationError with formatted message
func WrapValidationErrorf(ctx context.Context, err error, code string, format string, args ...interface{}) *ValidationError {
	return WrapValidationError(ctx, err, code, fmt.Sprintf(format, args...))
}

