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
  refreshOAuthSessionCredential,
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

interface AccessTokenOptions {
  clientId?: string;
  tokenIssuer?: string;
  accountId?: string | null;
  expiresIn?: jwt.SignOptions["expiresIn"];
  signingKey?: typeof privateKey;
  kid?: string;
  subject?: string;
}

function accessToken(options: AccessTokenOptions = {}): string {
  const accountId = options.accountId === undefined ? "account-1" : options.accountId;
  const payload: Record<string, unknown> = {
    azp: options.clientId ?? "mcp-client",
    aud: "account",
    scope: "basic profile email organization:account-1",
    ...(accountId === null ? {} : { account_id: accountId }),
  };
  if (options.subject !== "") {
    payload.sub = options.subject ?? "user-1";
  }
  return jwt.sign(
    payload,
    options.signingKey ?? privateKey,
    {
      algorithm: "RS256",
      keyid: options.kid ?? publicJwk.kid,
      issuer: options.tokenIssuer ?? issuer,
      expiresIn: options.expiresIn ?? "5m",
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

async function requestWithAuth(
  baseUrl: string,
  method: string,
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
        method,
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

async function get(
  baseUrl: string,
  path: string,
  authorization?: string,
): Promise<{ status: number; body: unknown; authenticate?: string }> {
  return requestWithAuth(baseUrl, "GET", path, authorization);
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

  it("refreshes only the token for the session's subject and account", () => {
    const credential = {
      subject: "user-1",
      accountId: "account-1",
      accessToken: "old-token",
    };
    expect(refreshOAuthSessionCredential(credential, {
      harnessOAuthClaims: { sub: "user-1" },
      harnessOAuthAccountId: "account-1",
      harnessOAuthAccessToken: "refreshed-token",
    })).toBe(true);
    expect(credential.accessToken).toBe("refreshed-token");

    expect(refreshOAuthSessionCredential(credential, {
      harnessOAuthClaims: { sub: "user-2" },
      harnessOAuthAccountId: "account-1",
      harnessOAuthAccessToken: "stolen-token",
    })).toBe(false);
    expect(refreshOAuthSessionCredential(credential, {
      harnessOAuthClaims: { sub: "user-1" },
      harnessOAuthAccountId: "account-2",
      harnessOAuthAccessToken: "other-account-token",
    })).toBe(false);
    expect(credential.accessToken).toBe("refreshed-token");
  });

  it("allows session initialization when no OAuth credential exists yet", () => {
    expect(refreshOAuthSessionCredential(undefined, {
      harnessOAuthClaims: { sub: "user-1" },
      harnessOAuthAccountId: "account-1",
      harnessOAuthAccessToken: "new-session-token",
    })).toBe(true);
  });

  it("rejects refresh when the refreshed access token is missing from locals", () => {
    const credential = {
      subject: "user-1",
      accountId: "account-1",
      accessToken: "old-token",
    };
    expect(refreshOAuthSessionCredential(credential, {
      harnessOAuthClaims: { sub: "user-1" },
      harnessOAuthAccountId: "account-1",
    })).toBe(false);
    expect(credential.accessToken).toBe("old-token");
  });

  it("allows /health and OPTIONS without a bearer token", async () => {
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, jwksFetch()));
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
    app.options("/mcp", (_req, res) => res.status(204).end());
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const health = await get(baseUrl, "/health");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: "ok" });

      const preflight = await requestWithAuth(baseUrl, "OPTIONS", "/mcp");
      expect(preflight.status).toBe(204);

      const protectedRoute = await get(baseUrl, "/mcp");
      expect(protectedRoute.status).toBe(401);
      expect(protectedRoute.body).toMatchObject({
        error: { message: "OAuth access token required" },
      });
    });
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
        `Bearer ${accessToken({ clientId: "another-client" })}`,
      );

      expect(response.status).toBe(401);
      expect(response.authenticate).toContain('error="invalid_token"');
      expect(response.body).toMatchObject({
        error: { code: -32001, message: "Invalid OAuth access token" },
      });
    });
  });

  it.each([
    ["issuer mismatch", accessToken({ tokenIssuer: "https://other.example.com" })],
    ["expired token", accessToken({ expiresIn: "-1m" })],
    ["missing account claim", accessToken({ accountId: null })],
    ["empty account claim", accessToken({ accountId: "" })],
    ["missing sub claim", accessToken({ subject: "" })],
  ])("rejects a token with %s", async (_case, token) => {
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, jwksFetch()));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const response = await get(baseUrl, "/mcp", `Bearer ${token}`);
      expect(response.status).toBe(401);
      expect(response.authenticate).toContain('error="invalid_token"');
    });
  });

  it("refreshes a warm JWKS cache when a token uses a rotated kid", async () => {
    const rotated = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const rotatedJwk = {
      ...rotated.publicKey.export({ format: "jwk" }),
      kid: "rotated-signing-key",
      alg: "RS256",
      use: "sig",
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [publicJwk] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [publicJwk, rotatedJwk] })));
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, fetchImpl as unknown as typeof fetch));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      expect((await get(baseUrl, "/mcp", `Bearer ${accessToken()}`)).status).toBe(200);
      const rotatedToken = accessToken({
        signingKey: rotated.privateKey,
        kid: rotatedJwk.kid,
      });
      expect((await get(baseUrl, "/mcp", `Bearer ${rotatedToken}`)).status).toBe(200);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  it("rejects an unknown kid after refreshing a warm JWKS cache once", async () => {
    const unknown = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const fetchImpl = jwksFetch();
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, fetchImpl));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      expect((await get(baseUrl, "/mcp", `Bearer ${accessToken()}`)).status).toBe(200);
      const response = await get(
        baseUrl,
        "/mcp",
        `Bearer ${accessToken({
          signingKey: unknown.privateKey,
          kid: "unknown-signing-key",
        })}`,
      );
      expect(response.status).toBe(401);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  it("rejects tokens when the JWKS endpoint is unavailable", async () => {
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const app = express();
    app.use(createOAuthHttpAuthMiddleware(oauthConfig, fetchImpl as unknown as typeof fetch));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const response = await get(baseUrl, "/mcp", `Bearer ${accessToken()}`);
      expect(response.status).toBe(401);
      expect(response.authenticate).toContain('error="invalid_token"');
      expect(response.body).toMatchObject({
        error: { message: "Invalid OAuth access token" },
      });
    });
  });
});
