import type { DashboardColumn, DashboardPanel, PanelCell, StatusTone } from "../../../../src/apps/view-types.js";

const MAX_SERIES = 8;

export interface Series {
  label: string;
  data: (number | null)[];
}

export interface ChartData {
  labels: string[];
  series: Series[];
  /** Original x values, used for drill-down messages. */
  keys: PanelCell[];
}

const number = (value: PanelCell): number | null => {
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

function timeValue(value: PanelCell): number {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  return Date.parse(String(value));
}

export function formatTime(value: PanelCell): string {
  const ms = timeValue(value);
  if (Number.isNaN(ms)) return String(value);
  const date = new Date(ms);
  const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
  return date.toLocaleString(undefined, hasTime
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" });
}

export function formatCell(value: PanelCell, column?: DashboardColumn): string {
  if (value === null) return "—";
  if (column?.kind === "time") return formatTime(value);
  if (column?.kind === "number") {
    const n = number(value);
    return n === null ? String(value) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

export function formatCompact(value: number): string {
  return value.toLocaleString(undefined, { notation: Math.abs(value) >= 10_000 ? "compact" : "standard", maximumFractionDigits: 2 });
}

function indexOf(panel: DashboardPanel, kind: DashboardColumn["kind"]): number {
  return panel.columns.findIndex((c) => c.kind === kind);
}

function numericIndexes(panel: DashboardPanel): number[] {
  return panel.columns.flatMap((c, i) => (c.kind === "number" ? [i] : []));
}

/** Line: x = time, one series per numeric column, sorted by time. */
function lineData(panel: DashboardPanel): ChartData {
  const x = indexOf(panel, "time");
  const rows = [...panel.rows].sort((a, b) => timeValue(a[x] ?? null) - timeValue(b[x] ?? null));
  return {
    labels: rows.map((r) => formatTime(r[x] ?? null)),
    keys: rows.map((r) => r[x] ?? null),
    series: numericIndexes(panel).slice(0, MAX_SERIES).map((i) => ({ label: panel.columns[i]!.name, data: rows.map((r) => number(r[i] ?? null)) })),
  };
}

/** Area: x = time, one stacked series per category (top 8 by total, the rest as Other). */
function areaData(panel: DashboardPanel): ChartData {
  const x = indexOf(panel, "time");
  const c = indexOf(panel, "category");
  const y = numericIndexes(panel)[0]!;
  const times = [...new Set(panel.rows.map((r) => r[x] ?? null))].sort((a, b) => timeValue(a) - timeValue(b));
  const totals = new Map<string, number>();
  for (const row of panel.rows) {
    const key = String(row[c] ?? "—");
    totals.set(key, (totals.get(key) ?? 0) + (number(row[y] ?? null) ?? 0));
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const top = new Set(ranked.slice(0, MAX_SERIES - 1));
  const hasOther = ranked.length > MAX_SERIES - 1;
  const names = [...top, ...(hasOther ? ["Other"] : [])];
  const cells = new Map(names.map((n) => [n, new Map<PanelCell, number>()]));
  for (const row of panel.rows) {
    const raw = String(row[c] ?? "—");
    const name = top.has(raw) ? raw : "Other";
    const bucket = cells.get(name)!;
    const t = row[x] ?? null;
    bucket.set(t, (bucket.get(t) ?? 0) + (number(row[y] ?? null) ?? 0));
  }
  return {
    labels: times.map(formatTime),
    keys: times,
    series: names.map((name) => ({ label: name, data: times.map((t) => cells.get(name)!.get(t) ?? 0) })),
  };
}

/** Bar and pie: x = category, sorted by the first numeric column, descending. */
function categoryData(panel: DashboardPanel): ChartData {
  const x = Math.max(indexOf(panel, "category"), 0);
  const ys = numericIndexes(panel).slice(0, MAX_SERIES);
  const rows = [...panel.rows].sort((a, b) => (number(b[ys[0]!] ?? null) ?? 0) - (number(a[ys[0]!] ?? null) ?? 0));
  return {
    labels: rows.map((r) => String(r[x] ?? "—")),
    keys: rows.map((r) => r[x] ?? null),
    series: ys.map((i) => ({ label: panel.columns[i]!.name, data: rows.map((r) => number(r[i] ?? null)) })),
  };
}

const STATUS_TONES: Array<[RegExp, StatusTone]> = [
  [/^(success|succeeded|passed|completed)$/, "success"],
  [/^(failed|failure|errored|error|expired|approvalrejected|rejected)$/, "danger"],
  [/^(running|asyncwaiting|taskwaiting|inprogress)$/, "info"],
  [/(waiting|queued|paused|ignorefailed|pending)/, "warning"],
  [/^(aborted|abortedbyfreeze|skipped|cancelled|canceled|notstarted|suspended)$/, "neutral"],
];

/** Status colours for category labels, when every label is a known status (SUCCESS, FAILED, …). */
export function statusTones(labels: string[]): StatusTone[] | undefined {
  if (labels.length === 0) return undefined;
  const tones = labels.map((label) => {
    const key = label.toLowerCase().replace(/[\s_-]/g, "");
    return STATUS_TONES.find(([pattern]) => pattern.test(key))?.[1];
  });
  return tones.every((t): t is StatusTone => t !== undefined) ? tones : undefined;
}

export function chartData(panel: DashboardPanel): ChartData {
  if (panel.chart === "line") return lineData(panel);
  if (panel.chart === "area") return areaData(panel);
  return categoryData(panel);
}

/** One-line summary per panel for ui/update-model-context. */
export function summarizePanel(panel: DashboardPanel): string {
  if (panel.error) return `${panel.title}: query failed (${panel.error})`;
  if (panel.rows.length === 0) return `${panel.title}: no rows`;
  const partial = panel.truncated || panel.capped ? " (partial result)" : "";
  if (panel.chart === "kpi") return `${panel.title}: ${formatCell(panel.rows[0]![0] ?? null, panel.columns[0])}`;
  if (panel.chart === "bar" || panel.chart === "pie") {
    const data = categoryData(panel);
    const first = data.series[0];
    return `${panel.title}: ${data.labels.length} ${panel.columns[0]?.name ?? "groups"}; highest ${data.labels[0]} (${first?.data[0] ?? "—"} ${first?.label ?? ""})${partial}`;
  }
  if (panel.chart === "line" || panel.chart === "area") {
    const data = chartData(panel);
    const latest = data.series.map((s) => `${s.label} ${s.data[s.data.length - 1] ?? "—"}`).slice(0, 3).join(", ");
    return `${panel.title}: ${data.labels.length} points from ${data.labels[0]} to ${data.labels[data.labels.length - 1]}; latest ${latest}${partial}`;
  }
  return `${panel.title}: ${panel.row_count} rows (${panel.columns.map((c) => c.name).join(", ")})${partial}`;
}
