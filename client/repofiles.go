package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	repoFilesBasePath = "code/api/v1/repos"
	repoFilesContentPath = repoFilesBasePath + "/%s/+/content/%s"
)

// RepoFilesService handles operations related to repository files
type RepoFilesService struct {
	Client *Client
}

// GetContent retrieves the content of a file from a repository
func (r *RepoFilesService) GetContent(ctx context.Context, scope dto.Scope, repoIdentifier string, filePath string, opts *dto.RepoFileContentOptions) (*dto.RepoFileContent, error) {
	path := fmt.Sprintf(repoFilesContentPath, repoIdentifier, filePath)
	params := make(map[string]string)
	addScope(scope, params)

	if opts != nil {
		if opts.GitRef != "" {
			params["git_ref"] = opts.GitRef
		}
		if opts.IncludeCommit {
			params["include_commit"] = "true"
		}
	}

	fileContent := new(dto.RepoFileContent)
	err := r.Client.Get(ctx, path, params, nil, fileContent)
	if err != nil {
		return nil, fmt.Errorf("failed to get repository file content: %w", err)
	}

	return fileContent, nil
}
