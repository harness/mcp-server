package logging

import (
	"context"
	"log/slog"
	
	"github.com/harness/harness-mcp/pkg/harness/errors"
	"go.opentelemetry.io/otel/trace"
)

type CtxKey string

const (
	ConversationIDKey CtxKey = "conversation_id"
)

// loggingHandler is a slog handler that adds request context information to log entries
type LoggingHandler struct {
	handler slog.Handler
}

// NewLoggingHandler creates a new logging handler that includes request context information
func NewLoggingHandler(handler slog.Handler) *LoggingHandler {
	return &LoggingHandler{handler: handler}
}

// Enabled reports whether the handler handles records at the given level.
func (h *LoggingHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.handler.Enabled(ctx, level)
}

// WithAttrs returns a new Handler whose attributes include both
// the receiver's attributes and the arguments.
func (h *LoggingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &LoggingHandler{handler: h.handler.WithAttrs(attrs)}
}

// WithGroup returns a new Handler with the given group name added to
// the receiver's existing groups.
func (h *LoggingHandler) WithGroup(name string) slog.Handler {
	return &LoggingHandler{handler: h.handler.WithGroup(name)}
}

func (h *LoggingHandler) Handle(ctx context.Context, r slog.Record) error {
	// Add conversation ID if present
	if id, ok := ctx.Value(ConversationIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(ConversationIDKey), id))
	}
	
	// Extract and add request ID
	if requestID := errors.ExtractRequestID(ctx); requestID != "" {
		r.AddAttrs(slog.String("request_id", requestID))
	}
	
	// Extract and add trace ID from OpenTelemetry
	if traceID := errors.ExtractTraceID(ctx); traceID != "" {
		r.AddAttrs(slog.String("trace_id", traceID))
	}
	
	// Extract and add tool name
	if toolName := errors.ExtractToolName(ctx); toolName != "" {
		r.AddAttrs(slog.String("tool_name", toolName))
	}
	
	// Check if any of the log attributes are errors with context
	// and extract their context information
	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "error" && a.Value.Kind() == slog.KindAny {
			if err, ok := a.Value.Any().(error); ok {
				errorCtx := errors.GetErrorContext(err)
				if errorCtx.RequestID != "" {
					r.AddAttrs(slog.String("error_request_id", errorCtx.RequestID))
				}
				if errorCtx.TraceID != "" {
					r.AddAttrs(slog.String("error_trace_id", errorCtx.TraceID))
				}
				if errorCtx.ToolName != "" {
					r.AddAttrs(slog.String("error_tool_name", errorCtx.ToolName))
				}
				
				// Add error code if available
				if errorCode := errors.GetErrorCode(err); errorCode != "" {
					r.AddAttrs(slog.String("error_code", errorCode))
				}
				
				// Add additional context from error
				if errorCtx.Context != nil && len(errorCtx.Context) > 0 {
					for k, v := range errorCtx.Context {
						r.AddAttrs(slog.Any("error_ctx_"+k, v))
					}
				}
			}
		}
		return true
	})
	
	return h.handler.Handle(ctx, r)
}

func AppendCtx(parent context.Context, conversationID string) context.Context {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithValue(parent, ConversationIDKey, conversationID)
}

// ExtractTraceIDFromSpan extracts trace ID directly from a span context
// This is a helper function for cases where you have direct access to span context
func ExtractTraceIDFromSpan(span trace.Span) string {
	if span == nil || !span.IsRecording() {
		return ""
	}
	
	spanContext := span.SpanContext()
	if !spanContext.IsValid() {
		return ""
	}
	
	return spanContext.TraceID().String()
}
