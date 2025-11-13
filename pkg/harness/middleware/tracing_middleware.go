package middleware

import (
	"net/http"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"log/slog"
)

func TracingMiddleware(config *config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log incoming headers for debugging
		slog.Debug("Incoming request headers",
			"traceparent", r.Header.Get("traceparent"),
			"tracestate", r.Header.Get("tracestate"))

		// Extract trace context from incoming request headers
		ctx := r.Context()
		propagator := otel.GetTextMapPropagator()
		ctx = propagator.Extract(ctx, propagation.HeaderCarrier(r.Header))

		// Create a new span
		tracer := otel.Tracer("mcp-server")
		ctx, span := tracer.Start(ctx, "mcp-tool-execution")
		defer span.End()

		// Log the span context for debugging
		spanContext := span.SpanContext()
		if spanContext.IsValid() {
			slog.Debug("Created span in middleware",
				"trace_id", spanContext.TraceID().String(),
				"span_id", spanContext.SpanID().String(),
				"is_remote", spanContext.IsRemote())

			// Manually inject the trace context back into the request headers
			// This ensures downstream code can access it even without context
			carrier := propagation.HeaderCarrier(r.Header)
			propagator.Inject(ctx, carrier)

			slog.Debug("Injected trace context into request headers",
				"traceparent", r.Header.Get("traceparent"),
				"tracestate", r.Header.Get("tracestate"))
		} else {
			slog.Debug("Created invalid span in middleware")
		}

		// Update request with new context
		r = r.WithContext(ctx)

		// Pass the request to the next handler
		next.ServeHTTP(w, r)
	})
}
