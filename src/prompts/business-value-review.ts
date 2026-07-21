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
        customer: z.string().optional().describe("Customer / account name shown on the report cover (e.g. \"Acme Corp\")"),
        quarter: z.string().optional().describe("Review period label for the subtitle (e.g. \"Q2 FY27\")"),
        diagrams: z.string().optional().describe("Diagram mode: \"mermaid\" (default, full Mermaid incl. radar — best for Cursor/Windsurf/Antigravity), \"auto\" (broadly-compatible Mermaid only, no radar — for GitHub/older renderers), or \"tables\" (no diagrams, tables only — if the client cannot render Mermaid)"),
      },
    },
    async ({ customer, quarter, diagrams }) => {
      const customerName = customer || "<customer>";
      const period = quarter || "<quarter/period>";
      const diagramMode = (diagrams || "mermaid").toLowerCase();
      const tablesOnly = diagramMode === "tables";
      // Mirrors VALID_TIME_FILTERS in src/registry/toolsets/ccm.ts — kept inline
      // so the prompt names the exact enum the tools accept (all relative windows).
      const VALID_TIME_FILTERS_HINT = "LAST_7, THIS_MONTH, LAST_30_DAYS, THIS_QUARTER, THIS_YEAR, LAST_MONTH, LAST_QUARTER, LAST_YEAR, LAST_3_MONTHS, LAST_6_MONTHS, LAST_12_MONTHS";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a Harness CCM FinOps analyst. Produce a **Business Value Review (BVR)** for **${customerName}** covering **${period}**.

A BVR is a customer-facing executive document. Follow the three phases below: gather data first, score maturity, then author the markdown report.

## IMPORTANT — data integrity rules
- **Never invent numbers.** A BVR is a financial document. Every figure must come from a tool call.
- **Never apply a fabricated rate, ratio, or discount** (e.g. "~40% RI discount", "assume 30% savings") anywhere in the report — not in the module deep-dives, the cross-cutting insights, OR the recommendations matrix. Dollar impacts must come from a tool response's own savings/cost field. If a recommendation's savings is not returned by a tool, state the action qualitatively (no $ figure) rather than deriving one from an assumed percentage.
- If a data source is unavailable (tool error, module not licensed, empty result), **omit that section or explicitly mark it "data unavailable"** — do not estimate or fabricate.
- Always pair a monthly figure with its annualized equivalent (× 12).
- **Scope:** CCM data is account-scoped. This BVR covers the whole Harness account, not a single project — there is no project filter on these calls.
- **Pass \`compact: false\` on data calls whose numbers you need.** \`harness_list\` defaults to \`compact: true\`, which strips per-row numeric fields — including per-item \`monthlySaving\`/\`monthlyCost\` on cost_recommendation, and time-series/breakdown values. For \`cost_recommendation\`, \`cost_breakdown\`, and \`cost_timeseries\` list calls, pass \`compact: false\` so the figures are present. (Aggregate totals from \`cost_recommendation_stats\` are unaffected.)
- **Pick ONE reporting window and reuse it everywhere.** Compute the target window as epoch-ms bounds (\`REVIEW_START_MS\`, \`REVIEW_END_MS\`) from the review period, and drive every section from the same window:
  - **Perspective calls** (\`cost_breakdown\`, \`cost_timeseries\`, \`cost_summary\`) accept EITHER a relative \`time_filter\` enum (${VALID_TIME_FILTERS_HINT}) OR an explicit \`start_time\`/\`end_time\` (epoch **ms**). For any specific/historical quarter (e.g. Q4 2025 = Oct 1 – Dec 31), **pass \`start_time\`/\`end_time\` directly** — do NOT rely on \`LAST_QUARTER\` (it is relative to today and won't match a named past quarter), and do NOT sum months manually. Use \`time_filter\` only when the review period genuinely is "this/last month/quarter/year".
  - **\`cost_commitment\`** accepts \`start_date\`/\`end_date\` (YYYY-MM-DD) — pass the same window.
  - **\`cost_anomaly\`** accepts \`start_time\`/\`end_time\` (epoch ms) — pass the same window.
  - **Normalize every section to this one window** and state it (with exact dates) up front. Do NOT mix a quarter headline with 30-day anomalies and 4-day recommendation defaults. If a section's data genuinely can't be scoped to the window, mark it "window not available" rather than silently using a different range.
  - **Fiscal vs calendar:** if the quarter label is ambiguous (e.g. "Q4"), state the assumption (calendar Q4 = Oct–Dec) explicitly or ask — do not guess silently.
  - **Fiscal vs calendar:** if the quarter label is ambiguous (e.g. "Q4"), do not assume — ask or state the assumption (calendar Q4 = Oct–Dec) explicitly in the report.
- The deliverable is a **markdown document** you author in this conversation. There is no rendering server.${tablesOnly
  ? " Diagram mode is **tables**: do NOT emit any Mermaid — present every visual as a plain markdown data table only."
  : " **Every visual must be a Mermaid diagram** (fenced \\`\\`\\`mermaid blocks) backed by a supporting data table. Diagrams are required, not optional. See \"Required diagrams\" below for the compatible syntax to use and the fallback rules."}

---

## Phase 1 — Gather data

### Step 0 — Bootstrap
Call \`harness_list\` with resource_type="cost_summary" and **no perspective_id** → returns CCM metadata: which clouds are connected, the default perspective IDs (defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultAzurePerspectiveId, defaultClusterPerspectiveId), and currency. Save the default perspective IDs — you need them below. (This is \`harness_list\`, not \`harness_get\`; the \`get\` operation on cost_summary returns budget status, see Step 3.)

### Step 1 — Cost categories (BU mappings)
Call \`harness_list\` with resource_type="cost_category" → business-mapping names and their bucket lists. Pick the primary mapping (e.g. "Business Units") and use it as <BU_MAPPING> below.

### Step 2 — Perspectives inventory
Call \`harness_list\` with resource_type="cost_perspective" → total count = configured perspectives. **Also identify an ALL-CLOUD perspective** for total-spend figures: look for one whose name/dataSources cover every connected cloud (e.g. named "All Cloud Cost", "Total Cost", or with multiple dataSources). Call this <ALL_CLOUD_PERSPECTIVE>.
- Bootstrap metadata (Step 0) only exposes **per-cloud** default perspective IDs (defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultAzurePerspectiveId), NOT an all-cloud one. Do NOT use a single per-cloud perspective as "total cloud spend" — it silently omits the other clouds.
- If no all-cloud perspective exists, compute total spend by summing the per-cloud totals from **each** connected cloud's default perspective (AWS + GCP + Azure) and state in the report that the total is a per-cloud sum.

### Step 3 — Cost visibility & allocation
- **Allocation %** — \`harness_list\` resource_type="cost_breakdown", params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>", group_by: "<BU_MAPPING>", start_time: REVIEW_START_MS, end_time: REVIEW_END_MS, limit: 100, compact: false} (use \`time_filter\` instead of start/end only for this/last-month-style windows). **\`compact: false\` is required** or the per-row \`cost\` values are stripped and rows look empty. **Caveat: this MCP's cost_breakdown resolves any non-predefined \`group_by\` (including a business-mapping name) as a resource LABEL key, not a cost-category/business-mapping grouping.** So true per-BU allocation may return label-based or empty rows. Proceed as follows:
  - Only if the rows clearly reflect the BU mapping: \`total\` = sum of all rows' numeric \`cost\`; \`unattributed\` = cost of the row named "Unattributed"/"Others"/"No <BU_MAPPING>". Allocation % = (total − unattributed) / total × 100.
  - **Guards:**
    - If \`total\` ≤ 0 or no rows are returned → "allocation: data unavailable" (do NOT divide by zero).
    - If the grouping does not reflect the BU mapping (label-based rows) → "allocation: data unavailable (cost_breakdown does not support BUSINESS_MAPPING group-by in this MCP)"; do NOT present a label breakdown as BU allocation.
    - **If NO Unattributed/Others row is present, do NOT report 100% allocation** — absence of that row usually means the grouping did not resolve, not that everything is allocated. Confirm the buckets match real BU names before claiming full allocation.
  - Benchmark ≥ 80%.
- **12-month spend trend** — \`harness_list\` resource_type="cost_timeseries", params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>", group_by: "cloudProvider", time_filter: "LAST_12_MONTHS", time_resolution: "MONTH", compact: false} → monthly spend across all clouds for the trailing-12 context chart. If you fell back to per-cloud sums (no all-cloud perspective), run this per cloud and add the series.
- **Total spend + forecast (review window)** — \`harness_list\` resource_type="cost_summary", params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>", start_time: REVIEW_START_MS, end_time: REVIEW_END_MS} → total cost, trend, forecast, idle/unallocated cost, efficiency score for the exact window. (Use \`start_time\`/\`end_time\` for a historical quarter; \`time_filter\` only for this/last-month-style windows. \`harness_list\` returns the summary; the \`get\` operation returns budget status — next bullet.)
- **Budget status** — \`harness_get\` resource_type="cost_summary", params={perspective_id: "<ALL_CLOUD_PERSPECTIVE>"} → budgetAmount vs actualCost, time remaining. This is a **separate** \`harness_get\` call from the summary \`harness_list\` above.

### Step 4 — Commitment orchestration (RI / Savings Plans)
Use the same review window (\`REVIEW_START\`/\`REVIEW_END\`), passed as **YYYY-MM-DD**. **Validate the dates before every call:** both must be real calendar dates (valid month 01–12 and day-of-month), \`start_date\` strictly before \`end_date\`, and \`end_date\` no later than today — never a future or reversed range. If you cannot form a valid window, skip this section and note why. Call \`harness_get\` resource_type="cost_commitment" with each aspect:
- params={aspect: "coverage", start_date, end_date} → % of eligible compute covered (on-demand % gap).
- params={aspect: "utilisation", start_date, end_date} → RI/SP utilization %. Benchmark ≥ 80%.
- params={aspect: "savings", start_date, end_date} → realized commitment savings (annualize).
- params={aspect: "analysis", start_date, end_date} → spend detail. **Scope caveat: this MCP's cost_commitment defaults to AWS EC2 (Amazon Elastic Compute Cloud – Compute) and does not expose a service selector, so treat these figures as EC2-only.** Do NOT report RDS or ElastiCache coverage/gap numbers or apply a fixed RI-discount percentage — those are not returned by the API here. Report the EC2 on-demand % gap from the actual response; if you want to flag RDS/ElastiCache as a qualitative expansion opportunity, do so without inventing dollar figures.
- If any commitment call returns an auth/licensing error, note "Commitment Orchestrator not licensed / no data" and move on.

### Step 5 — Recommendations & savings
- **Authoritative totals** — \`harness_get\` resource_type="cost_recommendation_stats", params={recommendation_states: "OPEN"} → total monthly saving + count for OPEN recommendations. This is the source of truth for the open-savings subtotal; annualize × 12. Add params={group_by: "type"} for a by-resource-type breakdown (resize, terminate, etc.).
- **Top items (names + per-item savings)** — \`harness_list\` resource_type="cost_recommendation", params={recommendation_states: "OPEN", sort_by: "MONTHLY_SAVING", sort_order: "DESCENDING", limit: 25, compact: false}. **\`compact: false\` is required to get per-item \`monthlySaving\`** — the default compact mode strips it (only the aggregate \`totalMonthlySaving\` survives), which is why the rows otherwise look savings-less. Use these to name the top opportunities and show each one's monthlySaving; **do NOT compute the section subtotal by summing these 25 rows** (the list is one page) — use the \`cost_recommendation_stats\` figure above as the authoritative subtotal.

### Step 6 — Anomalies
- \`harness_get\` resource_type="cost_anomaly_summary" → total anomaly count and anomalous spend by cloud provider (this aggregate is NOT status-filtered — it mixes active/ignored/resolved/archived).
- For the **actionable** figure, \`harness_list\` resource_type="cost_anomaly", params={status: "ACTIVE", start_time: <REVIEW_START epoch ms>, end_time: <REVIEW_END epoch ms>, order_by_field: "ANOMALOUS_SPEND", order_by_direction: "DESCENDING", limit: 25} — scope to the same review window via \`start_time\`/\`end_time\` (epoch **milliseconds**). Use the response's total/count field for the active-anomaly COUNT — do not equate the count with the number of rows returned (this is one page of 25). If you need the exact count and the response has no total, paginate with \`offset\` (0, 25, 50, …) until fewer than \`limit\` rows come back. Show the top ~5–10 by anomalous spend; report active anomalies distinctly from the all-status summary total, and never present the unfiltered summary count as "active/open anomalies".

> **Known data gaps (no MCP tool yet):** standalone budget-health roll-up, AutoStopping savings, and CCM Asset-Governance enforcement savings are not exposed as resource types. If the customer relies on these, mark those report subsections "data not available via MCP — pull from the Harness CCM UI" rather than guessing.

---

## Phase 2 — Score FinOps maturity

Score each of the 7 dimensions **1 (Crawl) / 2 (Walk) / 3 (Run)** using ONLY the evidence you actually gathered (fractions like 2.5 allowed). **Do not force a score when the backing data is missing** — if a dimension's evidence was unavailable (tool error, module not licensed, or a known MCP gap such as BUSINESS_MAPPING allocation, AutoStopping, or budget-health), mark that dimension **N/A** and state why. Never guess a score to fill the table. When computing group and overall averages, **exclude N/A dimensions** from the mean rather than treating them as 0, and note in the report which dimensions were excluded.

**Critical — allocation specifically:** if Step 3 reported allocation as "data unavailable" (e.g. cost_breakdown could not resolve the BUSINESS_MAPPING group-by, or no rows / no Unattributed row), you MUST score \`allocation\` = **N/A**, NOT 1.0/Crawl. A tooling limitation that prevents measuring allocation is not evidence of poor allocation — do not conflate "couldn't measure" with "0% allocated". The same applies to any dimension whose only signal was an unmeasurable/failed query.

| Dimension | Group | 1 — Crawl | 2 — Walk | 3 — Run |
| :-- | :-- | :-- | :-- | :-- |
| visibility | Inform | Perspectives only, no categories | Cost categories deployed (≥1 mapping) | All BUs have perspectives + categories, 4+ clouds |
| allocation | Inform | Allocated < 50% | Allocated 50–79% | Allocated ≥ 80% |
| tooling | Inform | Manual/Excel reporting | Some dashboards + API use | Fully automated dashboards, no Excel |
| commitment_strategy | Optimize | CO enabled, EC2 < 50% coverage | EC2 50–89% covered | EC2 ≥ 90% coverage, utilization > 80% (score from EC2 data only — RDS/ElastiCache not measurable via MCP) |
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
  2. Commitment Orchestration (EC2 coverage + RI/SP utilization; RDS/ElastiCache only as qualitative expansion notes — no fabricated figures)
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
- **Auto mode (diagrams="auto"):** use ONLY the broadly-supported diagram types — \`pie\` and \`xychart-beta\` (bar/line). Do NOT use \`radar-beta\`; render maturity as an \`xychart-beta\` bar of the scores instead. These have shipped in Mermaid for years and render in most clients (GitHub, older VS Code).
- **Full mode (diagrams="mermaid", the default):** you may use \`radar-beta\` for the maturity chart (needs Mermaid ≥ v11.6 — fine in Cursor/Windsurf/Antigravity). ${diagramMode === "mermaid" ? "**This run is in full mode — use radar-beta for the maturity chart.**" : "This run is in auto mode — do NOT use radar-beta; use the xychart-beta bar."}
- **Always include the supporting data table for every diagram** — it is the guaranteed fallback: if a block does not render, the reader still has the numbers. If the person tells you a diagram did not render, re-emit that visual as a plain table and switch to tables-only for the rest of the report.

**The four required visuals:**

1. **FinOps maturity** (Section I) — the 7 dimension scores (0–3).${diagramMode === "mermaid" ? " Use a \`radar-beta\` chart (Mermaid ≥ v11.6; the keyword is \`radar-beta\`, not \`radar\`). **Plug in YOUR computed scores** — the numbers in the skeleton below are placeholders, replace every one with the actual score you derived in Phase 2, and OMIT any dimension you marked N/A. Skeleton:\n\`\`\`mermaid\nradar-beta\n  title FinOps Maturity (0-3)\n  axis vis[\"Visibility\"], alloc[\"Allocation\"], tool[\"Tooling\"], comm[\"Commitment\"], anom[\"Anomaly\"], opt[\"Optimization\"], acct[\"Accountability\"]\n  curve current{<vis>,<alloc>,<tool>,<comm>,<anom>,<opt>,<acct>}\n  max 3\n  min 0\n\`\`\`\nIf the client cannot render \`radar-beta\`, fall back to an \`xychart-beta\` bar of the same scores." : " Use an \`xychart-beta\` bar (one bar per dimension, y-axis 0–3), one bar per dimension you scored (omit N/A dimensions)."}

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
