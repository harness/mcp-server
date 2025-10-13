package logging

import (
	"context"
	"log/slog"
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
	if id, ok := ctx.Value(ConversationIDKey).(string); ok && id != "" {
		r.AddAttrs(slog.String(string(ConversationIDKey), id))
	}
	return h.handler.Handle(ctx, r)
}

func AppendCtx(parent context.Context, conversationID string) context.Context {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithValue(parent, ConversationIDKey, conversationID)
}
