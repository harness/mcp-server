import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGovernanceRuleAuthoringPrompt(server: McpServer): void {
  server.registerPrompt(
    "governance-rule-authoring",
    {
      description: "Author a cloud asset governance (Cloud Custodian) rule safely: validate, dry-run on one account, inspect results, then optionally schedule an enforcement",
      argsSchema: {
        goal: z.string().describe("What the rule should find or fix, e.g. 'stop EC2 instances tagged env=dev outside business hours'"),
        cloudProvider: z.enum(["AWS", "AZURE", "GCP"]).describe("Cloud provider the rule targets"),
      },
    },
    async ({ goal, cloudProvider }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a cloud asset governance rule for ${cloudProvider}: ${goal}

Follow this order and stop for the user's confirmation where marked. Never skip the dry run.

1. **Check for an existing rule**: harness_list resource_type="cost_governance_rule" with filters={cloud_provider: "${cloudProvider}", search_term: <keywords>} — reuse or clone (harness_execute action="clone") an out-of-the-box rule if one fits.
2. **Pick the resource type**: harness_execute resource_type="cost_governance_rule" action="resource_types" params={cloud_provider: "${cloudProvider}"} to get valid values (e.g. aws.ec2).
3. **Draft the YAML**: a Cloud Custodian policy with a name, resource, filters, and actions. Start with filters only — add a destructive action (stop, terminate, delete) only if the user asked for it.
4. **Validate**: harness_execute action="validate" with the rule body. Fix any errors and re-validate.
5. **Create** (confirm with the user first): harness_create resource_type="cost_governance_rule" with name, cloudProvider, rulesYaml (and optionally resourceType, description).
6. **Pick a test target**: harness_execute action="targets" and action="regions" (params={cloud_provider}). Choose ONE non-production account and ONE region — ask the user which.
7. **Dry run**: harness_execute action="dry_run" resource_id=<rule id> with target_accounts and target_regions. A dry run only evaluates; it changes nothing.
8. **Inspect**: poll harness_get resource_type="cost_governance_evaluation" until executionStatus is SUCCESS, PARTIAL_SUCCESS or FAILED. Then harness_execute action="resources" to see what matched and action="logs" if it failed. Summarise matches and confirm they are what the user intended.
9. **Go live** (only on the user's explicit approval, after reviewing the matched resources): either harness_execute action="run" for a one-off LIVE run — this changes real cloud resources — or create a cost_governance_enforcement to schedule it. New enforcements default to dry-run; only set isDryRun=false when the user asks.

If any step fails, report the error and the evaluation id rather than retrying blindly.`,
        },
      }],
    }),
  );
}
