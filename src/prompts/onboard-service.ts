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
5. **Create service**: Generate the service YAML definition following existing patterns
6. **Create pipeline**: Generate a deployment pipeline YAML for the service with:
   - Build stage (if applicable)
   - Deploy to dev/staging/prod environments
   - Approval gates between staging and prod
7. **Present for review**: Show all generated YAML before creating anything

Do NOT create any resources until I confirm — present the complete plan first with all YAML definitions.`,
        },
      }],
    }),
  );
}
