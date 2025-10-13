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

	"github.com/harness/harness-mcp/client/dto"
)

const (
	aiDevopsChatPath = "chat/platform"
	dbChangesetPath  = "chat/db-changeset"
	idpWorkflowPath  = "chat/idp-workflow"
)

type GenaiService struct {
	Client *Client
}

// sendGenAIRequest is a generic method to send requests to GenAI services
func (g *GenaiService) sendGenAIRequest(ctx context.Context, path string, scope dto.Scope, request dto.GenAIRequest,
	onProgress ...func(progressUpdate dto.ProgressUpdate) error) (*dto.ServiceChatResponse, error) {
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

	// Determine if streaming is required
	shouldStream := request.IsStreaming() && progressCB != nil

	// Handle non-streaming case with early return
	if !shouldStream {
		var response dto.ServiceChatResponse
		err := g.Client.Post(ctx, path, params, request, map[string]string{}, &response)
		if err != nil {
			return nil, fmt.Errorf("failed to send request to genai service: %w", err)
		}

		return &response, nil
	}

	// Execute the streaming request
	resp, err := g.Client.PostStream(ctx, path, params, request)
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
		ConversationID: request.GetBaseParameters().ConversationID,
	}

	// Process the streaming response
	err = g.processStreamingResponse(ctx, resp.Body, finalResponse, progressCB)
	if err != nil {
		slog.WarnContext(ctx, "Error processing streaming response", "error", err.Error())
		return finalResponse, fmt.Errorf("error processing streaming response: %w", err)
	}

	return finalResponse, nil
}

// SendAIDevOpsChat sends a request to the AI DevOps service and returns the response.
// If request.Stream is true and onProgress is provided, it will handle streaming responses.
// For non-streaming requests or when onProgress is nil, it will use the standard request flow.
func (g *GenaiService) SendAIDevOpsChat(ctx context.Context, scope dto.Scope, request *dto.ServiceChatParameters, onProgress ...func(progressUpdate dto.ProgressUpdate) error) (*dto.ServiceChatResponse, error) {
	return g.sendGenAIRequest(ctx, aiDevopsChatPath, scope, request, onProgress...)
}

// SendDBChangeset sends a request to generate database changesets and returns the response.
// If request.Stream is true and onProgress is provided, it will handle streaming responses.
func (g *GenaiService) SendDBChangeset(ctx context.Context, scope dto.Scope, request *dto.DBChangesetParameters, onProgress ...func(progressUpdate dto.ProgressUpdate) error) (*dto.ServiceChatResponse, error) {
	return g.sendGenAIRequest(ctx, dbChangesetPath, scope, request, onProgress...)
}

// SendIDPWorkflow sends a request to generate idp workflows and returns the response.
// If request.Stream is true and onProgress is provided, it will handle streaming responses.
func (g *GenaiService) SendIDPWorkflow(ctx context.Context, scope dto.Scope, request *dto.IDPWorkflowParameters, onProgress ...func(progressUpdate dto.ProgressUpdate) error) (*dto.ServiceChatResponse, error) {
	return g.sendGenAIRequest(ctx, idpWorkflowPath, scope, request, onProgress...)
}

// processStreamingResponse handles Server-Sent Events (SSE) streaming responses
// and accumulates complete events before forwarding them with appropriate event types
func (g *GenaiService) processStreamingResponse(ctx context.Context, body io.ReadCloser, finalResponse *dto.ServiceChatResponse, onProgress func(dto.ProgressUpdate) error) error {
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
					slog.WarnContext(ctx, "Error creating JSON payload", "error", err.Error())
				} else {
					progress := dto.ProgressUpdate{
						Message: string(jsonPayload),
					}

					if err := onProgress(progress); err != nil {
						slog.WarnContext(ctx, "Error forwarding event", "type", eventType, "error", err.Error())
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
		slog.WarnContext(ctx, "Error in scanner", "error", err.Error())
		return fmt.Errorf("error reading response stream: %w", err)
	}

	return nil
}
