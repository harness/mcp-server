# 006 — Visualization Architecture Review

**Status**: Review  
**Author**: @sunil.gattupalle  
**Created**: 2026-05-02  

---

## Summary

The MCP server currently bundles a full SVG chart rendering pipeline and a native PNG rasterizer (`@resvg/resvg-js`) to return inline images in tool responses. This spec documents the current implementation, its known issues, and a recommended migration path toward client-side rendering.

---

## Current Architecture

### File inventory

17 source files under `src/utils/svg/`:

| File | Purpose |
|------|---------|
| `colors.ts` | Status color palette, shared constants (background, text, grid colors) |
| `types.ts` | Data types for execution summaries, timeseries, stage flows |
| `escape.ts` | XML escaping and label truncation utilities |
| `render-png.ts` | SVG-to-PNG conversion via `@resvg/resvg-js` |
| `index.ts` | Barrel exports for all renderers |
| `charts/types.ts` | Generic chart data types (bar, pie, scatter) |
| `charts/pie.ts` | Pie/donut chart renderer |
| `charts/bar.ts` | Horizontal bar chart renderer |
| `charts/scatter.ts` | Scatter plot renderer |
| `charts/index.ts` | Barrel exports for chart renderers |
| `timeline.ts` | Execution timeline (step-level Gantt-style) |
| `stage-flow.ts` | Pipeline stage flow diagram |
| `status-summary.ts` | Status summary card |
| `executions-timeseries.ts` | Stacked-bar-chart-by-day renderer used by `harness_list` (via `list-visuals.ts` for `visual_type=timeseries`) |
| `list-visuals.ts` | Aggregation logic + chart dispatch for `harness_list` (execution-only) |
| `mappers.ts` | Tool-handler-output → SVG-renderer-input mappers (e.g. diagnose result → execution summary, project-health output → status data) |
| `architecture.ts` | Pipeline YAML to architecture diagram |

### Rendering pipeline

```
Tool handler (harness_list, harness_diagnose, harness_status)
  → Aggregate execution data into chart data structures
  → Generate SVG string (hand-built, no library)
  → Rasterize via @resvg/resvg-js (native binary)
  → Base64-encode PNG buffer
  → Return as MCP image content block { type: "image", data: "...", mimeType: "image/png" }
```

### Entry points

Visualization is wired into three tools and exposed as seven discoverable visual resource types via `src/registry/toolsets/visualizations.ts` (`visual_timeline`, `visual_stage_flow`, `visual_health_dashboard`, `visual_pie_chart`, `visual_bar_chart`, `visual_timeseries`, `visual_architecture`):

- **`harness_list`** (`src/tools/harness-list.ts:41-42`): `include_visual` (boolean) and `visual_type` (`pie` | `bar` | `timeseries`) params. The `list-visuals.ts` dispatcher only renders for `resource_type=execution`; all other resource types return `null` from the visual builder.
- **`harness_diagnose`** (`src/tools/harness-diagnose.ts:46`): `include_visual` + `visual_type` (`timeline` | `flow` | `architecture`). Renders for `resource_type=pipeline` only. Auto-promotes to `architecture` when pipeline YAML is present in the result.
- **`harness_status`** (`src/tools/harness-status.ts:81`): `include_visual` (boolean). Renders a project health dashboard via `renderStatusSummarySvg` (status summary card only — no timeseries is rendered here today).

### Dependencies

- `@resvg/resvg-js` (^2.6.2) — native Node addon for SVG rasterization. Ships platform-specific `.node` binaries (~3–5 MB depending on platform; e.g. darwin-arm64 is ~3.4 MB on disk).

---

## Known Issues

### 1. Text does not render in PNG output (Critical)

`render-png.ts` configures resvg with `loadSystemFonts: false` and does not load any font files. The SVG references `'Inter', 'SF Pro Display', 'Segoe UI', system-ui` but resvg has no fonts available, so all text elements (titles, labels, legends, axis values, percentages) render as invisible empty glyphs.

The resulting charts show colored shapes with no labels — functionally useless.

```typescript
// src/utils/svg/render-png.ts — current config
const resvg = new Resvg(svgString, {
  fitTo: { mode: "zoom", value: scale },
  font: {
    loadSystemFonts: false,  // ← no fonts loaded at all
  },
});
```

### 2. Native binary portability

`@resvg/resvg-js` ships a compiled `.node` binary per platform (macOS arm64, macOS x64, Linux x64, Linux arm64, Windows). This creates issues:

- **Claude Desktop**: Uses an embedded Node.js runtime whose ABI may not match the compiled binary. `render-png.ts` uses a dynamic `import("@resvg/resvg-js")` so a load failure does not crash the server; the throw is caught one layer up at the tool call sites (`harness-list`, `harness-diagnose`, `harness-status`), which fall back to a text-only response. Visualization silently degrades to no image.
- **Docker**: Requires matching libc (glibc vs musl). Alpine-based images need `@resvg/resvg-js-linux-x64-musl`.
- **CI**: Needs platform-specific optional dependencies configured correctly in `package.json`.

### 3. Bundle size and complexity

17 source files (~1,887 LOC under `src/utils/svg/`; chart-rendering subset — `charts/` plus `executions-timeseries.ts`, `mappers.ts`, `list-visuals.ts` — is ~855 LOC) plus a native dependency to support a relatively narrow surface: chart rendering on `harness_list` is execution-only, and the diagnose/status visuals are bespoke per-tool. The volume of presentation code is unrelated to Harness API abstraction and increases the maintenance surface area of the server.

### 4. Static output, no interactivity

PNG images are static raster output. MCP clients with rich rendering capabilities cannot:

- Hover for tooltips
- Click to drill down into specific executions
- Customize colors or layout
- Resize or zoom
- Apply their own theme (light/dark mode)

Cursor has canvas support, Claude Desktop has artifacts — both can render interactive visualizations if given structured data.

### 5. Maintenance burden

Chart styling (colors, fonts, layout, grid lines) is hardcoded in SVG template strings. Any visual change requires:

1. Editing TypeScript SVG generation code
2. Rebuilding the server
3. Redeploying

This is work that belongs in a presentation layer, not a data API.

---

## Recommendation

### Short-term: Embed a portable font

Bundle a single open-source font (e.g. Inter WOFF2, ~100 KB) and load it explicitly via `Resvg`'s `fontFiles` option. This fixes the empty-glyph bug everywhere — dev laptops, Docker, Claude Desktop's embedded Node — without depending on whatever fonts happen to be installed on the host.

```typescript
font: {
  loadSystemFonts: false,
  fontFiles: [path.join(assetsDir, "Inter-Regular.woff2")],
  defaultFontFamily: "Inter",
},
```

`loadSystemFonts: true` is a tempting one-line fix but only covers the dev-laptop case — exactly the environment where this bug bites the least. Headless Docker images and Claude Desktop's embedded Node typically have no system fonts to load, so the dominant production path stays broken. Embedding the font is only marginally more work and is fully portable.

### Medium-term: Return structured chart data

Deprecate `include_visual` / `visual_type` params. Instead, return aggregated data in the JSON response that clients can render however they choose. The shape must follow the project's "no raw passthrough / identifier-named field → stable id, not a display label" rule — aggregations key on stable identifiers and carry display names alongside:

```json
{
  "items": [ ... ],
  "total": 47,
  "chart_data": {
    "status_breakdown": [
      { "status": "Success", "count": 30 },
      { "status": "Failed", "count": 12 },
      { "status": "Expired", "count": 5 }
    ],
    "daily_counts": [
      { "date": "2026-04-26", "Success": 5, "Failed": 2 },
      { "date": "2026-04-27", "Success": 8, "Failed": 1 }
    ],
    "pipeline_breakdown": [
      { "pipeline_id": "pr_checks", "pipeline_name": "PR Checks Pipeline", "count": 20 },
      { "pipeline_id": "deploy_all_services", "pipeline_name": "Deploy All Services", "count": 15 }
    ]
  }
}
```

When implemented, this shape must land as a Zod schema on the affected `EndpointSpec` and a stable `responseExtractor` projecting it — never `passthrough` (per the project's pre-push review rules).

The aggregation logic in `list-visuals.ts` (`aggregateByStatus`, `aggregateByPipeline`, `buildTimeseriesData`) is the valuable part — keep it but have it return data, not SVG.

### Long-term: Remove server-side rendering

Once `chart_data` is adopted by clients:

1. Remove `src/utils/svg/` (17 files)
2. Remove `@resvg/resvg-js` from `package.json` (eliminates native binary)
3. Remove `include_visual` / `visual_type` input schema params
4. Keep aggregation functions in a `src/utils/aggregation/` module

This reduces the server to its core job: Harness API abstraction + structured data delivery.

---

## Migration Plan

| Phase | Change | Breaking? |
|-------|--------|-----------|
| 0 | Embed Inter (or equivalent) WOFF2 and load it via `Resvg.fontFiles` | No |
| 1 | Add `chart_data` to responses alongside existing visuals | No |
| 2 | Deprecate `include_visual` / `visual_type` (log warning) | No |
| 3 | Remove SVG rendering, `@resvg/resvg-js` dependency, `include_visual`/`visual_type` params | Yes (major) |

Phase 0 can ship immediately. Phases 1–2 can ship together. Phase 3 removes documented tool-input params and is therefore a **major** semver bump (external clients — Cursor, Claude Desktop configs — may pin), not a minor one. A changelog entry plus deprecation warning lead time during Phase 2 is required.

**Phase 3 preconditions** (must be resolved before Phase 3 can ship):

- A replacement plan for `harness_diagnose` timeline / stage-flow / architecture diagrams (text representation, structured graph data, or keep SVG only for diagnose). See Open Question #1.
- A replacement plan for `harness_status` health-dashboard SVG (structured `health_summary` block).
- Audit-sink impact verified: confirm specs 004 (audit sinks) and 005 (OTel audit sink) do not depend on the `image` content-block shape today, or update them in lockstep.

---

## Open Questions

1. **Replacement for `harness_diagnose` diagrams** (Phase 3 precondition). Timeline / stage-flow / architecture visuals carry information that's awkward to express as a flat aggregation: per-step durations, dependency edges, parallel branches. Options: (a) keep SVG generation only for diagnose and remove only the chart pipeline; (b) return structured graph data (`{nodes, edges}`) and let the client render; (c) emit a text/Mermaid representation. Decision blocks Phase 3.
2. **Should `harness_status` return chart data?** The project health dashboard is a higher-level aggregation that could return structured data for all its current visual components (status breakdown, recent activity, health classification).
3. **Audit sink coupling.** The current image content blocks may flow through audit sinks (specs 004, 005) for token accounting or redaction; verify before removing.
