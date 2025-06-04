package client

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	branchOperationsBasePath   = "code/api/v1/repos/%s/branches"
	branchOperationsCreatePath = branchOperationsBasePath + "/create"
	fileOperationsContentPath  = "code/api/v1/repos/%s/content/%s"
)

// BranchOperationsService handles operations related to branches and file operations
type BranchOperationsService struct {
	Client *Client
}

// CreateBranch creates a new branch in the repository
func (b *BranchOperationsService) CreateBranch(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.BranchCreateRequest) (*dto.BranchCreateResponse, error) {
	path := fmt.Sprintf(branchOperationsCreatePath, repoIdentifier)
	params := make(map[string]string)
	addScope(scope, params)

	response := new(dto.BranchCreateResponse)
	err := b.Client.Post(ctx, path, params, req, response)
	if err != nil {
		return nil, fmt.Errorf("failed to create branch: %w", err)
	}

	return response, nil
}

// CommitFile commits a single file change to a branch
func (b *BranchOperationsService) CommitFile(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.FileCommitRequest) (*dto.FileCommitResponse, error) {
	path := fmt.Sprintf(fileOperationsContentPath, repoIdentifier, req.FilePath)
	params := make(map[string]string)
	addScope(scope, params)

	// Add branch and commit message to params
	params["branch"] = req.Branch
	params["message"] = req.CommitMsg

	// For new files, set create=true
	if req.IsNewFile {
		params["create"] = "true"
	}

	// Base64 encode the content
	contentBase64 := base64.StdEncoding.EncodeToString([]byte(req.Content))

	// Create the payload
	payload := map[string]string{
		"content": contentBase64,
	}

	response := new(dto.FileCommitResponse)
	err := b.Client.Post(ctx, path, params, payload, response)
	if err != nil {
		return nil, fmt.Errorf("failed to commit file: %w", err)
	}

	return response, nil
}

// CommitMultipleFiles commits multiple file changes in a single commit
func (b *BranchOperationsService) CommitMultipleFiles(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.MultiFileCommitRequest) (*dto.FileCommitResponse, error) {
	path := fmt.Sprintf("code/api/v1/repos/%s/contents", repoIdentifier)
	params := make(map[string]string)
	addScope(scope, params)

	// Add branch and commit message to params
	params["branch"] = req.Branch
	params["message"] = req.CommitMsg

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

	payload := map[string]interface{}{
		"files": files,
	}

	response := new(dto.FileCommitResponse)
	err := b.Client.Post(ctx, path, params, payload, response)
	if err != nil {
		return nil, fmt.Errorf("failed to commit multiple files: %w", err)
	}

	return response, nil
}
