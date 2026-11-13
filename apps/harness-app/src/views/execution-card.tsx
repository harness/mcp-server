import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ExecutionStageView, PipelineExecutionView } from "../../../../src/apps/view-types.js";
import { Card, StatusPill } from "../components/card.js";
import { host } from "../host.js";
import { LiveRefresh } from "./live-refresh.js";

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** Stages that run in parallel share one column of the stage bar. */
function stageColumns(stages: ExecutionStageView[]): ExecutionStageView[][] {
  const columns: ExecutionStageView[][] = [];
  for (const stage of stages) {
    const last = columns[columns.length - 1];
    if (last && stage.parallel_group && last[0]!.parallel_group === stage.parallel_group) last.push(stage);
    else columns.push([stage]);
  }
  return columns;
}

function segmentClass(stage: ExecutionStageView): string {
  if (stage.skipped) return "segment segment--skipped";
  if (!stage.started_at && stage.status.tone === "neutral") return "segment segment--pending";
  return `segment segment--${stage.status.tone}${stage.status.live ? " segment--live" : ""}`;
}

function StageIcon({ stage }: { stage: ExecutionStageView }) {
  if (stage.status.live) return <span class={`icon icon--spin icon--${stage.status.tone}`} aria-label={stage.status.label} />;
  const glyph = stage.status.tone === "danger" ? "✕" : stage.status.tone === "success" ? "✓" : "•";
  return <span class={`icon icon--${stage.status.tone}`} aria-label={stage.status.label}>{glyph}</span>;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function useLiveRefresh(view: PipelineExecutionView): { paused: boolean; resume: () => void } {
  const [paused, setPaused] = useState(false);
  const controller = useRef<LiveRefresh | undefined>(undefined);
  controller.current ??= new LiveRefresh({ refresh: (v) => host.refresh(v.refresh!), onPausedChange: setPaused });

  useEffect(() => controller.current!.update(view), [view]);
  useEffect(() => () => controller.current!.stop(), []);

  return { paused: paused && !view.terminal, resume: () => controller.current!.resume() };
}

function positionText(view: PipelineExecutionView, stage: ExecutionStageView | undefined): string {
  const parts: string[] = [];
  const index = view.current_stage_index;
  if (index !== undefined && view.stages.length > 0) parts.push(`stage ${index + 1}/${view.stages.length}`);
  if (stage?.steps_total) parts.push(`step ${Math.min((stage.steps_done ?? 0) + (stage.status.live ? 1 : 0), stage.steps_total)}/${stage.steps_total}`);
  const skipped = view.stages.filter((s) => s.skipped).length;
  if (skipped > 0) parts.push(`${skipped} skipped`);
  return parts.join(" · ");
}

function footerText(view: PipelineExecutionView, paused: boolean): string {
  if (paused) return "Live updates paused after an hour · Refresh to resume";
  const parts: string[] = [];
  if (view.scope.org && view.scope.project) parts.push(`${view.scope.org} / ${view.scope.project}`);
  if (view.trigger?.by) parts.push(`${view.trigger.type ? `${view.trigger.type.toLowerCase()} ` : ""}by ${view.trigger.by}`);
  else if (!parts.length && view.pipeline.identifier) parts.push(view.pipeline.identifier);
  return parts.join(" · ");
}

function StageDetails({ view, now }: { view: PipelineExecutionView; now: number }) {
  return (
    <ol class="details">
      {view.stages.map((stage) => (
        <li key={stage.id} class="details__row">
          <StageIcon stage={stage} />
          <span class="details__name" title={stage.name}>{stage.name}</span>
          <span class="details__meta">
            {stage.steps_total ? `${stage.steps_done ?? 0}/${stage.steps_total} steps` : ""}
            {stage.started_at ? ` · ${formatElapsed((stage.ended_at ?? now) - stage.started_at)}` : ""}
          </span>
          <StatusPill status={stage.status} />
          {stage.failure_message && <p class="details__failure">{stage.failure_message}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ExecutionCard({ view }: { view: PipelineExecutionView }) {
  const [expanded, setExpanded] = useState(false);
  const live = useLiveRefresh(view);
  const now = useNow(!view.terminal && view.started_at !== undefined);
  const columns = useMemo(() => stageColumns(view.stages), [view.stages]);
  const current = view.current_stage_index !== undefined ? view.stages[view.current_stage_index] : undefined;

  const elapsed = view.started_at ? formatElapsed((view.ended_at ?? (view.terminal ? view.started_at : now)) - view.started_at) : undefined;
  const title = view.pipeline.name ?? view.pipeline.identifier ?? "Pipeline execution";
  const failed = view.status.tone === "danger";

  const onDiagnose = () => {
    const scope = view.scope.org && view.scope.project ? ` in org ${view.scope.org}, project ${view.scope.project}` : "";
    void host.sendMessage(`Diagnose Harness pipeline execution ${view.execution_id}${scope}.`);
  };

  return (
    <Card
      title={title}
      badge={view.run_sequence !== undefined ? `#${view.run_sequence}` : undefined}
      status={view.status}
      aside={elapsed && <span class="timer">{elapsed}</span>}
      footer={footerText(view, live.paused)}
      openInHarness={view.open_in_harness}
      openLabel={view.awaiting_action ? "Approve in Harness" : undefined}
      refresh={view.refresh}
      onRefreshed={live.resume}
      actions={
        <>
          {failed && (
            <button type="button" class="btn btn--ghost" onClick={onDiagnose}>Diagnose</button>
          )}
          {view.stages.length > 0 && (
            <button type="button" class="btn btn--ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide details" : "Details"}
            </button>
          )}
        </>
      }
    >
      {current && (
        <div class="active">
          <span class="active__stage">
            <StageIcon stage={current} />
            <span class="active__name" title={current.name}>{current.name}</span>
            {current.current_step && (
              <>
                <span class="active__sep" aria-hidden="true">›</span>
                <span class="active__step" title={current.current_step}>{current.current_step}</span>
              </>
            )}
          </span>
          <span class="active__position">{positionText(view, current)}</span>
        </div>
      )}

      {columns.length > 0 && (
        <div class="stages" role="list" aria-label="Stages">
          {columns.map((column) => (
            <div key={column[0]!.id} class="stages__column" role="listitem">
              <div class="stages__bar">
                {column.map((stage) => (
                  <span key={stage.id} class={segmentClass(stage)} title={`${stage.name}: ${stage.status.label}`} />
                ))}
              </div>
              <span
                class={`stages__name${current && column.includes(current) ? " stages__name--active" : ""}`}
                title={column.map((s) => s.name).join(" | ")}
              >
                {column.map((s) => s.name).join(" | ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {view.stages.length === 0 && !view.terminal && <p class="placeholder">Loading stages…</p>}

      {view.failure && (
        <div class="failure" role="alert">
          {(view.failure.stage || view.failure.step) && (
            <span class="failure__where">{[view.failure.stage, view.failure.step].filter(Boolean).join(" › ")}</span>
          )}
          <p class={`failure__message${expanded ? "" : " failure__message--clamped"}`}>{view.failure.message}</p>
        </div>
      )}

      {expanded && <StageDetails view={view} now={now} />}
    </Card>
  );
}
