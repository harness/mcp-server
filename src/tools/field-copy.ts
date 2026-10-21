/**
 * Per-profile copy for long tool-field descriptions. `full` is the original wording; `compact` is the
 * short form used when HARNESS_SCHEMA_MODE=compact. Keep safety-critical rules in both.
 */
export type SchemaProfile = "full" | "compact";

const COPY = {
  "diagnose.options": {
    full: "Resource-specific diagnostic options. Pipeline: execution_id, pipeline_id, summary, include_yaml, include_logs, include_all_step_logs (boolean, fetch logs for ALL steps not just failed/deepest \u2014 logs are fetched in batches of 3 for memory safety, capped at max_all_step_logs, use for pipeline summarization), max_all_step_logs (number, default 25, max steps to include in all_step_logs \u2014 prevents OOM on large matrix/loop pipelines), return_download_url (boolean, return signed logs.zip URLs instead of inline log text), log_snippet_lines, max_failed_steps. Pipeline diagnosis requires a completed execution. When a Harness URL contains ?step=<nodeExecutionId>, setting include_logs:true fetches that specific step's log regardless of pass/fail status and returns it as requested_step_log alongside any failed_step_logs. GitOps: agent_id. Call harness_describe for details.",
    compact: "Resource-specific options. Pipeline: execution_id, pipeline_id, summary, include_yaml, include_logs, include_all_step_logs, return_download_url, log_snippet_lines, max_failed_steps (needs a completed execution; a ?step= URL with include_logs fetches that step). GitOps: agent_id.",
  },
  "execute.queries": {
    full: "Batch HQL queries \u2014 use with resource_type='hql_query' and action='validate' or 'run'. Fans out in parallel, returns per-query results.",
    compact: "Batch HQL queries for resource_type='hql_query' with action validate or run; run in parallel.",
  },
  "confirm.execute": {
    full: "Set to true to confirm the operation. Only required when the action's risk is medium_write or above (e.g. pipeline.run is high_write; hql_query.run/validate are read and need no confirmation) AND the client cannot surface a confirmation prompt \u2014 e.g. managed MCP that does not advertise elicitation, or an elicitation that fails at runtime. Has no effect for low-risk actions. Does NOT override an explicit decline from a client that completed an elicitation prompt \u2014 a user's decline is authoritative.",
    compact: "User-approved confirmation for medium/high-risk operations when the client cannot show a prompt. Set only with user intent; never overrides a user's decline.",
  },
  "confirm.create": {
    full: "Set to true to confirm the operation. Only required when the operation risk is medium_write or above (most write resources) AND the client cannot surface a confirmation prompt \u2014 e.g. managed MCP that does not advertise elicitation, or an elicitation that fails at runtime. Has no effect for low-risk creates. Does NOT override an explicit decline from a client that completed an elicitation prompt \u2014 a user's decline is authoritative.",
    compact: "User-approved confirmation for medium/high-risk operations when the client cannot show a prompt. Set only with user intent; never overrides a user's decline.",
  },
  "confirm.update": {
    full: "Set to true to confirm the operation. Only required when the operation risk is medium_write or above AND the client cannot surface a confirmation prompt \u2014 e.g. managed MCP that does not advertise elicitation, or an elicitation that fails at runtime. Has no effect for low-risk updates. Does NOT override an explicit decline from a client that completed an elicitation prompt \u2014 a user's decline is authoritative.",
    compact: "User-approved confirmation for medium/high-risk operations when the client cannot show a prompt. Set only with user intent; never overrides a user's decline.",
  },
  "confirm.delete": {
    full: "Set to true to confirm the destructive operation. Required when the client cannot surface a confirmation prompt \u2014 e.g. managed MCP that does not advertise elicitation, or an elicitation that fails at runtime. Does NOT override an explicit decline from a client that completed an elicitation prompt \u2014 a user's decline is authoritative.",
    compact: "User-approved confirmation for the destructive operation when the client cannot show a prompt. Set only with user intent; never overrides a user's decline.",
  },
  "execute.wait": {
    full: "For pipeline run/retry actions: block until the execution reaches a terminal status (Success/Failed/Aborted/Errored/Expired). Server-side polling \u2014 a single tool call gives the agent the final outcome instead of an LLM polling loop. Ignored for other actions.",
    compact: "Pipeline run/retry only: block until the execution reaches a terminal status (server-side polling).",
  },
  "execute.wait_timeout_seconds": {
    full: "Max seconds to wait when wait=true. Default 600 (10 min). Max 7200 (2 h). When the timeout fires, returns execution_timed_out=true with the last observed status.",
    compact: "Max seconds to wait when wait=true (default 600). On timeout returns execution_timed_out=true.",
  },
  "execute.wait_poll_interval_seconds": {
    full: "Initial poll interval when wait=true (seconds). Default 3. Backoff multiplier 1.5x, capped at 30s.",
    compact: "Initial poll interval when wait=true (default 3s, 1.5x backoff, capped at 30s).",
  },
  "create.params": {
    full: "Additional parameters. For external Git pipelines: store_type='REMOTE', connector_ref, repo_name, branch, file_path, commit_msg. For Harness Code pipelines: store_type='REMOTE', is_harness_code_repo=true, repo_name, branch, file_path.",
    compact: "Extra parameters, e.g. store_type='REMOTE' with connector_ref, repo_name, branch, file_path for remote Git pipelines. See harness_describe.",
  },
} as const;

export type FieldCopyKey = keyof typeof COPY;

export function fieldCopy(key: FieldCopyKey, profile: SchemaProfile): string {
  return COPY[key][profile];
}
