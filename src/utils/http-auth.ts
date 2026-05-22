import { timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { RequestHandler } from "express";
import type { Config } from "../config.js";
import { createLogger } from "./logger.js";

const log = createLogger("http-auth");

type HttpAuthConfig = Pick<Config, "HARNESS_MCP_AUTH_TOKEN" | "HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP" | "HARNESS_MCP_MODE" | "HARNESS_API_KEY">;

export function isLoopbackBindHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

function getHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : undefined;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    const maxLength = Math.max(leftBuffer.length, rightBuffer.length);
    timingSafeEqual(
      Buffer.from(left.padEnd(maxLength, "\0")),
      Buffer.from(right.padEnd(maxLength, "\0")),
    );
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedHttpRequest(
  headers: IncomingHttpHeaders,
  token: string | undefined,
): boolean {
  if (!token) return true;
  const authorization = getHeader(headers, "authorization");
  if (!authorization) return false;
  return timingSafeStringEqual(authorization, `Bearer ${token}`);
}

export function createHttpAuthMiddleware(token: string | undefined): RequestHandler {
  return (req, res, next) => {
    if (req.path === "/health" || req.method === "OPTIONS" || isAuthorizedHttpRequest(req.headers, token)) {
      next();
      return;
    }

    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
  };
}

export function validateHttpAuthForBindHost(host: string, config: HttpAuthConfig): void {
  // Check 1: credentials at risk — single-user with an API key and no MCP auth token.
  // Bind address is irrelevant here: a loopback port exposed via reverse proxy or tunnel
  // is just as reachable as a public bind. Warn now; will become an error in next major.
  const hasSingleUserCredentials = config.HARNESS_MCP_MODE !== "multi-user" && !!config.HARNESS_API_KEY;
  if (hasSingleUserCredentials && !config.HARNESS_MCP_AUTH_TOKEN && !config.HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP) {
    log.warn(
      "HTTP single-user mode has no HARNESS_MCP_AUTH_TOKEN set. " +
      "If this port is reachable via a reverse proxy or tunnel, the configured Harness API key is exposed. " +
      "Set HARNESS_MCP_AUTH_TOKEN to require authentication, or set HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP=true to silence this warning. " +
      "A future major version will make HARNESS_MCP_AUTH_TOKEN required in this configuration.",
      { host },
    );
  }

  // Check 2: DNS-rebinding defense — non-loopback binds must be explicitly secured.
  if (!isLoopbackBindHost(host) && !config.HARNESS_MCP_AUTH_TOKEN && !config.HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP) {
    throw new Error(
      "HARNESS_MCP_AUTH_TOKEN is required when HTTP transport binds to a non-loopback host. " +
      "Set HARNESS_MCP_AUTH_TOKEN or explicitly set HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP=true.",
    );
  }
}
