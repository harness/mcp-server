package tools

import (
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/stretchr/testify/assert"
)

func TestActionTypeValues_ContainsAllConstants(t *testing.T) {
	expected := map[string]bool{
		"CREATE_STEP":        false,
		"UPDATE_STEP":        false,
		"CREATE_PIPELINE":    false,
		"UPDATE_PIPELINE":    false,
		"CREATE_ENVIRONMENT": false,
		"UPDATE_ENVIRONMENT": false,
		"CREATE_SECRET":      false,
		"UPDATE_SECRET":      false,
		"CREATE_SERVICE":     false,
		"UPDATE_SERVICE":     false,
		"CREATE_CONNECTOR":   false,
		"UPDATE_CONNECTOR":   false,
		"CREATE_STEP_GROUP":  false,
		"UPDATE_STEP_GROUP":  false,
		"CREATE_PROCESS":     false,
	}

	values := dto.ActionTypeValues()
	for _, v := range values {
		if _, ok := expected[v]; ok {
			expected[v] = true
		} else {
			t.Errorf("unexpected action type in ActionTypeValues: %s", v)
		}
	}

	for action, found := range expected {
		if !found {
			t.Errorf("missing action type in ActionTypeValues: %s", action)
		}
	}
}

func TestAIDevOpsAgentTool_Definition(t *testing.T) {
	cfg := &config.McpServerConfig{}
	tool, handler := AIDevOpsAgentTool(cfg, nil)

	assert.Equal(t, "ask_ai_devops_agent", tool.Name)
	assert.NotNil(t, handler)
	assert.Contains(t, tool.Description, "create or update Harness entities")
	assert.Contains(t, tool.Description, "Returns the generated or updated YAML")
	assert.Contains(t, tool.Description, "CREATE_PIPELINE or UPDATE_PIPELINE")

	props := tool.InputSchema.Properties
	assert.Contains(t, props, "prompt")
	assert.Contains(t, props, "action")
	assert.Contains(t, props, "stream")
	assert.Contains(t, props, "conversation_id")
	assert.Contains(t, props, "context")

	assert.Contains(t, tool.InputSchema.Required, "prompt")
	assert.Contains(t, tool.InputSchema.Required, "action")
	assert.NotContains(t, tool.InputSchema.Required, "stream")
	assert.NotContains(t, tool.InputSchema.Required, "conversation_id")
	assert.NotContains(t, tool.InputSchema.Required, "context")
}

func TestAIDevOpsAgentTool_ActionEnum(t *testing.T) {
	cfg := &config.McpServerConfig{}
	tool, _ := AIDevOpsAgentTool(cfg, nil)

	actionProp := tool.InputSchema.Properties["action"]
	actionMap, ok := actionProp.(map[string]interface{})
	if !ok {
		t.Fatal("action property should be a map")
	}

	enumValues, ok := actionMap["enum"].([]string)
	if !ok {
		t.Fatal("action should have enum values")
	}

	assert.Contains(t, enumValues, "CREATE_PIPELINE")
	assert.Contains(t, enumValues, "UPDATE_PIPELINE")
	assert.Contains(t, enumValues, "CREATE_STEP")
	assert.Contains(t, enumValues, "CREATE_STEP_GROUP")
	assert.Contains(t, enumValues, "UPDATE_STEP_GROUP")
	assert.GreaterOrEqual(t, len(enumValues), 15)
}
