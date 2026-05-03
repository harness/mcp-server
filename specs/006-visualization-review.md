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
| `executions-timeseries.ts` | Stacked bar chart by day |
| `list-visuals.ts` | Aggregation logic + chart dispatch for `harness_list` |
| `mappers.ts` | Data mappers from API responses to chart data types |
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

- **`harness_list`**: `include_visual` (boolean) and `visual_type` (`pie` | `bar` | `timeseries`) params. Only supported for `execution` resource type; returns `null` for all others.
- **`harness_diagnose`**: Generates timeline and stage-flow diagrams for failed executions.
- **`harness_status`**: Project health dashboard with status summary and timeseries.

### Dependencies

- `@resvg/resvg-js` (^2.6.2) — native Node addon for SVG rasterization. Ships platform-specific `.node` binary (~5MB per platform).

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

- **Claude Desktop**: Uses an embedded Node.js runtime whose ABI may not match the compiled binary. The code uses dynamic import to avoid crashing the server, but visualization silently fails.
- **Docker**: Requires matching libc (glibc vs musl). Alpine-based images need `@resvg/resvg-js-linux-x64-musl`.
- **CI**: Needs platform-specific optional dependencies configured correctly in `package.json`.

### 3. Bundle size and complexity

17 source files and a native dependency for a feature that only supports one resource type (`execution`) on one tool (`harness_list`). The chart rendering code (~800 lines) is unrelated to Harness API abstraction and increases the maintenance surface area of the server.

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

### Short-term: Fix font loading

Change `loadSystemFonts` to `true` in `render-png.ts` so charts at least render text on systems with installed fonts:

```typescript
font: {
  loadSystemFonts: true,
},
```

This is a one-line fix that makes existing charts usable where system fonts are available. It does not solve the portability issue (headless Docker, Claude Desktop embedded Node).

### Medium-term: Return structured chart data

Deprecate `include_visual` / `visual_type` params. Instead, return aggregated data in the JSON response that clients can render however they choose:

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
      { "pipeline": "PR Checks Pipeline", "count": 20 },
      { "pipeline": "Deploy All Services", "count": 15 }
    ]
  }
}
```

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
| 0 | Fix `loadSystemFonts: true` | No |
| 1 | Add `chart_data` to responses alongside existing visuals | No |
| 2 | Deprecate `include_visual` / `visual_type` (log warning) | No |
| 3 | Remove SVG rendering, `@resvg/resvg-js` dependency | Yes (minor) |

Phase 0 can ship immediately. Phases 1-2 can ship together. Phase 3 requires a semver minor bump and changelog entry.

---

## Open Questions

1. **Should `harness_diagnose` keep its timeline/stage-flow diagrams?** These are more architectural than chart data and harder to express as structured JSON. They may warrant keeping SVG generation for diagnostic visuals specifically, or replacing with a text-based representation.
2. **Should `harness_status` return chart data?** The project health dashboard is a higher-level aggregation that could return structured data for all its current visual components.
3. **Font embedding as an alternative?** Instead of `loadSystemFonts: true`, we could embed a small open-source font (e.g., Inter WOFF2, ~100KB) for fully portable rendering. This fixes Docker/CI but doesn't address the fundamental architecture concern.
