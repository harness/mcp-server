import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBusinessValueReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    "business-value-review",
    {
      description:
        "Generate a Cloud FinOps Business Value Review (BVR / QBR / quarterly executive report) for a Harness CCM customer. " +
        "Gathers cost, allocation, commitment, recommendation, and anomaly data across the account, scores FinOps maturity " +
        "(Crawl/Walk/Run across 7 dimensions), and authors a structured markdown report with an executive summary, " +
        "per-module deep dives, cross-cutting insights, and a prioritized recommendations matrix.",
      argsSchema: {
        customer: z.string().describe("Customer / account name shown on the report cover (e.g. \"Acme Corp\")").optional(),
        quarter: z.string().describe("Review period label for the subtitle (e.g. \"Q2 FY27\")").optional(),
        projectId: z.string().describe("Project identifier to scope the review (optional; most CCM data is account-scoped)").optional(),
      },
    },
    async ({ customer, quarter, projectId }) => {
      const customerName = customer || "<customer>";
      const period = quarter || "<quarter/period>";
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a Harness CCM FinOps analyst. Produce a **Business Value Review (BVR)** for **${customerName}** covering **${period}**.

A BVR is a customer-facing executive document. Follow the four phases below: gather data first, score maturity, then author the markdown report.

## IMPORTANT — data integrity rules
- **Never invent numbers.** A BVR is a financial document. Every figure must come from a tool call.
- If a data source is unavailable (tool error, module not licensed, empty result), **omit that section or explicitly mark it "data unavailable"** — do not estimate or fabricate.
- Always pair a monthly figure with its annualized equivalent (× 12).
- The deliverable is a **markdown document** you author in this conversation. There is no rendering server — represent charts as markdown tables (and optionally a Mermaid diagram for the maturity radar).

---

## Phase 1 — Gather data

### Step 0 — Bootstrap
Call \`harness_get\` with resource_type="cost_summary"${projectFilter} and **no perspective_id** → returns CCM metadata: which clouds are connected, the default perspective IDs (defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultClusterPerspectiveId), and currency. Save the default perspective IDs — you need them below.

### Step 1 — Cost categories (BU mappings)
Call \`harness_list\` with resource_type="cost_category"${projectFilter} → business-mapping names and their bucket lists. Pick the primary mapping (e.g. "Business Units") and use it as <BU_MAPPING> below.

### Step 2 — Perspectives inventory
Call \`harness_list\` with resource_type="cost_perspective"${projectFilter} → total count = configured perspectives.

### Step 3 — Cost visibility & allocation
- \`harness_list\` resource_type="cost_breakdown"${projectFilter}, params={perspective_id: "<defaultAwsPerspectiveId or defaultGcpPerspectiveId>", group_by: "cost_category", time_filter: "THIS_MONTH"} → allocation % = named buckets / (named + Unattributed) × 100. Benchmark ≥ 80%.
- \`harness_list\` resource_type="cost_timeseries"${projectFilter}, params={perspective_id: "<default>", group_by: "cloudProvider", time_filter: "LAST_12_MONTHS", time_resolution: "MONTH"} → 12-month spend trend, cloud split, MoM/QoQ growth.
- \`harness_get\` resource_type="cost_summary"${projectFilter}, params={perspective_id: "<default>", time_filter: "THIS_MONTH"} → total cost, trend, forecast, idle/unallocated cost, efficiency score, and budget status (budgetAmount vs actualCost).

### Step 4 — Commitment orchestration (RI / Savings Plans)
Call \`harness_get\` resource_type="cost_commitment"${projectFilter} with each aspect (pass start_date/end_date as YYYY-MM-DD, ~90-day window):
- params={aspect: "coverage", start_date, end_date} → % of eligible compute covered (on-demand % gap).
- params={aspect: "utilisation", start_date, end_date} → RI/SP utilization %. Benchmark ≥ 80%.
- params={aspect: "savings", start_date, end_date} → realized commitment savings (annualize).
- params={aspect: "analysis", start_date, end_date} → per-service breakdown (EC2 vs RDS vs ElastiCache on-demand %). EC2 gap framing: RDS on-demand spend × ~40% RI discount = annual opportunity.
- If any commitment call returns an auth/licensing error, note "Commitment Orchestrator not licensed / no data" and move on.

### Step 5 — Recommendations & savings
- \`harness_get\` resource_type="cost_recommendation_stats"${projectFilter} → total monthly saving, count. Add params={group_by: "type"} for a by-resource-type breakdown (resize, terminate, etc.).
- \`harness_list\` resource_type="cost_recommendation"${projectFilter}, params={recommendation_states: "OPEN", sort_by: "MONTHLY_SAVING", sort_order: "DESCENDING", limit: 25} → top open opportunities. Sum monthlySaving; annualize × 12.

### Step 6 — Anomalies
Call \`harness_get\` resource_type="cost_anomaly_summary"${projectFilter} → total anomaly count and anomalous spend by cloud provider.

> **Known data gaps (no MCP tool yet):** standalone budget-health roll-up, AutoStopping savings, and CCM Asset-Governance enforcement savings are not exposed as resource types. If the customer relies on these, mark those report subsections "data not available via MCP — pull from the Harness CCM UI" rather than guessing.

---

## Phase 2 — Score FinOps maturity

Score each of the 7 dimensions **1 (Crawl) / 2 (Walk) / 3 (Run)** using the evidence you gathered (fractions like 2.5 allowed):

| Dimension | Group | 1 — Crawl | 2 — Walk | 3 — Run |
| :-- | :-- | :-- | :-- | :-- |
| visibility | Inform | Perspectives only, no categories | Cost categories deployed (≥1 mapping) | All BUs have perspectives + categories, 4+ clouds |
| allocation | Inform | Allocated < 50% | Allocated 50–79% | Allocated ≥ 80% |
| tooling | Inform | Manual/Excel reporting | Some dashboards + API use | Fully automated dashboards, no Excel |
| commitment_strategy | Optimize | CO enabled, < 50% coverage | EC2 50–89% covered, RDS/ElastiCache uncovered | EC2+RDS+ElastiCache ≥ 90% coverage, utilization > 80% |
| anomaly_detection | Optimize | Budgets exist, no anomaly rules | Anomaly detection enabled, alerts firing | Active rules + response process, zero unreviewed anomalies |
| optimization | Optimize | Recommendations exist, none actioned | Some recs actioned / AutoStopping piloted | Continuous optimization, > 50% recs actioned |
| accountability | Operate | No chargeback | Partial chargeback | Cost per BU/product with active chargeback |

Compute group averages — **Inform** (visibility, allocation, tooling), **Optimize** (commitment_strategy, anomaly_detection, optimization), **Operate** (accountability) — and an overall score (mean of the three group averages). Label: ≥ 2.5 = Run, ≥ 1.5 = Walk, else Crawl.

---

## Phase 3 — Author the report (markdown)

Output a single markdown document with this structure:

**YAML frontmatter** (cover): title "Business Value Review", subtitle "${period} Cloud FinOps Review", customer "${customerName}", date, author "Harness CCM FinOps Agent", classification "Confidential".

**I. Executive Summary & FinOps Maturity** — a metrics summary (total cloud spend + QoQ trend, realized savings run-rate + annualized, maturity score) and a maturity table (dimension · score · stage · evidence). Optionally add a Mermaid radar for the 7 dimensions.

**II. CCM Module Deep Dive** — one subsection each, using a Metric / Benchmark / Current table:
  1. Cost Visibility & Allocation
  2. Commitment Orchestration (EC2/RDS/ElastiCache gap framing, RI utilization)
  3. Recommendations & Optimization
  4. Anomaly Detection
  5. Cost Allocation & Accountability (chargeback coverage)
  (Mark AutoStopping / Asset-Governance-savings / Budget-health as "data not available via MCP" if not gathered.)

**II.X Cross-Cutting Insights** — 4–8 quantified findings connecting ≥ 2 modules (e.g. anomaly × tag hygiene, AI-tooling growth × commitment coverage, low utilization × new-purchase risk).

**III. Expansion Signals & Action Plan** — observed gaps mapped to Harness modules to expand into.

**IV. Prioritized Recommendations Matrix** — one deduped ranked table. Each row: Action · Source · Why · Owner · $ Impact (annualized) · Effort (S/M/L) · Time-to-impact · Risk · Validation. Follow with a "Quick Wins (Top 5)" and "Strategic Bets" cross-view.

Use blockquote callouts for the most important findings/risks. Prioritize every recommendation by annualized dollar impact.`,
          },
        }],
      };
    },
  );
}
