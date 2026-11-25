import { createHash, randomBytes } from "node:crypto";
import {
  createRequestStateCodec,
  inputRequired,
  inputResponse,
  type InputRequiredResult,
  type McpServer,
  type Server,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { createLogger } from "./logger.js";
import { type RiskLevel, type AutoApproveRisk, shouldAutoApprove, requiresConfirmation } from "../registry/types.js";

const log = createLogger("elicitation");

const confirmationSchema = {
  type: "object" as const,
  properties: {
    confirm: {
      type: "boolean" as const,
      title: "Confirm operation",
      description: "Set to true to approve this Harness operation.",
      default: true,
    },
  },
  required: ["confirm"],
};

export interface ElicitationResult {
  /** Whether the operation should proceed. */
  proceed: boolean;
  /** Why the operation was stopped, if applicable. */
  reason?: "declined" | "cancelled";
  /** How the confirmation was resolved — maps directly to ConfirmationMethod for audit. */
  method: "elicited" | "caller_confirmed" | "auto_approved" | "not_required" | "blocked";
  needsInput?: undefined;
}

/** The handler must return this result so the client can collect confirmation and retry. */
export interface ConfirmationPrompt {
  proceed: false;
  needsInput: InputRequiredResult;
}

export type ConfirmationDecision = ElicitationResult | ConfirmationPrompt;

export function isConfirmationPrompt(result: ConfirmationDecision): result is ConfirmationPrompt {
  return result.needsInput !== undefined;
}

interface ConfirmationState {
  tool: string;
  argsHash: string;
}

/** Stable hash of the tool arguments a confirmation is bound to. */
export function confirmationArgsHash(args: unknown): string {
  return createHash("sha256").update(stableStringify(args)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Build a tool-handler-friendly error string for a non-proceeding
 * `ElicitationResult`. Branches on `method` so the recovery hint matches
 * what actually happened:
 *
 *  - `elicited` → the client completed the handshake and the user explicitly
 *    declined or cancelled. Authoritative; `confirm: true` does NOT bypass.
 *  - `blocked` → the client did not surface a usable prompt (no elicitation
 *    capability, `elicitInput` failed, or accept arrived without
 *    `confirm=true`). Caller can retry with `confirm: true` to opt in for
 *    non-interactive automation.
 */
export function describeElicitationFailure(result: ElicitationResult): string {
  if (result.method === "blocked") {
    return "Operation blocked: the client could not surface a usable confirmation prompt (no elicitation capability, elicitInput failed, or accept missing confirm field). Hint: retry with confirm: true if you intend to proceed (e.g. non-interactive automation).";
  }
  const reason = result.reason ?? "declined";
  return `Operation ${reason} by user. To override an interactive decline, the user must accept the prompt — confirm: true does not bypass an explicit decline.`;
}

/**
 * Build the audit-row error string for a non-proceeding
 * `ElicitationResult`. Mirrors `describeElicitationFailure` in attributing
 * the block correctly: the `blocked` method is a CLIENT-side failure to
 * surface a prompt, not a human decline, and the audit row must say so.
 *
 * For the `blocked` branch we deliberately do NOT echo the internal
 * `reason` token. confirmViaElicitation always sets `reason: "cancelled"`
 * on blocked results today, but the function is defensive against any
 * residual `reason: "declined"` shape — either token would falsely imply
 * a human action when surfaced on a client-capability failure. The fact
 * that the operation never reached dispatch is captured by
 * `outcome: "blocked"` on the audit row instead.
 */
export function describeBlockedAudit(result: ElicitationResult): string {
  if (result.method === "blocked") {
    return "Operation blocked pre-dispatch: client could not surface a confirmation prompt";
  }
  return `Operation ${result.reason ?? "declined"} by user (${result.method})`;
}

/** Module-level auto-approve threshold (set via HARNESS_AUTO_APPROVE_RISK). */
let _autoApproveRisk: AutoApproveRisk = "none";
let _requestStateCodec = createRequestStateCodec<ConfirmationState>({
  key: randomBytes(32),
  ttlSeconds: 600,
  bind: (ctx) => ctx.mcpReq.method,
});

/**
 * Configure the elicitation module. Call once at startup.
 * A key shorter than 32 bytes is ignored and the process-random key is kept.
 */
export function configureElicitation(opts: { autoApproveRisk?: AutoApproveRisk; requestStateKey?: string }): void {
  if (opts.autoApproveRisk !== undefined) _autoApproveRisk = opts.autoApproveRisk;
  if (opts.requestStateKey && new TextEncoder().encode(opts.requestStateKey).byteLength >= 32) {
    _requestStateCodec = createRequestStateCodec<ConfirmationState>({
      key: opts.requestStateKey,
      ttlSeconds: 600,
      bind: (ctx) => ctx.mcpReq.method,
    });
  }
}

/** Verify hook for `ServerOptions.requestState`. */
export function confirmationRequestStateVerifier(): { verify: typeof _requestStateCodec.verify } {
  return { verify: (state, ctx) => _requestStateCodec.verify(state, ctx) };
}

/**
 * Client capabilities for this request. 2026-07-28 carries them on the
 * request envelope; 2025-era connections negotiated them at initialize.
 */
export function requestClientCapabilities(ctx: ServerContext | undefined, server: Server): unknown {
  // The SDK hides envelope keys from the public type; they are present at runtime.
  const envelope = ctx?.mcpReq.envelope as { clientCapabilities?: unknown } | undefined;
  return envelope?.clientCapabilities ?? server.getClientCapabilities();
}

/**
 * Check whether the connected client advertises form elicitation support.
 */
export function clientSupportsElicitation(server: Server, ctx?: ServerContext): boolean {
  const caps = requestClientCapabilities(ctx, server) as { elicitation?: unknown } | undefined;
  return !!caps?.elicitation;
}

/**
 * Prompt the user to confirm a write operation via MCP form elicitation.
 *
 * Decision flow:
 *  1. If the operation risk is at or below `HARNESS_AUTO_APPROVE_RISK`, proceed
 *     immediately (autonomous mode for CI/CD agents).
 *  2. If the operation risk is `read` or `low_write`, proceed silently — these
 *     do not require user confirmation regardless of client capability.
 *     `requiresConfirmation(risk)` is the single threshold that decides
 *     whether a prompt is surfaced; it kicks in at `medium_write`.
 *  3. If the client supports elicitation, prompt the user. The prompt
 *     contains a `confirm` checkbox (default `true`):
 *       - `accept` + `confirm === true` → proceed
 *       - `accept` + `confirm === false` (user unchecked the box) → BLOCK
 *         (authoritative; not bypassable by callerConfirmed)
 *       - `accept` missing the `confirm` field → degenerate non-interactive
 *         response (handled under callerConfirmed below)
 *       - `decline` / `cancel` → BLOCK (authoritative; not bypassable)
 *  4. If the client lacks elicitation:
 *     - `medium_write` / `high_write` / `destructive` → BLOCK.
 *  5. `callerConfirmed` (caller passed `confirm: true`) overrides:
 *       - the lacking-elicitation block (managed MCP, Cursor, etc.),
 *       - an `elicitInput` failure (transport or unsupported method),
 *       - an `accept` action missing `confirm=true` (degenerate response from
 *         a non-interactive client that advertises elicitation but does not
 *         actually surface a prompt).
 *     It does NOT override an explicit `decline` or `cancel` from a client
 *     that completed the elicitation handshake — a human (or trusted client)
 *     saying "no" to a write is authoritative, even if the model also passed
 *     `confirm: true` on the call.
 */
export async function confirmViaElicitation({
  server,
  ctx,
  toolName,
  message,
  risk,
  autoApproveRisk,
  callerConfirmed,
  argsHash,
}: {
  server: McpServer;
  /** Request context. Absent in unit tests that only exercise the decision table. */
  ctx?: ServerContext;
  toolName: string;
  message: string;
  /** The risk level of the operation (from operationPolicy). */
  risk: RiskLevel;
  /** Optional per-session threshold. Falls back to the process default. */
  autoApproveRisk?: AutoApproveRisk;
  /** When true, the caller explicitly passed confirm=true — acts as confirmation
   *  on clients that lack elicitation support (managed MCP, Cursor, etc.) and
   *  on clients that fail to surface a usable prompt. Override paths emit
   *  `method: "caller_confirmed"` (distinct from `elicited`) so audit sinks
   *  can tell automation overrides apart from genuine human consents. */
  callerConfirmed?: boolean;
  /** Hash of the tool arguments this confirmation is bound to. */
  argsHash?: string;
}): Promise<ConfirmationDecision> {
  const threshold = autoApproveRisk ?? _autoApproveRisk;
  if (shouldAutoApprove(risk, threshold)) {
    log.debug("Auto-approved (risk within autonomous threshold)", { toolName, risk, threshold });
    return { proceed: true, method: "auto_approved" };
  }

  // `read` / `low_write` actions never need user confirmation, regardless of
  // client capability. This matches the documented risk policy: confirmation
  // is gated on `requiresConfirmation(risk)` (medium_write+), and surfacing
  // an elicitation prompt for low-risk reads (e.g. hql_query.run) would be
  // user-hostile noise.
  if (!requiresConfirmation(risk)) {
    log.debug("Risk does not require confirmation, proceeding silently", { toolName, risk });
    return { proceed: true, method: "not_required" };
  }

  if (!clientSupportsElicitation(server.server, ctx)) {
    if (callerConfirmed) {
      log.info("Client lacks elicitation, proceeding via explicit confirm param", { toolName, risk });
      return { proceed: true, method: "caller_confirmed" };
    }
    log.warn("Client does not support elicitation, blocking operation", { toolName, risk });
    // Use `reason: "cancelled"` rather than `"declined"`: no human declined —
    // the client never surfaced a prompt at all. `method: "blocked"` is the
    // load-bearing signal; the reason field stays consistent across every
    // blocked branch (no-capability, throws, accept-without-confirm).
    return { proceed: false, reason: "cancelled", method: "blocked" };
  }

  const answer = inputResponse(ctx?.mcpReq.inputResponses, "confirm");
  if (answer.kind === "missing") {
    const prior = ctx?.mcpReq.requestState<ConfirmationState>();
    if (prior && argsHash && prior.argsHash !== argsHash) {
      log.warn("Confirmation retry changed the operation arguments", { toolName });
      return { proceed: false, reason: "cancelled", method: "blocked" };
    }
    const requestState = ctx
      ? await _requestStateCodec.mint({ tool: toolName, argsHash: argsHash ?? "" }, ctx)
      : undefined;
    log.info("Confirmation required", { toolName, risk });
    return {
      proceed: false,
      needsInput: inputRequired({
        inputRequests: {
          confirm: inputRequired.elicit({
            message,
            requestedSchema: confirmationSchema,
          }),
        },
        ...(requestState ? { requestState } : {}),
      }),
    };
  }

  if (answer.kind !== "elicit") {
    log.warn("Confirmation response was not an elicitation result", { toolName, kind: answer.kind });
    return { proceed: false, reason: "cancelled", method: "blocked" };
  }

  const bound = ctx?.mcpReq.requestState<ConfirmationState>();
  if (bound && argsHash && (bound.tool !== toolName || bound.argsHash !== argsHash)) {
    log.warn("Confirmation was bound to a different operation", { toolName, boundTool: bound.tool });
    return { proceed: false, reason: "cancelled", method: "blocked" };
  }

  log.info("Elicitation response", { toolName, action: answer.action });

  if (answer.action === "accept") {
    const content = answer.content;
    const isContentObject = typeof content === "object" && content !== null;
    const hasConfirmField = isContentObject && "confirm" in content;
    const confirmValue = hasConfirmField ? content.confirm : undefined;
    if (confirmValue === true) {
      return { proceed: true, method: "elicited" };
    }
    if (hasConfirmField && confirmValue === false) {
      log.info("Elicitation accept with confirm=false (user unchecked the box)", { toolName, risk });
      return { proceed: false, reason: "declined", method: "elicited" };
    }
    if (callerConfirmed) {
      log.info("Elicitation accept missing confirm field; proceeding via explicit confirm param", { toolName, risk });
      return { proceed: true, method: "caller_confirmed" };
    }
    log.warn("Elicitation accept missing confirm field; treating as blocked (no usable prompt surfaced)", { toolName, risk });
    return { proceed: false, reason: "cancelled", method: "blocked" };
  }
  if (answer.action === "decline") {
    return { proceed: false, reason: "declined", method: "elicited" };
  }
  return { proceed: false, reason: "cancelled", method: "elicited" };
}
