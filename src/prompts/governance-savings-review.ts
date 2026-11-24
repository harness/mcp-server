import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGovernanceSavingsReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    "governance-savings-review",
    {
      description: "Review cloud asset governance (Cloud Custodian) health: realised savings, enforcements, failing evaluations and pending enforcement recommendations",
      argsSchema: {
        timeFilter: z.enum(["LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS"]).describe("Window for the overview metrics (default LAST_30_DAYS)").optional(),
        cloudProvider: z.enum(["AWS", "AZURE", "GCP"]).describe("Limit rule and enforcement review to one provider").optional(),
      },
    },
    async ({ timeFilter, cloudProvider }) => {
      const window = timeFilter ?? "LAST_30_DAYS";
      const providerNote = cloudProvider ? `, filters={cloud_provider: "${cloudProvider}"}` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review cloud asset governance for this Harness account. This is a READ-ONLY review: do not run rules, enable enforcements or accept recommendations.

Steps:
1. **Headline numbers**: Call harness_get with resource_type="cost_governance_overview" for each of resource_id="total_realised_savings", "total_evaluations", "total_active_enforcements", "total_new_enforcement_recommendations" (params={time_filter: "${window}"}). Savings are currency amounts.
2. **Where savings come from**: Call harness_list with resource_type="cost_governance_overview" and filters={metric: "savings_grouped", time_filter: "${window}"}, then metric="top_cloud_accounts".
3. **Enforcements**: Call harness_list with resource_type="cost_governance_enforcement"${providerNote}. Flag enforcements that are disabled, or still in dry-run mode (isDryRun=true), since those realise no savings. Use harness_execute action="savings" on the biggest ones.
4. **Failures**: Call harness_list with resource_type="cost_governance_evaluation" and filters={execution_status: "FAILED"}. For up to 5 failures, call harness_execute action="logs" on the evaluation to find the root cause (credentials, region, invalid YAML).
5. **Pending decisions**: Call harness_list with resource_type="cost_governance_enforcement_recommendation" to find suggested enforcements awaiting a decision.
6. **Rule coverage**: Call harness_list with resource_type="cost_governance_recommendation" to see which rules feed recommendations and whether their recommendations are healthy.

Present:
- A one-paragraph summary (savings, activity, trend).
- A table of enforcements: name, provider, status, dry-run?, realised savings.
- A prioritised list of actions for the user to take (fix failing evaluations, move dry-run enforcements live, accept or dismiss recommendations). Do not perform them without being asked.`,
          },
        }],
      };
    },
  );
}
