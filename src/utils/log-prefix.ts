import type { HarnessClient } from "../client/harness-client.js";
import type { Registry } from "../registry/index.js";
import { asRecord, asString, asNumber } from "./type-guards.js";

/**
 * Build a log-service prefix from execution metadata.
 *
 * Fetches the execution, extracts pipelineIdentifier / runSequence / accountId,
 * and returns the simplified prefix format:
 *   {accountId}/pipeline/{pipelineId}/{runSequence}/-{executionId}
 *
 * The official Harness MCP also supports a legacy format based on
 * `shouldUseSimplifiedBaseKey`, but the simplified format works for most cases.
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

  return `${client.account}/pipeline/${pipelineId}/${runSequence}/-${executionId}`;
}
