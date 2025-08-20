package tools

import (
    "context"
    "encoding/json"
    "fmt"
    "strings"

    "github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
)

// ListPromptsTool creates a tool for listing prompts from the MCP server
func ListPromptsTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("list_prompts",
            mcp.WithDescription("Lists available prompts from the MCP server"),
            mcp.WithString("prefix",
                mcp.Description("Optional prefix to filter prompts by name"),
            ),
            WithScope(config, false),
        ),
        func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
            // Extract prefix parameter if present
            prefix, err := OptionalParam[string](request, "prefix")
            if err != nil {
                return mcp.NewToolResultError(err.Error()), nil
            }

            // Extract scope parameters (for future filtering if needed)
            scope, err := FetchScope(config, request, false)
            if err != nil {
                return mcp.NewToolResultError(err.Error()), nil
            }

            // Define the list of available prompts
            // These are the prompts that are registered with the MCP server
            allPrompts := []map[string]interface{}{
                {
                    "name":        "get_ccm_overview",
                    "description": "Ensure parameters are provided correctly and in the right format.",
                },
                {
                    "name":        "ask_confirmation_for_update_and_delete_operations",
                    "description": "Ensure that Update or Delete operations are executed ONLY after user confirmation.",
                },
                {
                    "name":        "pipeline_summarizer",
                    "description": "Summarize a Harness pipeline's structure, purpose, and behavior.",
                },
                {
                    "name":        "CCM",
                    "description": "Cloud Cost Management prompts and guidelines.",
                },
                {
                    "name":        "CD",
                    "description": "Continuous Deployment prompts and guidelines.",
                },
                {
                    "name":        "CI",
                    "description": "Continuous Integration prompts and guidelines.",
                },
                {
                    "name":        "CHAOS",
                    "description": "Chaos Engineering prompts and guidelines.",
                },
                {
                    "name":        "STO",
                    "description": "Security Testing Orchestration prompts and guidelines.",
                },
                {
                    "name":        "SSCA",
                    "description": "Software Supply Chain Assurance prompts and guidelines.",
                },
                {
                    "name":        "CODE",
                    "description": "Code Repository prompts and guidelines.",
                },
                {
                    "name":        "IDP",
                    "description": "Internal Developer Portal prompts and guidelines.",
                },
                {
                    "name":        "HAR",
                    "description": "Harness Application Reliability prompts and guidelines.",
                },
                {
                    "name":        "DBOPS",
                    "description": "Database Operations prompts and guidelines.",
                },
                {
                    "name":        "ACM",
                    "description": "Autonomous Code Maintenance prompts and guidelines.",
                },
                {
                    "name":        "SEI",
                    "description": "Software Engineering Insights prompts and guidelines.",
                },
            }

            // Filter prompts by prefix if specified
            var filteredPrompts []map[string]interface{}
            if prefix == "" {
                filteredPrompts = allPrompts
            } else {
                for _, prompt := range allPrompts {
                    if name, ok := prompt["name"].(string); ok {
                        if name == prefix || strings.HasPrefix(name, prefix) {
                            filteredPrompts = append(filteredPrompts, prompt)
                        }
                    }
                }
            }

            // Create the response in the expected format
            result := map[string]interface{}{
                "prompts": filteredPrompts,
            }

            // Note: scope parameters (accountID, orgID, projectID) are available
            // for future use if prompt filtering by scope is needed
            _ = scope

            r, err := json.Marshal(result)
            if err != nil {
                return nil, fmt.Errorf("failed to marshal result: %w", err)
            }

            return mcp.NewToolResultText(string(r)), nil
        }
}

// GetPromptTool creates a tool for retrieving a single prompt from the MCP server
func GetPromptTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("get_prompt",
            mcp.WithDescription("Retrieves a specific prompt from the MCP server by name"),
            mcp.WithString("prompt_name",
                mcp.Description("The name of the prompt to retrieve"),
                mcp.Required(),
            ),
            mcp.WithString("mode",
                mcp.Description("Optional mode to retrieve a specific version of the prompt"),
            ),
            WithScope(config, false),
        ),
        func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
            // Extract prompt name parameter
            promptName, err := RequiredParam[string](request, "prompt_name")
            if err != nil {
                return mcp.NewToolResultError(err.Error()), nil
            }

            // Extract optional mode parameter
            mode, err := OptionalParam[string](request, "mode")
            if err != nil {
                return mcp.NewToolResultError(err.Error()), nil
            }

            // Extract scope parameters (for future use if needed)
            scope, err := FetchScope(config, request, false)
            if err != nil {
                return mcp.NewToolResultError(err.Error()), nil
            }

            // Define prompt details map
            promptDetails := map[string]map[string]interface{}{
                "get_ccm_overview": {
                    "description": "Ensure parameters are provided correctly and in the right format.",
                    "messages": []map[string]interface{}{
                        {
                            "role": "user",
                            "content": map[string]interface{}{
                                "type": "text",
                                "text": "When calling get_ccm_overview, ensure you have: accountIdentifier, groupBy, startDate, and endDate.\n- If any are missing, ask the user for the specific value(s).\n- Always send startDate and endDate in the following format: 'MM/DD/YYYY' (e.g. '10/30/2025')\n- If no dates are supplied, default startDate to 60 days ago and endDate to now.",
                            },
                        },
                    },
                },
                "ask_confirmation_for_update_and_delete_operations": {
                    "description": "Ensure that Update or Delete operations are executed ONLY after user confirmation.",
                    "messages": []map[string]interface{}{
                        {
                            "role": "user",
                            "content": map[string]interface{}{
                                "type": "text",
                                "text": "**Confirmation Policy**:\nWhen a function/tool description contains the tag <INSERT_TOOL>, <UPDATE_TOOL> or <DELETE_TOOL>, **BEFORE** calling it you **ALWAYS** must:\n\n- Present a clear, minimal summary of the impending change (show key fields/values).\n- Ask: 'Please confirm to proceed (yes/no).'\n- **ONLY** invoke the tool if the user's next message is exactly \"yes\" (case-insensitive).\n- If the user's answer is anything other than \"yes\", do not call the tool; instead, offer to adjust or cancel.\n- Never assume consent; always re-ask if the context is ambiguous or stale.",
                            },
                        },
                    },
                },
                "pipeline_summarizer": {
                    "description": "Summarize a Harness pipeline's structure, purpose, and behavior.",
                    "messages": []map[string]interface{}{
                        {
                            "role": "user",
                            "content": map[string]interface{}{
                                "type": "text",
                                "text": "I need you to summarise the pipeline with the input pipeline identifier.\n\n1. **What to do?**\n   - Fetch any required metadata or definitions for the pipeline.\n   - Analyze its configuration and structure.\n   - Make the necessary tool calls to get the pipeline related details.\n   - Produce a concise, accurate summary of the pipeline's design and behavior.",
                            },
                        },
                    },
                },
            }

            // Check if the prompt exists
            promptDetail, exists := promptDetails[promptName]
            if !exists {
                // For module prompts (CCM, CD, etc.), return a generic response
                modulePrompts := map[string]string{
                    "CCM":    "Cloud Cost Management prompts and guidelines.",
                    "CD":     "Continuous Deployment prompts and guidelines.",
                    "CI":     "Continuous Integration prompts and guidelines.",
                    "CHAOS":  "Chaos Engineering prompts and guidelines.",
                    "STO":    "Security Testing Orchestration prompts and guidelines.",
                    "SSCA":   "Software Supply Chain Assurance prompts and guidelines.",
                    "CODE":   "Code Repository prompts and guidelines.",
                    "IDP":    "Internal Developer Portal prompts and guidelines.",
                    "HAR":    "Harness Application Reliability prompts and guidelines.",
                    "DBOPS":  "Database Operations prompts and guidelines.",
                    "ACM":    "Autonomous Code Maintenance prompts and guidelines.",
                    "SEI":    "Software Engineering Insights prompts and guidelines.",
                }

                if description, isModule := modulePrompts[promptName]; isModule {
                    promptDetail = map[string]interface{}{
                        "description": description,
                        "messages": []map[string]interface{}{
                            {
                                "role": "user",
                                "content": map[string]interface{}{
                                    "type": "text",
                                    "text": fmt.Sprintf("This is the %s module prompt. Use this for guidance when working with %s related tasks.", promptName, description),
                                },
                            },
                        },
                    }
                } else {
                    return mcp.NewToolResultError(fmt.Sprintf("prompt '%s' not found", promptName)), nil
                }
            }

            // Note: mode parameter and scope are available for future use
            _ = mode
            _ = scope

            // Return the prompt details
            r, err := json.Marshal(promptDetail)
            if err != nil {
                return nil, fmt.Errorf("failed to marshal result: %w", err)
            }

            return mcp.NewToolResultText(string(r)), nil
        }
    }