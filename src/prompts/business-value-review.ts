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
        diagrams: z.string().describe("Diagram mode: \"mermaid\" (default, full Mermaid incl. radar — best for Cursor/Windsurf/Antigravity), \"auto\" (broadly-compatible Mermaid only, no radar — for GitHub/older renderers), or \"tables\" (no diagrams, tables only — if the client cannot render Mermaid)").optional(),
      },
    },
    async ({ customer, quarter, projectId, diagrams }) => {
      const customerName = customer || "<customer>";
      const period = quarter || "<quarter/period>";
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      const diagramMode = (diagrams || "mermaid").toLowerCase();
      const tablesOnly = diagramMode === "tables";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a Harness CCM FinOps analyst. Produce a **Business Value Review (BVR)** for **${customerName}** covering **${period}**.

A BVR is a customer-facing executive document. Follow the three phases below: gather data first, score maturity, then author the markdown report.

## IMPORTANT — data integrity rules
- **Never invent numbers.** A BVR is a financial document. Every figure must come from a tool call.
- If a data source is unavailable (tool error, module not licensed, empty result), **omit that section or explicitly mark it "data unavailable"** — do not estimate or fabricate.
- Always pair a monthly figure with its annualized equivalent (× 12).${projectId ? "\n- **Scope note:** CCM data is account-scoped; the `project_id` shown in the calls below is passed through but most CCM endpoints ignore it. Treat all figures as account-wide, not project-specific." : ""}
- The deliverable is a **markdown document** you author in this conversation. There is no rendering server.${tablesOnly
  ? " Diagram mode is **tables**: do NOT emit any Mermaid — present every visual as a plain markdown data table only."
  : " **Every visual must be a Mermaid diagram** (fenced \\`\\`\\`mermaid blocks) backed by a supporting data table. Diagrams are required, not optional. See \"Required diagrams\" below for the compatible syntax to use and the fallback rules."}

---

## Phase 1 — Gather data

### Step 0 — Bootstrap
Call \`harness_list\` with resource_type="cost_summary"${projectFilter} and **no perspective_id** → returns CCM metadata: which clouds are connected, the default perspective IDs (defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultAzurePerspectiveId, defaultClusterPerspectiveId), and currency. Save the default perspective IDs — you need them below. (This is \`harness_list\`, not \`harness_get\`; the \`get\` operation on cost_summary returns budget status, see Step 3.)

### Step 1 — Cost categories (BU mappings)
Call \`harness_list\` with resource_type="cost_category"${projectFilter} → business-mapping names and their bucket lists. Pick the primary mapping (e.g. "Business Units") and use it as <BU_MAPPING> below.

### Step 2 — Perspectives inventory
Call \`harness_list\` with resource_type="cost_perspective"${projectFilter} → total count = configured perspectives. **Also identify an ALL-CLOUD perspective** for total-spend figures: look for one whose name/dataSources cover every connected cloud (e.g. named "All Cloud Cost", "Total Cost", or with multiple dataSources). Call this <ALL_CLOUD_PERSPECTIVE>.
- Bootstrap metadata (Step 0) only exposes **per-cloud** default perspective IDs (defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultAzurePerspectiveId), NOT an all-cloud one. Do NOT use a single per-cloud perspective as "total cloud spend" — it silently omits the other clouds.
- If no all-cloud perspective exists, compute total spend by summing the per-cloud totals from **each** connected cloud's default perspective (AWS + GCP + Azure) and state in the report that the total is a per-cloud sum.

### Step 3 — Cost visibility & allocation
- **Allocation %** — \`harness_list\` resource_type="cost_breakdown"${projectFilter}, params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>", group_by: "<BU_MAPPING>", time_filter: "THIS_MONTH", limit: 100}. **Caveat: this MCP's cost_breakdown resolves any non-predefined \`group_by\` (including a business-mapping name) as a resource LABEL key, not a cost-category/business-mapping grouping.** So true per-BU allocation may return label-based or empty rows. Proceed as follows:
  - If the rows clearly reflect the BU mapping, compute from each row's numeric \`cost\`: \`unattributed\` = cost of the row named "Unattributed"/"Others"/"No <BU_MAPPING>" (0 if absent); \`total\` = sum of all rows' \`cost\`; Allocation % = (total − unattributed) / total × 100.
  - **Guards:** if \`total\` ≤ 0, no rows are returned, or the grouping does not reflect the BU mapping, report "allocation: data unavailable (cost_breakdown does not support BUSINESS_MAPPING group-by in this MCP)" — do NOT divide by zero and do NOT present a label-based breakdown as BU allocation.
  - Benchmark ≥ 80%.
- **12-month spend trend** — \`harness_list\` resource_type="cost_timeseries"${projectFilter}, params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>", group_by: "cloudProvider", time_filter: "LAST_12_MONTHS", time_resolution: "MONTH"} → monthly spend across all clouds, cloud split, MoM/QoQ growth. If you fell back to per-cloud sums (no all-cloud perspective), run this per cloud and add the series.
- **Total spend + forecast** — \`harness_list\` resource_type="cost_summary"${projectFilter}, params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>", time_filter: "THIS_MONTH"} → total cost, trend, forecast, idle/unallocated cost, efficiency score. (\`harness_list\` returns the summary; the \`get\` operation returns budget status — next bullet.)
- **Budget status** — \`harness_get\` resource_type="cost_summary"${projectFilter}, params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>"} → budgetAmount vs actualCost, time remaining. This is a **separate** \`harness_get\` call from the summary \`harness_list\` above.

### Step 4 — Commitment orchestration (RI / Savings Plans)
Choose a ~90-day window and pass \`start_date\`/\`end_date\` as **YYYY-MM-DD**. **Validate the dates before every call:** both must be real calendar dates (valid month 01–12 and day-of-month), \`start_date\` strictly before \`end_date\`, and \`end_date\` no later than today — never a future or reversed range. If you cannot form a valid window, skip this section and note why. Call \`harness_get\` resource_type="cost_commitment"${projectFilter} with each aspect:
- params={aspect: "coverage", start_date, end_date} → % of eligible compute covered (on-demand % gap).
- params={aspect: "utilisation", start_date, end_date} → RI/SP utilization %. Benchmark ≥ 80%.
- params={aspect: "savings", start_date, end_date} → realized commitment savings (annualize).
- params={aspect: "analysis", start_date, end_date} → per-service breakdown (EC2 vs RDS vs ElastiCache on-demand %). EC2 gap framing: RDS on-demand spend × ~40% RI discount = annual opportunity.
- If any commitment call returns an auth/licensing error, note "Commitment Orchestrator not licensed / no data" and move on.

### Step 5 — Recommendations & savings
- **Authoritative totals** — \`harness_get\` resource_type="cost_recommendation_stats"${projectFilter}, params={recommendation_states: "OPEN"} → total monthly saving + count for OPEN recommendations. This is the source of truth for the open-savings subtotal; annualize × 12. Add params={group_by: "type"} for a by-resource-type breakdown (resize, terminate, etc.).
- **Top items (names only)** — \`harness_list\` resource_type="cost_recommendation"${projectFilter}, params={recommendation_states: "OPEN", sort_by: "MONTHLY_SAVING", sort_order: "DESCENDING", limit: 25} → the top opportunities to name in the report. If a returned item includes \`monthlySaving\`, show it; **do NOT compute the section subtotal by summing these 25 rows** (the list may be truncated/paginated and per-item savings can be absent) — use the \`cost_recommendation_stats\` figure above as the subtotal.

### Step 6 — Anomalies
- \`harness_get\` resource_type="cost_anomaly_summary"${projectFilter} → total anomaly count and anomalous spend by cloud provider (this aggregate is NOT status-filtered — it mixes active/ignored/resolved/archived).
- For the **actionable** figure, \`harness_list\` resource_type="cost_anomaly"${projectFilter}, params={status: "ACTIVE", order_by_field: "ANOMALOUS_SPEND", order_by_direction: "DESCENDING", limit: 25} → count + top active anomalies by anomalous spend. Report active anomalies distinctly from the all-status total; do not present the unfiltered summary count as "open/active anomalies".

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

**I. Executive Summary & FinOps Maturity** — a metrics summary (total cloud spend + QoQ trend, realized savings run-rate + annualized, maturity score) and a maturity table (dimension · score · stage · evidence), plus the **required** maturity visual (see "Required diagrams" below).

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

Use blockquote callouts for the most important findings/risks. Prioritize every recommendation by annualized dollar impact.

---

## Required diagrams
${tablesOnly
? `Diagram mode is **tables** — do NOT emit any Mermaid. Present each of the four visuals below as a plain markdown data table instead (maturity scores, 12-month spend, cost breakdown, savings composition).`
: `The report MUST include **all four** visuals below, each next to (not instead of) its supporting data table. Use only data you gathered — never fabricate a point to fill a chart; if a diagram's data is unavailable, replace it with a one-line note naming the missing source.

**Compatibility — how to pick the syntax (you cannot detect the client's renderer at runtime, so choose defensively). This run is in \`${diagramMode}\` mode:**
- **Auto mode (diagrams="auto"):** use ONLY the broadly-supported diagram types — \`pie\` and \`xychart-beta\` (bar/line). Do NOT use \`radar\`; render maturity as an \`xychart-beta\` bar of the 7 scores instead. These have shipped in Mermaid for years and render in most clients (GitHub, older VS Code).
- **Full mode (diagrams="mermaid", the default):** you may use \`radar\` for the maturity chart (needs Mermaid ≥ v11.6 — fine in Cursor/Windsurf/Antigravity). ${diagramMode === "mermaid" ? "**This run is in full mode — use radar for the maturity chart.**" : "This run is in auto mode — do NOT use radar; use the xychart-beta bar."}
- **Always include the supporting data table for every diagram** — it is the guaranteed fallback: if a block does not render, the reader still has the numbers. If the person tells you a diagram did not render, re-emit that visual as a plain table and switch to tables-only for the rest of the report.

**The four required visuals:**

1. **FinOps maturity** (Section I) — the 7 dimension scores (0–3).${diagramMode === "mermaid" ? " Use a \`radar\` chart:\n\`\`\`mermaid\nradar\n  title FinOps Maturity (0-3)\n  axis vis[\"Visibility\"], alloc[\"Allocation\"], tool[\"Tooling\"], comm[\"Commitment\"], anom[\"Anomaly\"], opt[\"Optimization\"], acct[\"Accountability\"]\n  curve current{2,2,1,3,2,2,3}\n\`\`\`" : " Use an \`xychart-beta\` bar (one bar per dimension, y-axis 0–3)."}

2. **12-month spend trend** (Section II.1) — an \`xychart-beta\` line of monthly total cloud spend, from \`cost_timeseries\`.

3. **Cost breakdown by top dimension** (Section II.1) — an \`xychart-beta\` bar of the top ~8 cost buckets (BU / service / product) from \`cost_breakdown\`.

4. **Savings composition** (Section II.3) — a \`pie\` of realized + open savings by source (commitment, recommendations, and any other gathered stream).

Mermaid authoring rules: keep axis/slice labels short (≤ ~15 chars, no line breaks); quote labels containing spaces or special characters; never put raw \`$\`, \`%\`, \`(\`, or \`,\` inside an unquoted label; render currency in the surrounding table, not inside the diagram.`}`,
          },
        }],
      };
    },
  );
}
