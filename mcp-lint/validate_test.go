package mcplint

import (
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestValidateToolName_SnakeCase(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		// Valid snake_case
		{"valid simple", "get_pipeline", false},
		{"valid with numbers", "get_pipeline_v2", false},
		{"valid module prefix", "ccm_get_costs", false},
		{"valid single verb", "list", false},
		{"valid long name", "ccm_get_cloud_cost_recommendations", false},

		// Invalid - not snake_case
		{"invalid camelCase", "getPipeline", true},
		{"invalid PascalCase", "GetPipeline", true},
		{"invalid hyphen", "get-pipeline", true},
		{"invalid starts with number", "123_test", true},
		{"invalid uppercase", "GET_PIPELINE", true},
		{"invalid mixed case", "Get_Pipeline", true},
		{"invalid spaces", "get pipeline", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateToolName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateToolName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateToolName_MaxLength(t *testing.T) {
	// Create a valid 64 character name
	valid64 := "get_" + strings.Repeat("a", 60) // 4 + 60 = 64
	// Create an invalid 65 character name
	invalid65 := "get_" + strings.Repeat("a", 61) // 4 + 61 = 65

	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid 64 chars", valid64, false},
		{"invalid 65 chars", invalid65, true},
		{"invalid empty", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateToolName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateToolName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateToolName_VerbPrefix(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		// Valid - starts with verb
		{"valid get prefix", "get_pipeline", false},
		{"valid list prefix", "list_pipelines", false},
		{"valid create prefix", "create_user", false},
		{"valid update prefix", "update_settings", false},
		{"valid delete prefix", "delete_resource", false},
		{"valid fetch prefix", "fetch_data", false},
		{"valid search prefix", "search_logs", false},
		{"valid run prefix", "run_pipeline", false},
		{"valid execute prefix", "execute_step", false},
		{"valid trigger prefix", "trigger_build", false},
		{"valid enable prefix", "enable_feature", false},
		{"valid disable prefix", "disable_feature", false},
		{"valid add prefix", "add_member", false},
		{"valid set prefix", "set_config", false},
		{"valid check prefix", "check_status", false},
		{"valid download prefix", "download_artifact", false},
		{"valid upload prefix", "upload_file", false},

		// Valid - module_verb pattern
		{"valid ccm_get pattern", "ccm_get_costs", false},
		{"valid ccm_list pattern", "ccm_list_recommendations", false},
		{"valid chaos_list pattern", "chaos_list_experiments", false},
		{"valid sto_get pattern", "sto_get_issues", false},
		{"valid sei_fetch pattern", "sei_fetch_metrics", false},

		// Invalid - no verb
		{"invalid noun only", "pipeline", true},
		{"invalid noun_noun", "pipeline_details", true},
		{"invalid module_noun", "ccm_costs", true},
		{"invalid module_noun_noun", "ccm_cost_data", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateToolName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateToolName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateTools(t *testing.T) {
	t.Run("all valid", func(t *testing.T) {
		tools := []mcp.Tool{
			mcp.NewTool("get_pipeline"),
			mcp.NewTool("list_pipelines"),
			mcp.NewTool("ccm_get_costs"),
		}
		errors := ValidateTools(tools)
		if len(errors) != 0 {
			t.Errorf("ValidateTools() returned %d errors, want 0: %v", len(errors), errors)
		}
	})

	t.Run("some invalid", func(t *testing.T) {
		tools := []mcp.Tool{
			mcp.NewTool("get_pipeline"),      // valid
			mcp.NewTool("getPipeline"),       // invalid - camelCase
			mcp.NewTool("pipeline_details"),  // invalid - no verb
			mcp.NewTool("ccm_get_costs"),     // valid
		}
		errors := ValidateTools(tools)
		if len(errors) != 2 {
			t.Errorf("ValidateTools() returned %d errors, want 2: %v", len(errors), errors)
		}
	})

	t.Run("empty list", func(t *testing.T) {
		errors := ValidateTools([]mcp.Tool{})
		if len(errors) != 0 {
			t.Errorf("ValidateTools() returned %d errors, want 0", len(errors))
		}
	})
}
