package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

// There are no external paths for the chatbot-service
const (
	chatPath = "chat"
)

type ChatbotService struct {
	Client *Client
}

func (c *ChatbotService) SendChatMessage(ctx context.Context, scope dto.Scope, request *dto.ChatRequest) (string, error) {
	path := chatPath
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

	var response string
	err := c.Client.Post(ctx, path, params, request, &response)
	if err != nil {
		return "", fmt.Errorf("failed to send message to chatbot: %w", err)
	}

	return response, nil
}
