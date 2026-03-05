package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/harness/mcp-server/common/client/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestIntelligenceService(serverURL string) *IntelligenceService {
	parsedURL, _ := url.Parse(serverURL)
	c := &Client{
		client:       &http.Client{},
		BaseURL:      parsedURL,
		AuthProvider: mockAuthProvider{},
	}
	return NewIntelligenceService(c)
}

func TestNewIntelligenceService(t *testing.T) {
	c := &Client{}
	svc := NewIntelligenceService(c)
	assert.NotNil(t, svc)
	assert.Equal(t, c, svc.Client)
}

func TestSendAIDevOpsChat_NilReceiver(t *testing.T) {
	var svc *IntelligenceService
	_, err := svc.SendAIDevOpsChat(context.Background(), dto.Scope{}, &dto.ServiceChatRequest{}, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestSendAIDevOpsChat_NilClient(t *testing.T) {
	svc := &IntelligenceService{Client: nil}
	_, err := svc.SendAIDevOpsChat(context.Background(), dto.Scope{}, &dto.ServiceChatRequest{}, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestSendAIDevOpsChat_NilRequest(t *testing.T) {
	svc := &IntelligenceService{Client: &Client{}}
	_, err := svc.SendAIDevOpsChat(context.Background(), dto.Scope{}, nil, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "request is nil")
}

func TestSendAIDevOpsChat_NonStreaming(t *testing.T) {
	expected := dto.ServiceChatResponse{
		ConversationID: "conv-123",
		Response:       "Here is your pipeline YAML",
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Contains(t, r.URL.Path, aiDevOpsAgentPath)

		assert.Equal(t, "acc-1", r.URL.Query().Get("accountIdentifier"))
		assert.Equal(t, "org-1", r.URL.Query().Get("orgIdentifier"))
		assert.Equal(t, "proj-1", r.URL.Query().Get("projectIdentifier"))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(expected)
	}))
	defer server.Close()

	svc := newTestIntelligenceService(server.URL)
	scope := dto.Scope{AccountID: "acc-1", OrgID: "org-1", ProjectID: "proj-1"}
	req := &dto.ServiceChatRequest{
		Prompt:         "Create a deploy pipeline",
		Action:         dto.CreatePipeline,
		ConversationID: "conv-123",
		Stream:         false,
	}

	resp, err := svc.SendAIDevOpsChat(context.Background(), scope, req, nil)
	require.NoError(t, err)
	assert.Equal(t, "conv-123", resp.ConversationID)
	assert.Equal(t, "Here is your pipeline YAML", resp.Response)
}

func TestSendAIDevOpsChat_SetsHarnessContext(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body dto.ServiceChatRequest
		json.NewDecoder(r.Body).Decode(&body)

		assert.NotNil(t, body.HarnessContext)
		assert.Equal(t, "acc-1", body.HarnessContext.AccountID)
		assert.Equal(t, "org-1", body.HarnessContext.OrgID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(dto.ServiceChatResponse{ConversationID: "c1"})
	}))
	defer server.Close()

	svc := newTestIntelligenceService(server.URL)
	scope := dto.Scope{AccountID: "acc-1", OrgID: "org-1"}
	req := &dto.ServiceChatRequest{
		Prompt: "test",
		Stream: false,
	}

	resp, err := svc.SendAIDevOpsChat(context.Background(), scope, req, nil)
	require.NoError(t, err)
	assert.Equal(t, "c1", resp.ConversationID)
}

func TestSendAIDevOpsChat_Streaming(t *testing.T) {
	ssePayload := "event: step\ndata: generating pipeline\n\nevent: result\ndata: pipeline_yaml_here\n\n"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, ssePayload)
	}))
	defer server.Close()

	svc := newTestIntelligenceService(server.URL)
	scope := dto.Scope{AccountID: "acc-1"}
	req := &dto.ServiceChatRequest{
		Prompt:         "Create a deploy pipeline",
		Action:         dto.CreatePipeline,
		ConversationID: "conv-456",
		Stream:         true,
	}

	var progressMessages []string
	onProgress := func(p dto.ProgressUpdate) error {
		progressMessages = append(progressMessages, p.Message)
		return nil
	}

	resp, err := svc.SendAIDevOpsChat(context.Background(), scope, req, onProgress)
	require.NoError(t, err)
	assert.Equal(t, "conv-456", resp.ConversationID)
	assert.Len(t, progressMessages, 2)
	assert.Contains(t, resp.Response, "generating pipeline")
	assert.Contains(t, resp.Response, "pipeline_yaml_here")
}

func TestSendAIDevOpsChat_StreamingError(t *testing.T) {
	ssePayload := "event: error\ndata: something went wrong\n\n"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, ssePayload)
	}))
	defer server.Close()

	svc := newTestIntelligenceService(server.URL)
	req := &dto.ServiceChatRequest{Prompt: "test", Stream: true}

	resp, err := svc.SendAIDevOpsChat(context.Background(), dto.Scope{AccountID: "a"}, req, func(p dto.ProgressUpdate) error {
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, "something went wrong", resp.Error)
}

func TestSendAIDevOpsChat_StreamingServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "internal error")
	}))
	defer server.Close()

	svc := newTestIntelligenceService(server.URL)
	req := &dto.ServiceChatRequest{Prompt: "test", Stream: true}

	_, err := svc.SendAIDevOpsChat(context.Background(), dto.Scope{AccountID: "a"}, req, func(p dto.ProgressUpdate) error {
		return nil
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "500")
}

func TestSendAIDevOpsChat_StreamingEofNotTreatedAsError(t *testing.T) {
	ssePayload := "event: error\ndata: eof\n\n"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, ssePayload)
	}))
	defer server.Close()

	svc := newTestIntelligenceService(server.URL)
	req := &dto.ServiceChatRequest{Prompt: "test", Stream: true}

	resp, err := svc.SendAIDevOpsChat(context.Background(), dto.Scope{AccountID: "a"}, req, func(p dto.ProgressUpdate) error {
		return nil
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Error)
}
