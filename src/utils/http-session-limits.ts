export interface HttpSessionLimitConfig {
  maxSessions: number;
  maxSessionsPerPrincipal: number;
}

export interface HttpSessionLimitEntry {
  principal: string;
}

export type HttpSessionLimitResult =
  | { allowed: true }
  | {
    allowed: false;
    reason: "global" | "principal";
    status: 429;
    message: string;
  };

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  error: { code: number; message: string };
  id: null;
}

export function checkHttpSessionLimit(
  sessions: ReadonlyMap<string, HttpSessionLimitEntry>,
  principal: string,
  config: HttpSessionLimitConfig,
): HttpSessionLimitResult {
  const maxSessions = Math.max(1, config.maxSessions);
  const maxSessionsPerPrincipal = Math.max(1, Math.min(config.maxSessionsPerPrincipal, maxSessions));

  if (sessions.size >= maxSessions) {
    return {
      allowed: false,
      reason: "global",
      status: 429,
      message: "Too many active MCP sessions. Close an existing session and retry.",
    };
  }

  let principalSessions = 0;
  for (const session of sessions.values()) {
    if (session.principal === principal) principalSessions++;
  }

  if (principalSessions >= maxSessionsPerPrincipal) {
    return {
      allowed: false,
      reason: "principal",
      status: 429,
      message: "Too many active MCP sessions for this principal. Close an existing session and retry.",
    };
  }

  return { allowed: true };
}

export function createHttpSessionLimitError(message: string): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    error: { code: -32000, message },
    id: null,
  };
}
