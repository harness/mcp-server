package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	aiDevopsChatPath = "chat/platform"
)

type GenaiService struct {
	Client *Client
}

func (g *GenaiService) SendAIDevOpsChat(ctx context.Context, scope dto.Scope, request *dto.ServiceChatParameters) (*dto.ServiceChatResponse, error) {
	path := aiDevopsChatPath
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

	var response dto.ServiceChatResponse
	err := g.Client.Post(ctx, path, params, request, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to genai service: %w", err)
	}

	return &response, nil
}
