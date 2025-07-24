package tools

import (
	"github.com/mark3labs/mcp-go/mcp"
)

// WithPagination adds page and size as optional parameters for pagination.
func WithPagination() mcp.ToolOption {
	return func(tool *mcp.Tool) {
		mcp.WithNumber("page",
			mcp.Description("Page number for pagination - page 0 is the first page"),
			mcp.Min(0),
			mcp.DefaultNumber(0),
		)(tool)
		mcp.WithNumber("size",
			mcp.Description("Number of items per page"),
			mcp.DefaultNumber(5),
			mcp.Max(20),
		)(tool)
	}
}

// FetchPagination fetches pagination parameters from the MCP request.
func FetchPagination(request mcp.CallToolRequest) (page, size int, err error) {
	pageVal, err := OptionalIntParamWithDefault(request, "page", 0)
	if err != nil {
		return 0, 0, err
	}
	if pageVal != 0 {
		page = int(pageVal)
	}
	sizeVal, err := OptionalIntParamWithDefault(request, "size", 5)
	if err != nil {
		return 0, 0, err
	}
	if sizeVal != 0 {
		size = int(sizeVal)
	}

	return page, size, nil
}
