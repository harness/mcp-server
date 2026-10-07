import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, type Config } from "../../src/config.js";
import {
  buildAuthorizationServerMetadata,
  createOAuthBrokerRuntime,
  registerOAuthBrokerRoutes,
} from "../../src/utils/oauth-broker.js";
import {
  createOAuthProxyHttpAuthMiddleware,
  createOAuthProxyRuntime,
  type OAuthProxyRuntime,
} from "../../src/utils/oauth-proxy.js";

const upstreamIssuer = "https://login.example.com/oauth2/default";
const harnessIssuer = "https://id.example.com/idp/realms/HarnessIDP";
const mcpOrigin = "https://mcp.example.com";
const cursorRedirect = "http://localhost:8787/callback";
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

function brokerConfig(vaultPath: string, grant: "refresh" | "jwt-bearer" = "refresh"): Config {
  return ConfigSchema.parse({
    HARNESS_MCP_MODE: "oauth-proxy",
    HARNESS_BASE_URL: `${mcpOrigin}/cli`,
    HARNESS_MCP_OAUTH_ISSUER: harnessIssuer,
    HARNESS_MCP_OAUTH_RESOURCE: `${mcpOrigin}/mcp`,
    HARNESS_MCP_OAUTH_CLIENT_ID: "harness-confidential-client",
    HARNESS_MCP_OAUTH_CLIENT_SECRET: "harness-secret",
    HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL: mcpOrigin,
    HARNESS_MCP_OAUTH_PROXY_VAULT_PATH: vaultPath,
    HARNESS_MCP_OAUTH_PROXY_VAULT_KEY: randomBytes(32).toString("base64"),
    HARNESS_MCP_OAUTH_PROXY_GRANT: grant,
    HARNESS_MCP_UPSTREAM_ISSUER: upstreamIssuer,
    HARNESS_MCP_UPSTREAM_AUDIENCE: "harness-mcp",
    HARNESS_MCP_UPSTREAM_JWKS_URI: `${upstreamIssuer}/v1/keys`,
    HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID: "upstream-web-client",
    HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET: "upstream-secret",
    HARNESS_MCP_UPSTREAM_DISCOVERY_URI: `${upstreamIssuer}/.well-known/openid-configuration`,
    HARNESS_MCP_BROKER_ISSUER: mcpOrigin,
    HARNESS_MCP_BROKER_CLIENT_ID: "cursor-harness-mcp",
    HARNESS_MCP_BROKER_REDIRECT_URIS: cursorRedirect,
  });
}

interface TokenState {
  nonce?: string;
  externalSubject?: string;
  accessSubject?: string;
  idSubject?: string;
  accessUid?: string;
  idEmail?: string;
  idEmailVerified?: boolean;
  idPreferredUsername?: string;
  harnessEmail?: string;
  harnessEmailVerified?: boolean;
}

function signUpstreamAccessToken(state: TokenState = {}): string {
  return jwt.sign(
    {
      aud: "harness-mcp",
      scope: "openid profile email offline_access",
      ...(state.accessUid ? { uid: state.accessUid } : {}),
    },
    upstreamKeys.privateKey,
    {
      algorithm: "RS256",
      keyid: "upstream-key",
      issuer: upstreamIssuer,
      subject: state.accessSubject ?? "upstream-user",
      expiresIn: "5m",
    },
  );
}

function signUpstreamIdToken(nonce: string, state: TokenState = {}): string {
  return jwt.sign(
    {
      aud: "upstream-web-client",
      nonce,
      ...(state.idEmail ? { email: state.idEmail } : {}),
      ...(state.idEmailVerified !== undefined ? { email_verified: state.idEmailVerified } : {}),
      ...(state.idPreferredUsername ? { preferred_username: state.idPreferredUsername } : {}),
    },
    upstreamKeys.privateKey,
    {
      algorithm: "RS256",
      keyid: "upstream-key",
      issuer: upstreamIssuer,
      subject: state.idSubject ?? "upstream-user",
      expiresIn: "5m",
    },
  );
}

function signHarnessToken(state: TokenState = {}): string {
  return jwt.sign(
    {
      azp: "harness-confidential-client",
      account_id: "account-1",
      external_sub: state.externalSubject ?? "upstream-user",
      ...(state.harnessEmail
        ? { email: state.harnessEmail, email_verified: state.harnessEmailVerified === true }
        : {}),
    },
    harnessKeys.privateKey,
    {
      algorithm: "RS256",
      keyid: "harness-key",
      issuer: harnessIssuer,
      subject: "harness-user",
      expiresIn: "5m",
    },
  );
}

function oauthFetch(state: TokenState): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `${upstreamIssuer}/.well-known/openid-configuration`) {
      return Response.json({
        issuer: upstreamIssuer,
        authorization_endpoint: `${upstreamIssuer}/v1/authorize`,
        token_endpoint: `${upstreamIssuer}/v1/token`,
      });
    }
    if (url === `${upstreamIssuer}/v1/keys`) {
      return Response.json({ keys: [upstreamJwk] });
    }
    if (url === `${harnessIssuer}/protocol/openid-connect/certs`) {
      return Response.json({ keys: [harnessJwk] });
    }
    if (url === `${upstreamIssuer}/v1/token`) {
      const body = init?.body as URLSearchParams;
      if (body.get("grant_type") === "refresh_token") {
        return Response.json({
          access_token: signUpstreamAccessToken(state),
          refresh_token: "rotated-upstream-refresh",
          token_type: "Bearer",
          expires_in: 300,
          scope: "openid profile email offline_access",
          id_token: "must-not-leak",
        });
      }
      return Response.json({
        access_token: signUpstreamAccessToken(state),
        refresh_token: "upstream-refresh",
        id_token: signUpstreamIdToken(state.nonce ?? "missing", state),
        token_type: "Bearer",
        expires_in: 300,
        scope: "openid profile email offline_access",
      });
    }
    if (url === `${harnessIssuer}/protocol/openid-connect/token`) {
      const body = init?.body as URLSearchParams;
      return Response.json({
        access_token: signHarnessToken(state),
        refresh_token: body.get("grant_type") === "authorization_code"
          ? "harness-refresh"
          : "rotated-harness-refresh",
        token_type: "Bearer",
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

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function completeBrowserFlow(
  baseUrl: string,
  state: { nonce?: string },
  verifier: string,
): Promise<string> {
  const authorize = new URL("/oauth/authorize", baseUrl);
  authorize.searchParams.set("client_id", "cursor-harness-mcp");
  authorize.searchParams.set("redirect_uri", cursorRedirect);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", "cursor-state");
  authorize.searchParams.set("resource", `${mcpOrigin}/mcp`);
  authorize.searchParams.set("scope", "openid profile email offline_access");
  authorize.searchParams.set("code_challenge", pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");

  const toUpstream = await fetch(authorize, { redirect: "manual" });
  expect(toUpstream.status).toBe(302);
  const upstreamUrl = new URL(toUpstream.headers.get("location")!);
  state.nonce = upstreamUrl.searchParams.get("nonce")!;
  expect(upstreamUrl.origin + upstreamUrl.pathname).toBe(
    `${upstreamIssuer}/v1/authorize`,
  );
  expect(upstreamUrl.searchParams.get("code_challenge_method")).toBe("S256");

  const upstreamCallback = new URL("/oauth/upstream/callback", baseUrl);
  upstreamCallback.searchParams.set("state", upstreamUrl.searchParams.get("state")!);
  upstreamCallback.searchParams.set("code", "upstream-code");
  const toHarness = await fetch(upstreamCallback, { redirect: "manual" });
  expect(toHarness.status).toBe(302);
  const harnessUrl = new URL(toHarness.headers.get("location")!);
  expect(harnessUrl.origin + harnessUrl.pathname).toBe(
    `${harnessIssuer}/protocol/openid-connect/auth`,
  );

  const harnessCallback = new URL("/oauth/harnessid/callback", baseUrl);
  harnessCallback.searchParams.set("state", harnessUrl.searchParams.get("state")!);
  harnessCallback.searchParams.set("code", "harness-code");
  const toCursor = await fetch(harnessCallback, { redirect: "manual" });
  expect(toCursor.status).toBe(302);
  const cursorUrl = new URL(toCursor.headers.get("location")!);
  expect(cursorUrl.origin + cursorUrl.pathname).toBe(cursorRedirect);
  expect(cursorUrl.searchParams.get("state")).toBe("cursor-state");
  expect(cursorUrl.searchParams.get("iss")).toBe(mcpOrigin);
  return cursorUrl.searchParams.get("code")!;
}

describe("integrated OAuth broker", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it("publishes authorization-server metadata for Cursor", () => {
    expect(buildAuthorizationServerMetadata(
      brokerConfig(join(tmpdir(), "unused-oauth-broker-vault.enc")),
    )).toMatchObject({
      issuer: mcpOrigin,
      authorization_endpoint: `${mcpOrigin}/oauth/authorize`,
      token_endpoint: `${mcpOrigin}/oauth/token`,
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("rejects unregistered redirects and missing S256 PKCE", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-validation-"));
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch({}),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const url = new URL("/oauth/authorize", baseUrl);
      url.search = new URLSearchParams({
        client_id: "cursor-harness-mcp",
        redirect_uri: "https://attacker.example/callback",
        response_type: "code",
        state: "state",
        resource: `${mcpOrigin}/mcp`,
        scope: "openid",
        code_challenge: "A".repeat(43),
        code_challenge_method: "S256",
      }).toString();
      const response = await fetch(url);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_request" });
    });
  });

  it("chains Okta and HarnessID, returns only Okta tokens, and uses HarnessID downstream", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-e2e-"));
    const state: { nonce?: string } = {};
    const fetchImpl = oauthFetch(state);
    const config = brokerConfig(join(directory, "vault.enc"));
    const proxy = createOAuthProxyRuntime(config, fetchImpl);
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));
    app.use(createOAuthProxyHttpAuthMiddleware(proxy));
    app.post("/mcp", (_req, res) => res.json({
      upstreamSubject: res.locals.harnessOAuthIdentitySubject,
      harnessSubject: res.locals.harnessOAuthClaims.sub,
      harnessToken: res.locals.harnessOAuthAccessToken,
    }));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const code = await completeBrowserFlow(baseUrl, state, verifier);
      const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "cursor-harness-mcp",
          redirect_uri: cursorRedirect,
          resource: `${mcpOrigin}/mcp`,
          code,
          code_verifier: verifier,
        }),
      });
      expect(tokenResponse.status).toBe(200);
      const tokens = await tokenResponse.json() as Record<string, unknown>;
      expect(tokens.access_token).toEqual(expect.any(String));
      expect(tokens.refresh_token).toBe("upstream-refresh");
      expect(tokens).not.toHaveProperty("id_token");
      expect(JSON.stringify(tokens)).not.toContain("harness-refresh");

      const mcp = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      expect(mcp.status).toBe(200);
      expect(await mcp.json()).toMatchObject({
        upstreamSubject: "upstream-user",
        harnessSubject: "harness-user",
        harnessToken: expect.any(String),
      });

      const replay = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "cursor-harness-mcp",
          redirect_uri: cursorRedirect,
          resource: `${mcpOrigin}/mcp`,
          code,
          code_verifier: verifier,
        }),
      });
      expect(replay.status).toBe(400);
      expect(await replay.json()).toMatchObject({ error: "invalid_grant" });
    });
  });

  it("supports the JWT bearer exchange without persisting Harness token material", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-jwt-"));
    const state: { nonce?: string } = {};
    const fetchImpl = oauthFetch(state);
    const config = brokerConfig(join(directory, "vault.enc"), "jwt-bearer");
    const proxy = createOAuthProxyRuntime(config, fetchImpl);
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));
    app.use(createOAuthProxyHttpAuthMiddleware(proxy));
    app.post("/mcp", (_req, res) => res.json({ ok: true }));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const code = await completeBrowserFlow(baseUrl, state, verifier);
      const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "cursor-harness-mcp",
          redirect_uri: cursorRedirect,
          resource: `${mcpOrigin}/mcp`,
          code,
          code_verifier: verifier,
        }),
      });
      const tokens = await tokenResponse.json() as Record<string, string>;
      const mcp = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      expect(mcp.status).toBe(200);
    });

    expect(await proxy.vault.getRecord(upstreamIssuer, "upstream-user")).toEqual({
      linked: true,
      updatedAt: expect.any(String),
    });
    const jwtGrant = vi.mocked(fetchImpl).mock.calls.find(([, init]) =>
      (init?.body as URLSearchParams | undefined)?.get("grant_type")
        === "urn:ietf:params:oauth:grant-type:jwt-bearer"
    );
    expect(jwtGrant).toBeDefined();
  });

  it("proxies upstream refresh rotation without returning an ID token", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-refresh-"));
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch({}),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: "cursor-harness-mcp",
          refresh_token: "upstream-refresh",
        }),
      });
      expect(response.status).toBe(200);
      const tokens = await response.json() as Record<string, unknown>;
      expect(tokens).toMatchObject({
        access_token: expect.any(String),
        refresh_token: "rotated-upstream-refresh",
        token_type: "Bearer",
      });
      expect(tokens).not.toHaveProperty("id_token");
    });
  });

  it("rejects an authorization code with the wrong PKCE verifier and consumes it", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-pkce-"));
    const config = brokerConfig(join(directory, "vault.enc"));
    const proxy = createOAuthProxyRuntime(config, oauthFetch({}));
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));
    const code = "single-use-code";
    const verifier = randomBytes(32).toString("base64url");
    await proxy.vault.putBrokerCode(
      createHash("sha256").update(code).digest("base64url"),
      {
        clientId: "cursor-harness-mcp",
        redirectUri: cursorRedirect,
        resource: `${mcpOrigin}/mcp`,
        scope: "openid",
        codeChallenge: pkceChallenge(verifier),
        upstreamIssuer,
        upstreamSubject: "upstream-user",
        upstreamTokens: {
          accessToken: signUpstreamAccessToken(),
          tokenType: "Bearer",
        },
        expiresAt: Date.now() + 60_000,
      },
    );

    await withListeningApp(app, async (baseUrl) => {
      for (const codeVerifier of [
        randomBytes(32).toString("base64url"),
        verifier,
      ]) {
        const response = await fetch(`${baseUrl}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: "cursor-harness-mcp",
            redirect_uri: cursorRedirect,
            resource: `${mcpOrigin}/mcp`,
            code,
            code_verifier: codeVerifier,
          }),
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: "invalid_grant" });
      }
    });
  });

  it("rejects a HarnessID link whose signed external subject does not match", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-subject-"));
    const state: { nonce?: string; externalSubject?: string } = {
      externalSubject: "attacker-subject",
    };
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch(state),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const authorize = new URL("/oauth/authorize", baseUrl);
      authorize.search = new URLSearchParams({
        client_id: "cursor-harness-mcp",
        redirect_uri: cursorRedirect,
        response_type: "code",
        state: "cursor-state",
        resource: `${mcpOrigin}/mcp`,
        scope: "openid profile email offline_access",
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: "S256",
      }).toString();
      const upstreamRedirect = new URL(
        (await fetch(authorize, { redirect: "manual" })).headers.get("location")!,
      );
      state.nonce = upstreamRedirect.searchParams.get("nonce")!;
      const upstreamCallback = new URL("/oauth/upstream/callback", baseUrl);
      upstreamCallback.searchParams.set("state", upstreamRedirect.searchParams.get("state")!);
      upstreamCallback.searchParams.set("code", "upstream-code");
      const harnessRedirect = new URL(
        (await fetch(upstreamCallback, { redirect: "manual" })).headers.get("location")!,
      );
      const harnessCallback = new URL("/oauth/harnessid/callback", baseUrl);
      harnessCallback.searchParams.set("state", harnessRedirect.searchParams.get("state")!);
      harnessCallback.searchParams.set("code", "harness-code");
      const response = await fetch(harnessCallback, { redirect: "manual" });
      const cursorError = new URL(response.headers.get("location")!);
      expect(cursorError.searchParams.get("error")).toBe("access_denied");
      expect(await proxy.vault.getRecord(upstreamIssuer, "upstream-user")).toBeUndefined();
    });
  });

  it("links an email access-token subject when the ID token verifies that email", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-email-"));
    const state: TokenState = {
      accessSubject: "user@example.com",
      idSubject: "00uuser",
      idEmail: "User@Example.com",
      idEmailVerified: true,
      externalSubject: "00uuser",
    };
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch(state),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));
    app.use(createOAuthProxyHttpAuthMiddleware(proxy));
    app.post("/mcp", (_req, res) => res.json({
      upstreamSubject: res.locals.harnessOAuthIdentitySubject,
    }));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const code = await completeBrowserFlow(baseUrl, state, verifier);
      const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "cursor-harness-mcp",
          redirect_uri: cursorRedirect,
          resource: `${mcpOrigin}/mcp`,
          code,
          code_verifier: verifier,
        }),
      });
      const tokens = await tokenResponse.json() as { access_token: string };
      const mcp = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      expect(await mcp.json()).toEqual({ upstreamSubject: "user@example.com" });
      expect(await proxy.vault.getRecord(upstreamIssuer, "user@example.com")).toMatchObject({
        linked: true,
      });
    });
  });

  it("links by verified Harness email when external_sub is a different identifier", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-harness-email-"));
    const state: TokenState = {
      accessSubject: "user@example.com",
      idSubject: "00uuser",
      idEmail: "user@example.com",
      idEmailVerified: true,
      externalSubject: "not-the-okta-user",
      harnessEmail: "user@example.com",
      harnessEmailVerified: true,
    };
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch(state),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const code = await completeBrowserFlow(baseUrl, state, verifier);
      expect(code).toEqual(expect.any(String));
      expect(await proxy.vault.getRecord(upstreamIssuer, "user@example.com")).toMatchObject({
        linked: true,
      });
    });
  });

  it("links when the access token uid equals the ID token subject", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-uid-"));
    const state: TokenState = {
      accessSubject: "user@example.com",
      accessUid: "00uuser",
      idSubject: "00uuser",
      externalSubject: "00uuser",
    };
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch(state),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const code = await completeBrowserFlow(baseUrl, state, verifier);
      expect(code).toEqual(expect.any(String));
      expect(await proxy.vault.getRecord(upstreamIssuer, "user@example.com")).toMatchObject({
        linked: true,
      });
    });
  });

  it("links an email when the ID token omits email_verified", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-email-unspecified-"));
    const state: TokenState = {
      accessSubject: "user@example.com",
      idSubject: "00uuser",
      idPreferredUsername: "user@example.com",
      externalSubject: "00uuser",
    };
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch(state),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const code = await completeBrowserFlow(baseUrl, state, verifier);
      expect(code).toEqual(expect.any(String));
    });
  });

  it("rejects an email subject when the ID token email is not verified", async () => {
    directory = await mkdtemp(join(tmpdir(), "oauth-broker-unverified-email-"));
    const state: TokenState = {
      accessSubject: "user@example.com",
      idSubject: "00uuser",
      idEmail: "user@example.com",
      idEmailVerified: false,
    };
    const proxy = createOAuthProxyRuntime(
      brokerConfig(join(directory, "vault.enc")),
      oauthFetch(state),
    );
    const app = express();
    registerOAuthBrokerRoutes(app, createOAuthBrokerRuntime(proxy));

    await withListeningApp(app, async (baseUrl) => {
      const verifier = randomBytes(32).toString("base64url");
      const authorize = new URL("/oauth/authorize", baseUrl);
      authorize.searchParams.set("client_id", "cursor-harness-mcp");
      authorize.searchParams.set("redirect_uri", cursorRedirect);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("state", "cursor-state");
      authorize.searchParams.set("resource", `${mcpOrigin}/mcp`);
      authorize.searchParams.set("scope", "openid profile email offline_access");
      authorize.searchParams.set("code_challenge", pkceChallenge(verifier));
      authorize.searchParams.set("code_challenge_method", "S256");
      const upstreamRedirect = new URL(
        (await fetch(authorize, { redirect: "manual" })).headers.get("location")!,
      );
      state.nonce = upstreamRedirect.searchParams.get("nonce")!;
      const upstreamCallback = new URL("/oauth/upstream/callback", baseUrl);
      upstreamCallback.searchParams.set("state", upstreamRedirect.searchParams.get("state")!);
      upstreamCallback.searchParams.set("code", "upstream-code");
      const response = await fetch(upstreamCallback, { redirect: "manual" });
      const cursorError = new URL(response.headers.get("location")!);
      expect(cursorError.origin + cursorError.pathname).toBe(cursorRedirect);
      expect(cursorError.searchParams.get("error")).toBe("access_denied");
      expect(await proxy.vault.getRecord(upstreamIssuer, "user@example.com")).toBeUndefined();
    });
  });
});
