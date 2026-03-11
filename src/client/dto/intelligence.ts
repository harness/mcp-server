/**
 * DTOs for the Harness Intelligence Service (AI DevOps Agent).
 *
 * Mirrors the Go SDK's common/client/dto/intelligence.go.
 */

/** Supported actions for the AI DevOps Agent */
export type RequestAction =
  | "CREATE_PIPELINE"
  | "UPDATE_PIPELINE"
  | "CREATE_ENVIRONMENT"
  | "UPDATE_ENVIRONMENT"
  | "CREATE_SECRET"
  | "UPDATE_SECRET"
  | "CREATE_SERVICE"
  | "UPDATE_SERVICE"
  | "CREATE_CONNECTOR"
  | "UPDATE_CONNECTOR"
  | "CREATE_PROCESS";

/** Const array of all action strings — used for Zod enum validation */
export const ACTION_VALUES = [
  "CREATE_PIPELINE",
  "UPDATE_PIPELINE",
  "CREATE_ENVIRONMENT",
  "UPDATE_ENVIRONMENT",
  "CREATE_SECRET",
  "UPDATE_SECRET",
  "CREATE_SERVICE",
  "UPDATE_SERVICE",
  "CREATE_CONNECTOR",
  "UPDATE_CONNECTOR",
  "CREATE_PROCESS",
] as const;

/** A context item passed to the intelligence service (e.g. existing YAML for updates) */
export interface ContextItem {
  type: string;
  payload: unknown;
}

/** Harness scoping context sent with every intelligence request */
export interface HarnessContext {
  account_id: string;
  org_id?: string;
  project_id?: string;
}

/** Request body for POST /gateway/harness-intelligence/api/v1/chat/platform */
export interface ServiceChatRequest {
  harness_context: HarnessContext;
  prompt: string;
  action: RequestAction;
  conversation_id: string;
  context?: ContextItem[];
  stream?: boolean;
}

/** Response from the intelligence service */
export interface ServiceChatResponse {
  conversation_id: string;
  capabilities_to_run?: string[];
  response?: string;
  error?: string;
}

/** Internal representation of a parsed SSE event */
export interface SSEEvent {
  type: string;
  data: string;
}
