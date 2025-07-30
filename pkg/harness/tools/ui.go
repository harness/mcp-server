package tools

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// CreateUISelectFromListTool creates a UI component that prompts the user to select an item from a displayed list
func CreateUISelectFromListTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ui_select_from_list",
			mcp.WithDescription("Prompts the user to select an item from a displayed list"),
			mcp.WithArray("options",
				mcp.Required(),
				mcp.Description("Array of options to display in the selection list"),
				mcp.MinItems(1),
				mcp.MaxItems(10),
				mcp.Items(map[string]any{
					"oneOf": []map[string]any{
						{
							"type":        "string",
							"description": "Simple string option to display in the list",
						},
						{
							"type": "object",
							"properties": map[string]any{
								"value": map[string]any{
									"type":        "string",
									"description": "Value for the option",
								},
								"label": map[string]any{
									"type":        "string",
									"description": "Display text for the option",
								},
							},
						},
					},
				}),
			),
			mcp.WithString("title",
				mcp.Required(),
				mcp.Description("Title for the selection list"),
				mcp.MinLength(1),
				mcp.MaxLength(100),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Parse required parameters
			optionsRaw, err := RequiredAnyArrayParam(request, "options")
			if err != nil {
				return mcp.NewToolResultError("Invalid options parameter: " + err.Error()), nil
			}

			// Ensure we have at least one option
			if len(optionsRaw) == 0 {
				return mcp.NewToolResultError("At least one option is required"), nil
			}

			title, err := RequiredParam[string](request, "title")
			if err != nil {
				return mcp.NewToolResultError("Invalid title parameter: " + err.Error()), nil
			}

			// Convert options to SelectOption format
			options := make([]dto.SelectOption, len(optionsRaw))
			for i, opt := range optionsRaw {
				switch o := opt.(type) {
				case string:
					// Simple string option
					options[i] = dto.SelectOption{Value: o, Label: o}
				case map[string]interface{}:
					// Object with value/label
					value, _ := o["value"].(string)
					label, _ := o["label"].(string)

					// If no label, use value as label
					if label == "" {
						label = value
					}

					options[i] = dto.SelectOption{Value: value, Label: label}
				default:
					// For any other type, convert to string
					s := fmt.Sprintf("%v", o)
					options[i] = dto.SelectOption{Value: s, Label: s}
				}
			}

			// Create the select component
			selectComponent := dto.NewSelectComponent("generic_select_component", title, options)

			// Create resources
			resource, err := utils.CreateUIResource(selectComponent)
			if err != nil {
				return nil, fmt.Errorf("failed to create UI resource: %w", err)
			}

			// Return the result
			return utils.NewToolResultWithResources(
				config,
				"",
				[]mcp.ResourceContents{resource},
				nil,
			), nil
		}
}

// CreateUIMultiSelectFromListTool creates a UI component that prompts the user to select multiple items from a displayed list
func CreateUIMultiSelectFromListTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ui_multi_select_from_list",
			mcp.WithDescription("Prompts the user to select multiple items from a displayed list"),
			mcp.WithArray("options",
				mcp.Required(),
				mcp.Description("Array of options to display in the selection list"),
				mcp.MinItems(1),
				mcp.MaxItems(20),
				mcp.Items(map[string]any{
					"oneOf": []map[string]any{
						{
							"type":        "string",
							"description": "Simple string option to display in the list",
						},
						{
							"type": "object",
							"properties": map[string]any{
								"value": map[string]any{
									"type":        "string",
									"description": "Value for the option",
								},
								"label": map[string]any{
									"type":        "string",
									"description": "Display text for the option",
								},
							},
						},
					},
				}),
			),
			mcp.WithString("title",
				mcp.Required(),
				mcp.Description("Title for the selection list"),
				mcp.MinLength(1),
				mcp.MaxLength(100),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Parse required parameters
			optionsRaw, err := RequiredAnyArrayParam(request, "options")
			if err != nil {
				return mcp.NewToolResultError("Invalid options parameter: " + err.Error()), nil
			}

			// Ensure we have at least one option
			if len(optionsRaw) == 0 {
				return mcp.NewToolResultError("At least one option is required"), nil
			}

			title, err := RequiredParam[string](request, "title")
			if err != nil {
				return mcp.NewToolResultError("Invalid title parameter: " + err.Error()), nil
			}

			// Convert options to SelectOption format
			options := make([]dto.SelectOption, len(optionsRaw))
			for i, opt := range optionsRaw {
				switch o := opt.(type) {
				case string:
					// Simple string option
					options[i] = dto.SelectOption{Value: o, Label: o}
				case map[string]interface{}:
					// Object with value/label
					value, _ := o["value"].(string)
					label, _ := o["label"].(string)

					// If no label, use value as label
					if label == "" {
						label = value
					}

					options[i] = dto.SelectOption{Value: value, Label: label}
				default:
					// For any other type, convert to string
					s := fmt.Sprintf("%v", o)
					options[i] = dto.SelectOption{Value: s, Label: s}
				}
			}

			// Create the multi-select component
			multiSelectComponent := dto.NewMultiSelectComponent(
				"generic_multi_select_component",
				title,
				options,
			)

			// Create resources
			resource, err := utils.CreateUIResource(multiSelectComponent)
			if err != nil {
				return nil, fmt.Errorf("failed to create UI resource: %w", err)
			}

			// Return the result
			return utils.NewToolResultWithResources(
				config,
				"",
				[]mcp.ResourceContents{resource},
				nil,
			), nil
		}
	}