import { describe, it, expect } from "vitest";
import { json } from "express";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createHarnessHttpExpressApp } from "../../src/utils/http-app.js";
import { resolveHttpHostValidationOptions } from "../../src/utils/http-hosts.js";

async function withListeningApp(
  app: ReturnType<typeof createHarnessHttpExpressApp>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
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
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function postJson(
  baseUrl: string,
  path: string,
  payload: string,
): Promise<{ status: number; body: unknown }> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          Host: "127.0.0.1",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString(),
        },
      },
      (res) => {
        let rawBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { rawBody += chunk; });
        res.on("end", () => {
          let parsed: unknown = rawBody;
          try {
            parsed = rawBody ? JSON.parse(rawBody) : undefined;
          } catch {
            // keep raw body
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

describe("createHarnessHttpExpressApp", () => {
  it("does not install the SDK default JSON parser before configured middleware", async () => {
    const sdkApp = createMcpExpressApp(resolveHttpHostValidationOptions("127.0.0.1", {}));
    sdkApp.post("/probe", (_req, res) => {
      res.json({ ok: true });
    });

    const harnessApp = createHarnessHttpExpressApp(resolveHttpHostValidationOptions("127.0.0.1", {}));
    harnessApp.post("/probe", (req, res) => {
      res.json({ parsed: req.body !== undefined });
    });

    const largePayload = JSON.stringify({ padding: "x".repeat(150 * 1024) });

    await withListeningApp(sdkApp, async (sdkBaseUrl) => {
      const sdkRes = await postJson(sdkBaseUrl, "/probe", largePayload);
      expect(sdkRes.status).toBe(413);
    });

    await withListeningApp(harnessApp, async (harnessBaseUrl) => {
      const harnessRes = await postJson(harnessBaseUrl, "/probe", largePayload);
      expect(harnessRes.status).toBe(200);
      expect(harnessRes.body).toEqual({ parsed: false });
    });
  });

  it("allows large payloads once the configured JSON parser is installed", async () => {
    const app = createHarnessHttpExpressApp(resolveHttpHostValidationOptions("127.0.0.1", {}));
    app.use(json({ limit: "1mb" }));
    app.post("/probe", (req, res) => {
      res.json({
        parsed: typeof req.body === "object" && req.body !== null,
        paddingLength: (req.body as { padding?: string })?.padding?.length ?? 0,
      });
    });

    const largePayload = JSON.stringify({ padding: "x".repeat(150 * 1024) });

    await withListeningApp(app, async (baseUrl) => {
      const res = await postJson(baseUrl, "/probe", largePayload);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ parsed: true, paddingLength: 150 * 1024 });
    });
  });
});
