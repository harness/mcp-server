package logging

import (
	"context"
	"log/slog"

	"github.com/harness/harness-mcp/pkg/errors"
)

type CtxKey string

const (
	ConversationIDKey CtxKey = "conversation_id"
	RequestIDKey      CtxKey = "request_id"
	TraceIDKey        CtxKey = "trace_id"
	UserIDKey         CtxKey = "user_id"
	AccountIDKey      CtxKey = "account_id"
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
	// Add conversation ID
	if id, ok := ctx.Value(ConversationIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(ConversationIDKey), id))
	}

	// Add request ID
	if id, ok := ctx.Value(RequestIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(RequestIDKey), id))
	}

	// Add trace ID
	if id, ok := ctx.Value(TraceIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(TraceIDKey), id))
	}

	// Add user ID
	if id, ok := ctx.Value(UserIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(UserIDKey), id))
	}

	// Add account ID
	if id, ok := ctx.Value(AccountIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(AccountIDKey), id))
	}

	return h.handler.Handle(ctx, r)
}

func AppendCtx(parent context.Context, conversationID string) context.Context {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithValue(parent, ConversationIDKey, conversationID)
}

// WithRequestContext adds request context to the context
func WithRequestContext(ctx context.Context, requestID, traceID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx = context.WithValue(ctx, RequestIDKey, requestID)
	ctx = context.WithValue(ctx, TraceIDKey, traceID)
	return ctx
}

// WithUserContext adds user context to the context
func WithUserContext(ctx context.Context, userID, accountID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx = context.WithValue(ctx, UserIDKey, userID)
	ctx = context.WithValue(ctx, AccountIDKey, accountID)
	return ctx
}

// GetRequestID extracts request ID from context
func GetRequestID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		return id
	}
	if id, ok := ctx.Value(ConversationIDKey).(string); ok {
		return id
	}
	return ""
}

// GetTraceID extracts trace ID from context
func GetTraceID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if id, ok := ctx.Value(TraceIDKey).(string); ok {
		return id
	}
	return ""
}

// GetUserID extracts user ID from context
func GetUserID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if id, ok := ctx.Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}

// GetAccountID extracts account ID from context
func GetAccountID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if id, ok := ctx.Value(AccountIDKey).(string); ok {
		return id
	}
	return ""
}

// StructuredLogger provides structured logging with error handling
type StructuredLogger struct {
	*slog.Logger
}

// NewStructuredLogger creates a new structured logger
func NewStructuredLogger(logger *slog.Logger) *StructuredLogger {
	return &StructuredLogger{Logger: logger}
}

// LogError logs an error with structured context
func (l *StructuredLogger) LogError(ctx context.Context, err error, msg string, args ...any) {
	if err == nil {
		return
	}

	// Use the error's LogError method if it's a BaseError
	if baseErr, ok := err.(errors.BaseError); ok {
		errors.LogError(ctx, baseErr, l.Logger)
		return
	}

	// Fallback for non-BaseError types
	allArgs := append([]any{
		slog.String("error", err.Error()),
	}, args...)

	// Add context information
	if requestID := GetRequestID(ctx); requestID != "" {
		allArgs = append(allArgs, slog.String("request_id", requestID))
	}
	if traceID := GetTraceID(ctx); traceID != "" {
		allArgs = append(allArgs, slog.String("trace_id", traceID))
	}
	if userID := GetUserID(ctx); userID != "" {
		allArgs = append(allArgs, slog.String("user_id", userID))
	}

	l.Error(msg, allArgs...)
}

// LogToolError logs a tool-specific error
func (l *StructuredLogger) LogToolError(ctx context.Context, err error, toolName, operation string) {
	if toolErr, ok := err.(errors.BaseError); ok {
		toolErr = errors.WithToolContext(toolErr, toolName, operation)
		l.LogError(ctx, toolErr, "Tool error occurred")
	} else {
		l.Error("Tool error occurred",
			slog.String("tool_name", toolName),
			slog.String("operation", operation),
			slog.String("error", err.Error()),
		)
	}
}

// LogInfo logs an info message with context
func (l *StructuredLogger) LogInfo(ctx context.Context, msg string, args ...any) {
	allArgs := make([]any, 0, len(args)+4)

	// Add context information
	if requestID := GetRequestID(ctx); requestID != "" {
		allArgs = append(allArgs, slog.String("request_id", requestID))
	}
	if traceID := GetTraceID(ctx); traceID != "" {
		allArgs = append(allArgs, slog.String("trace_id", traceID))
	}
	if userID := GetUserID(ctx); userID != "" {
		allArgs = append(allArgs, slog.String("user_id", userID))
	}

	allArgs = append(allArgs, args...)
	l.Info(msg, allArgs...)
}

// LogWarn logs a warning message with context
func (l *StructuredLogger) LogWarn(ctx context.Context, msg string, args ...any) {
	allArgs := make([]any, 0, len(args)+4)

	// Add context information
	if requestID := GetRequestID(ctx); requestID != "" {
		allArgs = append(allArgs, slog.String("request_id", requestID))
	}
	if traceID := GetTraceID(ctx); traceID != "" {
		allArgs = append(allArgs, slog.String("trace_id", traceID))
	}
	if userID := GetUserID(ctx); userID != "" {
		allArgs = append(allArgs, slog.String("user_id", userID))
	}

	allArgs = append(allArgs, args...)
	l.Warn(msg, allArgs...)
}
