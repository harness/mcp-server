package errors

import (
	"context"
	
	"go.opentelemetry.io/otel/trace"
)

// Context keys for storing error-related context
type ctxKey string

const (
	requestIDKey ctxKey = "request_id"
	toolNameKey  ctxKey = "tool_name"
)

// ExtractRequestID extracts the request ID from the context
func ExtractRequestID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	
	// Try context value first
	if id, ok := ctx.Value(requestIDKey).(string); ok && id != "" {
		return id
	}
	
	// Try common header keys from HTTP context
	// This will work if the request ID was set via WithRequestID
	return ""
}

// ExtractTraceID extracts the trace ID from OpenTelemetry span context
func ExtractTraceID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return ""
	}
	
	spanContext := span.SpanContext()
	if !spanContext.IsValid() {
		return ""
	}
	
	return spanContext.TraceID().String()
}

// ExtractToolName extracts the tool name from the context
func ExtractToolName(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	
	if name, ok := ctx.Value(toolNameKey).(string); ok && name != "" {
		return name
	}
	
	return ""
}

// WithRequestID adds a request ID to the context
func WithRequestID(ctx context.Context, requestID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, requestIDKey, requestID)
}

// WithToolName adds a tool name to the context
func WithToolName(ctx context.Context, toolName string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, toolNameKey, toolName)
}

// ExtractErrorContext extracts all error-related context from the context
func ExtractErrorContext(ctx context.Context) ErrorContext {
	return ErrorContext{
		RequestID: ExtractRequestID(ctx),
		TraceID:   ExtractTraceID(ctx),
		ToolName:  ExtractToolName(ctx),
		Context:   make(map[string]interface{}),
	}
}

