package dto

// CustomBranchCreateRequest represents a request to create a new branch
type CustomBranchCreateRequest struct {
	BranchName string `json:"branch_name"`
	StartPoint string `json:"start_point,omitempty"` // Optional, defaults to default branch if not specified
}

// CustomBranchCreateResponse represents the response from creating a branch
type CustomBranchCreateResponse struct {
	Name      string `json:"name"`
	CommitSha string `json:"commit_sha"`
	Success   bool   `json:"success"`
}

// CustomFileCommitRequest represents a request to commit a file change
type CustomFileCommitRequest struct {
	Branch      string `json:"branch"`      // Branch to commit to
	FilePath    string `json:"file_path"`   // Path of the file to commit
	Content     string `json:"content"`     // Content to write to the file
	CommitMsg   string `json:"commit_msg"`  // Commit message
	IsNewFile   bool   `json:"is_new_file"` // Whether this is a new file or an update
}

// CustomFileCommitResponse represents the response from committing a file
type CustomFileCommitResponse struct {
	CommitSha string `json:"commit_sha"`
	Success   bool   `json:"success"`
}

// CustomMultiFileCommitRequest represents a request to commit multiple file changes
type CustomMultiFileCommitRequest struct {
	Branch    string                `json:"branch"`     // Branch to commit to
	CommitMsg string                `json:"commit_msg"` // Commit message
	Files     []CustomFileOperation `json:"files"`      // Files to commit
}

// CustomFileOperation represents a single file operation in a multi-file commit
type CustomFileOperation struct {
	FilePath    string `json:"file_path"`   // Path of the file
	Content     string `json:"content"`     // Content to write
	IsNewFile   bool   `json:"is_new_file"` // Whether this is a new file or an update
}
