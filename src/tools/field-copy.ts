/**
 * Per-profile copy for long tool-field descriptions. `full` is the original wording; `compact` is the
 * short form used when HARNESS_SCHEMA_MODE=compact. Keep safety-critical rules in both.
 */
export type SchemaProfile = "full" | "compact";

const COPY = {
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
