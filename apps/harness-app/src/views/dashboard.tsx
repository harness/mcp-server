import { useEffect, useMemo, useState } from "preact/hooks";
import type { DashboardColumn, DashboardPanel, KgDashboardView, PanelCell } from "../../../../src/apps/view-types.js";
import { host } from "../host.js";
import { ChartPanel, type DrillTarget } from "./chart-panel.js";
import { formatCell, summarizePanel } from "./chart-data.js";

const FULLSCREEN_MIN_PANELS = 5;

function useContextVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => host.onContextChange(() => setVersion((v) => v + 1)), []);
  return version;
}

function compare(a: PanelCell, b: PanelCell, column: DashboardColumn): number {
  if (a === null) return 1;
  if (b === null) return -1;
  if (column.kind === "number") return Number(a) - Number(b);
  if (column.kind === "time") return Date.parse(String(a)) - Date.parse(String(b));
  return String(a).localeCompare(String(b));
}

function DataTable({ panel }: { panel: DashboardPanel }) {
  const [sort, setSort] = useState<{ index: number; desc: boolean } | undefined>();
  const rows = useMemo(() => {
    if (!sort) return panel.rows;
    const column = panel.columns[sort.index]!;
    const sorted = [...panel.rows].sort((a, b) => compare(a[sort.index] ?? null, b[sort.index] ?? null, column));
    return sort.desc ? sorted.reverse() : sorted;
  }, [panel, sort]);

  return (
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            {panel.columns.map((column, index) => (
              <th
                key={column.name}
                class={column.kind === "number" ? "num" : undefined}
                aria-sort={sort?.index === index ? (sort.desc ? "descending" : "ascending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => setSort({ index, desc: sort?.index === index ? !sort.desc : column.kind === "number" })}
                >
                  {column.name}
                  {sort?.index === index ? (sort.desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {panel.columns.map((column, c) => (
                <td key={column.name} class={column.kind === "number" ? "num" : undefined}>{formatCell(row[c] ?? null, column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ panel }: { panel: DashboardPanel }) {
  return (
    <div class="kpi">
      <span class="kpi__value">{formatCell(panel.rows[0]?.[0] ?? null, panel.columns[0])}</span>
      <span class="kpi__label">{panel.columns[0]?.name}</span>
    </div>
  );
}

function notice(panel: DashboardPanel): string | undefined {
  if (panel.truncated) return `Partial result: first ${panel.row_count.toLocaleString()} rows from the engine. Totals are not shown.`;
  if (panel.capped) return `Showing ${panel.rows.length.toLocaleString()} of ${panel.row_count.toLocaleString()} rows.`;
  return undefined;
}

function Panel({ panel, version, onReplace }: { panel: DashboardPanel; version: number; onReplace: (next: DashboardPanel) => void }) {
  const [asTable, setAsTable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const chartable = panel.chart !== "table" && panel.chart !== "kpi" && !panel.error && panel.rows.length > 0;
  // A KPI on a partial result would present a prefix as a total.
  const showKpi = panel.chart === "kpi" && !panel.truncated;
  const message = notice(panel);

  const rerun = async () => {
    if (!panel.refresh || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await host.fetchView(panel.refresh);
      const fresh = next?.kind === "kg_dashboard" ? next.panels[0] : undefined;
      if (!fresh) throw new Error("Query returned no result");
      onReplace({ ...fresh, id: panel.id, title: panel.title });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed");
    } finally {
      setBusy(false);
    }
  };

  const drill = (target: DrillTarget) => {
    const value = target.value === null ? "" : ` (${target.series}: ${target.value.toLocaleString()})`;
    void host.sendMessage(
      `Drill into "${panel.title}" for ${target.label}${value}. Base query: ${panel.query_string}`,
    );
  };

  return (
    <section class={`panel${panel.chart === "kpi" ? " panel--kpi" : ""}`} aria-label={panel.title}>
      <header class="panel__header">
        <h2 class="panel__title" title={panel.query_string}>{panel.title}</h2>
        <div class="panel__actions">
          {chartable && (
            <button type="button" class="btn btn--ghost btn--sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
              {asTable ? "Chart" : "Table"}
            </button>
          )}
          {panel.refresh && (
            <button type="button" class="btn btn--ghost btn--sm" onClick={rerun} disabled={busy}>
              {busy ? "Running…" : "Re-run"}
            </button>
          )}
        </div>
      </header>
      {panel.error ? (
        <p class="panel__error" role="alert">{panel.error}</p>
      ) : panel.rows.length === 0 ? (
        <p class="placeholder">No rows.</p>
      ) : showKpi ? (
        <Kpi panel={panel} />
      ) : chartable && !asTable ? (
        <ChartPanel panel={panel} version={version} onDrill={drill} />
      ) : (
        <DataTable panel={panel} />
      )}
      {(message || error) && <p class="panel__notice">{error ?? message}</p>}
    </section>
  );
}

export function Dashboard({ view }: { view: KgDashboardView }) {
  const [panels, setPanels] = useState(view.panels);
  const version = useContextVersion();
  useEffect(() => setPanels(view.panels), [view]);

  useEffect(() => {
    const lines = panels.map(summarizePanel);
    const heading = view.title ? `Harness dashboard "${view.title}" shown to the user:` : "Harness query results shown to the user:";
    void host.updateModelContext([heading, ...lines.map((l) => `- ${l}`)].join("\n")).catch(() => undefined);
  }, [panels, view.title]);

  const single = panels.length === 1;
  const fullscreen = panels.length >= FULLSCREEN_MIN_PANELS && host.canFullscreen();
  const inFullscreen = host.displayMode() === "fullscreen";

  return (
    <article class={`dashboard${single ? " dashboard--single" : ""}`}>
      {(view.title || fullscreen) && (
        <header class="dashboard__header">
          {view.title && <h1 class="card__title"><span class="card__title-text">{view.title}</span></h1>}
          {fullscreen && (
            <button type="button" class="btn btn--outline" onClick={() => void host.toggleFullscreen().catch(() => undefined)}>
              {inFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          )}
        </header>
      )}
      <div class="dashboard__grid">
        {panels.map((panel, i) => (
          <Panel
            key={panel.id}
            panel={panel}
            version={version}
            onReplace={(next) => setPanels((current) => current.map((p, j) => (j === i ? next : p)))}
          />
        ))}
      </div>
    </article>
  );
}
