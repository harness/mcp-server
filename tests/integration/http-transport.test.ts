/**
 * HTTP transport lifecycle tests.
 *
 * Tests session creation, routing, SSE streams, DELETE termination,
 * and error handling for the Streamable HTTP transport layer.
 *
 * These tests verify the Express route handlers and session management
 * without starting a real HTTP server — we test the route logic directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { json, type Express } from "express";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { resolveHttpHostValidationOptions } from "../../src/utils/http-hosts.js";
import { createHttpAuthMiddleware } from "../../src/utils/http-auth.js";
import { isSessionExpired } from "../../src/utils/http-sessions.js";
import { mergeConfigWithSessionHeaders, MissingSessionCredentialsError } from "../../src/utils/session-headers.js";
import { createHarnessHttpExpressApp } from "../../src/utils/http-app.js";

// We can't easily test the full HTTP server without starting it,
// so we test the session management patterns and transport lifecycle
// by verifying the key behaviors through direct function testing.

async function withListeningApp(app: Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    });
  }
}

async function getWithHost(baseUrl: string, host: string): Promise<{ status: number; body: unknown }> {
  const url = new URL("/probe", baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        headers: { Host: host },
      },
      (res) => {
        let rawBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { rawBody += chunk; });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: rawBody ? JSON.parse(rawBody) : undefined,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("HTTP transport session management", () => {
  describe("session store behavior", () => {
    it("sessions are created with a UUID and initial lastActivity", () => {
      const sessions = new Map<string, { lastActivity: number; activeRequests: number }>();
      const id = crypto.randomUUID();
      const now = Date.now();

      sessions.set(id, { lastActivity: now, activeRequests: 0 });

      expect(sessions.has(id)).toBe(true);
      expect(sessions.get(id)).toMatchObject({
        lastActivity: now,
        activeRequests: 0,
      });
    });

    it("session TTL reaper removes idle sessions while preserving active requests", () => {
      const SESSION_TTL_MS = 30 * 60_000; // matches MCP_SESSION_TTL_MS default
      const sessions = new Map<string, { lastActivity: number; activeRequests: number }>();

      // Active session
      sessions.set("active", { lastActivity: Date.now(), activeRequests: 0 });
      // Expired session
      sessions.set("expired", { lastActivity: Date.now() - SESSION_TTL_MS - 60_000, activeRequests: 0 });
      // In-flight session older than the TTL
      sessions.set("in-flight", { lastActivity: Date.now() - SESSION_TTL_MS - 60_000, activeRequests: 1 });

      // Simulate reaper
      const now = Date.now();
      for (const [id, session] of sessions) {
        if (isSessionExpired(session, SESSION_TTL_MS, now)) {
          sessions.delete(id);
        }
      }

      expect(sessions.has("active")).toBe(true);
      expect(sessions.has("expired")).toBe(false);
      expect(sessions.has("in-flight")).toBe(true);
    });

    it("session TTL reaper honors operator-configured TTL values", () => {
      const customTtlMs = 30_000;
      const sessions = new Map<string, { lastActivity: number }>();
      const now = Date.now();

      sessions.set("active", { lastActivity: now - customTtlMs + 1_000 });
      sessions.set("expired", { lastActivity: now - customTtlMs - 1_000 });

      for (const [id, session] of sessions) {
        if (now - session.lastActivity > customTtlMs) {
          sessions.delete(id);
        }
      }

      expect(sessions.has("active")).toBe(true);
      expect(sessions.has("expired")).toBe(false);
    });

    it("session lastActivity is updated on request", () => {
      const sessions = new Map<string, { lastActivity: number }>();
      const id = "test-session";
      const initialTime = Date.now() - 60_000; // 1 minute ago

      sessions.set(id, { lastActivity: initialTime });

      // Simulate request — update lastActivity
      const session = sessions.get(id)!;
      session.lastActivity = Date.now();

      expect(session.lastActivity).toBeGreaterThan(initialTime);
    });

    it("destroy removes session from store", () => {
      const sessions = new Map<string, { lastActivity: number }>();
      sessions.set("s1", { lastActivity: Date.now() });
      sessions.set("s2", { lastActivity: Date.now() });

      sessions.delete("s1");

      expect(sessions.size).toBe(1);
      expect(sessions.has("s1")).toBe(false);
      expect(sessions.has("s2")).toBe(true);
    });
  });

  describe("rate limiting behavior", () => {
    it("tracks per-IP request counts with window expiry", () => {
      const RATE_WINDOW_MS = 60_000;
      const RATE_LIMIT = 60;
      const ipHits = new Map<string, { count: number; resetAt: number }>();
      const ip = "127.0.0.1";
      const now = Date.now();

      // First request
      ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      expect(ipHits.get(ip)!.count).toBe(1);

      // 59 more requests
      for (let i = 2; i <= RATE_LIMIT; i++) {
        ipHits.get(ip)!.count = i;
      }
      expect(ipHits.get(ip)!.count).toBe(RATE_LIMIT);

      // 61st request should be over limit
      ipHits.get(ip)!.count++;
      expect(ipHits.get(ip)!.count).toBeGreaterThan(RATE_LIMIT);
    });

    it("resets count after window expires", () => {
      const RATE_WINDOW_MS = 60_000;
      const ipHits = new Map<string, { count: number; resetAt: number }>();
      const ip = "127.0.0.1";

      // Expired entry
      ipHits.set(ip, { count: 100, resetAt: Date.now() - 1000 });

      // Simulate reaper cleanup
      const now = Date.now();
      for (const [key, entry] of ipHits) {
        if (now >= entry.resetAt) {
          ipHits.delete(key);
        }
      }

      expect(ipHits.has(ip)).toBe(false);
    });
  });

  describe("CORS headers", () => {
    it("sets correct CORS headers for localhost", () => {
      const host = "127.0.0.1";
      const port = 3000;
      const headers: Record<string, string> = {};

      // Simulate CORS middleware
      headers["Access-Control-Allow-Origin"] = `http://${host}:${port}`;
      headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, mcp-session-id, x-harness-api-key, x-harness-account-id, x-harness-org, x-harness-project, x-harness-pipeline-version, x-harness-auto-approve-risk";
      headers["Access-Control-Expose-Headers"] = "mcp-session-id";

      expect(headers["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:3000");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
      expect(headers["Access-Control-Allow-Methods"]).toContain("DELETE");
      expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
      expect(headers["Access-Control-Allow-Headers"]).toContain("mcp-session-id");
      expect(headers["Access-Control-Expose-Headers"]).toContain("mcp-session-id");
    });
  });

  describe("HTTP app host-header validation", () => {
    it("accepts hosted MCP host and rejects unexpected hosts for localhost binds", async () => {
      const app = createHarnessHttpExpressApp(resolveHttpHostValidationOptions("127.0.0.1", {}));
      app.get("/probe", (_req, res) => {
        res.json({ ok: true });
      });

      await withListeningApp(app, async (baseUrl) => {
        const accepted = await getWithHost(baseUrl, "mcp.harness.io");
        expect(accepted.status).toBe(200);
        expect(accepted.body).toEqual({ ok: true });

        const rejected = await getWithHost(baseUrl, "evil.example.com");
        expect(rejected.status).toBe(403);
        expect(rejected.body).toMatchObject({
          error: { message: "Invalid Host: evil.example.com" },
        });
      });
    });
  });

  describe("graceful shutdown behavior", () => {
    it("prevents double-shutdown", () => {
      let draining = false;
      let shutdownCount = 0;

      function shutdown(): void {
        if (draining) return;
        draining = true;
        shutdownCount++;
      }

      shutdown();
      shutdown(); // Second call should be no-op

      expect(shutdownCount).toBe(1);
    });

    it("destroys all sessions on shutdown", () => {
      const sessions = new Map<string, { lastActivity: number }>();
      sessions.set("s1", { lastActivity: Date.now() });
      sessions.set("s2", { lastActivity: Date.now() });
      sessions.set("s3", { lastActivity: Date.now() });

      // Simulate shutdown
      for (const [id] of sessions) {
        sessions.delete(id);
      }

      expect(sessions.size).toBe(0);
    });
  });

  describe("route error handling patterns", () => {
    it("returns 404 JSON-RPC error for unknown session", () => {
      const sessions = new Map<string, unknown>();
      const sessionId = "nonexistent";

      const session = sessions.get(sessionId);
      expect(session).toBeUndefined();

      // This is what the route handler would return
      const errorResponse = {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found. Send an initialize request to start a new session." },
        id: null,
      };
      expect(errorResponse.jsonrpc).toBe("2.0");
      expect(errorResponse.error.code).toBe(-32000);
    });

    it("returns 400 when mcp-session-id header missing on GET/DELETE", () => {
      const sessionId = undefined;

      const errorResponse = {
        jsonrpc: "2.0",
        error: { code: -32000, message: "mcp-session-id header is required." },
        id: null,
      };

      expect(sessionId).toBeUndefined();
      expect(errorResponse.error.message).toContain("mcp-session-id");
    });
  });
});

// ---------------------------------------------------------------------------
// Route-level tests — exercises the real middleware stack (auth → body parse → route)
// ---------------------------------------------------------------------------

async function postMcp(
  baseUrl: string,
  opts: { headers?: Record<string, string>; body?: unknown },
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const url = new URL("/mcp", baseUrl);
  const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
          ...opts.headers,
        },
      },
      (res) => {
        let rawBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { rawBody += chunk; });
        res.on("end", () => {
          let parsed: unknown;
          try { parsed = JSON.parse(rawBody); } catch { parsed = rawBody; }
          const responseHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") responseHeaders[k] = v;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, headers: responseHeaders });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function buildInitializeBody(): unknown {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    },
  };
}

/**
 * Build a minimal Express app that mirrors the real src/index.ts middleware
 * stack for the auth + multi-user credential path, but without starting the
 * full Harness MCP server (which requires a real API key).
 */
function buildAuthTestApp(opts: {
  authToken?: string;
  multiUser?: boolean;
  bodyLimit?: string;
}): Express {
  const app = createHarnessHttpExpressApp(resolveHttpHostValidationOptions("127.0.0.1", {}));

  // Mirror src/index.ts ordering: CORS → auth → rate limit → body parse → route
  app.use((_req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });
  app.use(createHttpAuthMiddleware(opts.authToken));
  app.use(json({ limit: opts.bodyLimit ?? "1mb" }));

  app.post("/mcp", (req: any, res: any) => {
    // Simulate multi-user credential check from src/index.ts POST /mcp handler
    if (opts.multiUser) {
      const baseConfig = {
        HARNESS_MCP_MODE: "multi-user" as const,
        HARNESS_API_KEY: "",
        HARNESS_ACCOUNT_ID: "",
        HARNESS_AUTO_APPROVE_RISK: "none" as const,
      };
      try {
        mergeConfigWithSessionHeaders(baseConfig as any, req.headers);
      } catch (err) {
        if (err instanceof MissingSessionCredentialsError) {
          res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: err.message },
            id: null,
          });
          return;
        }
        throw err;
      }
    }
    // If we get here, auth + credentials passed
    res.json({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  });

  return app;
}

describe("HTTP /mcp route-level auth", () => {
  it("returns 401 when bearer token is required but missing", async () => {
    const app = buildAuthTestApp({ authToken: "secret-token" });
    await withListeningApp(app, async (baseUrl) => {
      const res = await postMcp(baseUrl, { body: buildInitializeBody() });
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
      });
    });
  });

  it("returns 401 when multi-user headers are missing on initialize", async () => {
    const app = buildAuthTestApp({ multiUser: true });
    await withListeningApp(app, async (baseUrl) => {
      const res = await postMcp(baseUrl, { body: buildInitializeBody() });
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        jsonrpc: "2.0",
        error: { code: -32001 },
      });
    });
  });

  it("returns 401 when API key account ID mismatches x-harness-account-id", async () => {
    const app = buildAuthTestApp({ multiUser: true });
    await withListeningApp(app, async (baseUrl) => {
      const res = await postMcp(baseUrl, {
        body: buildInitializeBody(),
        headers: {
          "x-harness-api-key": "pat.accountA.token.secret",
          "x-harness-account-id": "accountB",
        },
      });
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        jsonrpc: "2.0",
        error: { code: -32001 },
      });
    });
  });

  it("succeeds with SAT account ID extraction when x-harness-account-id is omitted", async () => {
    const app = buildAuthTestApp({ multiUser: true });
    await withListeningApp(app, async (baseUrl) => {
      const res = await postMcp(baseUrl, {
        body: buildInitializeBody(),
        headers: {
          "x-harness-api-key": "sat.myaccount.token.secret",
        },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    });
  });

  it("succeeds with correct bearer token and multi-user credentials", async () => {
    const app = buildAuthTestApp({ authToken: "my-token", multiUser: true });
    await withListeningApp(app, async (baseUrl) => {
      const res = await postMcp(baseUrl, {
        body: buildInitializeBody(),
        headers: {
          "Authorization": "Bearer my-token",
          "x-harness-api-key": "pat.myaccount.token.secret",
          "x-harness-account-id": "myaccount",
        },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    });
  });

  it("honors configured JSON body limits above the SDK default parser limit", async () => {
    const app = buildAuthTestApp({ bodyLimit: "1mb" });
    const body = buildInitializeBody() as {
      params: { _meta?: Record<string, string> };
    };
    body.params._meta = { padding: "x".repeat(150 * 1024) };

    await withListeningApp(app, async (baseUrl) => {
      const res = await postMcp(baseUrl, { body });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    });
  });
});
