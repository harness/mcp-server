import type { HarnessClient } from "../client/harness-client.js";
import type { Registry } from "../registry/index.js";
import { asRecord, asString, asNumber } from "./type-guards.js";

interface ExecGraphNode {
  uuid?: string;
  identifier?: string;
  baseFqn?: string;
  logBaseKey?: string;
}

function collectStageCandidates(
  nodeMap: Record<string, ExecGraphNode>,
  input: Record<string, unknown>,
): Set<string> {
  const targets = [
    asString(input.stage_execution_id),
    asString(input.stage_id),
  ].filter((value): value is string => Boolean(value));

  const identifiers = new Set<string>(targets);
  for (const [nodeId, node] of Object.entries(nodeMap)) {
    if (!targets.some((target) => target === nodeId || target === node.uuid || target === node.identifier)) {
      continue;
    }
    if (node.identifier) identifiers.add(node.identifier);
  }

  return identifiers;
}

function matchesTarget(nodeId: string, node: ExecGraphNode, target: string): boolean {
  return nodeId === target || node.uuid === target || node.identifier === target;
}

function isStageMatch(node: ExecGraphNode, stageCandidates: Set<string>): boolean {
  if (stageCandidates.size === 0) return true;
  const baseFqn = node.baseFqn ?? "";
  for (const stage of stageCandidates) {
    if (node.identifier === stage || baseFqn.includes(`.stages.${stage}`)) return true;
  }
  return false;
}

function findNodeLogBaseKey(
  nodeMap: Record<string, ExecGraphNode>,
  input: Record<string, unknown>,
): string | undefined {
  const stepTarget = asString(input.step_id);
  const stageCandidates = collectStageCandidates(nodeMap, input);

  if (stepTarget) {
    for (const [nodeId, node] of Object.entries(nodeMap)) {
      if (!matchesTarget(nodeId, node, stepTarget)) continue;
      if (!isStageMatch(node, stageCandidates)) continue;
      if (node.logBaseKey) return node.logBaseKey;
    }
  }

  for (const target of stageCandidates) {
    for (const [nodeId, node] of Object.entries(nodeMap)) {
      if (!matchesTarget(nodeId, node, target)) continue;
      if (node.logBaseKey) return node.logBaseKey;
    }
  }

  for (const [nodeId, node] of Object.entries(nodeMap)) {
    if (!matchesTarget(nodeId, node, "pipeline")) continue;
    if (node.baseFqn !== "pipeline") continue;
    if (node.logBaseKey) return node.logBaseKey;
  }

  // Last resort: no specific step/stage targeted and no pipeline-level key found.
  // Pick any node that has a logBaseKey — prefer the deepest (longest) key which
  // typically corresponds to the main execution step rather than a wrapper stage.
  let bestKey: string | undefined;
  for (const node of Object.values(nodeMap)) {
    if (!node.logBaseKey) continue;
    if (!bestKey || node.logBaseKey.length > bestKey.length) {
      bestKey = node.logBaseKey;
    }
  }
  return bestKey;
}

/**
 * Build a log-service prefix from execution metadata.
 *
 * Fetches the execution, extracts pipelineIdentifier / runSequence / accountId,
 * and returns the appropriate prefix format based on `shouldUseSimplifiedKey`:
 *
 * Simplified: {accountId}/pipeline/{pipelineId}/{runSequence}/-{executionId}
 * Standard:   accountId:{accountId}/orgId:{orgId}/projectId:{projectId}/pipelineId:{pipelineId}/runSequence:{seq}/level0:pipeline
 */
export async function buildLogPrefixFromExecution(
  client: HarnessClient,
  registry: Registry,
  executionId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const execution = await registry.dispatch(client, "execution", "get", {
    ...input,
    execution_id: executionId,
    render_full_graph: true,
  }) as Record<string, unknown>;

  const exec = asRecord(execution) ?? {};
  const pes = asRecord(exec.pipelineExecutionSummary) ?? exec;
  const executionGraph = asRecord(exec.executionGraph);
  const nodeMap = asRecord(executionGraph?.nodeMap) as Record<string, ExecGraphNode> | undefined;
  const pipelineId = asString(pes.pipelineIdentifier);
  const runSequence = asNumber(pes.runSequence);

  if (nodeMap) {
    const logBaseKey = findNodeLogBaseKey(nodeMap, input);
    if (logBaseKey) return logBaseKey;
  }

  if (!pipelineId || runSequence == null) {
    throw new Error(
      `Could not extract pipelineIdentifier/runSequence from execution ${executionId}. ` +
      `Provide a manual prefix in the format: {accountId}/pipeline/{pipelineId}/{runSequence}/-{executionId}`,
    );
  }

  // The Harness API returns `shouldUseSimplifiedKey` on the execution object
  // to indicate which log prefix format was used when the execution was created.
  const useSimplified = pes.shouldUseSimplifiedKey !== false;

  if (useSimplified) {
    return `${client.account}/pipeline/${pipelineId}/${runSequence}/-${executionId}`;
  }

  // Standard format requires org and project identifiers
  const orgId = asString(pes.orgIdentifier) ?? asString(input.org_id) ?? "";
  const projectId = asString(pes.projectIdentifier) ?? asString(input.project_id) ?? "";
  return `accountId:${client.account}/orgId:${orgId}/projectId:${projectId}/pipelineId:${pipelineId}/runSequence:${runSequence}/level0:pipeline`;
}
