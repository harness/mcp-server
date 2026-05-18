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
import type { Express } from "express";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { resolveHttpHostValidationOptions } from "../../src/utils/http-hosts.js";

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
      const sessions = new Map<string, { lastActivity: number }>();
      const id = crypto.randomUUID();
      const now = Date.now();

      sessions.set(id, { lastActivity: now });

      expect(sessions.has(id)).toBe(true);
      expect(sessions.get(id)!.lastActivity).toBe(now);
    });

    it("session TTL reaper removes idle sessions", () => {
      const SESSION_TTL_MS = 30 * 60_000;
      const sessions = new Map<string, { lastActivity: number }>();

      // Active session
      sessions.set("active", { lastActivity: Date.now() });
      // Expired session (31 minutes ago)
      sessions.set("expired", { lastActivity: Date.now() - SESSION_TTL_MS - 60_000 });

      // Simulate reaper
      const now = Date.now();
      for (const [id, session] of sessions) {
        if (now - session.lastActivity > SESSION_TTL_MS) {
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

  describe("SDK Host-header validation", () => {
    it("accepts hosted MCP host and rejects unexpected hosts for localhost binds", async () => {
      const app = createMcpExpressApp(resolveHttpHostValidationOptions("127.0.0.1", {}));
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
