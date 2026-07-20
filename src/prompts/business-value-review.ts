import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBusinessValueReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    "business-value-review",
    {
      description:
        "Generate a Cloud FinOps Business Value Review (BVR / QBR / quarterly executive report) for a Harness CCM customer. " +
        "Gathers account-level cost, allocation, commitment, recommendation, and anomaly data, scores evidenced FinOps maturity " +
        "dimensions (Crawl/Walk/Run), and authors a structured markdown report with an executive summary, " +
        "per-module deep dives, cross-cutting insights, and a prioritized recommendations matrix.",
      argsSchema: {
        customer: z.string().optional().describe("Customer / account name shown on the report cover (e.g. \"Acme Corp\")"),
        quarter: z.string().optional().describe("Review period label for the subtitle (e.g. \"Q2 FY27\")"),
        timeFilter: z.enum([
          "LAST_7",
          "THIS_MONTH",
          "LAST_30_DAYS",
          "THIS_QUARTER",
          "THIS_YEAR",
          "LAST_MONTH",
          "LAST_QUARTER",
          "LAST_YEAR",
          "LAST_3_MONTHS",
          "LAST_6_MONTHS",
          "LAST_12_MONTHS",
        ]).optional().describe("CCM relative time filter for period-scoped calls (default: LAST_QUARTER)"),
        reviewStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Commitment review start date (YYYY-MM-DD)"),
        reviewEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Commitment review end date (YYYY-MM-DD)"),
      },
    },
    async ({ customer, quarter, timeFilter, reviewStart, reviewEnd }) => {
      const customerName = customer || "<customer>";
      const reviewTimeFilter = timeFilter || "LAST_QUARTER";
      const period = quarter || reviewTimeFilter;
      const reviewStartDate = reviewStart || "<review-start YYYY-MM-DD>";
      const reviewEndDate = reviewEnd || "<review-end YYYY-MM-DD>";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a Harness CCM FinOps analyst. Produce a **Business Value Review (BVR)** for **${customerName}**, labeled **${period}**.

A BVR is a customer-facing executive document. Follow the phases below: gather data first, score only evidenced maturity dimensions, then author the markdown report.

## IMPORTANT — data integrity rules
- **Never invent numbers.** A BVR is a financial document. Every figure must come from a tool call.
- If a data source is unavailable (tool error, module not licensed, empty result), **omit that section or explicitly mark it "data unavailable"** — do not estimate or fabricate.
- Harness CCM resources used here are account-scoped. Do not claim that these results represent one Harness project, and do not pass \`org_id\` or \`project_id\`.
- Use \`${reviewTimeFilter}\` for period-scoped CCM calls. The report label does not filter an API: show the exact source window beside every metric, and do not claim it covers ${period} unless the windows align.
- Pair a monthly figure with its annualized equivalent (× 12). Do not multiply a multi-month period total by 12; annualize only a value explicitly returned as monthly, such as \`monthlySaving\`.
- Use raw numeric response fields for calculations, not formatted display strings. Show the formula and source fields for every derived figure.
- The deliverable is a **markdown document** you author in this conversation. There is no rendering server — represent charts as markdown tables (and optionally a Mermaid diagram for the maturity radar).

---

## Phase 1 — Gather data

### Step 0 — Bootstrap
Call \`harness_list\` with resource_type="cost_summary" and **no perspective_id** → returns CCM metadata: which clouds are connected, the default perspective IDs (defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultAzurePerspectiveId, defaultClusterPerspectiveId), and currency. Save the available default perspective IDs — you need them below.

### Step 1 — Cost categories (BU mappings)
Call \`harness_list\` with resource_type="cost_category" → business-mapping names and identifiers. For each relevant mapping, call \`harness_get\` with resource_type="cost_category", resource_id="<category_id>" to retrieve its bucket list. Do not assume which mapping is primary; identify it only from returned names/configuration or report all mappings.

### Step 2 — Perspectives inventory
Call \`harness_list\` with resource_type="cost_perspective" → use the returned \`total\` as the configured perspective count. If the call returns no usable items or total, mark the inventory unavailable rather than interpreting it as zero.

### Step 3 — Cost visibility & allocation
- \`harness_list\` resource_type="cost_summary", params={perspective_id: "<default>", time_filter: "${reviewTimeFilter}"} → \`trendStats\` (cost, idle cost, unallocated cost, utilized cost, efficiency score) and \`forecastCost\`.
- Calculate high-level allocation only when raw total-cost and unallocated-cost values are both present: \`allocated % = (total cost - unallocated cost) / total cost × 100\`. Benchmark ≥ 80%. Otherwise mark allocation as unavailable.
- \`harness_get\` resource_type="cost_summary", params={perspective_id: "<default>"} → budget status only (\`budgetAmount\` vs \`actualCost\`). Do not pass \`time_filter\` to this budget operation.
- \`harness_list\` resource_type="cost_breakdown", params={perspective_id: "<default>", group_by: "product", time_filter: "${reviewTimeFilter}"} → major cost drivers. Do not substitute a cost-category group: the current tool treats unknown group names as label keys and cannot return BU-mapping bucket spend.
- \`harness_list\` resource_type="cost_timeseries", params={perspective_id: "<default>", group_by: "cloudProvider", time_filter: "LAST_12_MONTHS", time_resolution: "MONTH"} → trailing-12-complete-month spend trend and cloud split. Label this window separately from ${period}.

### Step 4 — Commitment orchestration (RI / Savings Plans)
Use the exact review dates \`${reviewStartDate}\` through \`${reviewEndDate}\`. If placeholders remain or those dates do not match ${period}, resolve the dates with the user before making commitment calls.
Call \`harness_get\` with resource_type="cost_commitment" and each aspect:
- params={aspect: "coverage", start_date: "${reviewStartDate}", end_date: "${reviewEndDate}"} → EC2 eligible-compute coverage and on-demand gap.
- params={aspect: "utilisation", start_date: "${reviewStartDate}", end_date: "${reviewEndDate}"} → EC2 RI/SP utilization. Benchmark ≥ 80%.
- params={aspect: "savings", start_date: "${reviewStartDate}", end_date: "${reviewEndDate}"} → realized commitment savings for the returned window. Annualize only if the API explicitly labels a value as monthly.
- params={aspect: "analysis", start_date: "${reviewStartDate}", end_date: "${reviewEndDate}"} → returned EC2 spend detail.
- The MCP operation currently defaults the commitment service to EC2. Do not claim RDS or ElastiCache coverage, utilization, or opportunity unless those services are explicitly present in the response. Never apply an assumed discount percentage.
- If any commitment call returns an auth/licensing error, note "Commitment Orchestrator not licensed / no data" and move on.

### Step 5 — Recommendations & savings
- \`harness_get\` resource_type="cost_recommendation_stats", params={recommendation_states: "OPEN", days_back: 90} → aggregate open monthly saving and count for the trailing 90-day discovery window. Repeat with \`group_by: "type"\` and the same filters for a by-resource-type breakdown.
- \`harness_list\` resource_type="cost_recommendation", params={recommendation_states: "OPEN", days_back: 90, sort_by: "MONTHLY_SAVING", sort_order: "DESCENDING", limit: 25} → top open opportunities.
- Use aggregate stats for the total opportunity. A sum of the top 25 \`monthlySaving\` values is a partial top-opportunities subtotal, not the account total. Annualize monthly savings × 12 and label the 90-day discovery window.

### Step 6 — Anomalies
Call \`harness_list\` with resource_type="cost_anomaly", filters={time_filter: "${reviewTimeFilter}", order_by_field: "ANOMALOUS_SPEND", order_by_direction: "DESCENDING", limit: 100, offset: 0}. Repeat with offsets 100, 200, and so on until no items remain. Report the period-scoped count and sum anomalous spend only from numeric values returned by those items.

> **Known data gaps:** standalone budget-health roll-up, AutoStopping savings, CCM Asset-Governance enforcement savings, and cost-category bucket spend are not available through the calls above. Mark those report subsections "data not available via MCP — pull from the Harness CCM UI" rather than guessing.

---

## Phase 2 — Score FinOps maturity

Score a dimension **1 (Crawl) / 2 (Walk) / 3 (Run)** only when the gathered data or user-provided context proves the relevant threshold (fractions like 2.5 allowed). Otherwise write **N/A — insufficient evidence**. Resource presence alone does not prove a manual process, automation, alert response, recommendation adoption, or chargeback.

| Dimension | Group | 1 — Crawl | 2 — Walk | 3 — Run |
| :-- | :-- | :-- | :-- | :-- |
| visibility | Inform | Perspectives only, no categories | Cost categories deployed (≥1 mapping) | All BUs have perspectives + categories, 4+ clouds |
| allocation | Inform | Allocated < 50% | Allocated 50–79% | Allocated ≥ 80% |
| tooling | Inform | Manual/Excel reporting | Some dashboards + API use | Fully automated dashboards, no Excel |
| commitment_strategy | Optimize | CO enabled, < 50% coverage | EC2 50–89% covered, RDS/ElastiCache uncovered | EC2+RDS+ElastiCache ≥ 90% coverage, utilization > 80% |
| anomaly_detection | Optimize | Budgets exist, no anomaly rules | Anomaly detection enabled, alerts firing | Active rules + response process, zero unreviewed anomalies |
| optimization | Optimize | Recommendations exist, none actioned | Some recs actioned / AutoStopping piloted | Continuous optimization, > 50% recs actioned |
| accountability | Operate | No chargeback | Partial chargeback | Cost per BU/product with active chargeback |

Compute each group average from scored dimensions only — **Inform** (visibility, allocation, tooling), **Optimize** (commitment_strategy, anomaly_detection, optimization), **Operate** (accountability). If a group has no scored dimensions, mark the group N/A. Compute the overall score only when all three groups have numeric scores; otherwise mark it N/A. For numeric scores, label ≥ 2.5 = Run, ≥ 1.5 = Walk, else Crawl.

---

## Phase 3 — Author the report (markdown)

Output a single markdown document with this structure:

**YAML frontmatter** (cover): title "Business Value Review", subtitle "${period} Cloud FinOps Review", customer "${customerName}", date, author "Harness CCM FinOps Agent", classification "Confidential".

**I. Executive Summary & FinOps Maturity** — a metrics summary (total cloud spend + exact window, trend, realized savings, and evidenced maturity score when available) and a maturity table (dimension · score/N/A · stage · evidence). Add a Mermaid radar only if all 7 dimensions have numeric scores.

**II. CCM Module Deep Dive** — one subsection each, using a Metric / Benchmark / Current table:
  1. Cost Visibility & Allocation
  2. Commitment Orchestration (EC2 coverage, utilization, and returned savings)
  3. Recommendations & Optimization
  4. Anomaly Detection
  5. Cost Allocation & Accountability (chargeback coverage)
  (Mark AutoStopping / Asset-Governance-savings / Budget-health as "data not available via MCP" if not gathered.)

**II.X Cross-Cutting Insights** — include only quantified findings supported by data from at least 2 modules. Omit this section if no such connections are evidenced.

**III. Expansion Signals & Action Plan** — observed gaps mapped to Harness modules to expand into.

**IV. Prioritized Recommendations Matrix** — one deduped ranked table. Each row: Action · Source · Why · Owner · $ Impact (annualized) · Effort (S/M/L) · Time-to-impact · Risk · Validation. Follow with a "Quick Wins (Top 5)" and "Strategic Bets" cross-view.

Use blockquote callouts for the most important findings/risks. Rank measured savings by annualized dollar impact; use N/A for recommendations whose dollar impact is not available rather than inventing a value.`,
          },
        }],
      };
    },
  );
}
