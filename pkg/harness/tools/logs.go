package tools

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// DownloadExecutionLogsTool creates a tool for downloading logs for a pipeline execution
// TODO: to make this easy to use, we ask to pass in an output path and do the complete download of the logs.
// This is less work for the user, but we may want to only return the download instruction instead in the future.
func DownloadExecutionLogsTool(config *config.Config, client *client.LogService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("download_execution_logs",
			mcp.WithDescription("Downloads logs for an execution inside Harness"),
			mcp.WithString("plan_execution_id",
				mcp.Description("The ID of the plan execution"),
			),
			mcp.WithString("logs_directory",
				mcp.Required(),
				mcp.Description("The absolute path to the directory where the logs should get downloaded."),
			),
			mcp.WithString("log_key",
				mcp.Description("Optional log key to be used for downloading logs directly"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			planExecutionID, err := RequiredParam[string](request, "plan_execution_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get optional log key parameter
			logKey, _ := OptionalParam[string](request, "log_key")

			logDownloadURL, err := client.DownloadLogs(ctx, scope, planExecutionID, logKey)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch log download URL: %w", err)
			}

			logsDirectory, err := RequiredParam[string](request, "logs_directory")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// If OutputDir is configured, use it as the base directory for logs
			if config.OutputDir != "" {

				if !strings.HasPrefix(logsDirectory, config.OutputDir) {
					// Create a subdirectory within the output directory for logs
					oldLogsDirectory := logsDirectory
					logsDirectoryName := filepath.Base(logsDirectory)
					// If the logs directory is just a root path like /tmp, use a more descriptive name
					if logsDirectoryName == "/" || logsDirectoryName == "" {
						logsDirectoryName = "pipeline-logs"
					}
					logsDirectory = filepath.Join(config.OutputDir, logsDirectoryName)
					slog.Info("Redirecting logs from %s to %s to ensure access", oldLogsDirectory, logsDirectory)
				}
			}

			// Create the logs folder path (creates all parent directories if needed)
			logsFolderName := fmt.Sprintf("logs-%s", planExecutionID)
			logsFolderPath := filepath.Join(logsDirectory, logsFolderName)
			err = os.MkdirAll(logsFolderPath, 0755)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to create logs directory: %v", err)), nil
			}

			// Get the download URL
			logDownloadURL, err = client.DownloadLogs(ctx, scope, planExecutionID, logKey)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to fetch log download URL: %v", err)), nil
			}

			// Download the logs into outputPath
			resp, err := http.Get(logDownloadURL)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to download logs: %v", err)), nil
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return mcp.NewToolResultError(fmt.Sprintf("failed to download logs: unexpected status code %d", resp.StatusCode)), nil
			}

			// Create the logs.zip file path
			logsZipPath := filepath.Join(logsFolderPath, "logs.zip")

			// Create the output file
			outputFile, err := os.Create(logsZipPath)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to create output file: %v", err)), nil
			}
			defer outputFile.Close()

			// Copy the response body to the output file
			bytesWritten, err := io.Copy(outputFile, resp.Body)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to write logs to file: %v", err)), nil
			}

			// Success message with download details
			instruction := fmt.Sprintf("Successfully downloaded logs to %s (%d bytes)! You can unzip and analyze these logs.", logsZipPath, bytesWritten)

			return mcp.NewToolResultText(instruction), nil
		}
}
