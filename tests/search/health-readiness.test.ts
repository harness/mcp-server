/**
 * Contract tests for /health search readiness signaling (mirrors src/index.ts handler).
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { SearchManager } from "../../src/search/manager.js";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_MCP_MODE: "single-user" as const,
    HARNESS_SEARCH_PROVIDER: "none" as const,
    ...overrides,
  };
}

function registerHealthRoute(app: express.Express, searchManager: SearchManager, sessions: Map<string, unknown>) {
  app.get("/health", (_req, res) => {
    const search = searchManager.getReadiness();
    const degraded = search.state === "failed";
    res.status(degraded ? 503 : 200).json({
      status: degraded ? "degraded" : "ok",
      sessions: sessions.size,
      search,
    });
  });
}

async function withHealthServer(
  searchManager: SearchManager,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  const sessions = new Map<string, unknown>();
  registerHealthRoute(app, searchManager, sessions);

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

async function getHealth(baseUrl: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL("/health", baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, (res) => {
      let rawBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { rawBody += chunk; });
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          body: JSON.parse(rawBody) as Record<string, unknown>,
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

describe("/health search readiness", () => {
  it("returns 200 ok when search is disabled", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();

    await withHealthServer(mgr, async (baseUrl) => {
      const { status, body } = await getHealth(baseUrl);
      expect(status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.search).toEqual({ state: "disabled", configured: "none" });
    });
  });

  it("returns 503 degraded when search init failed", async () => {
    const mgr = new SearchManager(makeConfig({ HARNESS_SEARCH_PROVIDER: "local" }) as never);
    vi.spyOn(LocalSearchProvider.prototype, "initialize").mockResolvedValueOnce();
    vi.spyOn(LocalSearchProvider.prototype, "isAvailable").mockReturnValue(false);
    vi.spyOn(LocalSearchProvider.prototype, "getInitError").mockReturnValue("Cannot find module '@huggingface/transformers'");
    await mgr.initialize();

    await withHealthServer(mgr, async (baseUrl) => {
      const { status, body } = await getHealth(baseUrl);
      expect(status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.search).toEqual({
        state: "failed",
        configured: "local",
        error: "Cannot find module '@huggingface/transformers'",
      });
    });

    vi.restoreAllMocks();
  });
});
