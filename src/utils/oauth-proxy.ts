import {
  createHash,
  createPublicKey,
  randomBytes,
  type JsonWebKey as NodeJsonWebKey,
  type KeyObject,
} from "node:crypto";
import type { Express, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Config } from "../config.js";
import { createLogger } from "./logger.js";
import { getProtectedResourceMetadataUrl } from "./oauth-auth.js";
import {
  createNodeRedisCommands,
  RedisOAuthProxyVault,
} from "./oauth-proxy-redis-vault.js";
import {
  decodeOAuthProxyVaultKey,
  OAuthProxyVault,
  type OAuthProxyVaultRecord,
  type OAuthProxyVaultStore,
} from "./oauth-proxy-vault.js";

const log = createLogger("oauth-proxy");
const CLOCK_TOLERANCE_SECONDS = 30;
const JWKS_CACHE_TTL_MS = 5 * 60_000;

/** Decoded claims for local grant debugging. The raw token is not logged. */
export function describeReceivedJwt(token: string | undefined): unknown {
  if (!token) return undefined;
  const claims = jwt.decode(token);
  return claims && typeof claims !== "string" ? claims : { readable: false };
}

interface OAuthJwk extends NodeJsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
}

export interface VerifiedIdentity {
  issuer: string;
  subject: string;
  claims: JwtPayload;
}

export interface OAuthProxyRuntime {
  config: Config;
  vault: OAuthProxyVaultStore;
  upstreamVerifier: JwtVerifier;
  upstreamIdVerifier: JwtVerifier;
  harnessVerifier: JwtVerifier;
  fetchImpl: typeof fetch;
  exchangeLocks: Map<string, Promise<void>>;
}

class TokenEndpointError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`HarnessID token endpoint returned HTTP ${status}: ${clip(responseBody)}`);
  }

  get invalidGrant(): boolean {
    return this.responseBody.includes("invalid_grant")
      || this.responseBody.includes("invalid_token");
  }
}

class JwtVerifier {
  private keys = new Map<string, KeyObject>();
  private expiresAt = 0;

  constructor(
    private readonly issuer: string,
    private readonly jwksUri: string,
    private readonly fetchImpl: typeof fetch,
    private readonly audience?: string,
  ) {}

  async verify(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (
      !decoded
      || decoded.header.alg !== "RS256"
      || typeof decoded.header.kid !== "string"
    ) {
      throw new Error("Access token must be an RS256 JWT with a kid header.");
    }
    const key = await this.key(decoded.header.kid);
    return jwt.verify(token, key, {
      algorithms: ["RS256"],
      issuer: this.issuer,
      audience: this.audience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    }) as JwtPayload;
  }

  private async key(kid: string): Promise<KeyObject> {
    if (Date.now() >= this.expiresAt || !this.keys.has(kid)) {
      await this.refresh();
    }
    const key = this.keys.get(kid);
    if (!key) throw new Error(`No signing key found for kid "${kid}".`);
    return key;
  }

  private async refresh(): Promise<void> {
    const response = await this.fetchImpl(this.jwksUri, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`JWKS request failed with HTTP ${response.status}.`);
    }
    const body = await response.json() as { keys?: OAuthJwk[] };
    if (!Array.isArray(body.keys)) {
      throw new Error("JWKS response does not contain a keys array.");
    }
    const keys = new Map<string, KeyObject>();
    for (const jwk of body.keys) {
      if (
        typeof jwk.kid !== "string"
        || jwk.kty !== "RSA"
        || (jwk.use !== undefined && jwk.use !== "sig")
        || (jwk.alg !== undefined && jwk.alg !== "RS256")
      ) {
        continue;
      }
      keys.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" }));
    }
    this.keys = keys;
    this.expiresAt = Date.now() + JWKS_CACHE_TTL_MS;
  }
}

function required(config: Config, name: keyof Config): string {
  const value = config[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`oauth-proxy configuration is missing ${String(name)}.`);
  }
  return value;
}

export function createOAuthProxyRuntime(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): OAuthProxyRuntime {
  const upstreamIssuer = required(config, "HARNESS_MCP_UPSTREAM_ISSUER").replace(/\/+$/, "");
  const upstreamJwksUri = required(config, "HARNESS_MCP_UPSTREAM_JWKS_URI");
  const harnessIssuer = required(config, "HARNESS_MCP_OAUTH_ISSUER").replace(/\/+$/, "");
  const harnessJwksUri = required(config, "HARNESS_MCP_OAUTH_JWKS_URI");
  const vaultKey = decodeOAuthProxyVaultKey(
    required(config, "HARNESS_MCP_OAUTH_PROXY_VAULT_KEY"),
  );

  return {
    config,
    vault: config.HARNESS_MCP_OAUTH_PROXY_VAULT_MODE === "redis"
      ? new RedisOAuthProxyVault(
        vaultKey,
        config.HARNESS_MCP_OAUTH_PROXY_REDIS_KEY_PREFIX,
        createNodeRedisCommands(required(config, "HARNESS_MCP_OAUTH_PROXY_REDIS_URL")),
      )
      : new OAuthProxyVault(config.HARNESS_MCP_OAUTH_PROXY_VAULT_PATH, vaultKey),
    upstreamVerifier: new JwtVerifier(
      upstreamIssuer,
      upstreamJwksUri,
      fetchImpl,
      required(config, "HARNESS_MCP_UPSTREAM_AUDIENCE"),
    ),
    upstreamIdVerifier: new JwtVerifier(
      upstreamIssuer,
      upstreamJwksUri,
      fetchImpl,
      required(config, "HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID"),
    ),
    harnessVerifier: new JwtVerifier(harnessIssuer, harnessJwksUri, fetchImpl),
    fetchImpl,
    exchangeLocks: new Map(),
  };
}

export function oauthProxyProtectedResourceConfig(config: Config): {
  HARNESS_MCP_OAUTH_ISSUER: string;
  HARNESS_MCP_OAUTH_RESOURCE: string;
  HARNESS_MCP_OAUTH_JWKS_URI: string;
  HARNESS_MCP_OAUTH_SCOPES: string;
} {
  return {
    HARNESS_MCP_OAUTH_ISSUER: required(config, "HARNESS_MCP_BROKER_ISSUER"),
    HARNESS_MCP_OAUTH_RESOURCE: config.HARNESS_MCP_OAUTH_RESOURCE,
    HARNESS_MCP_OAUTH_JWKS_URI: required(config, "HARNESS_MCP_UPSTREAM_JWKS_URI"),
    HARNESS_MCP_OAUTH_SCOPES: config.HARNESS_MCP_UPSTREAM_SCOPES,
  };
}

export function registerOAuthProxyRoutes(
  app: Express,
  runtime: OAuthProxyRuntime,
): void {
  app.get("/oauth/link", async (req, res) => {
    try {
      const id = queryString(req.query.txn);
      const transaction = id ? await runtime.vault.getTransaction(id) : undefined;
      if (!transaction) {
        res.status(400).type("html").send(page(
          "Link expired",
          "<p>Retry the MCP request to create a new HarnessID link.</p>",
        ));
        return;
      }
      res.redirect(buildHarnessAuthorizationUrl(
        runtime.config,
        transaction.state,
        transaction.codeVerifier,
        callbackUrl(runtime.config),
      ));
    } catch (error) {
      log.warn("OAuth proxy link failed", { error: errorMessage(error) });
      res.status(500).type("html").send(page("Link failed", "<p>Unable to start HarnessID login.</p>"));
    }
  });

  app.get("/oauth/callback", async (req, res) => {
    const state = queryString(req.query.state);
    const code = queryString(req.query.code);
    const oauthError = queryString(req.query.error);
    if (oauthError) {
      res.status(400).type("html").send(page(
        "HarnessID login failed",
        `<p>${escapeHtml(queryString(req.query.error_description) ?? oauthError)}</p>`,
      ));
      return;
    }
    const found = state ? await runtime.vault.takeTransactionByState(state) : undefined;
    if (!found || !code) {
      res.status(400).type("html").send(page(
        "HarnessID login failed",
        "<p>The authorization state is missing or expired. Retry the MCP request.</p>",
      ));
      return;
    }

    try {
      const harness = await completeHarnessAuthorization(
        runtime,
        found.transaction.subject,
        code,
        found.transaction.codeVerifier,
        callbackUrl(runtime.config),
      );
      res.type("html").send(page(
        "Harness account linked",
        `<p>HarnessID linked this upstream identity to Harness account <code>${escapeHtml(harness.accountId)}</code>.</p>
         <p>Return to the MCP client and retry the request.</p>`,
      ));
    } catch (error) {
      log.warn("OAuth proxy callback rejected", { error: errorMessage(error) });
      res.status(400).type("html").send(page(
        "HarnessID link rejected",
        `<p>${escapeHtml(errorMessage(error))}</p>`,
      ));
    }
  });
}

export function createOAuthProxyHttpAuthMiddleware(
  runtime: OAuthProxyRuntime,
): RequestHandler {
  const metadataUrl = getProtectedResourceMetadataUrl(
    runtime.config.HARNESS_MCP_OAUTH_RESOURCE,
  );

  return async (req, res, next) => {
    if (req.path === "/health" || req.method === "OPTIONS") {
      next();
      return;
    }

    const token = bearerToken(req.headers.authorization);
    if (!token) {
      oauthError(res, metadataUrl, "OAuth access token required");
      return;
    }

    let identity: VerifiedIdentity;
    try {
      identity = await verifyUpstreamAccessToken(runtime, token);
    } catch (error) {
      log.warn("Upstream access token rejected", { error: errorMessage(error) });
      oauthError(res, metadataUrl, "Invalid upstream access token", true);
      return;
    }

    try {
      const result = await withIdentityLock(runtime, identity, async () => {
        const record = await runtime.vault.getRecord(identity.issuer, identity.subject);
        if (!record?.linked) return undefined;
        return exchangeHarnessToken(runtime, identity, record, token);
      });
      if (!result) {
        await sendLinkRequired(runtime, identity, res, metadataUrl);
        return;
      }

      res.locals.harnessOAuthClaims = result.claims;
      res.locals.harnessOAuthAccessToken = result.accessToken;
      res.locals.harnessOAuthAccountId = result.accountId;
      res.locals.harnessOAuthIdentitySubject = identity.subject;
      res.locals.upstreamOAuthClaims = identity.claims;
      next();
    } catch (error) {
      if (error instanceof TokenEndpointError && error.invalidGrant) {
        await runtime.vault.deleteRecord(identity.issuer, identity.subject);
        await sendLinkRequired(runtime, identity, res, metadataUrl);
        return;
      }
      log.error("HarnessID token exchange failed", { error: errorMessage(error) });
      res.status(502).json({
        jsonrpc: "2.0",
        error: { code: -32002, message: "HarnessID token exchange failed" },
        id: null,
      });
    }
  };
}

async function exchangeHarnessToken(
  runtime: OAuthProxyRuntime,
  identity: VerifiedIdentity,
  record: OAuthProxyVaultRecord,
  upstreamToken: string,
): Promise<{ accessToken: string; claims: JwtPayload; accountId: string }> {
  const tokens = runtime.config.HARNESS_MCP_OAUTH_PROXY_GRANT === "refresh"
    ? await harnessGrant(runtime, {
      grant_type: "refresh_token",
      refresh_token: record.refreshToken ?? "",
      scope: runtime.config.HARNESS_MCP_OAUTH_SCOPES,
    })
    : await harnessGrant(runtime, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: upstreamToken,
      scope: runtime.config.HARNESS_MCP_OAUTH_SCOPES,
    });

  if (
    runtime.config.HARNESS_MCP_OAUTH_PROXY_GRANT === "refresh"
    && tokens.refreshToken
  ) {
    await runtime.vault.putRecord(
      identity.issuer,
      identity.subject,
      {
        linked: true,
        refreshToken: tokens.refreshToken,
        updatedAt: new Date().toISOString(),
      },
    );
  }
  return verifyHarnessToken(runtime, tokens.accessToken);
}

async function verifyHarnessToken(
  runtime: OAuthProxyRuntime,
  accessToken: string,
): Promise<{ accessToken: string; claims: JwtPayload; accountId: string }> {
  const claims = await runtime.harnessVerifier.verify(accessToken);
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("HarnessID access token is missing sub.");
  }
  if (claims.azp !== runtime.config.HARNESS_MCP_OAUTH_CLIENT_ID) {
    throw new Error(
      `HarnessID token was not issued to "${runtime.config.HARNESS_MCP_OAUTH_CLIENT_ID}".`,
    );
  }
  const accountId = claims[runtime.config.HARNESS_MCP_OAUTH_ACCOUNT_CLAIM];
  if (typeof accountId !== "string" || accountId.length === 0) {
    throw new Error(
      `HarnessID access token is missing ${runtime.config.HARNESS_MCP_OAUTH_ACCOUNT_CLAIM}.`,
    );
  }
  return { accessToken, claims, accountId };
}

async function exchangeHarnessCode(
  runtime: OAuthProxyRuntime,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  return harnessGrant(runtime, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
}

async function harnessGrant(
  runtime: OAuthProxyRuntime,
  fields: Record<string, string>,
): Promise<TokenResponse> {
  const clientId = runtime.config.HARNESS_MCP_OAUTH_CLIENT_ID;
  const clientSecret = required(runtime.config, "HARNESS_MCP_OAUTH_CLIENT_SECRET");
  const body = new URLSearchParams({
    ...fields,
    client_id: clientId,
    client_secret: clientSecret,
  });
  log.info("HarnessID token request", {
    grantType: fields.grant_type,
    assertion: describeReceivedJwt(fields.assertion),
  });
  const response = await runtime.fetchImpl(
    `${runtime.config.HARNESS_MCP_OAUTH_ISSUER.replace(/\/+$/, "")}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    log.warn("HarnessID token response rejected", {
      status: response.status,
      body: text,
    });
    throw new TokenEndpointError(response.status, text);
  }
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (typeof parsed.access_token !== "string") {
    throw new Error("HarnessID token response did not include access_token.");
  }
  log.info("HarnessID token response", {
    accessToken: describeReceivedJwt(parsed.access_token),
    idToken: typeof parsed.id_token === "string"
      ? describeReceivedJwt(parsed.id_token)
      : undefined,
    hasRefreshToken: typeof parsed.refresh_token === "string",
    expiresIn: parsed.expires_in,
    scope: parsed.scope,
  });
  return {
    accessToken: parsed.access_token,
    refreshToken: typeof parsed.refresh_token === "string" ? parsed.refresh_token : undefined,
    idToken: typeof parsed.id_token === "string" ? parsed.id_token : undefined,
    expiresIn: typeof parsed.expires_in === "number" ? parsed.expires_in : undefined,
  };
}

export function buildHarnessAuthorizationUrl(
  config: Config,
  state: string,
  verifier: string,
  redirectUri: string,
): string {
  const url = new URL(
    `${config.HARNESS_MCP_OAUTH_ISSUER.replace(/\/+$/, "")}/protocol/openid-connect/auth`,
  );
  url.searchParams.set("client_id", config.HARNESS_MCP_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.HARNESS_MCP_OAUTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", oauthPkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("kc_idp_hint", config.HARNESS_MCP_OAUTH_IDP_HINT);
  url.searchParams.set("prompt", "login");
  return url.toString();
}

function callbackUrl(config: Config): string {
  return `${required(config, "HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL").replace(/\/+$/, "")}/oauth/callback`;
}

const VERIFIED_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function claimString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizedEmail(value: unknown): string | undefined {
  const email = claimString(value)?.trim().toLowerCase();
  return email && VERIFIED_EMAIL_PATTERN.test(email) ? email : undefined;
}

export function verifiedEmail(claims: JwtPayload): string | undefined {
  if (claims.email_verified === false || claims.email_verified === "false") return undefined;
  return normalizedEmail(claims.email);
}

export function upstreamSubjectsMatch(accessClaims: JwtPayload, idClaims: JwtPayload): boolean {
  const accessSub = claimString(accessClaims.sub);
  const idSub = claimString(idClaims.sub);
  if (accessSub && idSub && accessSub === idSub) return true;
  const accessUid = claimString(accessClaims.uid);
  if (accessUid && idSub && accessUid === idSub) return true;
  const idNames = [
    verifiedEmail(idClaims),
    normalizedEmail(idClaims.preferred_username),
    claimString(idClaims.preferred_username)?.toLowerCase(),
  ];
  const accessNames = [
    verifiedEmail(accessClaims),
    normalizedEmail(accessClaims.preferred_username),
    claimString(accessClaims.preferred_username)?.toLowerCase(),
  ];
  if (accessSub && idNames.includes(accessSub.toLowerCase())) return true;
  if (idSub && accessNames.includes(idSub.toLowerCase())) return true;
  const idEmail = verifiedEmail(idClaims);
  const accessEmail = verifiedEmail(accessClaims);
  return idEmail !== undefined && idEmail === accessEmail;
}

function assertLinkedIdentity(
  config: Config,
  upstreamSubject: string,
  claims: JwtPayload,
  alternateSubjects: readonly string[] = [],
): void {
  const identifiers = [upstreamSubject, ...alternateSubjects];
  const claimName = config.HARNESS_MCP_OAUTH_EXTERNAL_SUB_CLAIM;
  const externalSubject = claims[claimName];
  if (typeof externalSubject === "string" && identifiers.includes(externalSubject)) return;
  const harnessEmail = verifiedEmail(claims);
  if (harnessEmail && identifiers.some((identifier) => identifier.toLowerCase() === harnessEmail)) {
    return;
  }
  throw new Error(
    `HarnessID token claim "${claimName}" does not match the upstream subject or verified email. ` +
    "Configure a HarnessID client mapper for the broker user ID, or include a verified email claim.",
  );
}

export async function verifyUpstreamAccessToken(
  runtime: OAuthProxyRuntime,
  token: string,
): Promise<VerifiedIdentity> {
  const claims = await runtime.upstreamVerifier.verify(token);
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("Upstream access token is missing sub.");
  }
  return {
    issuer: required(runtime.config, "HARNESS_MCP_UPSTREAM_ISSUER"),
    subject: claims.sub,
    claims,
  };
}

export async function completeHarnessAuthorization(
  runtime: OAuthProxyRuntime,
  upstreamSubject: string,
  code: string,
  verifier: string,
  redirectUri: string,
  alternateSubjects: readonly string[] = [],
): Promise<{ accessToken: string; claims: JwtPayload; accountId: string }> {
  const tokens = await exchangeHarnessCode(runtime, code, verifier, redirectUri);
  const harness = await verifyHarnessToken(runtime, tokens.accessToken);
  assertLinkedIdentity(runtime.config, upstreamSubject, harness.claims, alternateSubjects);
  if (
    runtime.config.HARNESS_MCP_OAUTH_PROXY_GRANT === "refresh"
    && !tokens.refreshToken
  ) {
    throw new Error("HarnessID did not return a refresh token.");
  }
  await runtime.vault.putRecord(
    required(runtime.config, "HARNESS_MCP_UPSTREAM_ISSUER"),
    upstreamSubject,
    {
      linked: true,
      refreshToken: runtime.config.HARNESS_MCP_OAUTH_PROXY_GRANT === "refresh"
        ? tokens.refreshToken
        : undefined,
      updatedAt: new Date().toISOString(),
    },
  );
  return harness;
}

async function sendLinkRequired(
  runtime: OAuthProxyRuntime,
  identity: VerifiedIdentity,
  res: Parameters<RequestHandler>[1],
  metadataUrl: string,
): Promise<void> {
  const transactionId = randomOAuthToken();
  await runtime.vault.putTransaction(transactionId, {
    issuer: identity.issuer,
    subject: identity.subject,
    state: randomOAuthToken(),
    codeVerifier: randomOAuthToken(),
    expiresAt: Date.now() + runtime.config.HARNESS_MCP_OAUTH_PROXY_LINK_TTL_MS,
  });
  const verificationUri = new URL(
    "/oauth/link",
    required(runtime.config, "HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL"),
  );
  verificationUri.searchParams.set("txn", transactionId);
  res.setHeader(
    "WWW-Authenticate",
    `Bearer error="insufficient_authorization", resource_metadata="${metadataUrl}"`,
  );
  res.status(401).json({
    error: "authorization_required",
    verification_uri_complete: verificationUri.toString(),
    expires_in: Math.floor(runtime.config.HARNESS_MCP_OAUTH_PROXY_LINK_TTL_MS / 1000),
  });
}

async function withIdentityLock<T>(
  runtime: OAuthProxyRuntime,
  identity: VerifiedIdentity,
  work: () => Promise<T>,
): Promise<T> {
  const key = `${identity.issuer}\n${identity.subject}`;
  const previous = runtime.exchangeLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  runtime.exchangeLocks.set(key, tail);
  await previous;
  try {
    if (runtime.vault.withLock) return await runtime.vault.withLock(key, work);
    return await work();
  } finally {
    release();
    if (runtime.exchangeLocks.get(key) === tail) runtime.exchangeLocks.delete(key);
  }
}

function oauthError(
  res: Parameters<RequestHandler>[1],
  metadataUrl: string,
  message: string,
  invalid = false,
): void {
  res.setHeader(
    "WWW-Authenticate",
    invalid
      ? `Bearer error="invalid_token", resource_metadata="${metadataUrl}"`
      : `Bearer resource_metadata="${metadataUrl}"`,
  );
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  return /^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1];
}

export function randomOAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export function oauthPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function clip(value: string, max = 400): string {
  return value.replace(/\s+/g, " ").slice(0, max);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}
