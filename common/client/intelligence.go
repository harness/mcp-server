package client

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/harness/mcp-server/common/client/dto"
)

const (
	aiDevOpsAgentPath = "api/v1/chat/platform"
)

// IntelligenceService handles communication with the Intelligence Service API
type IntelligenceService struct {
	Client *Client
}

// NewIntelligenceService creates a new IntelligenceService
func NewIntelligenceService(client *Client) *IntelligenceService {
	return &IntelligenceService{
		Client: client,
	}
}

// SendAIDevOpsChat sends a chat request to the AI DevOps agent
func (s *IntelligenceService) SendAIDevOpsChat(
	ctx context.Context,
	scope dto.Scope,
	request *dto.ServiceChatRequest,
	onProgress func(progress dto.ProgressUpdate) error,
) (*dto.ServiceChatResponse, error) {
	if s == nil || s.Client == nil {
		return nil, fmt.Errorf("intelligence service or client is nil")
	}

	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}

	// Build query parameters
	params := make(map[string]string)
	if scope.AccountID != "" {
		params["accountIdentifier"] = scope.AccountID
	}
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	// Ensure harness_context is set in the request
	if request.HarnessContext == nil {
		request.HarnessContext = &dto.HarnessContext{
			AccountID: scope.AccountID,
			OrgID:     scope.OrgID,
			ProjectID: scope.ProjectID,
		}
	}

	// Determine if streaming is required
	shouldStream := request.Stream && onProgress != nil

	// Handle non-streaming case
	if !shouldStream {
		var response dto.ServiceChatResponse
		headers := make(map[string]string)
		AddHarnessAccountToHeaders(ctx, scope, headers)

		err := s.Client.Post(ctx, aiDevOpsAgentPath, params, request, headers, &response)
		if err != nil {
			return nil, fmt.Errorf("failed to send request to intelligence service: %w", err)
		}
		slog.InfoContext(ctx, "Non-streaming request completed", "response", response)

		return &response, nil
	}

	// Handle streaming case
	resp, err := s.Client.PostStream(ctx, aiDevOpsAgentPath, params, request)
	if err != nil {
		slog.WarnContext(ctx, "Failed to execute streaming request", "error", err.Error())
		return nil, fmt.Errorf("failed to execute streaming request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("streaming request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Initialize the response with conversation ID from request
	finalResponse := &dto.ServiceChatResponse{
		ConversationID: request.ConversationID,
	}

	// Process the streaming response
	err = s.processStreamingResponse(ctx, resp.Body, finalResponse, onProgress)
	if err != nil {
		slog.WarnContext(ctx, "Error processing streaming response", "error", err.Error())
		return finalResponse, fmt.Errorf("error processing streaming response: %w", err)
	}

	return finalResponse, nil
}

// processStreamingResponse handles Server-Sent Events (SSE) streaming responses
func (s *IntelligenceService) processStreamingResponse(
	ctx context.Context,
	body io.ReadCloser,
	finalResponse *dto.ServiceChatResponse,
	onProgress func(dto.ProgressUpdate) error,
) error {
	scanner := bufio.NewScanner(body)
	var allContent, currentEvent strings.Builder
	inEvent := false
	var eventType string
	var eventData string
	eventCount := 0

	slog.InfoContext(ctx, "Starting to process streaming response", "hasOnProgress", onProgress != nil)

	for scanner.Scan() {
		line := scanner.Text()
		allContent.WriteString(line + "\n")

		switch {
		case strings.HasPrefix(line, "event: "):
			eventType = strings.TrimPrefix(line, "event: ")
			currentEvent.Reset()
			currentEvent.WriteString(line + "\n")
			inEvent = true
			slog.DebugContext(ctx, "Received SSE event line", "eventType", eventType)

		case strings.HasPrefix(line, "data: ") && inEvent:
			eventData = strings.TrimPrefix(line, "data: ")
			currentEvent.WriteString(line + "\n")

		case line == "" && inEvent:
			// Empty line ends the event
			currentEvent.WriteString("\n")
			eventCount++

			if onProgress != nil {
				eventPayload := map[string]any{
					"type": eventType,
					"data": eventData,
				}

				// Convert to JSON string
				jsonPayload, err := json.Marshal(eventPayload)
				if err != nil {
					slog.WarnContext(ctx, "Error creating JSON payload", "error", err.Error(), "eventType", eventType)
				} else {
					progress := dto.ProgressUpdate{
						Message: string(jsonPayload),
					}

					if err := onProgress(progress); err != nil {
						slog.WarnContext(ctx, "Error forwarding event", "type", eventType, "error", err.Error())
					}
				}

				if eventType == "error" && eventData != "eof" {
					finalResponse.Error = eventData
				}
			}

			// Reset for next event
			inEvent = false
		}
	}

	slog.InfoContext(ctx, "Finished processing streaming response", "totalEvents", eventCount)

	// Add note about streamed events
	instructionNote := "NOTE: The SSE events below have already been streamed to the user in real-time.\n" +
		"Do not repeat the full content of these events in your response.\n" +
		"Focus on summarizing key outcomes and providing additional context or next steps.\n" +
		"---\n\n"

	finalResponse.Response = instructionNote + allContent.String()

	if err := scanner.Err(); err != nil {
		slog.WarnContext(ctx, "Error in scanner", "error", err.Error())
		return fmt.Errorf("error reading response stream: %w", err)
	}

	return nil
}
