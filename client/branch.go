package client

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// API paths for Harness Code repository operations
	branchBasePath      = "code/api/v1/repos/%s/branches"
	branchCreatePath    = branchBasePath + "/create"
	fileContentPostPath = "code/api/v1/repos/%s/content/%s"
	contentsPath        = "code/api/v1/repos/%s/contents"
)

// BranchService handles operations related to branches and file operations
type BranchService struct {
	Client *Client
}

// Create creates a new branch in the repository
func (b *BranchService) Create(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.CreateBranchRequest) (*dto.CreateBranchResponse, error) {
	// Format the path with repository identifier
	path := fmt.Sprintf(branchCreatePath, repoIdentifier)
	params := make(map[string]string)
	// Add scope parameters
	addScope(scope, params)

	// No additional headers needed, authentication is handled by the client
	headers := make(map[string]string)

	// Create the payload in the format expected by the API
	payload := map[string]interface{}{
		"branch_name": req.BranchName,
		"start_point": req.StartPoint,
	}

	// Convert payload to JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize payload: %w", err)
	}

	response := new(dto.CreateBranchResponse)
	err = b.Client.PostRaw(ctx, path, params, bytes.NewBuffer(payloadBytes), headers, response)
	if err != nil {
		return nil, fmt.Errorf("failed to create branch: %w", err)
	}

	return response, nil
}

// CommitFile commits a single file change to a branch
func (b *BranchService) CommitFile(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.CommitFileRequest) (*dto.CommitFileResponse, error) {
	// Format the path with repository identifier and file path
	path := fmt.Sprintf(fileContentPostPath, repoIdentifier, req.FilePath)
	params := make(map[string]string)
	// Add scope parameters
	addScope(scope, params)
	
	// Add branch and commit message to params
	params["branch"] = req.Branch
	params["message"] = req.CommitMsg
	
	// For new files, set create=true
	if req.IsNewFile {
		params["create"] = "true"
	}
	
	// No additional headers needed, authentication is handled by the client
	headers := make(map[string]string)
	
	// Base64 encode the content
	contentBase64 := base64.StdEncoding.EncodeToString([]byte(req.Content))
	
	// Create the payload in the format expected by the API
	payload := map[string]string{
		"content": contentBase64,
	}
	
	// Convert payload to JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize payload: %w", err)
	}
	
	response := new(dto.CommitFileResponse)
	err = b.Client.PostRaw(ctx, path, params, bytes.NewBuffer(payloadBytes), headers, response)
	if err != nil {
		return nil, fmt.Errorf("failed to commit file: %w", err)
	}
	
	return response, nil
}

// CommitMultipleFiles commits multiple file changes in a single commit
func (b *BranchService) CommitMultipleFiles(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.CommitMultipleFilesRequest) (*dto.CommitFileResponse, error) {
	// Format the path with repository identifier
	path := fmt.Sprintf(contentsPath, repoIdentifier)
	params := make(map[string]string)
	// Add scope parameters
	addScope(scope, params)
	
	// Add branch and commit message to params
	params["branch"] = req.Branch
	params["message"] = req.CommitMsg
	
	// No additional headers needed, authentication is handled by the client
	headers := make(map[string]string)
	
	// Create the payload with encoded file contents
	files := make([]map[string]interface{}, len(req.Files))
	for i, file := range req.Files {
		contentBase64 := base64.StdEncoding.EncodeToString([]byte(file.Content))
		files[i] = map[string]interface{}{
			"path":    file.FilePath,
			"content": contentBase64,
			"create":  file.IsNewFile,
		}
	}
	
	// Create the payload in the format expected by the API
	payload := map[string]interface{}{
		"files": files,
	}
	
	// Convert payload to JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize payload: %w", err)
	}

	response := new(dto.CommitFileResponse)
	err = b.Client.PostRaw(ctx, path, params, bytes.NewBuffer(payloadBytes), headers, response)
	if err != nil {
		return nil, fmt.Errorf("failed to commit multiple files: %w", err)
	}
	
	return response, nil
}
