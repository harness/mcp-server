package errors

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestNewToolError(t *testing.T) {
	err := NewToolError(ErrCodeToolNotFound, "Tool not found")

	if err.Code() != ErrCodeToolNotFound {
		t.Errorf("Expected code %s, got %s", ErrCodeToolNotFound, err.Code())
	}

	if err.Message() != "Tool not found" {
		t.Errorf("Expected message 'Tool not found', got '%s'", err.Message())
	}

	expectedError := "[TOOL_NOT_FOUND] Tool not found"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}
}

func TestErrorWithCause(t *testing.T) {
	cause := errors.New("underlying error")
	err := NewToolError(ErrCodeToolExecutionFailed, "Tool failed").WithCause(cause)

	if err.Cause() != cause {
		t.Errorf("Expected cause to be set")
	}

	errorStr := err.Error()
	if !contains(errorStr, "underlying error") {
		t.Errorf("Expected error to contain cause, got '%s'", errorStr)
	}
}

func TestErrorWithContext(t *testing.T) {
	requestID := uuid.New().String()
	traceID := uuid.New().String()

	err := NewToolError(ErrCodeToolExecutionFailed, "Tool failed").WithContext(&ErrorContext{
		RequestID: requestID,
		TraceID:   traceID,
	})

	ctx := err.Context()
	if ctx == nil {
		t.Fatal("Expected context to be set")
	}

	if ctx.RequestID != requestID {
		t.Errorf("Expected request ID %s, got %s", requestID, ctx.RequestID)
	}

	if ctx.TraceID != traceID {
		t.Errorf("Expected trace ID %s, got %s", traceID, ctx.TraceID)
	}
}

func TestErrorFromContext(t *testing.T) {
	ctx := context.Background()
	ctx = context.WithValue(ctx, "request_id", "test-request-id")
	ctx = context.WithValue(ctx, "trace_id", "test-trace-id")

	err := NewErrorFromContext(ctx, "tool", ErrCodeToolNotFound, "Tool not found")

	if err.Code() != ErrCodeToolNotFound {
		t.Errorf("Expected code %s, got %s", ErrCodeToolNotFound, err.Code())
	}

	errorCtx := err.Context()
	if errorCtx == nil {
		t.Fatal("Expected context to be extracted")
	}

	if errorCtx.RequestID != "test-request-id" {
		t.Errorf("Expected request ID 'test-request-id', got '%s'", errorCtx.RequestID)
	}

	if errorCtx.TraceID != "test-trace-id" {
		t.Errorf("Expected trace ID 'test-trace-id', got '%s'", errorCtx.TraceID)
	}
}

func TestErrorCatalog(t *testing.T) {
	def, exists := GetErrorDefinition(ErrCodeToolNotFound)
	if !exists {
		t.Fatal("Expected error definition to exist")
	}

	if def.Code != ErrCodeToolNotFound {
		t.Errorf("Expected code %s, got %s", ErrCodeToolNotFound, def.Code)
	}

	if def.Category != "Tool" {
		t.Errorf("Expected category 'Tool', got '%s'", def.Category)
	}

	if def.Retryable {
		t.Errorf("Expected tool not found to not be retryable")
	}
}

func TestErrorUserMessage(t *testing.T) {
	err := NewToolError(ErrCodeToolNotFound, "Custom message")

	userMsg := err.GetUserMessage()
	expected := "The tool you're trying to use is not available"
	if userMsg != expected {
		t.Errorf("Expected user message '%s', got '%s'", expected, userMsg)
	}
}

func TestErrorHelpers(t *testing.T) {
	err := NewToolNotFoundError("test_tool")
	if err.Code() != ErrCodeToolNotFound {
		t.Errorf("Expected tool not found error")
	}

	err2 := NewValidationRequiredError("field1")
	if err2.Code() != ErrCodeValidationRequired {
		t.Errorf("Expected validation required error")
	}

	// Test that the returned error is a BaseError
	if _, ok := err.(BaseError); !ok {
		t.Errorf("Expected BaseError interface")
	}
}

func TestHTTPStatus(t *testing.T) {
	err := NewClientNotFoundError("test")
	status := err.GetHTTPStatus()
	if status != 404 {
		t.Errorf("Expected HTTP status 404, got %d", status)
	}

	if err.IsRetryable() {
		t.Errorf("Expected 404 to not be retryable")
	}
}

// Helper function
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || containsMiddle(s, substr)))
}

func containsMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
