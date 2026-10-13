import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "../../src/config.js";
import {
  createOAuthProxyHttpAuthMiddleware,
  createOAuthProxyRuntime,
  upstreamEmailIdentifiers,
} from "../../src/utils/oauth-proxy.js";
import {
  decodeOAuthProxyVaultKey,
  OAuthProxyVault,
} from "../../src/utils/oauth-proxy-vault.js";

const upstreamIssuer = "https://login.example.com/oauth2/default";
const harnessIssuer = "https://id.example.com/idp/realms/HarnessIDP";
const upstreamKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const harnessKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const upstreamJwk = {
  ...upstreamKeys.publicKey.export({ format: "jwk" }),
  kid: "upstream-key",
  alg: "RS256",
  use: "sig",
};
const harnessJwk = {
  ...harnessKeys.publicKey.export({ format: "jwk" }),
  kid: "harness-key",
  alg: "RS256",
  use: "sig",
};

function proxyConfig(vaultPath: string, grant: "refresh" | "jwt-bearer" = "refresh") {
  return ConfigSchema.parse({
    HARNESS_MCP_MODE: "oauth-proxy",
    HARNESS_BASE_URL: "https://mcp.example.com/cli",
    HARNESS_MCP_OAUTH_ISSUER: harnessIssuer,
    HARNESS_MCP_OAUTH_RESOURCE: "https://mcp.example.com/mcp",
    HARNESS_MCP_OAUTH_CLIENT_ID: "harness-mcp-proxy",
    HARNESS_MCP_OAUTH_CLIENT_SECRET: "harness-secret",
    HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL: "https://mcp.example.com",
    HARNESS_MCP_OAUTH_PROXY_VAULT_PATH: vaultPath,
    HARNESS_MCP_OAUTH_PROXY_VAULT_KEY: randomBytes(32).toString("base64"),
    HARNESS_MCP_OAUTH_PROXY_GRANT: grant,
    HARNESS_MCP_UPSTREAM_ISSUER: upstreamIssuer,
    HARNESS_MCP_UPSTREAM_AUDIENCE: "harness-mcp",
    HARNESS_MCP_UPSTREAM_JWKS_URI: `${upstreamIssuer}/v1/keys`,
    HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID: "cursor-upstream-client",
    HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET: "upstream-secret",
  });
}

describe("upstreamEmailIdentifiers", () => {
  it("collects email-shaped claims and keeps only configured domains", () => {
    const open = proxyConfig("/tmp/vault.enc");
    const restricted = ConfigSchema.parse({
      ...open,
      HARNESS_MCP_UPSTREAM_EMAIL_DOMAINS: "jpmchase.com",
    });
    const claims = {
      sub: "ida-user-1",
      email: "User@Jpmchase.com",
      upn: "user@jpmchase.com",
      preferred_username: "not-an-email",
      unique_name: "other@notjpmchase.com",
    };
    expect(upstreamEmailIdentifiers(open, [claims])).toEqual([
      "user@jpmchase.com",
      "other@notjpmchase.com",
    ]);
    expect(upstreamEmailIdentifiers(restricted, [claims])).toEqual([
      "user@jpmchase.com",
    ]);
  });

  it("ignores email claims when email_verified is false", () => {
    const config = proxyConfig("/tmp/vault.enc");
    expect(upstreamEmailIdentifiers(config, [{
      sub: "ida-user-1",
      email: "user@jpmchase.com",
      upn: "user@jpmchase.com",
      email_verified: false,
    }])).toEqual([]);
  });

  it("rejects an invalid email domain setting", () => {
    expect(() => ConfigSchema.parse({
      HARNESS_API_KEY: "pat.acct123.tokenId.secret",
      HARNESS_ACCOUNT_ID: "acct123",
      HARNESS_MCP_UPSTREAM_EMAIL_DOMAINS: "not a domain",
    })).toThrow("HARNESS_MCP_UPSTREAM_EMAIL_DOMAINS");
  });
});

function upstreamToken(subject = "upstream-user"): string {
  return jwt.sign(
    { aud: "harness-mcp", scope: "openid profile email" },
    upstreamKeys.privateKey,
    {
      algorithm: "RS256",
      keyid: "upstream-key",
      issuer: upstreamIssuer,
      subject,
      expiresIn: "5m",
    },
  );
}

function harnessToken(subject = "harness-user"): string {
  return jwt.sign(
    {
      azp: "harness-mcp-proxy",
      account_id: "account-1",
      external_sub: "upstream-user",
      scope: "openid profile email organization:account-1",
      jti: randomBytes(8).toString("hex"),
    },
    harnessKeys.privateKey,
    {
      algorithm: "RS256",
      keyid: "harness-key",
      issuer: harnessIssuer,
      subject,
      expiresIn: "5m",
    },
  );
}

function mockOAuthFetch(): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `${upstreamIssuer}/v1/keys`) {
      return Response.json({ keys: [upstreamJwk] });
    }
    if (url === `${harnessIssuer}/protocol/openid-connect/certs`) {
      return Response.json({ keys: [harnessJwk] });
    }
    if (url === `${harnessIssuer}/protocol/openid-connect/token`) {
      const body = init?.body as URLSearchParams;
      const grant = body.get("grant_type");
      return Response.json({
        access_token: harnessToken(),
        refresh_token: grant === "refresh_token" ? "rotated-refresh-token" : "refresh-token",
        expires_in: 300,
      });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

async function withListeningApp(
  app: express.Express,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe("OAuth proxy mode", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it("requires the confidential client, upstream provider, and encrypted-vault settings", () => {
    expect(() => ConfigSchema.parse({
      HARNESS_MCP_MODE: "oauth-proxy",
    })).toThrow("oauth-proxy mode requires");
  });

  it("encrypts refresh tokens at rest", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-vault-"));
    const path = join(directory, "vault.enc");
    const key = randomBytes(32);
    const vault = new OAuthProxyVault(path, key);
    await vault.putRecord(upstreamIssuer, "upstream-user", {
      linked: true,
      refreshToken: "secret-refresh-token",
      accessToken: "secret-access-token",
      accessTokenExpiresAt: Date.now() + 300_000,
      updatedAt: "2026-10-02T00:00:00Z",
    });

    expect(await vault.getRecord(upstreamIssuer, "upstream-user")).toMatchObject({
      refreshToken: "secret-refresh-token",
      accessToken: "secret-access-token",
    });
    const stored = await readFile(path, "utf8");
    expect(stored).not.toContain("secret-refresh-token");
    expect(stored).not.toContain("secret-access-token");
    expect(() => decodeOAuthProxyVaultKey("not-a-key")).toThrow("32-byte key");
  });

  it("requires a new login when the upstream identity is not mapped", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-link-"));
    const config = proxyConfig(join(directory, "vault.enc"));
    const runtime = createOAuthProxyRuntime(config, mockOAuthFetch());
    const app = express();
    app.use(createOAuthProxyHttpAuthMiddleware(runtime));
    app.post("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstreamToken()}` },
      });
      const body = await response.json() as { error: { message: string } };
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"');
      expect(body.error.message).toBe(
        "HarnessID authentication is required for this identity.",
      );
      expect(JSON.stringify(body)).not.toContain("/oauth/link");
    });
  });

  it("exchanges a refresh token and exposes the Harness identity to MCP", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-refresh-"));
    const config = proxyConfig(join(directory, "vault.enc"));
    const runtime = createOAuthProxyRuntime(config, mockOAuthFetch());
    await runtime.vault.putRecord(upstreamIssuer, "upstream-user", {
      linked: true,
      refreshToken: "initial-refresh-token",
      updatedAt: "2026-10-02T00:00:00Z",
    });
    const app = express();
    app.use(createOAuthProxyHttpAuthMiddleware(runtime));
    app.post("/mcp", (_req, res) => {
      res.json({
        identitySubject: res.locals.harnessOAuthIdentitySubject,
        harnessSubject: res.locals.harnessOAuthClaims.sub,
        accountId: res.locals.harnessOAuthAccountId,
        token: res.locals.harnessOAuthAccessToken,
      });
    });

    await withListeningApp(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstreamToken()}` },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        identitySubject: "upstream-user",
        harnessSubject: "harness-user",
        accountId: "account-1",
        token: expect.any(String),
      });
    });

    expect(await runtime.vault.getRecord(upstreamIssuer, "upstream-user")).toMatchObject({
      refreshToken: "rotated-refresh-token",
      accessToken: expect.any(String),
      accessTokenExpiresAt: expect.any(Number),
    });
  });

  it("reuses a cached HarnessID access token until the renewal window", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-cache-"));
    const config = proxyConfig(join(directory, "vault.enc"));
    const fetchImpl = mockOAuthFetch();
    const runtime = createOAuthProxyRuntime(config, fetchImpl);
    const token = harnessToken();
    const claims = jwt.decode(token) as { exp: number };
    await runtime.vault.putRecord(upstreamIssuer, "upstream-user", {
      linked: true,
      refreshToken: "initial-refresh-token",
      accessToken: token,
      accessTokenExpiresAt: claims.exp * 1000,
      updatedAt: "2026-10-02T00:00:00Z",
    });
    const app = express();
    app.use(createOAuthProxyHttpAuthMiddleware(runtime));
    app.post("/mcp", (_req, res) => {
      res.json({ token: res.locals.harnessOAuthAccessToken });
    });

    await withListeningApp(app, async (baseUrl) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${upstreamToken()}` },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ token });
      }
    });

    const tokenCalls = vi.mocked(fetchImpl).mock.calls.filter(
      ([url]) => String(url).endsWith("/protocol/openid-connect/token"),
    );
    expect(tokenCalls).toHaveLength(0);
  });

  it("renews a HarnessID access token inside the renewal window", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-renew-"));
    const config = proxyConfig(join(directory, "vault.enc"));
    const fetchImpl = mockOAuthFetch();
    const runtime = createOAuthProxyRuntime(config, fetchImpl);
    const expiring = harnessToken();
    await runtime.vault.putRecord(upstreamIssuer, "upstream-user", {
      linked: true,
      refreshToken: "initial-refresh-token",
      accessToken: expiring,
      accessTokenExpiresAt: Date.now() + 30_000,
      updatedAt: "2026-10-02T00:00:00Z",
    });
    const app = express();
    app.use(createOAuthProxyHttpAuthMiddleware(runtime));
    app.post("/mcp", (_req, res) => {
      res.json({ token: res.locals.harnessOAuthAccessToken });
    });

    await withListeningApp(app, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstreamToken()}` },
      });
      const firstBody = await first.json() as { token: string };
      expect(first.status).toBe(200);
      expect(firstBody.token).not.toBe(expiring);

      const second = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstreamToken()}` },
      });
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual({ token: firstBody.token });
    });

    const tokenCalls = vi.mocked(fetchImpl).mock.calls.filter(
      ([url]) => String(url).endsWith("/protocol/openid-connect/token"),
    );
    expect(tokenCalls).toHaveLength(1);
    expect(await runtime.vault.getRecord(upstreamIssuer, "upstream-user")).toMatchObject({
      refreshToken: "rotated-refresh-token",
    });
  });

  it("requires a new login when HarnessID rejects the refresh token", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-invalid-grant-"));
    const config = proxyConfig(join(directory, "vault.enc"));
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === `${upstreamIssuer}/v1/keys`) {
        return Response.json({ keys: [upstreamJwk] });
      }
      if (url === `${harnessIssuer}/protocol/openid-connect/certs`) {
        return Response.json({ keys: [harnessJwk] });
      }
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }) as unknown as typeof fetch;
    const runtime = createOAuthProxyRuntime(config, fetchImpl);
    await runtime.vault.putRecord(upstreamIssuer, "upstream-user", {
      linked: true,
      refreshToken: "expired-refresh-token",
      updatedAt: "2026-10-02T00:00:00Z",
    });
    const app = express();
    app.use(createOAuthProxyHttpAuthMiddleware(runtime));
    app.post("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstreamToken()}` },
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"');
    });
    expect(await runtime.vault.getRecord(upstreamIssuer, "upstream-user")).toBeUndefined();
  });

  it("uses the upstream JWT assertion without storing a token", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-proxy-jwt-"));
    const config = proxyConfig(join(directory, "vault.enc"), "jwt-bearer");
    const fetchImpl = mockOAuthFetch();
    const runtime = createOAuthProxyRuntime(config, fetchImpl);
    await runtime.vault.putRecord(upstreamIssuer, "upstream-user", {
      linked: true,
      updatedAt: "2026-10-02T00:00:00Z",
    });
    const app = express();
    app.use(createOAuthProxyHttpAuthMiddleware(runtime));
    app.post("/mcp", (_req, res) => res.json({ ok: true }));
    const assertion = upstreamToken();

    await withListeningApp(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${assertion}` },
      });
      expect(response.status).toBe(200);
    });

    const tokenCall = vi.mocked(fetchImpl).mock.calls.find(
      ([url]) => String(url).endsWith("/protocol/openid-connect/token"),
    );
    const body = tokenCall?.[1]?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect(body.get("assertion")).toBe(assertion);
    expect(await runtime.vault.getRecord(upstreamIssuer, "upstream-user")).toEqual({
      linked: true,
      updatedAt: "2026-10-02T00:00:00Z",
    });
  });

});
