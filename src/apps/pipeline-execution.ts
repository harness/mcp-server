/**
 * Pipeline execution view model for the MCP Apps execution card.
 *
 * Built from the execution v2 response (`pipelineExecutionSummary` +
 * `executionGraph`): stages from the layout graph, step counts from the node map.
 */

import { asNumber, asRecord, asString, isRecord } from "../utils/type-guards.js";
import { TERMINAL_STATUSES } from "../utils/poll-execution.js";
import { canonicalStatus, viewStatus } from "./mcp-apps.js";
import type { ExecutionStageView, PipelineExecutionView, ViewRefresh } from "./view-types.js";

export const EXECUTION_DEEP_LINK =
  "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/deployments/{planExecutionId}/pipeline";

export interface ExecutionViewContext {
  orgId?: string;
  projectId?: string;
  /** Registry deep-link builder (base URL and account applied). */
  deepLink: (template: string, params: Record<string, string>) => string | undefined;
}

/** Open in Harness link; undefined without org and project, where the link would be wrong. */
function executionLink(ctx: ExecutionViewContext, pipelineId: string | undefined, executionId: string): string | undefined {
  if (!pipelineId || !ctx.orgId || !ctx.projectId) return undefined;
  return ctx.deepLink(EXECUTION_DEEP_LINK, {
    orgIdentifier: ctx.orgId,
    projectIdentifier: ctx.projectId,
    pipelineIdentifier: pipelineId,
    planExecutionId: executionId,
  });
}

const AWAITING_ACTION = new Set(["ApprovalWaiting", "InterventionWaiting", "InputWaiting", "WaitingOnApproval"]);
const STEP_DONE = new Set([...TERMINAL_STATUSES]);
const CONTAINER_STEP_TYPES = new Set(["STEP_GROUP", "NG_SECTION", "NG_EXECUTION", "NG_FORK", "STAGES_STEP", "PIPELINE_SECTION"]);
/** Harness-internal setup steps that the Harness UI does not count as pipeline steps. */
const INTERNAL_STEP_TYPES = new Set(["liteEngineTask", "LITE_ENGINE_TASK", "InitializeContainer"]);

interface LayoutNode {
  nodeType?: string;
  nodeGroup?: string;
  nodeIdentifier?: string;
  name?: string;
  status?: string;
  startTs?: number;
  endTs?: number;
  failureInfo?: { message?: string };
  edgeLayoutList?: { currentNodeChildren?: string[]; nextIds?: string[] };
}

interface GraphNode {
  name?: string;
  identifier?: string;
  baseFqn?: string;
  status?: string;
  stepType?: string;
  startTs?: number;
  failureInfo?: { message?: string };
}

function refreshFor(executionId: string, ctx: ExecutionViewContext): ViewRefresh {
  const args: Record<string, unknown> = { resource_type: "execution", resource_id: executionId, params: { render_full_graph: true } };
  if (ctx.orgId) args.org_id = ctx.orgId;
  if (ctx.projectId) args.project_id = ctx.projectId;
  return { tool: "harness_get", arguments: args };
}

function walkStages(layout: Record<string, LayoutNode>, startId: string): Array<{ node: LayoutNode; id: string; group?: string }> {
  const stages: Array<{ node: LayoutNode; id: string; group?: string }> = [];
  const visited = new Set<string>();

  const walk = (nodeId: string, group?: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = layout[nodeId];
    if (!node) return;
    const children = node.edgeLayoutList?.currentNodeChildren ?? [];
    if (node.nodeType?.toLowerCase() === "parallel") {
      for (const child of children) walk(child, nodeId);
    } else if (node.nodeGroup === "STAGE") {
      stages.push({ node, id: node.nodeIdentifier ?? nodeId, group });
    } else {
      for (const child of children) walk(child, group);
    }
    for (const next of node.edgeLayoutList?.nextIds ?? []) walk(next);
  };

  walk(startId);
  return stages;
}

function stepsByStage(nodeMap: Record<string, GraphNode> | undefined): Map<string, GraphNode[]> {
  const byStage = new Map<string, GraphNode[]>();
  if (!nodeMap) return byStage;
  for (const node of Object.values(nodeMap)) {
    const fqn = node.baseFqn ?? "";
    const match = /^pipeline\.stages\.([^.]+)\..*\.steps\.[^.]+$/.exec(fqn);
    if (!match || CONTAINER_STEP_TYPES.has(node.stepType ?? "") || INTERNAL_STEP_TYPES.has(node.stepType ?? "")) continue;
    const list = byStage.get(match[1]!) ?? [];
    list.push(node);
    byStage.set(match[1]!, list);
  }
  for (const list of byStage.values()) list.sort((a, b) => (a.startTs ?? Infinity) - (b.startTs ?? Infinity));
  return byStage;
}

function stageView(entry: { node: LayoutNode; id: string; group?: string }, steps: GraphNode[] | undefined): ExecutionStageView {
  const { node, id, group } = entry;
  const raw = node.status ?? "NotStarted";
  const stage: ExecutionStageView = {
    id,
    name: node.name ?? id,
    status: viewStatus(raw) ?? { label: raw, tone: "neutral" },
  };
  if (group) stage.parallel_group = group;
  if (raw === "Skipped") stage.skipped = true;
  if (node.startTs) stage.started_at = node.startTs;
  if (node.endTs) stage.ended_at = node.endTs;
  const stageFailure = node.failureInfo?.message?.trim();
  if (stageFailure) stage.failure_message = stageFailure;
  if (steps?.length) {
    stage.steps_total = steps.length;
    stage.steps_done = steps.filter((s) => STEP_DONE.has(canonicalStatus(s.status ?? ""))).length;
    const current = steps.find((s) => viewStatus(s.status)?.live);
    if (current) stage.current_step = current.name ?? current.identifier;
  }
  return stage;
}

function currentStageIndex(stages: ExecutionStageView[]): number | undefined {
  const live = stages.findIndex((s) => s.status.live && s.started_at);
  if (live >= 0) return live;
  const failed = stages.findIndex((s) => s.status.tone === "danger");
  if (failed >= 0) return failed;
  for (let i = stages.length - 1; i >= 0; i--) if (stages[i]!.started_at) return i;
  return stages.length > 0 ? 0 : undefined;
}

/** Full view from an execution v2 get response. Undefined when the response is not an execution. */
export function buildPipelineExecutionView(raw: unknown, ctx: ExecutionViewContext): PipelineExecutionView | undefined {
  const root = asRecord(raw);
  const pes = asRecord(root?.pipelineExecutionSummary);
  const executionId = asString(pes?.planExecutionId);
  if (!pes || !executionId) return undefined;

  const rawStatus = asString(pes.status) ?? "Running";
  const pipelineId = asString(pes.pipelineIdentifier);
  const orgId = asString(pes.orgIdentifier) ?? ctx.orgId;
  const projectId = asString(pes.projectIdentifier) ?? ctx.projectId;
  const scoped = { ...ctx, orgId, projectId };

  const layout = isRecord(pes.layoutNodeMap) ? (pes.layoutNodeMap as Record<string, LayoutNode>) : undefined;
  const startId = asString(pes.startingNodeId);
  const graph = asRecord(root?.executionGraph);
  const nodeMap = isRecord(graph?.nodeMap) ? (graph.nodeMap as Record<string, GraphNode>) : undefined;
  const steps = stepsByStage(nodeMap);
  const stages = layout && startId ? walkStages(layout, startId).map((entry) => stageView(entry, steps.get(entry.id))) : [];

  const view: PipelineExecutionView = {
    kind: "pipeline_execution",
    execution_id: executionId,
    pipeline: { name: asString(pes.name), identifier: pipelineId },
    scope: { org: orgId, project: projectId },
    status: viewStatus(rawStatus) ?? { label: rawStatus, tone: "neutral" },
    terminal: TERMINAL_STATUSES.has(canonicalStatus(rawStatus)),
    stages,
    steps_loaded: nodeMap !== undefined,
    refresh: refreshFor(executionId, scoped),
  };
  if (AWAITING_ACTION.has(canonicalStatus(rawStatus))) view.awaiting_action = true;
  const runSequence = asNumber(pes.runSequence);
  if (runSequence !== undefined) view.run_sequence = runSequence;
  const startTs = asNumber(pes.startTs);
  const endTs = asNumber(pes.endTs);
  if (startTs) view.started_at = startTs;
  if (endTs && view.terminal) view.ended_at = endTs;

  const triggerInfo = asRecord(pes.executionTriggerInfo);
  const triggeredBy = asRecord(triggerInfo?.triggeredBy);
  const by = asString(asRecord(triggeredBy?.extraInfo)?.email) ?? asString(triggeredBy?.identifier);
  const type = asString(triggerInfo?.triggerType);
  if (by || type) view.trigger = { ...(type ? { type } : {}), ...(by ? { by } : {}) };

  const index = currentStageIndex(stages);
  if (index !== undefined) view.current_stage_index = index;

  const failedStage = stages.find((s) => s.status.tone === "danger");
  const failedStep = failedStage ? steps.get(failedStage.id)?.find((s) => viewStatus(s.status)?.tone === "danger") : undefined;
  const message = (
    asString(asRecord(pes.executionErrorInfo)?.message) ??
    asString(asRecord(pes.failureInfo)?.message) ??
    failedStep?.failureInfo?.message ??
    failedStage?.failure_message
  )?.trim();
  if (message && view.status.tone === "danger") {
    view.failure = { message };
    if (failedStage) view.failure.stage = failedStage.name;
    const stepName = failedStep?.name ?? failedStep?.identifier;
    if (stepName) view.failure.step = stepName;
  }

  const link = executionLink(scoped, pipelineId, executionId);
  if (link) view.open_in_harness = link;
  return view;
}

/**
 * Minimal view right after run, retry, or interrupt. The trigger response has no
 * stage graph, so the card refreshes immediately to fill it in.
 */
export function buildPendingExecutionView(
  executionId: string,
  options: ExecutionViewContext & { pipelineId?: string; status?: string; label?: string },
): PipelineExecutionView {
  const rawStatus = options.status ?? "Queued";
  const status = viewStatus(rawStatus) ?? { label: rawStatus, tone: "neutral" as const };
  const terminal = TERMINAL_STATUSES.has(canonicalStatus(rawStatus));
  const view: PipelineExecutionView = {
    kind: "pipeline_execution",
    execution_id: executionId,
    pipeline: { identifier: options.pipelineId },
    scope: { org: options.orgId, project: options.projectId },
    status: options.label ? { label: options.label, tone: "neutral", live: true } : status,
    terminal: options.label ? false : terminal,
    stages: [],
    refresh: refreshFor(executionId, options),
  };
  const link = executionLink(options, options.pipelineId, executionId);
  if (link) view.open_in_harness = link;
  return view;
}
