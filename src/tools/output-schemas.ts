import * as z from "zod/v4";

// Dynamic-shape passthrough: satisfies SDK's normalizeObjectSchema without constraining response fields.
const dynamicObject = z.object({}).catchall(z.unknown());

// --- harness_list ---
export const listOutputSchema = z.object({
  items: z.array(dynamicObject).optional().describe("Array of resource objects when the API returns a canonical list"),
  total: z.number().optional().describe("Total number of matching resources when provided by the API"),
  page: z.number().optional().describe("Current page number (0-indexed) when provided by the API"),
  analysis: z.string().optional().describe("Visual analysis summary (when include_visual=true)"),
}).catchall(z.unknown());

// --- harness_get ---
export const getOutputSchema = z.object({}).catchall(z.unknown()).describe("Resource object — shape varies by resource_type");

// --- harness_create ---
export const createOutputSchema = z.object({}).catchall(z.unknown()).describe("Created resource object");

// --- harness_update ---
export const updateOutputSchema = z.object({}).catchall(z.unknown()).describe("Updated resource object");

// --- harness_delete ---
export const deleteOutputSchema = z.object({
  deleted: z.boolean().describe("Whether the resource was successfully deleted"),
  resource_type: z.string().describe("The type of resource that was deleted"),
  resource_id: z.string().describe("The ID of the deleted resource"),
});

// --- harness_execute ---
export const executeOutputSchema = z.object({}).catchall(z.unknown()).describe("Execution result — shape varies by action and resource_type");

// --- harness_diagnose ---
export const diagnoseOutputSchema = z.object({}).catchall(z.unknown()).describe("Diagnostic data — shape varies by resource_type");

// --- harness_search ---
export const searchOutputSchema = z.object({
  query: z.string().describe("The search query that was executed"),
  total_matches: z.number().describe("Total number of matching results"),
  searched_types: z.number().describe("Number of resource types searched"),
  results: z.array(z.object({
    resource_type: z.string().describe("Resource type"),
    match_count: z.number().describe("Number of matches in this type"),
    items: z.array(dynamicObject).describe("Matching resources"),
  }).catchall(z.unknown())).describe("Search results grouped by resource type"),
});

// --- harness_describe ---
export const describeOutputSchema = z.object({}).catchall(z.unknown()).describe("Resource type metadata, toolset info, or registry summary");

// --- harness_status ---
export const statusOutputSchema = z.object({
  project: z.object({
    org: z.string().describe("Organization identifier"),
    project: z.string().describe("Project identifier"),
  }).catchall(z.unknown()).describe("Project scope"),
  summary: z.object({
    total_failed: z.number().describe("Count of failed executions"),
    total_running: z.number().describe("Count of running executions"),
    total_recent: z.number().describe("Count of recent executions"),
    health: z.enum(["healthy", "degraded", "failing"]).describe("Overall project health"),
  }).describe("Execution health summary"),
  failed_executions: z.array(dynamicObject).describe("Recent failed executions"),
  running_executions: z.array(dynamicObject).describe("Currently running executions"),
  recent_activity: z.array(dynamicObject).describe("Recent execution activity"),
  openInHarness: z.string().describe("Deep link to project in Harness UI").optional(),
});

// --- harness_schema ---
export const schemaOutputSchema = z.object({}).catchall(z.unknown()).describe("Schema data — shape varies by query mode");
