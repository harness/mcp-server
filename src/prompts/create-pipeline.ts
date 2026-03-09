import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreatePipelinePrompt(server: McpServer): void {
  server.registerPrompt(
    "create-pipeline",
    {
      description: "Generate a new Harness pipeline YAML from requirements",
      argsSchema: {
        description: z.string().describe("Describe what the pipeline should do"),
        projectId: z.string().describe("Target project identifier").optional(),
      },
    },
    async ({ description, projectId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a Harness pipeline based on these requirements:

${description}

Steps:
1. Read the pipeline JSON Schema resource (schema:///pipeline) to understand the required pipeline structure and fields
2. Call harness_describe with resource_type="pipeline" to understand available operations
3. If helpful, call harness_list with resource_type="pipeline"${projectId ? ` and project_id="${projectId}"` : ""} to see existing pipeline patterns
4. Also check available connectors (harness_list resource_type="connector"), services (harness_list resource_type="service"), and environments (harness_list resource_type="environment")
5. Generate the pipeline YAML conforming to the schema
6. Present the YAML for review before creating

Do NOT create the pipeline until I confirm — just show me the YAML first.`,
        },
      }],
    }),
  );
}
