import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import { useEffect, useRef } from "preact/hooks";
import type { DashboardPanel } from "../../../../src/apps/view-types.js";
import { chartData, formatCompact, statusTones } from "./chart-data.js";
import type { DrillTarget } from "./dashboard-actions.js";

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend,
  LinearScale, LineController, LineElement, PointElement, Tooltip,
);

const SERIES_COUNT = 8;

let probe: HTMLSpanElement | undefined;

/** Resolve a CSS color expression (vars, light-dark()) to [r, g, b, a]; canvas cannot parse those itself. */
function rgba(expression: string): [number, number, number, number] {
  probe ??= Object.assign(document.createElement("span"), { hidden: true });
  if (!probe.isConnected) document.body.appendChild(probe);
  probe.style.color = "";
  probe.style.color = expression;
  const parts = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [];
  const [r = 128, g = 128, b = 128, a = 1] = parts;
  return [r, g, b, a];
}

function color(variable: string, alpha = 1): string {
  const [r, g, b, a] = rgba(`var(${variable})`);
  return `rgba(${r}, ${g}, ${b}, ${a * alpha})`;
}

function fontFamily(): string {
  return getComputedStyle(document.body).fontFamily || "system-ui";
}

const LABEL_MAX = 24;

/** Axis labels only; tooltips keep the full value. */
function shortLabel(label: string): string {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
}


function config(panel: DashboardPanel, onDrill: (target: DrillTarget) => void): ChartConfiguration {
  const data = chartData(panel);
  const series = (i: number, alpha = 1) => color(`--hx-series-${(i % SERIES_COUNT) + 1}`, alpha);
  const palette = Array.from({ length: SERIES_COUNT }, (_, i) => series(i));
  const text = color("--hx-text-muted");
  const grid = color("--hx-border");
  const font = { family: fontFamily(), size: 12 };
  const many = data.series.length > 1;
  const horizontal = panel.chart === "bar" && data.labels.length > 8;
  const tones = data.series.length === 1 ? statusTones(data.labels) : undefined;
  const toneColors = tones?.map((tone) => color(tone === "neutral" ? "--hx-text-muted" : `--hx-${tone}`));

  const onClick: NonNullable<ChartConfiguration["options"]>["onClick"] = (_event, elements) => {
    const hit = elements[0];
    if (!hit) return;
    const series = data.series[hit.datasetIndex];
    onDrill({
      key: data.keys[hit.index] ?? null,
      label: data.labels[hit.index] ?? "",
      series: series?.label ?? "",
      value: series?.data[hit.index] ?? null,
    });
  };

  if (panel.chart === "pie") {
    return {
      type: "doughnut",
      data: {
        labels: data.labels,
        datasets: [{ data: data.series[0]?.data ?? [], backgroundColor: toneColors ?? palette, borderColor: color("--hx-bg"), borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick,
        plugins: { legend: { position: "right", labels: { color: text, font, boxWidth: 10 } } },
      },
    };
  }

  const isArea = panel.chart === "area";
  return {
    type: panel.chart === "bar" ? "bar" : "line",
    data: {
      labels: data.labels,
      datasets: data.series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: series(i),
        backgroundColor: panel.chart === "bar" ? toneColors ?? series(i) : series(i, isArea ? 0.35 : 0.12),
        fill: isArea ? (i === 0 ? "origin" : "-1") : false,
        borderWidth: 2,
        borderRadius: panel.chart === "bar" ? 3 : 0,
        pointRadius: data.labels.length > 40 ? 0 : 2,
        tension: 0.25,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      interaction: { mode: "index", intersect: false, axis: horizontal ? "y" : "x" },
      onClick,
      scales: {
        [horizontal ? "y" : "x"]: {
          stacked: isArea,
          grid: { display: false },
          ticks: { color: text, font, maxRotation: 0, autoSkip: !horizontal, callback: (_v: string | number, i: number) => shortLabel(data.labels[i] ?? "") },
        },
        [horizontal ? "x" : "y"]: {
          stacked: isArea,
          beginAtZero: true,
          grid: { color: grid },
          ticks: { color: text, font, callback: (v: string | number) => (typeof v === "number" ? formatCompact(v) : v) },
        },
      },
      plugins: {
        legend: { display: many, position: "bottom", labels: { color: text, font, boxWidth: 10 } },
        tooltip: { callbacks: { label: (item) => ` ${item.dataset.label}: ${typeof item.raw === "number" ? item.raw.toLocaleString() : item.raw}` } },
      },
    },
  } as ChartConfiguration;
}

export function ChartPanel({ panel, version, onDrill }: { panel: DashboardPanel; version: number; onDrill: (target: DrillTarget) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drill = useRef(onDrill);
  drill.current = onDrill;

  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, config(panel, (target) => drill.current(target)));
    return () => chart.destroy();
  }, [panel, version]);

  return (
    <div class={`chart chart--${panel.chart}`}>
      <canvas ref={canvas} role="img" aria-label={`${panel.title} chart`} />
    </div>
  );
}
