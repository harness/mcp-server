import { timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { RequestHandler } from "express";
import type { Config } from "../config.js";

type HttpAuthConfig = Pick<Config, "HARNESS_MCP_AUTH_TOKEN" | "HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP">;

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
  if (isLoopbackBindHost(host)) return;
  if (config.HARNESS_MCP_AUTH_TOKEN) return;
  if (config.HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP) return;

  throw new Error(
    "HARNESS_MCP_AUTH_TOKEN is required when HTTP transport binds to a non-loopback host. " +
    "Set HARNESS_MCP_AUTH_TOKEN or explicitly set HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP=true.",
  );
}
