import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerOnboardServicePrompt(server: McpServer): void {
  server.registerPrompt(
    "onboard-service",
    {
      description: "Walk through onboarding a new service into Harness with environments and a deployment pipeline",
      argsSchema: {
        serviceName: z.string().describe("Name of the service to onboard"),
        projectId: z.string().describe("Target project identifier").optional(),
      },
    },
    async ({ serviceName, projectId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Onboard the service "${serviceName}" into Harness with a complete deployment setup.

Steps:
1. **Check existing**: Call harness_search with query="${serviceName}"${projectId ? ` and project_id="${projectId}"` : ""} to see if this service already exists
2. **Review patterns**: Call harness_list with resource_type="service"${projectId ? ` and project_id="${projectId}"` : ""} to see existing service patterns in the project
3. **Environments**: Call harness_list with resource_type="environment"${projectId ? ` and project_id="${projectId}"` : ""} to see available environments
4. **Connectors**: Call harness_list with resource_type="connector"${projectId ? ` and project_id="${projectId}"` : ""} to see available infrastructure connectors
5. **Check existing input sets**: Call harness_list with resource_type="input_set"${projectId ? ` and project_id="${projectId}"` : ""} to see if the project already uses input sets for parameterized deployments
6. **Create service**: Generate the service YAML definition following existing patterns
7. **Create pipeline**: Generate a deployment pipeline YAML for the service with:
   - Build stage (if applicable)
   - Deploy to dev/staging/prod environments using \`<+input>\` for environment-specific values (infrastructure, namespace, replicas, image tag)
   - Approval gates between staging and prod
8. **Choose storage mode** — ask where to store the pipeline:
   - **Inline (default)**: Stored in Harness — simplest setup
   - **Remote (External Git)**: Stored in GitHub/GitLab/Bitbucket via a Git connector
   - **Remote (Harness Code)**: Stored in a Harness Code repository
9. **Create per-environment input sets**: Since the pipeline uses \`<+input>\` placeholders for multi-environment deployment, create input sets that pre-fill values for each target environment:
   - \`${serviceName}-dev\` — dev infrastructure, namespace, lower replicas
   - \`${serviceName}-staging\` — staging infrastructure, namespace
   - \`${serviceName}-prod\` — prod infrastructure, namespace, higher replicas
   - Example YAML for each:
     \`\`\`yaml
     inputSet:
       name: ${serviceName} Dev
       identifier: ${serviceName.replace(/[^a-zA-Z0-9]/g, "_")}_dev
       pipeline:
         identifier: <pipeline_id>
         variables:
           - name: env
             type: String
             value: dev
           - name: namespace
             type: String
             value: dev
     \`\`\`
   - Create each using harness_create with resource_type="input_set" and pipeline_id=<pipeline_id>
   - This lets future runs use: \`harness_execute(resource_type="pipeline", input_set_ids=["${serviceName.replace(/[^a-zA-Z0-9]/g, "_")}_dev"])\` instead of passing inputs manually
10. **Present for review**: Show all generated YAML (service, pipeline, input sets) before creating anything

Do NOT create any resources until I confirm — present the complete plan first with all YAML definitions.`,
        },
      }],
    }),
  );
}
