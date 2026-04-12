import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMigrateToTemplatePrompt(server: McpServer): void {
  server.registerPrompt(
    "migrate-pipeline-to-template",
    {
      description: "Analyze an existing pipeline and extract reusable stage/step templates from it",
      argsSchema: {
        pipelineId: z.string().describe("Pipeline identifier to analyze"),
        projectId: z.string().describe("Project identifier").optional(),
      },
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
3. **List existing input sets**: Call harness_list with resource_type="input_set", pipeline_id="${pipelineId}"${projectFilter} to see if input sets already exist for this pipeline
4. **Identify reusable patterns**: Analyze the pipeline for:
   - Stages that could become **Stage templates** (e.g., deployment stages, approval stages)
   - Steps or step groups that could become **Step templates** (e.g., common build steps, deploy steps, notification steps)
   - Patterns repeated across stages that indicate template opportunity
   - Hardcoded values that vary per environment or run (these become \`<+input>\` placeholders)
5. **Generate template YAML**: For each identified template:
   - Extract the stage/step definition
   - Parameterize hardcoded values as runtime inputs (\`<+input>\`)
   - Add template metadata (name, identifier, versionLabel, type)
6. **Generate updated pipeline YAML**: Rewrite the pipeline to reference the new templates using templateRef and templateInputs
7. **Generate input sets for common configurations**: For each set of \`<+input>\` placeholders introduced:
   - Identify which values were previously hardcoded and extract them into named input sets
   - Create input sets for common scenarios (e.g., "dev-defaults", "prod-defaults"):
     \`\`\`yaml
     inputSet:
       name: Dev Defaults
       identifier: dev_defaults
       pipeline:
         identifier: ${pipelineId}
         variables:
           - name: env
             type: String
             value: dev
     \`\`\`
   - This preserves the original behavior: running with \`input_set_ids: ["dev_defaults"]\` produces the same result as the pre-template pipeline
   - Multiple input sets can be combined: \`input_set_ids: ["base_defaults", "prod_overrides"]\` (later sets override earlier ones by variable name)
8. **Present for review**: Show all template YAMLs, the updated pipeline YAML, and proposed input sets

Do NOT create templates, update the pipeline, or create input sets until I confirm the plan.`,
          },
        }],
      };
    },
  );
}
