import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMigrateToTemplatePrompt(server: McpServer): void {
  server.prompt(
    "migrate-pipeline-to-template",
    "Analyze an existing pipeline and extract reusable stage/step templates from it",
    {
      pipelineId: z.string().describe("Pipeline identifier to analyze"),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ pipelineId, projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze pipeline "${pipelineId}" and extract reusable templates from it.

Steps:
1. **Get pipeline YAML**: Call harness_get with resource_type="pipeline", resource_id="${pipelineId}"${projectFilter} to fetch the full pipeline definition
2. **List existing templates**: Call harness_list with resource_type="template"${projectFilter} to see what templates already exist (avoid duplicating)
3. **Identify reusable patterns**: Analyze the pipeline for:
   - Stages that could become **Stage templates** (e.g., deployment stages, approval stages)
   - Steps or step groups that could become **Step templates** (e.g., common build steps, deploy steps, notification steps)
   - Patterns repeated across stages that indicate template opportunity
4. **Generate template YAML**: For each identified template:
   - Extract the stage/step definition
   - Parameterize hardcoded values as runtime inputs (<+input>)
   - Add template metadata (name, identifier, versionLabel, type)
5. **Generate updated pipeline YAML**: Rewrite the pipeline to reference the new templates using templateRef and templateInputs
6. **Present for review**: Show all template YAMLs and the updated pipeline YAML

Do NOT create templates or update the pipeline until I confirm the plan.`,
          },
        }],
      };
    },
  );
}
