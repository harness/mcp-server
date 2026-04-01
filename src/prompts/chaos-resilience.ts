import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerChaosResiliencePrompt(server: McpServer): void {
  server.registerPrompt(
    "chaos-resilience-test",
    {
      description: "Design and run a chaos experiment to test service resilience",
      argsSchema: {
        serviceName: z.string().describe("Name of the service to test"),
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ serviceName, projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Design a chaos experiment to test the resilience of "${serviceName}".

Steps:
1. **Check infrastructure**: Call harness_list with resource_type="chaos_infrastructure"${projectFilter} for Linux targets and resource_type="chaos_k8s_infrastructure"${projectFilter} for Kubernetes targets
2. **Review templates**: Call harness_list with resource_type="chaos_experiment_template"${projectFilter} to see pre-built experiment templates
3. **Check probes**: Call harness_list with resource_type="chaos_probe"${projectFilter} to see available steady-state probes
4. **Check ChaosGuard rules**: Call harness_list with resource_type="chaos_guard_rule"${projectFilter} to review governance policies that may restrict experiment execution
5. **Review past experiments**: Call harness_list with resource_type="chaos_experiment"${projectFilter} to see previously run experiments and their outcomes
6. **Design experiment**: Based on the service type and available infrastructure, propose:
   - **Fault type**: Network loss, pod kill, CPU stress, memory hog, etc.
   - **Blast radius**: Which pods/nodes to target
   - **Probes**: Health checks to validate steady-state before/during/after
   - **Duration**: How long to inject the fault
   - **Expected behavior**: What should happen (graceful degradation, failover, etc.)
7. **Present plan**: Show the experiment design for review

Do NOT run the experiment until I confirm — present the design and expected outcomes first.`,
          },
        }],
      };
    },
  );
}
