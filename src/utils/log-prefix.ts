import type { HarnessClient } from "../client/harness-client.js";
import type { Registry } from "../registry/index.js";
import { asRecord, asString, asNumber } from "./type-guards.js";

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
  }) as Record<string, unknown>;

  const exec = asRecord(execution) ?? {};
  const pes = asRecord(exec.pipelineExecutionSummary) ?? exec;
  const pipelineId = asString(pes.pipelineIdentifier);
  const runSequence = asNumber(pes.runSequence);

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
