import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDoraMetricsPrompt(server: McpServer): void {
  server.registerPrompt(
    "dora-metrics-review",
    {
      description: "Review DORA metrics (deployment frequency, change failure rate, MTTR, lead time) and suggest improvements",
      argsSchema: {
        teamRefId: z.string().describe("SEI team reference ID to analyze").optional(),
        dateStart: z.string().describe("Start date for analysis (YYYY-MM-DD)").optional(),
        dateEnd: z.string().describe("End date for analysis (YYYY-MM-DD)").optional(),
      },
    },
    async ({ teamRefId, dateStart, dateEnd }) => {
      const teamFilter = teamRefId ? `, team_ref_id="${teamRefId}"` : "";
      const dateFilter = [
        dateStart ? `, date_start="${dateStart}"` : "",
        dateEnd ? `, date_end="${dateEnd}"` : "",
      ].join("");
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review DORA metrics and provide actionable improvement recommendations.

Steps:
1. Call harness_get with resource_type="sei_deployment_frequency"${teamFilter}${dateFilter} to get deployment frequency data
2. Call harness_get with resource_type="sei_change_failure_rate"${teamFilter}${dateFilter} to get change failure rate
3. Call harness_get with resource_type="sei_mttr"${teamFilter}${dateFilter} to get mean time to recovery
4. Call harness_get with resource_type="sei_lead_time"${teamFilter}${dateFilter} to get lead time for changes
5. Classify each metric as Elite / High / Medium / Low per the DORA benchmarks:
   - Deployment Frequency: Elite (on-demand/multiple per day), High (weekly-monthly), Medium (monthly-6mo), Low (>6mo)
   - Change Failure Rate: Elite (<5%), High (5-10%), Medium (10-15%), Low (>15%)
   - MTTR: Elite (<1hr), High (<1day), Medium (<1week), Low (>1week)
   - Lead Time: Elite (<1day), High (1day-1week), Medium (1week-1month), Low (>1month)
6. Present a DORA scorecard table with current values and classifications
7. Identify the weakest metric and provide 3 concrete improvement actions
8. Suggest pipeline or process changes that would improve the weakest areas`,
          },
        }],
      };
    },
  );
}
