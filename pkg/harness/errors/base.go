package errors

import (
	"fmt"
)

// ErrorContext holds additional context information for errors
type ErrorContext struct {
	RequestID string
	TraceID   string
	ToolName  string
	Context   map[string]interface{}
}

// BaseError is the base error type that all specific error types embed
type BaseError struct {
	Code      string
	Message   string
	RequestID string
	TraceID   string
	ToolName  string
	Context   map[string]interface{}
	Err       error // wrapped error for error wrapping support
}

// Error implements the error interface
func (e *BaseError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the wrapped error for error wrapping support
func (e *BaseError) Unwrap() error {
	return e.Err
}

// WithContext adds additional context to the error
func (e *BaseError) WithContext(key string, value interface{}) *BaseError {
	if e.Context == nil {
		e.Context = make(map[string]interface{})
	}
	e.Context[key] = value
	return e
}

// GetContext returns the error context
func (e *BaseError) GetContext() ErrorContext {
	return ErrorContext{
		RequestID: e.RequestID,
		TraceID:   e.TraceID,
		ToolName:  e.ToolName,
		Context:   e.Context,
	}
}

// IsErrorType checks if the error is of a specific type
func IsErrorType(err error, errorType string) bool {
	if err == nil {
		return false
	}
	
	switch errorType {
	case "ToolError":
		_, ok := err.(*ToolError)
		return ok
	case "ClientError":
		_, ok := err.(*ClientError)
		return ok
	case "ValidationError":
		_, ok := err.(*ValidationError)
		return ok
	case "AuthError":
		_, ok := err.(*AuthError)
		return ok
	default:
		return false
	}
}

