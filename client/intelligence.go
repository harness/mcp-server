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
	// Base API paths
	similaritySearchPath = "api/v1/template-search"
	aiDevOpsAgentPath    = "api/v1/chat/platform"
)

type IntelligenceService struct {
	Client *Client
}

func (ts *IntelligenceService) buildPath(basePath string) string {
	return basePath
}

// SimilaritySearch searches for similar templates based on the provided request
func (ts *IntelligenceService) SimilaritySearch(ctx context.Context, request *dto.SimilaritySearchRequest) (*dto.TemplateData, error) {
	endpoint := ts.buildPath(similaritySearchPath)

	// Validate required parameters
	if request.AccountID == "" {
		return nil, fmt.Errorf("account_identifier is required")
	}
	if request.Description == "" {
		return nil, fmt.Errorf("description is required")
	}

	// Create query parameters map for all request fields
	params := make(map[string]string)
	params["account_identifier"] = request.AccountID

	if request.OrgID != "" {
		params["org_identifier"] = request.OrgID
	}
	if request.ProjectID != "" {
		params["project_identifier"] = request.ProjectID
	}

	// Always include description as it's required
	params["description"] = request.Description

	// Include optional parameters
	if request.TemplateType != "" {
		params["template_type"] = request.TemplateType
	}
	if request.Count > 0 {
		params["count"] = fmt.Sprintf("%d", request.Count)
	}

	var result dto.SimilaritySearchResponse
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to perform similarity search: %w", err)
	}

	var templateRef string

	res := result.Results[0]
	// Check if metadata is an array of key-value pairs
	metadataArray, ok := res.Metadata.([]interface{})
	if !ok {
		return nil, fmt.Errorf("metadata is not an array of key-value pairs")
	}

	// Extract template_id, org_id, and project_id from metadata
	var templateID, orgID, projectID string
	for _, item := range metadataArray {
		kvPair, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		key, keyOk := kvPair["Key"].(string)
		value, valueOk := kvPair["Value"].(string)

		if !keyOk || !valueOk {
			continue
		}

		switch key {
		case "template_id":
			templateID = value
		case "org_id":
			orgID = value
		case "project_id":
			projectID = value
		}
	}

	// Skip if template_id is missing
	if templateID == "" {
		return nil, fmt.Errorf("template_id is missing")
	}

	// Build template reference based on scope
	templateRef = buildTemplateRef(orgID, projectID, templateID)
	templateData := dto.TemplateData("template_ref: " + templateRef + " type: " + request.TemplateType)

	return &templateData, nil
}

func buildTemplateRef(orgID, projectID, templateID string) string {
	if projectID != "" {
		return templateID
	} else if orgID != "" {
		return fmt.Sprintf("org.%s", templateID)
	} else {
		return fmt.Sprintf("account.%s", templateID)
	}
}

// sendAIDevOpsChatRequest handles sending AI DevOps chat requests with support for both streaming and non-streaming modes
func (ts *IntelligenceService) sendAIDevOpsChatRequest(ctx context.Context, path string, scope dto.Scope, request dto.GenAIRequest,
	onProgress func(progressUpdate dto.ProgressUpdate) error) (*dto.ServiceChatResponseIntelligence, error) {
	if ts == nil || ts.Client == nil {
		return nil, fmt.Errorf("intelligence service or client is nil")
	}

	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}

	// Validate context
	if ctx == nil {
		return nil, fmt.Errorf("context is nil")
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
	shouldStream := request.IsStreaming() && onProgress != nil

	// Handle non-streaming case with early return
	if !shouldStream {
		var response dto.ServiceChatResponseIntelligence
		err := ts.Client.Post(ctx, path, params, request, map[string]string{}, &response)
		if err != nil {
			return nil, fmt.Errorf("failed to send request to intelligence service: %w", err)
		}
		slog.InfoContext(ctx, "Non-streaming request completed", "response", response)

		return &response, nil
	}

	// Execute the streaming request
	resp, err := ts.Client.PostStream(ctx, path, params, request)
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
	finalResponse := &dto.ServiceChatResponseIntelligence{
		ConversationID: request.GetBaseParameters().ConversationID,
	}

	// Process the streaming response
	err = ts.processStreamingResponse(ctx, resp.Body, finalResponse, onProgress)
	if err != nil {
		slog.WarnContext(ctx, "Error processing streaming response", "error", err.Error())
		return finalResponse, fmt.Errorf("error processing streaming response: %w", err)
	}

	return finalResponse, nil
}

// SendAIDevOpsChat sends a chat request to the AI DevOps agent
func (ts *IntelligenceService) SendAIDevOpsChat(ctx context.Context, scope dto.Scope, request *dto.ServiceChatParameters, onProgress func(progress dto.ProgressUpdate) error) (*dto.ServiceChatResponseIntelligence, error) {
	endpoint := ts.buildPath(aiDevOpsAgentPath)

	// Parameter validation is handled at the tool level
	return ts.sendAIDevOpsChatRequest(ctx, endpoint, scope, request, onProgress)
}

// processStreamingResponse handles Server-Sent Events (SSE) streaming responses
// and accumulates complete events before forwarding them with appropriate event types
func (ts *IntelligenceService) processStreamingResponse(ctx context.Context, body io.ReadCloser, finalResponse *dto.ServiceChatResponseIntelligence, onProgress func(dto.ProgressUpdate) error) error {
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

				if eventType == "error" && eventData != "eof" {
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
