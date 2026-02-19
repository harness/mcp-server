package client

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const tracerName = "mcp-server-http-client"

// startHTTPClientSpan creates an HTTP client span and injects trace context into the request.
// It returns the updated context with the span and the span itself for deferred cleanup.
// The span should be ended by the caller using defer span.End().
func startHTTPClientSpan(ctx context.Context, method, path string, req *http.Request) (context.Context, trace.Span) {
	tracer := otel.Tracer(tracerName)
	spanName := "http.client." + method

	spanCtx, span := tracer.Start(ctx, spanName,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("http.method", method),
			attribute.String("http.target", path),
		),
	)

	// Set full URL after request is created
	if req != nil {
		span.SetAttributes(attribute.String("http.url", req.URL.String()))

		// Inject OpenTelemetry trace context into HTTP headers
		propagator := otel.GetTextMapPropagator()
		propagator.Inject(spanCtx, propagation.HeaderCarrier(req.Header))
	}

	return spanCtx, span
}

// recordHTTPResponse records HTTP response status on the span
func recordHTTPResponse(span trace.Span, statusCode int) {
	if span != nil {
		span.SetAttributes(attribute.Int("http.status_code", statusCode))
	}
}

// injectTraceContext injects trace context into HTTP headers without creating a span.
// This is useful for streaming requests where span lifecycle doesn't match request lifecycle.
func injectTraceContext(ctx context.Context, req *http.Request) {
	if req == nil {
		return
	}
	propagator := otel.GetTextMapPropagator()
	propagator.Inject(ctx, propagation.HeaderCarrier(req.Header))
}
