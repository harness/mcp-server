import express from "express";
import { describe, expect, it, vi } from "vitest";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createHttpAuthMiddleware,
  isAuthorizedHttpRequest,
  validateHttpAuthForBindHost,
} from "../../src/utils/http-auth.js";

async function withListeningApp(app: express.Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
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

async function getWithAuth(
  baseUrl: string,
  path: string,
  authorization?: string,
): Promise<{ status: number; body: unknown }> {
  return requestWithAuth(baseUrl, "GET", path, authorization);
}

async function requestWithAuth(
  baseUrl: string,
  method: string,
  path: string,
  authorization?: string,
): Promise<{ status: number; body: unknown }> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const headers = authorization ? { Authorization: authorization } : undefined;
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers,
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

describe("HTTP MCP auth", () => {
  it("allows requests when no HTTP auth token is configured", () => {
    expect(isAuthorizedHttpRequest({}, undefined)).toBe(true);
  });

  it("requires an exact Bearer token when HTTP auth is configured", () => {
    expect(isAuthorizedHttpRequest({}, "secret-token")).toBe(false);
    expect(isAuthorizedHttpRequest({ authorization: "Bearer wrong" }, "secret-token")).toBe(false);
    expect(isAuthorizedHttpRequest({ authorization: "Basic secret-token" }, "secret-token")).toBe(false);
    expect(isAuthorizedHttpRequest({ authorization: "Bearer secret-token" }, "secret-token")).toBe(true);
  });

  it("rejects unauthenticated MCP routes before handlers run", async () => {
    const app = express();
    app.use(createHttpAuthMiddleware("secret-token"));
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
    app.options("/mcp", (_req, res) => res.status(204).end());
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const health = await getWithAuth(baseUrl, "/health");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: "ok" });

      const preflight = await requestWithAuth(baseUrl, "OPTIONS", "/mcp");
      expect(preflight.status).toBe(204);

      const rejected = await getWithAuth(baseUrl, "/mcp");
      expect(rejected.status).toBe(401);
      expect(rejected.body).toMatchObject({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
      });

      const accepted = await getWithAuth(baseUrl, "/mcp", "Bearer secret-token");
      expect(accepted.status).toBe(200);
      expect(accepted.body).toEqual({ ok: true });
    });
  });

  it("fails closed for non-loopback binds without auth unless explicitly allowed", () => {
    expect(() =>
      validateHttpAuthForBindHost("0.0.0.0", {
        HARNESS_MCP_AUTH_TOKEN: undefined,
        HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
        HARNESS_MCP_MODE: "single-user",
        HARNESS_API_KEY: "pat.test.abc.xyz",
      }),
    ).toThrow("HARNESS_MCP_AUTH_TOKEN is required");

    expect(() =>
      validateHttpAuthForBindHost("0.0.0.0", {
        HARNESS_MCP_AUTH_TOKEN: undefined,
        HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: true,
        HARNESS_MCP_MODE: "single-user",
        HARNESS_API_KEY: "pat.test.abc.xyz",
      }),
    ).not.toThrow();

    expect(() =>
      validateHttpAuthForBindHost("0.0.0.0", {
        HARNESS_MCP_AUTH_TOKEN: "secret-token",
        HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
        HARNESS_MCP_MODE: "single-user",
        HARNESS_API_KEY: "pat.test.abc.xyz",
      }),
    ).not.toThrow();
  });

  it("warns for loopback single-user with no auth token (reverse-proxy risk)", () => {
    const warnSpy = vi.spyOn(console, "error");

    expect(() =>
      validateHttpAuthForBindHost("127.0.0.1", {
        HARNESS_MCP_AUTH_TOKEN: undefined,
        HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
        HARNESS_MCP_MODE: "single-user",
        HARNESS_API_KEY: "pat.test.abc.xyz",
      }),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"level":"warn"'),
    );
    warnSpy.mockRestore();
  });

  it("does not warn when HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP silences it", () => {
    const warnSpy = vi.spyOn(console, "error");

    validateHttpAuthForBindHost("127.0.0.1", {
      HARNESS_MCP_AUTH_TOKEN: undefined,
      HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: true,
      HARNESS_MCP_MODE: "single-user",
      HARNESS_API_KEY: "pat.test.abc.xyz",
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not warn when auth token is configured", () => {
    const warnSpy = vi.spyOn(console, "error");

    validateHttpAuthForBindHost("127.0.0.1", {
      HARNESS_MCP_AUTH_TOKEN: "secret",
      HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
      HARNESS_MCP_MODE: "single-user",
      HARNESS_API_KEY: "pat.test.abc.xyz",
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not warn in multi-user mode (no credentials in config)", () => {
    const warnSpy = vi.spyOn(console, "error");

    validateHttpAuthForBindHost("127.0.0.1", {
      HARNESS_MCP_AUTH_TOKEN: undefined,
      HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
      HARNESS_MCP_MODE: "multi-user",
      HARNESS_API_KEY: "",
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
