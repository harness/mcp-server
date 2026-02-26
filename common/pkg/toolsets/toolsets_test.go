package toolsets

import (
	"context"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dummyHandler(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return nil, nil
}

func newDummyServerTool(name string) server.ServerTool {
	return server.ServerTool{
		Tool:    mcp.NewTool(name, mcp.WithDescription("dummy "+name)),
		Handler: dummyHandler,
	}
}

// ---------------------------------------------------------------------------
// NewToolset
// ---------------------------------------------------------------------------

func TestNewToolset_CreatesDisabled(t *testing.T) {
	ts := NewToolset("my-toolset", "My description")
	assert.Equal(t, "my-toolset", ts.Name)
	assert.Equal(t, "My description", ts.Description)
	assert.False(t, ts.Enabled)
}

// ---------------------------------------------------------------------------
// AddReadTools / AddWriteTools
// ---------------------------------------------------------------------------

func TestAddReadTools(t *testing.T) {
	ts := NewToolset("test", "test")
	readTool := newDummyServerTool("read_tool")

	result := ts.AddReadTools(readTool)
	assert.Same(t, ts, result, "AddReadTools should return the same toolset for chaining")
	assert.Len(t, ts.readTools, 1)
	assert.Equal(t, "read_tool", ts.readTools[0].Tool.Name)
}

func TestAddWriteTools(t *testing.T) {
	ts := NewToolset("test", "test")
	writeTool := newDummyServerTool("write_tool")

	result := ts.AddWriteTools(writeTool)
	assert.Same(t, ts, result, "AddWriteTools should return the same toolset for chaining")
	assert.Len(t, ts.writeTools, 1)
	assert.Equal(t, "write_tool", ts.writeTools[0].Tool.Name)
}

func TestAddWriteTools_ReadOnlyIgnored(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.SetReadOnly()
	writeTool := newDummyServerTool("write_tool")

	ts.AddWriteTools(writeTool)
	assert.Len(t, ts.writeTools, 0, "AddWriteTools should be ignored when toolset is read-only")
}

func TestAddMultipleTools(t *testing.T) {
	ts := NewToolset("test", "test")
	r1 := newDummyServerTool("read1")
	r2 := newDummyServerTool("read2")
	w1 := newDummyServerTool("write1")

	ts.AddReadTools(r1, r2)
	ts.AddWriteTools(w1)

	assert.Len(t, ts.readTools, 2)
	assert.Len(t, ts.writeTools, 1)
}

// ---------------------------------------------------------------------------
// GetActiveTools
// ---------------------------------------------------------------------------

func TestGetActiveTools_DisabledReturnsNil(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddReadTools(newDummyServerTool("r1"))
	ts.AddWriteTools(newDummyServerTool("w1"))

	tools := ts.GetActiveTools()
	assert.Nil(t, tools)
}

func TestGetActiveTools_EnabledReturnsBoth(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddReadTools(newDummyServerTool("r1"))
	ts.AddWriteTools(newDummyServerTool("w1"))
	ts.Enabled = true

	tools := ts.GetActiveTools()
	assert.Len(t, tools, 2)

	names := make([]string, len(tools))
	for i, tool := range tools {
		names[i] = tool.Tool.Name
	}
	assert.Contains(t, names, "r1")
	assert.Contains(t, names, "w1")
}

func TestGetActiveTools_ReadOnlyReturnsOnlyRead(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddReadTools(newDummyServerTool("r1"), newDummyServerTool("r2"))
	ts.AddWriteTools(newDummyServerTool("w1"))
	ts.SetReadOnly()
	ts.Enabled = true

	tools := ts.GetActiveTools()
	// After SetReadOnly, writeTools may have been added before SetReadOnly, but
	// GetActiveTools should only return readTools
	assert.Len(t, tools, 2)
	for _, tool := range tools {
		assert.NotEqual(t, "w1", tool.Tool.Name)
	}
}

func TestGetActiveTools_EnabledNoWriteTools(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddReadTools(newDummyServerTool("r1"))
	ts.Enabled = true

	tools := ts.GetActiveTools()
	assert.Len(t, tools, 1)
	assert.Equal(t, "r1", tools[0].Tool.Name)
}

// ---------------------------------------------------------------------------
// GetAvailableTools
// ---------------------------------------------------------------------------

func TestGetAvailableTools_ReturnsAllRegardlessOfEnabled(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddReadTools(newDummyServerTool("r1"))
	ts.AddWriteTools(newDummyServerTool("w1"))
	// Toolset is disabled but GetAvailableTools should still return tools

	tools := ts.GetAvailableTools()
	assert.Len(t, tools, 2)
}

func TestGetAvailableTools_ReadOnlyReturnsOnlyRead(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddReadTools(newDummyServerTool("r1"))
	ts.AddWriteTools(newDummyServerTool("w1"))
	ts.SetReadOnly()

	tools := ts.GetAvailableTools()
	assert.Len(t, tools, 1)
	assert.Equal(t, "r1", tools[0].Tool.Name)
}

// ---------------------------------------------------------------------------
// SetReadOnly
// ---------------------------------------------------------------------------

func TestSetReadOnly(t *testing.T) {
	ts := NewToolset("test", "test")
	ts.AddWriteTools(newDummyServerTool("w1"))
	ts.Enabled = true

	// Before SetReadOnly, active tools include write tool
	assert.Len(t, ts.GetActiveTools(), 1)

	ts.SetReadOnly()

	// After SetReadOnly, active tools only include read tools (none added)
	assert.Len(t, ts.GetActiveTools(), 0)
}

// ---------------------------------------------------------------------------
// ToolsetGroup
// ---------------------------------------------------------------------------

func TestNewToolsetGroup_NotReadOnly(t *testing.T) {
	tg := NewToolsetGroup(false)
	assert.NotNil(t, tg)
	assert.NotNil(t, tg.Toolsets)
	assert.False(t, tg.readOnly)
}

func TestNewToolsetGroup_ReadOnly(t *testing.T) {
	tg := NewToolsetGroup(true)
	assert.NotNil(t, tg)
	assert.True(t, tg.readOnly)
}

// ---------------------------------------------------------------------------
// AddToolset
// ---------------------------------------------------------------------------

func TestAddToolset_AddsToGroup(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("mytools", "My tools")

	tg.AddToolset(ts)
	assert.Contains(t, tg.Toolsets, "mytools")
}

func TestAddToolset_ReadOnlyGroupSetsReadOnlyOnToolset(t *testing.T) {
	tg := NewToolsetGroup(true)
	ts := NewToolset("mytools", "My tools")
	ts.AddWriteTools(newDummyServerTool("w1"))

	tg.AddToolset(ts)

	// Toolset should be read-only now
	assert.Len(t, ts.GetAvailableTools(), 0, "Write tools should not be available when toolset is marked read-only by group")
}

// ---------------------------------------------------------------------------
// EnableToolsets
// ---------------------------------------------------------------------------

func TestEnableToolsets_EmptyEnablesDefault(t *testing.T) {
	tg := NewToolsetGroup(false)
	defaultTs := NewToolset("core", "Core toolset")
	tg.AddToolset(defaultTs)

	err := tg.EnableToolsets([]string{})
	require.NoError(t, err)
	assert.True(t, defaultTs.Enabled)
}

func TestEnableToolsets_EmptyWithNoDefaultErrors(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("other", "Other toolset")
	tg.AddToolset(ts)

	err := tg.EnableToolsets([]string{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "core")
}

func TestEnableToolsets_AllEnablesAll(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts1 := NewToolset("pipelines", "Pipelines")
	ts2 := NewToolset("ccm", "CCM")
	ts3 := NewToolset("chaos", "Chaos")
	tg.AddToolset(ts1)
	tg.AddToolset(ts2)
	tg.AddToolset(ts3)

	err := tg.EnableToolsets([]string{"all"})
	require.NoError(t, err)
	assert.True(t, ts1.Enabled)
	assert.True(t, ts2.Enabled)
	assert.True(t, ts3.Enabled)
}

func TestEnableToolsets_InvalidNameErrors(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("valid", "Valid")
	tg.AddToolset(ts)

	err := tg.EnableToolsets([]string{"nonexistent"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nonexistent")
}

func TestEnableToolsets_SpecificNames(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts1 := NewToolset("pipelines", "Pipelines")
	ts2 := NewToolset("ccm", "CCM")
	ts3 := NewToolset("chaos", "Chaos")
	tg.AddToolset(ts1)
	tg.AddToolset(ts2)
	tg.AddToolset(ts3)

	err := tg.EnableToolsets([]string{"pipelines", "chaos"})
	require.NoError(t, err)
	assert.True(t, ts1.Enabled)
	assert.False(t, ts2.Enabled)
	assert.True(t, ts3.Enabled)
}

func TestEnableToolsets_AllSetsEverythingOn(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("a", "A")
	tg.AddToolset(ts)

	err := tg.EnableToolsets([]string{"all"})
	require.NoError(t, err)
	assert.True(t, tg.everythingOn)
}

// ---------------------------------------------------------------------------
// EnableToolset
// ---------------------------------------------------------------------------

func TestEnableToolset_ExistingToolset(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("mytools", "My tools")
	ts.AddReadTools(newDummyServerTool("r1"))
	tg.AddToolset(ts)

	err := tg.EnableToolset("mytools")
	require.NoError(t, err)
	assert.True(t, ts.Enabled)
}

func TestEnableToolset_NonExistentErrors(t *testing.T) {
	tg := NewToolsetGroup(false)

	err := tg.EnableToolset("ghost")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ghost")
}

func TestEnableToolset_Idempotent(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("mytools", "My tools")
	ts.AddReadTools(newDummyServerTool("r1"))
	tg.AddToolset(ts)

	err := tg.EnableToolset("mytools")
	require.NoError(t, err)
	err = tg.EnableToolset("mytools")
	require.NoError(t, err)
	assert.True(t, ts.Enabled)
}

// ---------------------------------------------------------------------------
// IsEnabled
// ---------------------------------------------------------------------------

func TestIsEnabled_NotEnabled(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("mytools", "My tools")
	tg.AddToolset(ts)

	assert.False(t, tg.IsEnabled("mytools"))
}

func TestIsEnabled_Enabled(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("mytools", "My tools")
	tg.AddToolset(ts)
	ts.Enabled = true

	assert.True(t, tg.IsEnabled("mytools"))
}

func TestIsEnabled_NonExistent(t *testing.T) {
	tg := NewToolsetGroup(false)

	assert.False(t, tg.IsEnabled("ghost"))
}

func TestIsEnabled_EverythingOn(t *testing.T) {
	tg := NewToolsetGroup(false)
	ts := NewToolset("mytools", "My tools")
	tg.AddToolset(ts)

	err := tg.EnableToolsets([]string{"all"})
	require.NoError(t, err)

	// Even though we check a name that exists, everythingOn should return true
	assert.True(t, tg.IsEnabled("mytools"))
	// Even for a name that doesn't exist in Toolsets map, everythingOn returns true
	assert.True(t, tg.IsEnabled("anything"))
}

// ---------------------------------------------------------------------------
// Integration: Read-only group with toolsets
// ---------------------------------------------------------------------------

func TestToolsetGroup_ReadOnlyIntegration(t *testing.T) {
	tg := NewToolsetGroup(true) // read-only

	ts := NewToolset("mytools", "My tools")
	ts.AddReadTools(newDummyServerTool("reader"))
	// Write tools added BEFORE AddToolset won't be affected by SetReadOnly,
	// but when AddToolset is called on a readOnly group, it calls ts.SetReadOnly()
	// which sets readOnly=true. Subsequent AddWriteTools will be ignored.
	tg.AddToolset(ts)

	// After AddToolset on a read-only group, the toolset is read-only
	ts.AddWriteTools(newDummyServerTool("writer"))
	assert.Len(t, ts.writeTools, 0, "write tools should not be added after read-only is set")

	ts.Enabled = true
	tools := ts.GetActiveTools()
	assert.Len(t, tools, 1)
	assert.Equal(t, "reader", tools[0].Tool.Name)
}

func TestToolsetGroup_WriteToolsBeforeAddToReadOnlyGroup(t *testing.T) {
	tg := NewToolsetGroup(true) // read-only

	ts := NewToolset("mytools", "My tools")
	ts.AddReadTools(newDummyServerTool("reader"))
	ts.AddWriteTools(newDummyServerTool("writer")) // added before group sets read-only

	tg.AddToolset(ts) // this calls SetReadOnly on the toolset
	ts.Enabled = true

	// GetActiveTools should only return read tools because readOnly is now true
	tools := ts.GetActiveTools()
	assert.Len(t, tools, 1)
	assert.Equal(t, "reader", tools[0].Tool.Name)
}
