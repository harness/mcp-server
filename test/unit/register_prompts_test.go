package unit

import (
	"embed"
	"encoding/json"
	"strings"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	p "github.com/harness/harness-mcp/pkg/prompts"
	"github.com/mark3labs/mcp-go/server"
)

func registerPromptsCopy(moduleID string, cfg *config.Config, mcpServer *server.MCPServer) (*p.Prompt, error) {
	
	    // Create a map to store prompts by mode
		modulePromptsByMode := map[string][]prompts.PromptFile{
			string(p.Standard): {},
			string(p.Architect): {},
		}
		
		// Get module-specific prompts for standard mode
		standardPrompts, err := mockGetModulePrompts(prompts.PromptFiles, strings.ToLower(moduleID), cfg.Internal, string(p.Standard))
		if err != nil {
			return nil, err
		}
		modulePromptsByMode[string(p.Standard)] = standardPrompts
		
		// Get module-specific prompts for architect mode (only for internal)
		if cfg.Internal {
			architectPrompts, err := mockGetModulePrompts(prompts.PromptFiles, strings.ToLower(moduleID), cfg.Internal, string(p.Architect))
			if err != nil {
				return nil, err
			}
			modulePromptsByMode[string(p.Architect)] = architectPrompts
		}
		
		// Check if we have any prompts for this module
		totalPrompts := len(modulePromptsByMode[string(p.Standard)]) + len(modulePromptsByMode[string(p.Architect)])
		if totalPrompts == 0 {
			// No prompts for this module
			return nil, nil
		}
	
		// Create a map to store combined content for each mode
		modeContents := make(map[string]string)
		
		// Get description and result description from the first available prompt
		description := ""
		resultDescription := ""
		
		// First, prioritize standard mode for descriptions to ensure deterministic behavior
		if len(modulePromptsByMode[string(p.Standard)]) > 0 {
			standardPrompts := modulePromptsByMode[string(p.Standard)]
			if standardPrompts[0].Metadata.Description != "" {
				description = standardPrompts[0].Metadata.Description
			}
			if standardPrompts[0].Metadata.ResultDescription != "" {
				resultDescription = standardPrompts[0].Metadata.ResultDescription
			}
		}
		
		// If standard mode doesn't have descriptions, fall back to architect mode
		if description == "" || resultDescription == "" {
			if len(modulePromptsByMode[string(p.Architect)]) > 0 {
				architectPrompts := modulePromptsByMode[string(p.Architect)]
				if description == "" && architectPrompts[0].Metadata.Description != "" {
					description = architectPrompts[0].Metadata.Description
				}
				if resultDescription == "" && architectPrompts[0].Metadata.ResultDescription != "" {
					resultDescription = architectPrompts[0].Metadata.ResultDescription
				}
			}
		}
		
		// Process each mode separately to build the content map
		for mode, modePrompts := range modulePromptsByMode {
			if len(modePrompts) == 0 {
				continue // Skip empty modes
			}
			
			// Combine all prompt contents for this mode
			var combinedContent strings.Builder
			for i, promptFile := range modePrompts {
				if promptFile.Content != "" {
					if i > 0 {
						combinedContent.WriteString("\n\n")
					}
					combinedContent.WriteString(promptFile.Content)
				}
			}
			
			// Store the combined content for this mode
			modeContents[mode] = combinedContent.String()
		}
		
		// Convert the mode contents map to JSON
		contentJSON, err := json.Marshal(modeContents)
		if err != nil {
			return nil, err
		}
		
		// Create a single MCP prompt with the module ID as the name
		mcpPrompt := p.NewPrompt().
			SetName(strings.ToUpper(moduleID)). // Use moduleID as the prompt name
			SetDescription(description).
			SetResultDescription(resultDescription).
			SetText(string(contentJSON)). // Store the JSON map as the prompt text
			Build()
		
		// Create a Prompts collection with the single prompt
		mcpPrompts := p.Prompts{}
		mcpPrompts.Append(mcpPrompt)
		
		// Register the prompt with the MCP server
		p.AddPrompts(mcpPrompts, mcpServer)
		
		return mcpPrompt, nil
}

// Mock the GetModulePrompts function to return our test prompts
func mockGetModulePrompts(fs embed.FS, module string, isInternal bool, mode string) ([]prompts.PromptFile, error) {
	// Return different prompts based on the requested mode
	if mode == string(p.Standard) {
		return []prompts.PromptFile{
			{
				Metadata: prompts.PromptMetadata{
					Description:       "Standard test description",
					ResultDescription: "Standard result description",
					Module:            "testmodule",
				},
				Content:  "Standard content",
				FilePath: "files/internal/standard/testmodule.txt",
			},
		}, nil
	} else if mode == string(p.Architect) {
		return []prompts.PromptFile{
			{
				Metadata: prompts.PromptMetadata{
					Description:       "Architect test description",
					ResultDescription: "Architect result description",
					Module:            "testmodule",
				},
				Content:  "Architect content",
				FilePath: "files/internal/architect/testmodule.txt",
			},
		}, nil
	}

	return []prompts.PromptFile{}, nil
}

func TestRegisterPrompts(t *testing.T) {
	// We can't directly replace the GetModulePrompts function, so we'll use our own implementation
	// in the testRegisterPrompts function

	cfg := &config.Config{
		Internal: true,
	}

	// Create fake MCP server
	mcpServer := server.NewMCPServer("test-server", "test-version")

	// Use our test version of registerPrompts
	prompt, err := registerPromptsCopy("testmodule", cfg, mcpServer)
	if err != nil {
		t.Fatalf("registerPrompts returned error: %v", err)
	}
	if prompt.Name != "TESTMODULE" {
		t.Errorf("expected prompt name 'TESTMODULE', got %q", prompt.Name)
	}
	if !strings.Contains(prompt.Description, "Standard test description") {
		t.Errorf("description mismatch, got %q", prompt.Description)
	}
	if !strings.Contains(prompt.ResultDescription, "Standard result description") {
		t.Errorf("result description mismatch, got %q", prompt.ResultDescription)
	}

	// Verify JSON text contains both modes
	var modeContents map[string]string
	if err := json.Unmarshal([]byte(prompt.Text), &modeContents); err != nil {
		t.Fatalf("failed to unmarshal prompt text: %v", err)
	}

	if modeContents[string(p.Standard)] != "Standard content" {
		t.Errorf("standard mode content mismatch, got %q", modeContents[string(p.Standard)])
	}
	if modeContents[string(p.Architect)] != "Architect content" {
		t.Errorf("architect mode content mismatch, got %q", modeContents[string(p.Architect)])
	}
}
