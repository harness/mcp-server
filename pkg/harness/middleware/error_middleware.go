package middleware

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/harness/harness-mcp/pkg/errors"
	"github.com/harness/harness-mcp/pkg/harness/logging"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ErrorHandlerMiddleware creates middleware that handles errors and adds context
func ErrorHandlerMiddleware(logger *logging.StructuredLogger) server.ToolHandlerMiddleware {
	return func(next server.ToolHandlerFunc) server.ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Generate request and trace IDs if not present
			requestID := logging.GetRequestID(ctx)
			if requestID == "" {
				requestID = uuid.New().String()
				ctx = context.WithValue(ctx, logging.RequestIDKey, requestID)
			}

			traceID := logging.GetTraceID(ctx)
			if traceID == "" {
				traceID = uuid.New().String()
				ctx = context.WithValue(ctx, logging.TraceIDKey, traceID)
			}

			// Execute the tool handler
			result, err := next(ctx, request)

			// Handle errors
			if err != nil {
				toolName := request.Params.Name

				// Convert to structured error if not already
				var baseErr errors.BaseError
				if b, ok := err.(errors.BaseError); ok {
					baseErr = b
				} else {
					// Create a tool error for unknown errors
					baseErr = errors.NewToolExecutionError(toolName, err)
				}

				// Add context
				baseErr = errors.WithToolContext(baseErr, toolName, "tool_execution")
				baseErr = errors.WithRequestContext(baseErr, requestID, traceID)

				// Extract user context if available
				if userID := logging.GetUserID(ctx); userID != "" {
					if accountID := logging.GetAccountID(ctx); accountID != "" {
						baseErr = errors.WithUserContext(baseErr, userID, accountID)
					}
				}

				// Add request parameters for debugging
				if request.Params.Arguments != nil {
					baseErr = baseErr.WithParameter("request_args", request.Params.Arguments)
				}

				// Log the error
				logger.LogToolError(ctx, baseErr, toolName, "tool_execution")

				// Return user-friendly error message
				userMessage := baseErr.GetUserMessage()
				if userMessage == "" {
					userMessage = "An error occurred while processing your request"
				}

				// Add suggested actions if available
				if actions := baseErr.GetSuggestedActions(); len(actions) > 0 {
					userMessage += fmt.Sprintf(" (Suggestion: %s)", actions[0])
				}

				return mcp.NewToolResultError(userMessage), nil
			}

			// Log successful tool execution
			logger.LogInfo(ctx, "Tool executed successfully",
				slog.String("tool_name", request.Params.Name),
				slog.Int("result_count", len(result.Content)),
			)

			return result, nil
		}
	}
}


// ErrorRecoveryMiddleware creates middleware that recovers from panics
func ErrorRecoveryMiddleware(logger *logging.StructuredLogger) server.ToolHandlerMiddleware {
	return func(next server.ToolHandlerFunc) server.ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (result *mcp.CallToolResult, err error) {
			defer func() {
				if r := recover(); r != nil {
					toolName := request.Params.Name

					// Create a structured error for the panic
					var panicErr error
					switch v := r.(type) {
					case error:
						panicErr = v
					case string:
						panicErr = fmt.Errorf("panic: %s", v)
					default:
						panicErr = fmt.Errorf("panic: %v", v)
					}

					baseErr := errors.NewToolExecutionError(toolName, panicErr)
					baseErr = errors.WithToolContext(baseErr, toolName, "tool_execution_panic")

					// Add request context
					if requestID := logging.GetRequestID(ctx); requestID != "" {
						baseErr = baseErr.WithMetadata("request_id", requestID)
					}
					if traceID := logging.GetTraceID(ctx); traceID != "" {
						baseErr = baseErr.WithMetadata("trace_id", traceID)
					}

					// Log the panic
					logger.LogToolError(ctx, baseErr, toolName, "panic_recovery")

					// Return error result
					result = mcp.NewToolResultError("An unexpected error occurred. Please try again.")
					err = nil
				}
			}()

			return next(ctx, request)
		}
	}
}
