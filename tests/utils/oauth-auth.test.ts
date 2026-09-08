import { generateKeyPairSync } from "node:crypto";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import {
  buildProtectedResourceMetadata,
  createOAuthHttpAuthMiddleware,
  getProtectedResourceMetadataUrl,
  isOAuthSessionSubjectAuthorized,
  registerOAuthProtectedResourceRoutes,
} from "../../src/utils/oauth-auth.js";

const issuer = "https://harnessid.qa.example.com";
const resource = "https://mcp.qa.example.com/mcp";
const oauthConfig = {
  HARNESS_MCP_OAUTH_ISSUER: issuer,
  HARNESS_MCP_OAUTH_RESOURCE: resource,
  HARNESS_MCP_OAUTH_JWKS_URI: `${issuer}/oauth/jwks`,
  HARNESS_MCP_OAUTH_CLIENT_ID: "mcp-client",
  HARNESS_MCP_OAUTH_ACCOUNT_CLAIM: "account_id",
  HARNESS_MCP_OAUTH_SCOPES: "openid profile email organization",
};

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "qa-signing-key",
  alg: "RS256",
  use: "sig",
};

function accessToken(clientId = "mcp-client"): string {
  return jwt.sign(
    {
      azp: clientId,
      scope: "basic profile email organization:account-1",
      account_id: "account-1",
    },
    privateKey,
    {
      algorithm: "RS256",
      keyid: publicJwk.kid,
      issuer,
      subject: "user-1",
      expiresIn: "5m",
    },
  );
}

function jwksFetch(): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

async function withListeningApp(
  app: express.Express,
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
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function get(
  baseUrl: string,
  path: string,
  authorization?: string,
): Promise<{ status: number; body: unknown; authenticate?: string }> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        headers: authorization ? { Authorization: authorization } : undefined,
      },
      (res) => {
        let rawBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { rawBody += chunk; });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: rawBody ? JSON.parse(rawBody) : undefined,
            authenticate: res.headers["www-authenticate"],
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("HarnessID OAuth HTTP authentication", () => {
  it("builds RFC 9728 metadata and a path-aware metadata URL", () => {
    expect(buildProtectedResourceMetadata(oauthConfig)).toEqual({
      resource,
      authorization_servers: [issuer],
      scopes_supported: ["openid", "profile", "email", "organization"],
      bearer_methods_supported: ["header"],
    });
    expect(getProtectedResourceMetadataUrl(resource)).toBe(
      "https://mcp.qa.example.com/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("binds OAuth sessions to the subject that initialized them", () => {
    expect(isOAuthSessionSubjectAuthorized("user-1", "user-1")).toBe(true);
    expect(isOAuthSessionSubjectAuthorized("user-1", "user-2")).toBe(false);
    expect(isOAuthSessionSubjectAuthorized("user-1", undefined)).toBe(false);
    expect(isOAuthSessionSubjectAuthorized(undefined, undefined)).toBe(true);
  });

  it("serves root and path-aware protected-resource metadata without a token", async () => {
    const app = express();
    registerOAuthProtectedResourceRoutes(app, oauthConfig);
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, jwksFetch()));

    await withListeningApp(app, async (baseUrl) => {
      for (const path of [
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-protected-resource/mcp",
      ]) {
        const response = await get(baseUrl, path);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          resource,
          authorization_servers: [issuer],
        });
      }
    });
  });

  it("challenges missing tokens with protected-resource metadata", async () => {
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, jwksFetch()));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const response = await get(baseUrl, "/mcp");
      expect(response.status).toBe(401);
      expect(response.authenticate).toBe(
        'Bearer resource_metadata="https://mcp.qa.example.com/.well-known/oauth-protected-resource/mcp"',
      );
      expect(response.body).toMatchObject({
        error: { code: -32001, message: "OAuth access token required" },
      });
    });
  });

  it("accepts an mcp-client token and exposes its bearer credential", async () => {
    const fetchImpl = jwksFetch();
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, fetchImpl));
    app.get("/mcp", (_req, res) => {
      res.json({
        subject: res.locals.harnessOAuthClaims.sub,
        accountId: res.locals.harnessOAuthAccountId,
        accessToken: res.locals.harnessOAuthAccessToken,
      });
    });

    await withListeningApp(app, async (baseUrl) => {
      const token = accessToken();
      const first = await get(baseUrl, "/mcp", `Bearer ${token}`);
      const second = await get(baseUrl, "/mcp", `Bearer ${accessToken()}`);

      expect(first.status).toBe(200);
      expect(first.body).toEqual({
        subject: "user-1",
        accountId: "account-1",
        accessToken: token,
      });
      expect(second.status).toBe(200);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  it("rejects tokens issued to another OAuth client", async () => {
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, jwksFetch()));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const response = await get(
        baseUrl,
        "/mcp",
        `Bearer ${accessToken("another-client")}`,
      );

      expect(response.status).toBe(401);
      expect(response.authenticate).toContain('error="invalid_token"');
      expect(response.body).toMatchObject({
        error: { code: -32001, message: "Invalid OAuth access token" },
      });
    });
  });
});
