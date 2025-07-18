package client

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"github.com/rs/zerolog/log"
	"net/http"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	aiDevopsChatPath = "chat/platform"
)

type GenaiService struct {
	Client *Client
}

// SendAIDevOpsChat sends a request to the AI DevOps service and returns the response.
// If request.Stream is true and onProgress is provided, it will handle streaming responses.
// For non-streaming requests or when onProgress is nil, it will use the standard request flow.
func (g *GenaiService) SendAIDevOpsChat(ctx context.Context, scope dto.Scope, request *dto.ServiceChatParameters, onProgress ...func(progressUpdate dto.ProgressUpdate) error) (*dto.ServiceChatResponse, error) {
	if g == nil || g.Client == nil {
		return nil, fmt.Errorf("genai service or client is nil")
	}

	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}

	// Validate context
	if ctx == nil {
		return nil, fmt.Errorf("context is nil")
	}

	// Extract the progress callback if provided
	var progressCB func(progressUpdate dto.ProgressUpdate) error
	if len(onProgress) > 0 && onProgress[0] != nil {
		progressCB = onProgress[0]
	}

	params := make(map[string]string)
	// Only add non-empty scope parameters
	if scope.AccountID != "" {
		params["accountIdentifier"] = scope.AccountID
	}
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	// Handle non-streaming case with early return
	isStreaming := request.Stream && progressCB != nil
	if !isStreaming {
		var response dto.ServiceChatResponse
		err := g.Client.Post(ctx, aiDevopsChatPath, params, request, &response)
		if err != nil {
			return nil, fmt.Errorf("failed to send request to genai service: %w", err)
		}

		return &response, nil
	}

	// Execute the streaming request
	resp, err := g.Client.PostStream(ctx, aiDevopsChatPath, params, request)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to execute streaming request")
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
	err = g.processStreamingResponse(resp.Body, finalResponse, progressCB)
	if err != nil {
		log.Warn().Err(err).Msg("Error processing streaming response")
		return finalResponse, fmt.Errorf("error processing streaming response: %w", err)
	}

	return finalResponse, nil
}

// processStreamingResponse handles Server-Sent Events (SSE) streaming responses
// and accumulates complete events before forwarding them with appropriate event types
func (g *GenaiService) processStreamingResponse(body io.ReadCloser, finalResponse *dto.ServiceChatResponse, onProgress func(dto.ProgressUpdate) error) error {
	scanner := bufio.NewScanner(body)
	var allContent, currentEvent strings.Builder
	inEvent := false
	var eventType string
	var eventData string

	for scanner.Scan() {
		line := scanner.Text()
		allContent.WriteString(line + "\n")

		switch {
		case strings.HasPrefix(line, "event: "):
			eventType = strings.TrimPrefix(line, "event: ")
			currentEvent.Reset()
			currentEvent.WriteString(line + "\n")
			inEvent = true

		case strings.HasPrefix(line, "data: ") && inEvent:
			eventData = strings.TrimPrefix(line, "data: ")
			currentEvent.WriteString(line + "\n")

		case line == "" && inEvent:
			// Empty line ends the event
			currentEvent.WriteString("\n")

			if onProgress != nil {
				eventPayload := map[string]any{
					"type": eventType,
					"data": eventData,
				}

				// Convert to JSON string
				jsonPayload, err := json.Marshal(eventPayload)
				if err != nil {
					log.Warn().Err(err).Msg("Error creating JSON payload")
				} else {
					progress := dto.ProgressUpdate{
						Message: string(jsonPayload),
					}

					if err := onProgress(progress); err != nil {
						log.Warn().Str("type", eventType).Err(err).Msg("Error forwarding event")
					}
				}

				if eventType == "error" {
					finalResponse.Error = eventData
				}
			}

			// Reset for next event
			inEvent = false
		}
	}

	// Add a header note to inform the Uber Agent that these events have already been shown to the user
	// TODO: move this to a prompt template for uber agent to ingest
	instructionNote := "NOTE TO AGENT: The SSE events below have already been streamed to the end user in real-time.\n" +
		"Do not repeat the full content of these events in your response.\n" +
		"Focus on summarizing key outcomes and providing additional context or next steps.\n" +
		"---\n\n"

	finalResponse.Response = instructionNote + allContent.String()

	if err := scanner.Err(); err != nil {
		log.Warn().Err(err).Msg("Error in scanner")
		return fmt.Errorf("error reading response stream: %w", err)
	}

	return nil
}
