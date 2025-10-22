package metrics

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
)

// HTTPMetricsMiddleware wraps HTTP handlers to collect Prometheus metrics
type HTTPMetricsMiddleware struct {
	Logger *slog.Logger
	Config *config.Config
}

// NewHTTPMetricsMiddleware creates a new HTTP metrics middleware
func NewHTTPMetricsMiddleware(logger *slog.Logger, config *config.Config) *HTTPMetricsMiddleware {
	if logger == nil {
		logger = slog.Default()
	}

	return &HTTPMetricsMiddleware{
		Logger: logger.With("component", "http_metrics_middleware"),
		Config: config,
	}
}

// Wrap wraps an HTTP handler to collect metrics
func (m *HTTPMetricsMiddleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()

		requestLogger := m.Logger.With(
			"method", r.Method,
			"path", r.URL.Path,
		)

		requestLogger.Debug("Processing HTTP request for metrics collection")

		// Extract MCP method from request body
		mcpMethod := m.extractMCPMethod(r, requestLogger)

		// Create a response recorder to capture the status code
		recorder := &responseRecorder{
			ResponseWriter: w,
			statusCode:     http.StatusOK, // Default to 200
		}

		// Call the next handler
		next.ServeHTTP(recorder, r)

		// Calculate duration in milliseconds
		duration := float64(time.Since(startTime).Nanoseconds()) / 1e6

		// Record metrics
		statusStr := strconv.Itoa(recorder.statusCode)
		HTTPRequestsTotal.WithLabelValues(statusStr, r.Method, mcpMethod).Inc()
		HTTPRequestsDuration.WithLabelValues(statusStr, r.Method, mcpMethod).Observe(duration)

		requestLogger.Debug("HTTP request metrics recorded",
			"status", recorder.statusCode,
			"method", r.Method,
			"api", mcpMethod,
			"duration_ms", duration)
	})
}

// extractMCPMethod extracts the MCP JSON-RPC method from the request body
func (m *HTTPMetricsMiddleware) extractMCPMethod(r *http.Request, logger *slog.Logger) string {
	// Only attempt to parse POST requests (MCP over HTTP uses POST)
	if r.Method != "POST" {
		return "non-mcp"
	}

	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		logger.Debug("Failed to read request body for MCP method extraction", "error", err)
		return "unknown"
	}

	// Restore the request body for the next handler
	r.Body = io.NopCloser(bytes.NewReader(body))

	// Parse the JSON-RPC request
	var jsonRPCRequest struct {
		Method string `json:"method"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		logger.Debug("Failed to parse JSON-RPC request for MCP method extraction", "error", err)
		return "non-json-rpc"
	}

	if jsonRPCRequest.Method == "" {
		logger.Debug("No method found in JSON-RPC request")
		return "no-method"
	}

	logger.Debug("Extracted MCP method from request", "method", jsonRPCRequest.Method)
	return jsonRPCRequest.Method
}

// responseRecorder captures HTTP response status codes
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

// extractRequestID extracts request ID from HTTP request headers
// It checks headers in order of precedence: X-Request-ID, X-Correlation-ID, Request-ID
func extractRequestID(r *http.Request) string {
	// Check headers in order of precedence
	headers := []string{"X-Request-ID", "X-Correlation-ID", "Request-ID"}
	
	for _, header := range headers {
		if value := r.Header.Get(header); value != "" {
			return value
		}
	}
	
	return ""
}
