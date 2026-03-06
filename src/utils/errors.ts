import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/*
 * Error handling convention for tool handlers:
 *
 *   return errorResult(msg)  — for user-fixable problems the LLM can act on:
 *     bad resource_type, missing confirmation, unsupported operation, missing
 *     required fields, validation errors. These are plain Errors thrown by the
 *     registry/toolset layer. The LLM sees the message and can retry/adjust.
 *
 *   throw toMcpError(err)    — for infrastructure failures the LLM cannot fix:
 *     HTTP 5xx, auth failures (401/403), timeouts, rate limits (429). These are
 *     HarnessApiErrors thrown by the HTTP client. Thrown as JSON-RPC errors so
 *     MCP clients surface them as system-level failures.
 *
 * Quick test: HarnessApiError → throw. Plain Error → return errorResult.
 */

/**
 * Typed error for Harness API failures.
 */
export class HarnessApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly harnessCode?: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "HarnessApiError";
  }
}

/**
 * Returns true for user-fixable errors (registry validation, missing fields,
 * unknown resource types) — i.e. plain Errors that are NOT HarnessApiErrors.
 */
export function isUserError(err: unknown): err is Error {
  return err instanceof Error && !(err instanceof HarnessApiError) && !(err instanceof McpError);
}

/**
 * Map a HarnessApiError (or generic Error) to an MCP-friendly McpError.
 */
export function toMcpError(err: unknown): McpError {
  if (err instanceof McpError) return err;

  if (err instanceof HarnessApiError) {
    const code = mapHttpStatusToMcpCode(err.statusCode);
    const detail = err.correlationId ? ` (correlationId: ${err.correlationId})` : "";
    return new McpError(code, `${err.message}${detail}`);
  }

  if (err instanceof Error) {
    return new McpError(ErrorCode.InternalError, err.message);
  }

  return new McpError(ErrorCode.InternalError, String(err));
}

function mapHttpStatusToMcpCode(status: number): ErrorCode {
  if (status === 400) return ErrorCode.InvalidParams;
  if (status === 401 || status === 403) return ErrorCode.InvalidRequest;
  if (status === 404) return ErrorCode.InvalidParams;
  if (status === 429) return ErrorCode.InternalError;
  return ErrorCode.InternalError;
}
