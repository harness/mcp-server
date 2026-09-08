import { createPublicKey, type JsonWebKey as NodeJsonWebKey, type KeyObject } from "node:crypto";
import type { Express, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Config } from "../config.js";
import { createLogger } from "./logger.js";

const log = createLogger("oauth-auth");
const JWKS_CACHE_TTL_MS = 5 * 60_000;

type OAuthConfig = Partial<Pick<
  Config,
  | "HARNESS_MCP_OAUTH_ISSUER"
  | "HARNESS_MCP_OAUTH_RESOURCE"
  | "HARNESS_MCP_OAUTH_JWKS_URI"
  | "HARNESS_MCP_OAUTH_CLIENT_ID"
  | "HARNESS_MCP_OAUTH_ACCOUNT_CLAIM"
  | "HARNESS_MCP_OAUTH_SCOPES"
>>;

interface OAuthJwk extends NodeJsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface JwkSet {
  keys: OAuthJwk[];
}

interface CachedJwkSet {
  expiresAt: number;
  keys: Map<string, KeyObject>;
}

function requiredOAuthConfig(config: OAuthConfig): {
  issuer: string;
  resource: string;
  jwksUri: string;
  clientId: string;
  accountClaim: string;
  scopes: string[];
} {
  const issuer = config.HARNESS_MCP_OAUTH_ISSUER;
  const resource = config.HARNESS_MCP_OAUTH_RESOURCE;
  const jwksUri = config.HARNESS_MCP_OAUTH_JWKS_URI;
  if (!issuer || !resource || !jwksUri) {
    throw new Error("HarnessID OAuth configuration is incomplete.");
  }

  return {
    issuer,
    resource,
    jwksUri,
    clientId: config.HARNESS_MCP_OAUTH_CLIENT_ID ?? "mcp-client",
    accountClaim: config.HARNESS_MCP_OAUTH_ACCOUNT_CLAIM ?? "account_id",
    scopes: (config.HARNESS_MCP_OAUTH_SCOPES ?? "openid profile email organization")
      .split(/\s+/)
      .filter(Boolean),
  };
}

function isJwkSet(value: unknown): value is JwkSet {
  if (!value || typeof value !== "object" || !("keys" in value)) return false;
  return Array.isArray((value as { keys?: unknown }).keys);
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1];
}

function protectedResourceMetadataPath(resource: string): string {
  const resourceUrl = new URL(resource);
  const suffix = resourceUrl.pathname === "/" ? "" : resourceUrl.pathname.replace(/\/+$/, "");
  return `/.well-known/oauth-protected-resource${suffix}`;
}

export function getProtectedResourceMetadataUrl(resource: string): string {
  const resourceUrl = new URL(resource);
  resourceUrl.pathname = protectedResourceMetadataPath(resource);
  resourceUrl.search = "";
  resourceUrl.hash = "";
  return resourceUrl.toString();
}

export function buildProtectedResourceMetadata(config: OAuthConfig): Record<string, unknown> {
  const { issuer, resource, scopes } = requiredOAuthConfig(config);
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
  };
}

export interface OAuthSessionCredential {
  subject: string;
  accountId: string;
  accessToken: string;
}

export function isOAuthSessionSubjectAuthorized(
  sessionSubject: string | undefined,
  requestSubject: unknown,
): boolean {
  return sessionSubject === undefined || sessionSubject === requestSubject;
}

export function refreshOAuthSessionCredential(
  session: { oauthCredential?: OAuthSessionCredential },
  locals: Record<string, unknown>,
): boolean {
  const requestSubject = locals.harnessOAuthClaims
    && typeof locals.harnessOAuthClaims === "object"
    ? (locals.harnessOAuthClaims as { sub?: unknown }).sub
    : undefined;
  if (!isOAuthSessionSubjectAuthorized(
    session.oauthCredential?.subject,
    requestSubject,
  )) {
    return false;
  }
  if (!session.oauthCredential) return true;
  if (locals.harnessOAuthAccountId !== session.oauthCredential.accountId) {
    return false;
  }
  if (typeof locals.harnessOAuthAccessToken !== "string") {
    return false;
  }
  session.oauthCredential.accessToken = locals.harnessOAuthAccessToken;
  return true;
}

export function registerOAuthProtectedResourceRoutes(app: Express, config: OAuthConfig): void {
  const { resource } = requiredOAuthConfig(config);
  const metadata = buildProtectedResourceMetadata(config);
  const paths = new Set([
    "/.well-known/oauth-protected-resource",
    protectedResourceMetadataPath(resource),
  ]);

  for (const path of paths) {
    app.get(path, (_req, res) => {
      res.json(metadata);
    });
  }
}

class JwksResolver {
  private cache?: CachedJwkSet;

  constructor(
    private readonly jwksUri: string,
    private readonly fetchImpl: typeof fetch,
  ) {}

  async get(kid: string): Promise<KeyObject> {
    const now = Date.now();
    if (!this.cache || now >= this.cache.expiresAt) {
      await this.refresh();
    }

    const key = this.cache?.keys.get(kid);
    if (!key) {
      throw new Error(`No OAuth signing key found for kid "${kid}".`);
    }
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

    const body: unknown = await response.json();
    if (!isJwkSet(body)) {
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

    this.cache = {
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
      keys,
    };
  }
}

export function createOAuthHttpAuthMiddleware(
  config: OAuthConfig,
  fetchImpl: typeof fetch = fetch,
): RequestHandler {
  const { issuer, resource, jwksUri, clientId, accountClaim } =
    requiredOAuthConfig(config);
  const metadataUrl = getProtectedResourceMetadataUrl(resource);
  const resolver = new JwksResolver(jwksUri, fetchImpl);

  return async (req, res, next) => {
    if (req.path === "/health" || req.method === "OPTIONS") {
      next();
      return;
    }

    const token = bearerToken(req.headers.authorization);
    if (!token) {
      res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${metadataUrl}"`);
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "OAuth access token required" },
        id: null,
      });
      return;
    }

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (
        !decoded
        || decoded.header.alg !== "RS256"
        || typeof decoded.header.kid !== "string"
      ) {
        throw new Error("Access token has an unsupported JWT header.");
      }

      const key = await resolver.get(decoded.header.kid);
      const claims = jwt.verify(token, key, {
        algorithms: ["RS256"],
        issuer,
      }) as JwtPayload;
      if (typeof claims.sub !== "string" || claims.sub.length === 0) {
        throw new Error("Access token is missing sub.");
      }
      if (claims.azp !== clientId) {
        throw new Error(`Access token was not issued to OAuth client "${clientId}".`);
      }
      const accountId = claims[accountClaim];
      if (typeof accountId !== "string" || accountId.length === 0) {
        throw new Error(`Access token is missing account claim "${accountClaim}".`);
      }

      res.locals.harnessOAuthClaims = claims;
      res.locals.harnessOAuthAccessToken = token;
      res.locals.harnessOAuthAccountId = accountId;
      next();
    } catch (error) {
      log.warn("OAuth access token rejected", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.setHeader(
        "WWW-Authenticate",
        `Bearer error="invalid_token", resource_metadata="${metadataUrl}"`,
      );
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Invalid OAuth access token" },
        id: null,
      });
    }
  };
}
