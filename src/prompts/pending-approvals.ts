import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPendingApprovalsPrompt(server: McpServer): void {
  server.prompt(
    "pending-approvals",
    "Find pipeline executions waiting for approval and present them for action",
    {
      projectId: z.string().describe("Project identifier").optional(),
      orgId: z.string().describe("Organization identifier").optional(),
      pipelineId: z.string().describe("Filter to a specific pipeline").optional(),
    },
    async ({ projectId, orgId, pipelineId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Find all pipeline executions that are currently waiting for approval and help me take action on them.

**Step 1: Find executions with approval-waiting status**
Use harness_list with resource_type="execution"${orgId ? `, org_id="${orgId}"` : ""}${projectId ? `, project_id="${projectId}"` : ""}${pipelineId ? `, pipeline_id="${pipelineId}"` : ""}, status="ApprovalWaiting" to find executions that are blocked on approvals.

**Step 2: For each waiting execution, get approval details**
For each execution found, use harness_list with resource_type="approval_instance", execution_id=<execution_id>, approval_status="WAITING" to get the pending approval instances.

**Step 3: Present a summary**
For each pending approval, show:
- Pipeline name and execution ID
- Approval type (Harness, Jira, ServiceNow, Custom)
- Approval message/description from the step configuration
- How long it has been waiting (from the created timestamp)
- Who needs to approve (approver user groups if available)
- A deep link to the execution in Harness

**Step 4: Offer to take action**
Ask me if I want to approve or reject any of the pending approvals. If I choose to act, use harness_execute with resource_type="approval_instance", action="approve" (or "reject"), approval_id=<id>, and confirmation=true.

If no executions are waiting for approval, let me know the project is clear.`,
        },
      }],
    }),
  );
}
