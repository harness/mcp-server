package toolsets

import (
	"context"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Mock tool handler for testing
func mockToolHandler() server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				mcp.TextContent{
					Type: "text",
					Text: "mock result",
				},
			},
		}, nil
	}
}

// Helper function to create a test toolset
func createTestToolset(name string, toolNames []string) *Toolset {
	toolset := NewToolset(name, "Test toolset: "+name)

	var serverTools []server.ServerTool
	for _, toolName := range toolNames {
		tool := mcp.Tool{
			Name:        toolName,
			Description: "Test tool: " + toolName,
			InputSchema: mcp.ToolInputSchema{
				Type: "object",
				Properties: map[string]interface{}{
					"test": map[string]interface{}{
						"type":        "string",
						"description": "Test parameter",
					},
				},
			},
		}
		serverTool := NewServerTool(tool, mockToolHandler())
		serverTools = append(serverTools, serverTool)
	}

	// Add tools as read tools (available in both read-only and full mode)
	toolset.AddReadTools(serverTools...)

	return toolset
}

func TestSimpleToolGroupTracker_RegisterToolGroup(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Test registering a toolset with multiple tools
	toolset := createTestToolset("test-toolset", []string{"tool1", "tool2", "tool3"})

	err := tracker.RegisterToolGroup(toolset)
	require.NoError(t, err)

	// Verify all tools are registered
	toolsetName, found := tracker.GetGroupForTool("tool1")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)

	toolsetName, found = tracker.GetGroupForTool("tool2")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)

	toolsetName, found = tracker.GetGroupForTool("tool3")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)
}

func TestSimpleToolGroupTracker_RegisterToolGroup_EmptyToolset(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Test registering an empty toolset
	toolset := NewToolset("empty-toolset", "Empty test toolset")

	err := tracker.RegisterToolGroup(toolset)
	require.NoError(t, err)

	// Verify toolset is registered but no tools
	toolsets := tracker.GetRegisteredGroups()
	assert.Contains(t, toolsets, "empty-toolset")

	mappings := tracker.GetAllToolMappings()
	assert.Empty(t, mappings)
}

func TestSimpleToolGroupTracker_RegisterToolGroup_NilToolset(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Test registering nil toolset (should be handled gracefully)
	err := tracker.RegisterToolGroup(nil)
	assert.NoError(t, err) // Should not error, just handle gracefully
}

func TestSimpleToolGroupTracker_GetGroupForTool(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Register multiple toolsets
	toolset1 := createTestToolset("toolset1", []string{"tool1", "tool2"})
	toolset2 := createTestToolset("toolset2", []string{"tool3", "tool4"})

	err := tracker.RegisterToolGroup(toolset1)
	require.NoError(t, err)
	err = tracker.RegisterToolGroup(toolset2)
	require.NoError(t, err)

	// Test finding tools
	toolsetName, found := tracker.GetGroupForTool("tool1")
	assert.True(t, found)
	assert.Equal(t, "toolset1", toolsetName)

	toolsetName, found = tracker.GetGroupForTool("tool3")
	assert.True(t, found)
	assert.Equal(t, "toolset2", toolsetName)

	// Test non-existent tool
	_, found = tracker.GetGroupForTool("nonexistent")
	assert.False(t, found)
}

func TestSimpleToolGroupTracker_GetAllToolMappings(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Register toolsets
	toolset1 := createTestToolset("toolset1", []string{"tool1", "tool2"})
	toolset2 := createTestToolset("toolset2", []string{"tool3", "tool4"})

	err := tracker.RegisterToolGroup(toolset1)
	require.NoError(t, err)
	err = tracker.RegisterToolGroup(toolset2)
	require.NoError(t, err)

	// Get all mappings
	mappings := tracker.GetAllToolMappings()

	expected := map[string]string{
		"tool1": "toolset1",
		"tool2": "toolset1",
		"tool3": "toolset2",
		"tool4": "toolset2",
	}

	assert.Equal(t, expected, mappings)

	// Verify returned map is a copy (modifying it shouldn't affect registry)
	mappings["tool5"] = "toolset3"

	newMappings := tracker.GetAllToolMappings()
	assert.NotContains(t, newMappings, "tool5")
}

func TestSimpleToolGroupTracker_GetRegisteredGroups(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Initially empty
	toolsets := tracker.GetRegisteredGroups()
	assert.Empty(t, toolsets)

	// Register toolsets
	toolset1 := createTestToolset("toolset1", []string{"tool1"})
	toolset2 := createTestToolset("toolset2", []string{"tool2"})

	err := tracker.RegisterToolGroup(toolset1)
	require.NoError(t, err)
	err = tracker.RegisterToolGroup(toolset2)
	require.NoError(t, err)

	// Get registered toolsets
	toolsets = tracker.GetRegisteredGroups()
	assert.Len(t, toolsets, 2)
	assert.Contains(t, toolsets, "toolset1")
	assert.Contains(t, toolsets, "toolset2")
}

func TestSimpleToolGroupTracker_Clear(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Register toolsets
	toolset1 := createTestToolset("toolset1", []string{"tool1", "tool2"})
	toolset2 := createTestToolset("toolset2", []string{"tool3", "tool4"})

	err := tracker.RegisterToolGroup(toolset1)
	require.NoError(t, err)
	err = tracker.RegisterToolGroup(toolset2)
	require.NoError(t, err)

	// Verify toolsets are registered
	mappings := tracker.GetAllToolMappings()
	assert.Len(t, mappings, 4)

	// Clear registry
	tracker.Clear()

	// Verify registry is empty
	mappings = tracker.GetAllToolMappings()
	assert.Empty(t, mappings)

	toolsets := tracker.GetRegisteredGroups()
	assert.Empty(t, toolsets)

	_, found := tracker.GetGroupForTool("tool1")
	assert.False(t, found)
}

func TestSimpleToolGroupTracker_DuplicateToolNames(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Register first toolset with a tool
	toolset1 := createTestToolset("toolset1", []string{"duplicate_tool"})
	err := tracker.RegisterToolGroup(toolset1)
	require.NoError(t, err)

	// Register second toolset with same tool name
	toolset2 := createTestToolset("toolset2", []string{"duplicate_tool"})
	err = tracker.RegisterToolGroup(toolset2)
	require.NoError(t, err)

	// The second registration should overwrite the first
	toolsetName, found := tracker.GetGroupForTool("duplicate_tool")
	assert.True(t, found)
	assert.Equal(t, "toolset2", toolsetName)
}

func TestSimpleToolGroupTracker_ConcurrentAccess(t *testing.T) {
	tracker := NewSimpleToolGroupTracker()

	// Test concurrent registration and reading
	done := make(chan bool, 2)

	// Goroutine 1: Register toolsets
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 10; i++ {
			toolset := createTestToolset("toolset"+string(rune('0'+i)), []string{"tool" + string(rune('0'+i))})
			err := tracker.RegisterToolGroup(toolset)
			assert.NoError(t, err)
		}
	}()

	// Goroutine 2: Read from registry
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 100; i++ {
			tracker.GetAllToolMappings()
			tracker.GetRegisteredGroups()
			tracker.GetGroupForTool("tool1")
		}
	}()

	// Wait for both goroutines to complete
	<-done
	<-done

	// Verify final state
	mappings := tracker.GetAllToolMappings()
	assert.Len(t, mappings, 10)
}

func TestAutoRegisteringToolGroup_AddToolset(t *testing.T) {
	// Create a fresh registry for this test
	testTracker := NewSimpleToolGroupTracker()
	SetMainToolTracker(testTracker)
	defer func() {
		// Reset to default registry after test
		SetMainToolTracker(NewSimpleToolGroupTracker())
	}()

	// Create registry-aware group
	group := CreateAutoRegisteringGroup(false)

	// Create and add toolset
	toolset := createTestToolset("test-toolset", []string{"tool1", "tool2"})
	group.AddToolset(toolset)

	// Verify toolset was added to both group and tracker
	assert.Contains(t, group.Toolsets, "test-toolset")
	assert.Equal(t, "test-toolset", group.Toolsets["test-toolset"].Name)

	// Verify tools were registered in global tracker
	toolsetName, found := testTracker.GetGroupForTool("tool1")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)

	toolsetName, found = testTracker.GetGroupForTool("tool2")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)
}

func TestAutoRegisteringToolGroup_MultipleToolsets(t *testing.T) {
	// Create a fresh registry for this test
	testTracker := NewSimpleToolGroupTracker()
	SetMainToolTracker(testTracker)
	defer func() {
		// Reset to default registry after test
		SetMainToolTracker(NewSimpleToolGroupTracker())
	}()

	// Create registry-aware group
	group := CreateAutoRegisteringGroup(false)

	// Add multiple toolsets
	toolset1 := createTestToolset("toolset1", []string{"tool1", "tool2"})
	toolset2 := createTestToolset("toolset2", []string{"tool3", "tool4"})

	group.AddToolset(toolset1)
	group.AddToolset(toolset2)

	// Verify both toolsets are in group
	assert.Len(t, group.Toolsets, 2)
	assert.Contains(t, group.Toolsets, "toolset1")
	assert.Contains(t, group.Toolsets, "toolset2")

	// Verify all tools are registered
	mappings := testTracker.GetAllToolMappings()
	expected := map[string]string{
		"tool1": "toolset1",
		"tool2": "toolset1",
		"tool3": "toolset2",
		"tool4": "toolset2",
	}
	assert.Equal(t, expected, mappings)
}

func TestAutoRegisteringToolGroup_ReadOnlyMode(t *testing.T) {
	// Create a fresh registry for this test
	testTracker := NewSimpleToolGroupTracker()
	SetMainToolTracker(testTracker)
	defer func() {
		// Reset to default registry after test
		SetMainToolTracker(NewSimpleToolGroupTracker())
	}()

	// Create registry-aware group in read-only mode
	group := CreateAutoRegisteringGroup(true)

	// Create toolset with both read and write tools
	toolset := NewToolset("test-toolset", "Test toolset")

	readTool := NewServerTool(mcp.Tool{
		Name:        "read_tool",
		Description: "Read tool",
	}, mockToolHandler())

	writeTool := NewServerTool(mcp.Tool{
		Name:        "write_tool",
		Description: "Write tool",
	}, mockToolHandler())

	toolset.AddReadTools(readTool)
	toolset.AddWriteTools(writeTool)

	group.AddToolset(toolset)

	// Verify toolset is set to read-only
	assert.True(t, group.Toolsets["test-toolset"].readOnly)

	// Verify only read tools are registered (GetAvailableTools() only returns read tools in read-only mode)
	mappings := testTracker.GetAllToolMappings()
	assert.Contains(t, mappings, "read_tool")
	// Write tools are not available in read-only mode, so they won't be registered
	assert.NotContains(t, mappings, "write_tool")
}

func TestMainToolTrackerManagement(t *testing.T) {
	// Save original registry
	originalTracker := GetMainToolTracker()

	// Create and set new registry
	newTracker := NewSimpleToolGroupTracker()
	SetMainToolTracker(newTracker)

	// Verify new registry is active
	assert.Equal(t, newTracker, GetMainToolTracker())

	// Register a toolset in new tracker
	toolset := createTestToolset("test-toolset", []string{"test-tool"})
	err := newTracker.RegisterToolGroup(toolset)
	require.NoError(t, err)

	// Verify tool is found in new tracker
	toolsetName, found := GetMainToolTracker().GetGroupForTool("test-tool")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)

	// Restore original registry
	SetMainToolTracker(originalTracker)

	// Verify original registry is restored
	assert.Equal(t, originalTracker, GetMainToolTracker())
}

func TestToolGroupTracker_Interface(t *testing.T) {
	// Verify SimpleToolGroupTracker implements ToolGroupTracker interface
	var tracker ToolGroupTracker = NewSimpleToolGroupTracker()

	// Test all interface methods
	toolset := createTestToolset("test-toolset", []string{"test-tool"})

	err := tracker.RegisterToolGroup(toolset)
	assert.NoError(t, err)

	toolsetName, found := tracker.GetGroupForTool("test-tool")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)

	mappings := tracker.GetAllToolMappings()
	assert.Contains(t, mappings, "test-tool")

	toolsets := tracker.GetRegisteredGroups()
	assert.Contains(t, toolsets, "test-toolset")

	tracker.Clear()

	mappings = tracker.GetAllToolMappings()
	assert.Empty(t, mappings)
}

func TestNewAutoRegisteringToolGroup_WithCustomTracker(t *testing.T) {
	customTracker := NewSimpleToolGroupTracker()

	// Create group with custom registry
	group := NewAutoRegisteringToolGroup(false, customTracker)

	// Add toolset
	toolset := createTestToolset("test-toolset", []string{"test-tool"})
	group.AddToolset(toolset)

	// Verify tool is registered in custom registry
	toolsetName, found := customTracker.GetGroupForTool("test-tool")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)

	// Verify tool is NOT in global registry (since we used custom registry)
	_, found = GetMainToolTracker().GetGroupForTool("test-tool")
	assert.False(t, found)
}

func TestNewAutoRegisteringToolGroup_WithNilTracker(t *testing.T) {
	// Save original global registry
	originalTracker := GetMainToolTracker()
	testTracker := NewSimpleToolGroupTracker()
	SetMainToolTracker(testTracker)
	defer SetMainToolTracker(originalTracker)

	// Create group with nil registry (should use global registry)
	group := NewAutoRegisteringToolGroup(false, nil)

	// Add toolset
	toolset := createTestToolset("test-toolset", []string{"test-tool"})
	group.AddToolset(toolset)

	// Verify tool is registered in global registry
	toolsetName, found := testTracker.GetGroupForTool("test-tool")
	assert.True(t, found)
	assert.Equal(t, "test-toolset", toolsetName)
}

// Benchmark tests for performance validation
func BenchmarkSimpleToolGroupTracker_RegisterToolGroup(b *testing.B) {
	tracker := NewSimpleToolGroupTracker()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		toolset := createTestToolset("toolset"+string(rune(i)), []string{"tool" + string(rune(i))})
		tracker.RegisterToolGroup(toolset)
	}
}

func BenchmarkSimpleToolGroupTracker_GetGroupForTool(b *testing.B) {
	tracker := NewSimpleToolGroupTracker()

	// Pre-populate registry
	for i := 0; i < 100; i++ {
		toolset := createTestToolset("toolset"+string(rune(i)), []string{"tool" + string(rune(i))})
		tracker.RegisterToolGroup(toolset)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tracker.GetGroupForTool("tool" + string(rune(i%100)))
	}
}

func BenchmarkSimpleToolGroupTracker_GetAllToolMappings(b *testing.B) {
	tracker := NewSimpleToolGroupTracker()

	// Pre-populate registry
	for i := 0; i < 100; i++ {
		toolset := createTestToolset("toolset"+string(rune(i)), []string{"tool" + string(rune(i))})
		tracker.RegisterToolGroup(toolset)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tracker.GetAllToolMappings()
	}
}
