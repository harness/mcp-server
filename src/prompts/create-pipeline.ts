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
5. If the pipeline involves building/pushing Docker images, determine the registry type:
   - If the user says "Harness Artifact Registry" or "HAR" → use TEMPLATE A below
   - If the user says DockerHub, ECR, GCR, ACR, or any other provider → use TEMPLATE B below
   - Call harness_list with resource_type="registry"${projectId ? ` and project_id="${projectId}"` : ""} to discover existing HAR registries

   **TEMPLATE A — Harness Artifact Registry (use when user says "Harness Artifact Registry" or "HAR"):**
   \`\`\`yaml
   - step:
       type: BuildAndPushDockerRegistry
       name: Build and Push to Harness Artifact Registry
       identifier: build_and_push_har
       spec:
         repo: <+input>
         tags:
           - latest
           - <+pipeline.sequenceId>
         caching: true
         registryRef: <+input>
   \`\`\`
   Key: uses \`registryRef\`. Does NOT have \`connectorRef\`. No Docker connector needed.

   **TEMPLATE B — Third-party registry (DockerHub, ECR, GCR, ACR, etc.):**
   \`\`\`yaml
   - step:
       type: BuildAndPushDockerRegistry
       name: Build and Push Docker Image
       identifier: build_and_push_docker
       spec:
         connectorRef: <+input>
         repo: <+input>
         tags:
           - latest
           - <+pipeline.sequenceId>
         caching: true
   \`\`\`
   Key: uses \`connectorRef\`. Does NOT have \`registryRef\`.

6. Generate the pipeline YAML conforming to the schema, using the correct template from step 5
7. Present the YAML for review before creating

Do NOT create the pipeline until I confirm — just show me the YAML first.`,
        },
      }],
    }),
  );
}
