package tools

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// LogFileInfo stores information about a log file
type LogFileInfo struct {
	Name      string
	Timestamp time.Time
	Content   []byte
}

// extractAndAnalyzeLogs extracts log files from the ZIP file path, finds the most recent ones,
// and returns the last N lines across those files
func extractAndAnalyzeLogs(zipFilePath string, numLines int) (string, error) {
	// If numLines is not specified, default to 10 (approx. 1KB of data)
	if numLines <= 0 {
		numLines = 10
	}

	// Cap numLines at a maximum of 20
	if numLines > 20 {
		slog.Info("Limiting requested lines to maximum allowed", "requested", numLines, "max_allowed", 20)
		numLines = 20
	}

	// Extract log files from the ZIP archive
	logFiles, err := extractLogFilesFromZipPath(zipFilePath)
	if err != nil {
		return "", err
	}

	// If no files were found, return a message
	if len(logFiles) == 0 {
		return "No files with content found in the archive.", nil
	}

	// Sort log files by timestamp (most recent first)
	sortLogFilesByTimestamp(logFiles)

	// Extract the required number of lines from the files
	formattedLines := extractLinesFromFiles(logFiles, numLines)

	// Format the JSON output for better readability
	result := formatJSONLines(formattedLines)
	return result, nil
}

// extractLogFilesFromZipPath extracts all log files from a ZIP file path
func extractLogFilesFromZipPath(zipFilePath string) ([]LogFileInfo, error) {
	// Open the ZIP file
	zipFile, err := os.Open(zipFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open ZIP file: %v", err)
	}
	defer zipFile.Close()

	// Get file info to determine size
	fileInfo, err := zipFile.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get ZIP file info: %v", err)
	}

	// Create a reader for the ZIP content
	zipr, err := zip.NewReader(zipFile, fileInfo.Size())
	if err != nil {
		return nil, fmt.Errorf("failed to read ZIP content: %v", err)
	}

	// Debug: List all files in the ZIP
	fileList := "Files in archive:\n"
	for _, file := range zipr.File {
		fileList += fmt.Sprintf("- %s (size: %d bytes)\n", file.Name, file.UncompressedSize64)
	}
	slog.Info("ZIP archive contents", "files", fileList)

	// Find all files with content in the ZIP
	var logFiles []LogFileInfo
	for _, file := range zipr.File {
		// Debug: Check each file
		slog.Info("Examining file in ZIP", "name", file.Name, "size", file.UncompressedSize64)

		// Skip directories and empty files
		if file.FileInfo().IsDir() || file.UncompressedSize64 == 0 {
			slog.Info("Skipping directory or empty file", "name", file.Name)
			continue
		}

		// Open the file
		rc, err := file.Open()
		if err != nil {
			slog.Error("Failed to open file", "file", file.Name, "error", err)
			continue
		}
		defer rc.Close()

		// Create a buffer for reading the file in chunks
		bufSize := 64 * 1024 // 64KB chunks
		buf := make([]byte, bufSize)
		var content []byte

		// Read the file in chunks to avoid loading very large files entirely into memory
		for {
			n, err := rc.Read(buf)
			if n > 0 {
				content = append(content, buf[:n]...)

				// If the file is getting too large, stop reading and just use what we have
				if len(content) > 10*1024*1024 { // 10MB limit
					slog.Warn("File too large, truncating", "file", file.Name, "size_read", len(content))
					break
				}
			}
			if err == io.EOF {
				break
			}
			if err != nil {
				slog.Error("Failed to read file", "file", file.Name, "error", err)
				break
			}
		}

		// Extract timestamp from the last non-empty line with a timestamp
		timestampStr := ""
		if len(content) > 0 {
			lines := strings.Split(string(content), "\n")

			// Start from the end and find the first non-empty line with a timestamp
			for i := len(lines) - 1; i >= 0; i-- {
				if lines[i] == "" {
					continue
				}

				timestampStr = extractTimestamp(lines[i])
				if timestampStr != "" {
					slog.Info("Found timestamp in line", "line_index", i, "total_lines", len(lines))
					break
				}
			}

			if timestampStr == "" {
				slog.Info("No timestamp found in any line", "file", file.Name)
			}
		}

		// Parse the timestamp
		var timestamp time.Time
		if timestampStr != "" {
			// Try parsing with RFC3339Nano format first (most common for JSON logs)
			t, err := time.Parse(time.RFC3339Nano, timestampStr)
			if err == nil {
				timestamp = t
			} else {
				// Try other common formats
				formats := []string{
					"2006-01-02T15:04:05.000000000Z",
					"2006-01-02T15:04:05Z",
					"2006-01-02T15:04:05.000Z",
				}

				for _, format := range formats {
					t, err := time.Parse(format, timestampStr)
					if err == nil {
						timestamp = t
						break
					}
				}
			}

			// Log the timestamp parsing result for debugging
			if timestamp.IsZero() {
				slog.Info("Failed to parse timestamp", "raw", timestampStr)
			} else {
				slog.Info("Parsed timestamp", "raw", timestampStr, "parsed", timestamp.Format(time.RFC3339))
			}
		}

		// Add to our list of log files
		logFiles = append(logFiles, LogFileInfo{
			Name:      file.Name,
			Timestamp: timestamp,
			Content:   content,
		})
	}

	return logFiles, nil
}

// sortLogFilesByTimestamp sorts log files by timestamp (most recent first)
func sortLogFilesByTimestamp(logFiles []LogFileInfo) {
	sort.Slice(logFiles, func(i, j int) bool {
		return logFiles[i].Timestamp.After(logFiles[j].Timestamp)
	})
}

// extractLinesFromFiles extracts the required number of lines from multiple log files
func extractLinesFromFiles(logFiles []LogFileInfo, numLines int) []string {
	var formattedLines []string

	// Process files in order of recency (most recent first) until we have enough lines
	for fileIndex, logFile := range logFiles {
		slog.Info("Processing file",
			"file", logFile.Name,
			"timestamp", logFile.Timestamp,
			"index", fileIndex,
			"lines_needed", numLines-len(formattedLines))

		// Split the content into lines
		lines := strings.Split(string(logFile.Content), "\n")

		// Remove empty lines at the end of the file
		for len(lines) > 0 && lines[len(lines)-1] == "" {
			lines = lines[:len(lines)-1]
		}

		// Calculate how many more lines we need
		linesNeeded := numLines - len(formattedLines)

		// Process lines from the end of the file (most recent first)
		start := len(lines) - linesNeeded
		if start < 0 {
			start = 0
		}

		// Process each line from the end of the file
		for i := len(lines) - 1; i >= start && len(formattedLines) < numLines; i-- {
			line := lines[i]
			if line == "" {
				continue
			}

			// Process the line and add it to formattedLines (at the beginning to maintain order)
			formattedLines = append([]string{line}, formattedLines...)
		}

		// If we have enough lines or processed all files, stop
		if len(formattedLines) >= numLines || fileIndex == len(logFiles)-1 {
			break
		}
	}

	return formattedLines
}

// removeAnsiCodes removes ANSI color codes from a string
func removeAnsiCodes(s string) string {
	// Simple string replacement for ANSI color codes
	s = strings.ReplaceAll(s, "\u001b", "")
	s = strings.ReplaceAll(s, "\x1b", "")

	// Remove any remaining color code patterns like [33;1m
	re := regexp.MustCompile("\\[[0-9;]*[a-zA-Z]")
	return re.ReplaceAllString(s, "")
}

// formatJSONLines formats a slice of JSON lines for better readability
// Returns a human-readable format of the log entries
func formatJSONLines(lines []string) string {
	var formattedOutput strings.Builder

	for _, line := range lines {
		// Try to parse the JSON
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(line), &parsed); err == nil {
			// Extract timestamp and log message
			timestamp, _ := parsed["time"].(string)
			level, _ := parsed["level"].(string)
			output, _ := parsed["out"].(string)

			// Clean ANSI codes from the output
			output = removeAnsiCodes(output)

			// Format the timestamp if possible
			formattedTime := timestamp
			if t, err := time.Parse(time.RFC3339Nano, timestamp); err == nil {
				formattedTime = t.Format("2006-01-02 15:04:05")
			}

			// Add a line to the output
			formattedOutput.WriteString(fmt.Sprintf("[%s] %s: %s\n", formattedTime, level, output))
		} else {
			// If we can't parse it, just add the raw line
			formattedOutput.WriteString(line)
			formattedOutput.WriteString("\n")
		}
	}

	return formattedOutput.String()
}

// extractTimestamp extracts the timestamp from a JSON log line with a "time" field
func extractTimestamp(line string) string {
	// Check if this is a JSON log with a "time" field
	if strings.Contains(line, "\"time\":") {
		// Extract the timestamp value
		parts := strings.Split(line, "\"time\":")
		if len(parts) > 1 {
			// Extract the quoted timestamp value
			timePart := parts[1]
			// Find the opening quote
			start := strings.Index(timePart, "\"")
			if start >= 0 {
				// Find the closing quote
				end := strings.Index(timePart[start+1:], "\"")
				if end >= 0 {
					// Extract the timestamp between quotes
					return timePart[start+1 : start+1+end]
				}
			}
		}
	}

	return ""
}

// Note: getLastLines function has been removed as it's no longer used.
// The functionality has been incorporated into the extractAndAnalyzeLogs function
// which now handles multiple files and processes lines with dedicated helper functions.

// DownloadExecutionLogsTool creates a tool for downloading logs for a pipeline execution
// TODO: to make this easy to use, we ask to pass in an output path and do the complete download of the logs.
// This is less work for the user, but we may want to only return the download instruction instead in the future.
func DownloadExecutionLogsTool(config *config.Config, client *client.LogService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("download_execution_logs",
			mcp.WithDescription("Downloads logs for a pipeline execution. Returns the last N non-empty lines as human-readable formatted logs with timestamps and ANSI codes removed."),
			mcp.WithString("plan_execution_id",
				mcp.Description("The ID of the plan execution"),
			),
			mcp.WithString("logs_directory",
				mcp.Required(),
				mcp.Description("The absolute path to the directory where the logs should get downloaded."),
			),
			mcp.WithNumber("num_lines",
				mcp.Description("Number of log lines to return. Default is 10."),
				mcp.DefaultNumber(10),
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

			// Get the logs directory
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
			logDownloadURL, err := client.DownloadLogs(ctx, scope, planExecutionID, logKey)
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

			// Log information about the response
			slog.Info("Response received",
				"content_type", resp.Header.Get("Content-Type"),
				"content_length", resp.ContentLength)

			// Create a temporary buffer to check if the file is a ZIP
			headerBuf := make([]byte, 2)
			_, err = io.ReadFull(resp.Body, headerBuf)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to read response header: %v", err)), nil
			}

			// Check if it's a ZIP file (PK signature)
			isZip := headerBuf[0] == 'P' && headerBuf[1] == 'K'
			slog.Info("File type check", "is_zip", isZip)

			// Write the header bytes we've already read
			_, err = outputFile.Write(headerBuf)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to write header bytes: %v", err)), nil
			}

			// Stream the rest of the response body directly to the file
			written, err := io.Copy(outputFile, resp.Body)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to write logs to file: %v", err)), nil
			}

			// Log the total bytes written
			totalWritten := written + 2 // Add the 2 bytes we wrote separately
			slog.Info("File download completed", "bytes_written", totalWritten)

			if !config.Internal {
				// Success message with download details
				instruction := fmt.Sprintf("Successfully downloaded logs to %s (%d bytes)! You can unzip and analyze these logs.", logsZipPath, totalWritten)

				return mcp.NewToolResultText(instruction), nil
			}

			numLines, err := OptionalParam[float64](request, "num_lines")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// For internal mode, we need to close the file first to ensure all data is flushed
			outputFile.Close()
			// Now extract and analyze the logs from the ZIP file path
			logContent, err := extractAndAnalyzeLogs(logsZipPath, int(numLines))
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to extract and analyze logs: %v", err)), nil
			}

			slog.Info("File analysis completed", "content", logContent)

			return mcp.NewToolResultText(logContent), nil
		}
}
