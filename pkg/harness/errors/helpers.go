package errors

import (
	"context"
	"fmt"
)

// WrapError wraps an existing error with context and error code
// It attempts to detect the error type and wrap appropriately
func WrapError(ctx context.Context, err error, code string, message string) error {
	if err == nil {
		return nil
	}
	
	// Check if error is already one of our typed errors
	if toolErr, ok := err.(*ToolError); ok {
		return WrapToolError(ctx, toolErr.Err, code, message)
	}
	if clientErr, ok := err.(*ClientError); ok {
		return WrapClientError(ctx, clientErr.Err, code, message)
	}
	if validationErr, ok := err.(*ValidationError); ok {
		return WrapValidationError(ctx, validationErr.Err, code, message)
	}
	if authErr, ok := err.(*AuthError); ok {
		return WrapAuthError(ctx, authErr.Err, code, message)
	}
	
	// Determine error type from code prefix
	switch {
	case isToolErrorCode(code):
		return WrapToolError(ctx, err, code, message)
	case isClientErrorCode(code):
		return WrapClientError(ctx, err, code, message)
	case isValidationErrorCode(code):
		return WrapValidationError(ctx, err, code, message)
	case isAuthErrorCode(code):
		return WrapAuthError(ctx, err, code, message)
	default:
		// Default to ToolError for unknown codes
		return WrapToolError(ctx, err, code, message)
	}
}

// WrapErrorf wraps an existing error with context and formatted message
func WrapErrorf(ctx context.Context, err error, code string, format string, args ...interface{}) error {
	return WrapError(ctx, err, code, fmt.Sprintf(format, args...))
}

// Helper functions to check error code prefixes
func isToolErrorCode(code string) bool {
	return len(code) >= 11 && code[:11] == "TOOL_ERROR_"
}

func isClientErrorCode(code string) bool {
	return len(code) >= 13 && code[:13] == "CLIENT_ERROR_"
}

func isValidationErrorCode(code string) bool {
	return len(code) >= 19 && code[:19] == "VALIDATION_ERROR_"
}

func isAuthErrorCode(code string) bool {
	return len(code) >= 11 && code[:11] == "AUTH_ERROR_"
}

// GetErrorCode extracts the error code from an error
func GetErrorCode(err error) string {
	if err == nil {
		return ""
	}
	
	switch e := err.(type) {
	case *ToolError:
		return e.Code
	case *ClientError:
		return e.Code
	case *ValidationError:
		return e.Code
	case *AuthError:
		return e.Code
	default:
		return ""
	}
}

// GetErrorContext extracts error context from an error
func GetErrorContext(err error) ErrorContext {
	if err == nil {
		return ErrorContext{}
	}
	
	switch e := err.(type) {
	case *ToolError:
		return e.GetContext()
	case *ClientError:
		return e.GetContext()
	case *ValidationError:
		return e.GetContext()
	case *AuthError:
		return e.GetContext()
	default:
		return ErrorContext{}
	}
}

