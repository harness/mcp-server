import { createHash, timingSafeEqual } from "node:crypto";
import { urlencoded, type Express, type Request, type Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import type { Config } from "../config.js";
import { createLogger } from "./logger.js";
import {
  buildHarnessAuthorizationUrl,
  completeHarnessAuthorization,
  oauthPkceChallenge,
  randomOAuthToken,
  describeReceivedJwt,
  upstreamSubjectsMatch,
  type OAuthProxyRuntime,
  verifyUpstreamAccessToken,
} from "./oauth-proxy.js";
import type {
  OAuthBrokerAuthorizationCode,
  OAuthBrokerTransaction,
  UpstreamTokenBundle,
} from "./oauth-proxy-vault.js";

const log = createLogger("oauth-broker");
const FORM_LIMIT = "32kb";

interface UpstreamMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
}

interface UpstreamTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
  error_description?: unknown;
}

export interface OAuthBrokerRuntime {
  proxy: OAuthProxyRuntime;
  metadata?: UpstreamMetadata;
}

export function createOAuthBrokerRuntime(proxy: OAuthProxyRuntime): OAuthBrokerRuntime {
  return { proxy };
}

export function brokerIssuer(config: Config): string {
  return required(config, "HARNESS_MCP_BROKER_ISSUER").replace(/\/+$/, "");
}

export function brokerProtectedResourceConfig(config: Config): {
  HARNESS_MCP_OAUTH_ISSUER: string;
  HARNESS_MCP_OAUTH_RESOURCE: string;
  HARNESS_MCP_OAUTH_JWKS_URI: string;
  HARNESS_MCP_OAUTH_SCOPES: string;
} {
  return {
    HARNESS_MCP_OAUTH_ISSUER: brokerIssuer(config),
    HARNESS_MCP_OAUTH_RESOURCE: config.HARNESS_MCP_OAUTH_RESOURCE,
    HARNESS_MCP_OAUTH_JWKS_URI: required(config, "HARNESS_MCP_UPSTREAM_JWKS_URI"),
    HARNESS_MCP_OAUTH_SCOPES: config.HARNESS_MCP_UPSTREAM_SCOPES,
  };
}

export function buildAuthorizationServerMetadata(config: Config): Record<string, unknown> {
  const issuer = brokerIssuer(config);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: configuredScopes(config),
    authorization_response_iss_parameter_supported: true,
  };
}

export function registerOAuthBrokerRoutes(
  app: Express,
  runtime: OAuthBrokerRuntime,
): void {
  const oauthHits = new Map<string, { count: number; resetAt: number }>();
  app.use("/oauth", (req, res, next) => {
    const now = Date.now();
    if (oauthHits.size > 1_000) {
      for (const [ip, value] of oauthHits) {
        if (value.resetAt <= now) oauthHits.delete(ip);
      }
    }
    const key = req.ip ?? "unknown";
    const current = oauthHits.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + 5 * 60_000 }
      : current;
    entry.count++;
    oauthHits.set(key, entry);
    if (entry.count > 120) {
      res.status(429).json({
        error: "temporarily_unavailable",
        error_description: "Too many OAuth requests.",
      });
      return;
    }
    next();
  });
  const metadata = buildAuthorizationServerMetadata(runtime.proxy.config);
  app.get("/.well-known/oauth-authorization-server", (_req, res) => res.json(metadata));

  app.get("/oauth/authorize", async (req, res) => {
    try {
      const config = runtime.proxy.config;
      const clientId = requiredQuery(req, "client_id");
      const redirectUri = requiredQuery(req, "redirect_uri");
      const state = requiredQuery(req, "state");
      const resource = requiredQuery(req, "resource");
      const scope = requiredQuery(req, "scope");
      const codeChallenge = requiredQuery(req, "code_challenge");
      if (requiredQuery(req, "response_type") !== "code") {
        throw new OAuthRequestError("unsupported_response_type", "Only response_type=code is supported.");
      }
      if (clientId !== config.HARNESS_MCP_BROKER_CLIENT_ID) {
        throw new OAuthRequestError("unauthorized_client", "Unknown OAuth client.");
      }
      if (!allowedRedirectUris(config).has(redirectUri)) {
        throw new OAuthRequestError("invalid_request", "The redirect_uri is not registered.");
      }
      if (resource !== config.HARNESS_MCP_OAUTH_RESOURCE) {
        throw new OAuthRequestError("invalid_target", "The resource does not identify this MCP server.");
      }
      if (requiredQuery(req, "code_challenge_method") !== "S256" || !validPkceValue(codeChallenge)) {
        throw new OAuthRequestError("invalid_request", "S256 PKCE is required.");
      }
      validateScopes(config, scope);

      const id = randomOAuthToken();
      const upstreamState = randomOAuthToken();
      const upstreamVerifier = randomOAuthToken();
      const upstreamNonce = randomOAuthToken();
      const transaction: OAuthBrokerTransaction = {
        clientId,
        redirectUri,
        clientState: state,
        resource,
        scope,
        codeChallenge,
        upstreamState,
        upstreamCodeVerifier: upstreamVerifier,
        upstreamNonce,
        expiresAt: Date.now() + config.HARNESS_MCP_BROKER_TRANSACTION_TTL_MS,
      };
      await runtime.proxy.vault.putBrokerTransaction(id, transaction);
      const expiryTimer = setTimeout(() => {
        runtime.proxy.vault.deleteBrokerTransaction(id).catch((error) => {
          log.warn("Failed to expire OAuth broker transaction", {
            error: errorMessage(error),
          });
        });
      }, config.HARNESS_MCP_BROKER_TRANSACTION_TTL_MS);
      expiryTimer.unref();

      const upstream = await upstreamMetadata(runtime);
      const authorizationUrl = new URL(upstream.authorization_endpoint);
      authorizationUrl.searchParams.set("client_id", required(config, "HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID"));
      authorizationUrl.searchParams.set("redirect_uri", upstreamCallbackUrl(config));
      authorizationUrl.searchParams.set("response_type", "code");
      authorizationUrl.searchParams.set("scope", scope);
      authorizationUrl.searchParams.set("state", upstreamState);
      authorizationUrl.searchParams.set("nonce", upstreamNonce);
      authorizationUrl.searchParams.set("code_challenge", oauthPkceChallenge(upstreamVerifier));
      authorizationUrl.searchParams.set("code_challenge_method", "S256");
      res.redirect(authorizationUrl.toString());
    } catch (error) {
      sendAuthorizationError(res, error);
    }
  });

  app.get("/oauth/upstream/callback", async (req, res) => {
    const state = queryString(req.query.state);
    const found = state
      ? await runtime.proxy.vault.takeBrokerTransactionByUpstreamState(state)
      : undefined;
    if (!found) {
      res.status(400).type("html").send(errorPage("Upstream login state is missing or expired."));
      return;
    }
    const transaction = found.transaction;
    const providerError = queryString(req.query.error);
    if (providerError) {
      redirectOAuthError(runtime.proxy.config, res, transaction, providerError, queryString(req.query.error_description));
      return;
    }
    const code = queryString(req.query.code);
    if (!code) {
      redirectOAuthError(runtime.proxy.config, res, transaction, "invalid_request", "The upstream provider did not return a code.");
      return;
    }

    try {
      const tokens = await exchangeUpstreamCode(runtime, code, transaction.upstreamCodeVerifier);
      const identity = await verifyUpstreamAccessToken(runtime.proxy, tokens.accessToken);
      const idClaims = await verifyUpstreamIdToken(
        runtime,
        tokens.idToken,
        transaction.upstreamNonce,
        identity.claims,
      );
      const linked = await runtime.proxy.vault.getRecord(identity.issuer, identity.subject);
      const next: OAuthBrokerTransaction = {
        ...transaction,
        upstreamIssuer: identity.issuer,
        upstreamSubject: identity.subject,
        upstreamIdSubject: typeof idClaims.sub === "string" ? idClaims.sub : undefined,
        upstreamTokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: tokens.tokenType,
          expiresIn: tokens.expiresIn,
          expiresAt: tokens.expiresAt,
          scope: tokens.scope,
        },
      };
      if (linked?.linked) {
        await issueCursorAuthorizationCode(runtime, next, res);
        return;
      }

      next.harnessState = randomOAuthToken();
      next.harnessCodeVerifier = randomOAuthToken();
      await runtime.proxy.vault.putBrokerTransaction(found.id, next);
      res.redirect(buildHarnessAuthorizationUrl(
        runtime.proxy.config,
        next.harnessState,
        next.harnessCodeVerifier,
        harnessCallbackUrl(runtime.proxy.config),
      ));
    } catch (error) {
      log.warn("Upstream OAuth callback rejected", { error: errorMessage(error) });
      redirectOAuthError(runtime.proxy.config, res, transaction, "access_denied", "Upstream login could not be verified.");
    }
  });

  app.get("/oauth/harnessid/callback", async (req, res) => {
    const state = queryString(req.query.state);
    const found = state
      ? await runtime.proxy.vault.takeBrokerTransactionByHarnessState(state)
      : undefined;
    if (!found) {
      res.status(400).type("html").send(errorPage("HarnessID login state is missing or expired."));
      return;
    }
    const transaction = found.transaction;
    const providerError = queryString(req.query.error);
    if (providerError) {
      redirectOAuthError(runtime.proxy.config, res, transaction, providerError, queryString(req.query.error_description));
      return;
    }
    const code = queryString(req.query.code);
    if (
      !code
      || !transaction.upstreamSubject
      || !transaction.upstreamTokens
      || !transaction.harnessCodeVerifier
    ) {
      redirectOAuthError(runtime.proxy.config, res, transaction, "invalid_request", "The authorization transaction is incomplete.");
      return;
    }
    try {
      await completeHarnessAuthorization(
        runtime.proxy,
        transaction.upstreamSubject,
        code,
        transaction.harnessCodeVerifier,
        harnessCallbackUrl(runtime.proxy.config),
        transaction.upstreamIdSubject ? [transaction.upstreamIdSubject] : [],
      );
      await issueCursorAuthorizationCode(runtime, transaction, res);
    } catch (error) {
      log.warn("HarnessID broker callback rejected", { error: errorMessage(error) });
      redirectOAuthError(runtime.proxy.config, res, transaction, "access_denied", "HarnessID linking could not be verified.");
    }
  });

  app.post(
    "/oauth/token",
    urlencoded({ extended: false, limit: FORM_LIMIT }),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      try {
        const grantType = formString(req, "grant_type");
        if (grantType === "authorization_code") {
          await redeemAuthorizationCode(runtime, req, res);
          return;
        }
        if (grantType === "refresh_token") {
          await refreshUpstreamToken(runtime, req, res);
          return;
        }
        throw new OAuthRequestError("unsupported_grant_type", "Unsupported grant_type.");
      } catch (error) {
        sendTokenError(res, error);
      }
    },
  );
}

async function redeemAuthorizationCode(
  runtime: OAuthBrokerRuntime,
  req: Request,
  res: Response,
): Promise<void> {
  validateTokenClient(runtime.proxy.config, req);
  const rawCode = requiredForm(req, "code");
  const stored = await runtime.proxy.vault.takeBrokerCode(codeDigest(rawCode));
  if (!stored) throw new OAuthRequestError("invalid_grant", "Authorization code is invalid or expired.");
  if (
    requiredForm(req, "redirect_uri") !== stored.redirectUri
    || optionalForm(req, "resource") !== stored.resource
    || !pkceMatches(requiredForm(req, "code_verifier"), stored.codeChallenge)
  ) {
    throw new OAuthRequestError("invalid_grant", "Authorization code binding validation failed.");
  }
  sendUpstreamTokens(res, stored.upstreamTokens);
}

async function refreshUpstreamToken(
  runtime: OAuthBrokerRuntime,
  req: Request,
  res: Response,
): Promise<void> {
  validateTokenClient(runtime.proxy.config, req);
  const refreshToken = requiredForm(req, "refresh_token");
  const upstream = await upstreamMetadata(runtime);
  const response = await postUpstreamToken(runtime, upstream.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: optionalForm(req, "scope") ?? runtime.proxy.config.HARNESS_MCP_UPSTREAM_SCOPES,
  });
  sendUpstreamTokens(res, response);
}

async function exchangeUpstreamCode(
  runtime: OAuthBrokerRuntime,
  code: string,
  verifier: string,
): Promise<UpstreamTokenBundle & { idToken?: string }> {
  const upstream = await upstreamMetadata(runtime);
  return postUpstreamToken(runtime, upstream.token_endpoint, {
    grant_type: "authorization_code",
    code,
    redirect_uri: upstreamCallbackUrl(runtime.proxy.config),
    code_verifier: verifier,
  });
}

async function postUpstreamToken(
  runtime: OAuthBrokerRuntime,
  endpoint: string,
  fields: Record<string, string>,
): Promise<UpstreamTokenBundle & { idToken?: string }> {
  const config = runtime.proxy.config;
  const clientId = required(config, "HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID");
  const clientSecret = required(config, "HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET");
  const response = await runtime.proxy.fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as UpstreamTokenResponse;
  if (!response.ok || typeof body.access_token !== "string") {
    throw new OAuthRequestError(
      typeof body.error === "string" ? body.error : "invalid_grant",
      typeof body.error_description === "string"
        ? body.error_description
        : `Upstream token endpoint returned HTTP ${response.status}.`,
    );
  }
  log.info("Upstream token response", {
    accessToken: describeReceivedJwt(body.access_token),
    idToken: typeof body.id_token === "string" ? describeReceivedJwt(body.id_token) : undefined,
    hasRefreshToken: typeof body.refresh_token === "string",
    expiresIn: body.expires_in,
    scope: body.scope,
  });
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : undefined;
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : undefined,
    idToken: typeof body.id_token === "string" ? body.id_token : undefined,
    tokenType: typeof body.token_type === "string" ? body.token_type : "Bearer",
    expiresIn,
    expiresAt: expiresIn === undefined ? undefined : Date.now() + expiresIn * 1000,
    scope: typeof body.scope === "string" ? body.scope : undefined,
  };
}

async function verifyUpstreamIdToken(
  runtime: OAuthBrokerRuntime,
  idToken: string | undefined,
  nonce: string,
  accessClaims: JwtPayload,
): Promise<JwtPayload> {
  if (!idToken) throw new Error("Upstream token response did not include id_token.");
  const claims = await runtime.proxy.upstreamIdVerifier.verify(idToken);
  if (claims.nonce !== nonce) {
    throw new Error("Upstream ID token nonce does not match the authorization transaction.");
  }
  if (!upstreamSubjectsMatch(accessClaims, claims)) {
    log.warn("Upstream identity claims did not match", {
      accessClaims: Object.keys(accessClaims).sort(),
      idClaims: Object.keys(claims).sort(),
    });
    throw new Error("Upstream ID token subject does not match the access token subject or verified email.");
  }
  return claims;
}

async function issueCursorAuthorizationCode(
  runtime: OAuthBrokerRuntime,
  transaction: OAuthBrokerTransaction,
  res: Response,
): Promise<void> {
  if (
    !transaction.upstreamIssuer
    || !transaction.upstreamSubject
    || !transaction.upstreamTokens
  ) {
    throw new Error("Upstream authorization is incomplete.");
  }
  const rawCode = randomOAuthToken();
  const code: OAuthBrokerAuthorizationCode = {
    clientId: transaction.clientId,
    redirectUri: transaction.redirectUri,
    resource: transaction.resource,
    scope: transaction.scope,
    codeChallenge: transaction.codeChallenge,
    upstreamIssuer: transaction.upstreamIssuer,
    upstreamSubject: transaction.upstreamSubject,
    upstreamTokens: transaction.upstreamTokens,
    expiresAt: Date.now() + runtime.proxy.config.HARNESS_MCP_BROKER_CODE_TTL_MS,
  };
  const digest = codeDigest(rawCode);
  await runtime.proxy.vault.putBrokerCode(digest, code);
  const expiryTimer = setTimeout(() => {
    runtime.proxy.vault.takeBrokerCode(digest).catch((error) => {
      log.warn("Failed to expire OAuth broker authorization code", {
        error: errorMessage(error),
      });
    });
  }, runtime.proxy.config.HARNESS_MCP_BROKER_CODE_TTL_MS);
  expiryTimer.unref();
  const callback = new URL(transaction.redirectUri);
  callback.searchParams.set("code", rawCode);
  callback.searchParams.set("state", transaction.clientState);
  callback.searchParams.set("iss", brokerIssuer(runtime.proxy.config));
  res.redirect(callback.toString());
}

async function upstreamMetadata(runtime: OAuthBrokerRuntime): Promise<UpstreamMetadata> {
  if (runtime.metadata) return runtime.metadata;
  const response = await runtime.proxy.fetchImpl(
    required(runtime.proxy.config, "HARNESS_MCP_UPSTREAM_DISCOVERY_URI"),
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Upstream discovery returned HTTP ${response.status}.`);
  }
  const value = await response.json() as Partial<UpstreamMetadata>;
  const expectedIssuer = required(runtime.proxy.config, "HARNESS_MCP_UPSTREAM_ISSUER").replace(/\/+$/, "");
  if (
    value.issuer?.replace(/\/+$/, "") !== expectedIssuer
    || typeof value.authorization_endpoint !== "string"
    || typeof value.token_endpoint !== "string"
  ) {
    throw new Error("Upstream discovery metadata is incomplete or has the wrong issuer.");
  }
  runtime.metadata = {
    issuer: expectedIssuer,
    authorization_endpoint: value.authorization_endpoint,
    token_endpoint: value.token_endpoint,
  };
  return runtime.metadata;
}

function sendUpstreamTokens(res: Response, tokens: UpstreamTokenBundle): void {
  const expiresIn = tokens.expiresAt === undefined
    ? tokens.expiresIn
    : Math.max(1, Math.floor((tokens.expiresAt - Date.now()) / 1000));
  res.json({
    access_token: tokens.accessToken,
    token_type: tokens.tokenType,
    ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    ...(expiresIn !== undefined ? { expires_in: expiresIn } : {}),
    ...(tokens.scope ? { scope: tokens.scope } : {}),
  });
}

function validateTokenClient(config: Config, req: Request): void {
  if (requiredForm(req, "client_id") !== config.HARNESS_MCP_BROKER_CLIENT_ID) {
    throw new OAuthRequestError("invalid_client", "Unknown OAuth client.");
  }
}

function validateScopes(config: Config, scope: string): void {
  const allowed = new Set(configuredScopes(config));
  const requested = scope.split(/\s+/).filter(Boolean);
  if (requested.length === 0 || requested.some((value) => !allowed.has(value))) {
    throw new OAuthRequestError("invalid_scope", "One or more requested scopes are not allowed.");
  }
}

function configuredScopes(config: Config): string[] {
  return config.HARNESS_MCP_UPSTREAM_SCOPES.split(/\s+/).filter(Boolean);
}

function allowedRedirectUris(config: Config): Set<string> {
  return new Set(
    config.HARNESS_MCP_BROKER_REDIRECT_URIS
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function upstreamCallbackUrl(config: Config): string {
  return `${brokerIssuer(config)}/oauth/upstream/callback`;
}

function harnessCallbackUrl(config: Config): string {
  return `${brokerIssuer(config)}/oauth/harnessid/callback`;
}

function redirectOAuthError(
  config: Config,
  res: Response,
  transaction: OAuthBrokerTransaction,
  error: string,
  description?: string,
): void {
  const callback = new URL(transaction.redirectUri);
  callback.searchParams.set("error", error);
  if (description) callback.searchParams.set("error_description", description);
  callback.searchParams.set("state", transaction.clientState);
  callback.searchParams.set("iss", brokerIssuer(config));
  res.redirect(callback.toString());
}

function sendAuthorizationError(res: Response, error: unknown): void {
  const requestError = oauthRequestError(error);
  res.status(400).json({
    error: requestError.code,
    error_description: requestError.message,
  });
}

function sendTokenError(res: Response, error: unknown): void {
  const requestError = oauthRequestError(error);
  const status = requestError.code === "invalid_client" ? 401 : 400;
  res.status(status).json({
    error: requestError.code,
    error_description: requestError.message,
  });
}

class OAuthRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function oauthRequestError(error: unknown): OAuthRequestError {
  return error instanceof OAuthRequestError
    ? error
    : new OAuthRequestError("server_error", "The authorization server could not complete the request.");
}

function required(config: Config, name: keyof Config): string {
  const value = config[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`OAuth broker configuration is missing ${String(name)}.`);
  }
  return value;
}

function requiredQuery(req: Request, name: string): string {
  const value = queryString(req.query[name]);
  if (!value) throw new OAuthRequestError("invalid_request", `Missing ${name}.`);
  return value;
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formString(req: Request, name: string): string | undefined {
  const value = (req.body as Record<string, unknown> | undefined)?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalForm(req: Request, name: string): string | undefined {
  return formString(req, name);
}

function requiredForm(req: Request, name: string): string {
  const value = formString(req, name);
  if (!value) throw new OAuthRequestError("invalid_request", `Missing ${name}.`);
  return value;
}

function validPkceValue(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

function pkceMatches(verifier: string, expectedChallenge: string): boolean {
  if (!validPkceValue(verifier)) return false;
  const actual = Buffer.from(oauthPkceChallenge(verifier));
  const expected = Buffer.from(expectedChallenge);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function codeDigest(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>OAuth login failed</title></head><body><h1>OAuth login failed</h1><p>${escapeHtml(message)}</p></body></html>`;
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
