/**
 * Knowledge Graph dashboard view model: one panel per HQL query result, with a
 * chart picked from the result shape unless the agent passes a hint.
 */

import { asRecord, asString, isRecord } from "../utils/type-guards.js";
import type {
  ColumnKind,
  DashboardColumn,
  DashboardPanel,
  KgDashboardView,
  PanelCell,
  PanelChart,
} from "./view-types.js";

/** Rows sent to the view per panel; the text result keeps every row. */
export const PANEL_ROW_CAP = 500;
const BAR_MAX_ROWS = 25;
const PIE_MAX_ROWS = 8;
const CHARTS = new Set<PanelChart>(["kpi", "line", "area", "bar", "pie", "table"]);

const TIME_NAME = /(^|_)(time|timestamp|date|day|week|month|year|hour|created_at|updated_at|started_at|ended_at|ts)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

export interface PanelHint {
  title?: string;
  chart?: string;
}

export interface DashboardHint extends PanelHint {
  panels?: PanelHint[];
}

export interface QueryOptions {
  timeout_ms?: number;
  max_results?: number;
}

export interface QueryResultInput {
  query_string: string;
  /** Execution options the query ran with; re-runs send the same ones. */
  options?: QueryOptions;
  result?: unknown;
  error?: string;
}

/** Unwrap protobuf-style cells ({ string_value: "x" }) to scalars. */
function cellValue(cell: unknown): PanelCell {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return cell;
  const record = asRecord(cell);
  if (record) {
    const values = Object.values(record);
    if (values.length === 1) return cellValue(values[0]);
    if ("value" in record) return cellValue(record.value);
  }
  return JSON.stringify(cell);
}

function normalizeRows(rawRows: unknown, names: string[]): PanelCell[][] {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.map((row) => {
    if (Array.isArray(row)) return row.map(cellValue);
    const record = asRecord(row);
    if (record && Array.isArray(record.values)) return record.values.map(cellValue);
    if (record) return names.map((name) => cellValue(record[name]));
    return [cellValue(row)];
  });
}

function isNumeric(value: PanelCell): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

function looksLikeTime(value: PanelCell): boolean {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

function columnKind(name: string, declared: string | undefined, values: PanelCell[]): ColumnKind {
  const type = declared?.toLowerCase() ?? "";
  if (/time|date/.test(type)) return "time";
  if (/int|long|float|double|decimal|number|numeric/.test(type)) return TIME_NAME.test(name) ? "time" : "number";
  const present = values.filter((v) => v !== null);
  if (present.length === 0) return "category";
  if (present.every(looksLikeTime)) return "time";
  if (present.every(isNumeric)) return TIME_NAME.test(name) && present.every((v) => Number(v) > 1e9) ? "time" : "number";
  return "category";
}

/** Default chart for a result shape (spec: KPI, line, area, bar, table). */
export function inferChart(columns: DashboardColumn[], rowCount: number): PanelChart {
  const numbers = columns.filter((c) => c.kind === "number").length;
  const times = columns.filter((c) => c.kind === "time").length;
  const categories = columns.filter((c) => c.kind === "category").length;
  if (rowCount === 0) return "table";
  if (rowCount === 1 && columns.length === 1 && numbers === 1) return "kpi";
  if (times === 1 && numbers >= 1 && categories === 0) return "line";
  if (times === 1 && categories === 1 && numbers === 1) return "area";
  if (times === 0 && categories === 1 && numbers >= 1 && rowCount <= BAR_MAX_ROWS) return "bar";
  return "table";
}

/** A hint wins only when the data can be drawn that way; otherwise fall back to the inferred chart. */
function resolveChart(hint: string | undefined, columns: DashboardColumn[], rowCount: number): PanelChart {
  const inferred = inferChart(columns, rowCount);
  const chart = hint?.toLowerCase() as PanelChart | undefined;
  if (!chart || !CHARTS.has(chart)) return inferred;
  const numbers = columns.filter((c) => c.kind === "number").length;
  const times = columns.filter((c) => c.kind === "time").length;
  const categories = columns.filter((c) => c.kind === "category").length;
  if (chart === "table") return "table";
  if (numbers === 0 || rowCount === 0) return inferred;
  if (chart === "kpi") return rowCount === 1 ? "kpi" : inferred;
  if (chart === "pie") return columns.length === 2 && categories === 1 && numbers === 1 && rowCount <= PIE_MAX_ROWS ? "pie" : inferred;
  if (chart === "line") return times === 1 ? "line" : inferred;
  if (chart === "area") return times === 1 && categories === 1 ? "area" : inferred;
  return categories >= 1 && times === 0 ? "bar" : inferred;
}

function defaultTitle(query: string, index: number): string {
  const type = /find\s+\w+\s+"([^"]+)"/i.exec(query)?.[1];
  if (!type) return `Query ${index + 1}`;
  const name = type.split(":").pop()!.replace(/_/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function panelRefresh(query: string, options: QueryOptions | undefined, hint: PanelHint | undefined): DashboardPanel["refresh"] {
  const view: Record<string, string> = {};
  if (hint?.title) view.title = hint.title;
  if (hint?.chart) view.chart = hint.chart;
  return {
    tool: "harness_execute",
    arguments: {
      resource_type: "hql_query",
      action: "run",
      body: { query_string: query, ...(options?.timeout_ms != null ? { timeout_ms: options.timeout_ms } : {}), ...(options?.max_results != null ? { max_results: options.max_results } : {}) },
      ...(Object.keys(view).length > 0 ? { params: { view } } : {}),
    },
  };
}

export function buildPanel(input: QueryResultInput, index: number, hint?: PanelHint): DashboardPanel {
  const title = hint?.title?.trim() || defaultTitle(input.query_string, index);
  const base = { id: `p${index}`, title, query_string: input.query_string, refresh: panelRefresh(input.query_string, input.options, hint) };
  const result = asRecord(input.result);
  if (input.error || !result) {
    return { ...base, chart: "table", columns: [], rows: [], row_count: 0, error: input.error ?? "No result" };
  }

  const rawColumns = Array.isArray(result.columns) ? result.columns : [];
  const names = rawColumns.map((c, i) => asString(asRecord(c)?.name) ?? (typeof c === "string" ? c : `column_${i + 1}`));
  const allRows = normalizeRows(result.rows, names);
  const width = Math.max(names.length, ...allRows.slice(0, 1).map((r) => r.length));
  while (names.length < width) names.push(`column_${names.length + 1}`);

  const rows = allRows.slice(0, PANEL_ROW_CAP);
  const columns: DashboardColumn[] = names.map((name, i) => {
    const declared = asRecord(rawColumns[i]);
    const type = asString(declared?.type) ?? asString(declared?.data_type) ?? asString(declared?.dataType);
    return { name, kind: columnKind(name, type, rows.map((r) => r[i] ?? null)) };
  });

  const panel: DashboardPanel = {
    ...base,
    chart: resolveChart(hint?.chart, columns, rows.length),
    columns,
    rows,
    row_count: allRows.length,
  };
  if (result.truncated === true) panel.truncated = true;
  if (allRows.length > rows.length) panel.capped = true;
  return panel;
}

function readHint(raw: unknown): DashboardHint | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const hint: DashboardHint = {};
  const title = asString(record.title);
  const chart = asString(record.chart);
  if (title) hint.title = title;
  if (chart) hint.chart = chart;
  if (Array.isArray(record.panels)) {
    hint.panels = record.panels.map((p) => {
      const panel = asRecord(p);
      return { title: asString(panel?.title), chart: asString(panel?.chart) };
    });
  }
  return hint;
}

/** Single hql_query.run result. The hint's title and chart apply to the panel. */
export function buildSingleQueryDashboard(query: string, result: unknown, rawHint: unknown, options?: QueryOptions): KgDashboardView | undefined {
  if (!query || !isRecord(result)) return undefined;
  const hint = readHint(rawHint);
  return { kind: "kg_dashboard", panels: [buildPanel({ query_string: query, options, result }, 0, hint)] };
}

/** Batch result: the hint's title names the dashboard and `panels[i]` applies to query i. */
export function buildBatchDashboard(results: QueryResultInput[], rawHint: unknown): KgDashboardView | undefined {
  if (results.length === 0) return undefined;
  const hint = readHint(rawHint);
  const view: KgDashboardView = {
    kind: "kg_dashboard",
    panels: results.map((r, i) => buildPanel(r, i, hint?.panels?.[i])),
  };
  if (hint?.title) view.title = hint.title;
  return view;
}
