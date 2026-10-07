import { createPublicKey, type JsonWebKey as NodeJsonWebKey, type KeyObject } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { PocConfig } from "./config.js";

interface OAuthJwk extends NodeJsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface JwkSet {
  keys: OAuthJwk[];
}

export interface OktaUser {
  issuer: string;
  subject: string;
  token: string;
}

export async function oktaUserInfo(
  config: PocConfig,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(`${config.oktaIssuer}/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return {};
  return await response.json() as Record<string, unknown>;
}

export class OktaVerifier {
  private keys = new Map<string, KeyObject>();
  private expiresAt = 0;

  constructor(
    private readonly config: PocConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(token: string): Promise<OktaUser> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || decoded.header.alg !== "RS256" || typeof decoded.header.kid !== "string") {
      throw new Error("Okta access token must be an RS256 JWT. Use an Okta custom authorization server.");
    }
    const key = await this.key(decoded.header.kid);
    const claims = jwt.verify(token, key, {
      algorithms: ["RS256"],
      issuer: this.config.oktaIssuer,
      clockTolerance: 30,
    }) as JwtPayload;
    if (typeof claims.sub !== "string" || claims.sub.length === 0) {
      throw new Error("Okta access token is missing sub.");
    }
    if (this.config.oktaAudience && !audienceMatches(claims.aud, this.config.oktaAudience)) {
      throw new Error(`Okta access token audience does not include ${this.config.oktaAudience}.`);
    }
    return { issuer: this.config.oktaIssuer, subject: claims.sub, token };
  }

  private async key(kid: string): Promise<KeyObject> {
    if (Date.now() >= this.expiresAt || !this.keys.has(kid)) {
      await this.refresh();
    }
    const found = this.keys.get(kid);
    if (!found) throw new Error(`No Okta signing key found for kid ${kid}.`);
    return found;
  }

  private async refresh(): Promise<void> {
    const response = await this.fetchImpl(`${this.config.oktaIssuer}/v1/keys`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Okta JWKS request failed with HTTP ${response.status}.`);
    const body = await response.json() as JwkSet;
    if (!Array.isArray(body.keys)) throw new Error("Okta JWKS response has no keys.");
    const keys = new Map<string, KeyObject>();
    for (const jwk of body.keys) {
      if (typeof jwk.kid !== "string" || jwk.kty !== "RSA") continue;
      keys.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" }));
    }
    this.keys = keys;
    this.expiresAt = Date.now() + 5 * 60_000;
  }
}

function audienceMatches(audience: unknown, expected: string): boolean {
  if (typeof audience === "string") return audience === expected;
  return Array.isArray(audience) && audience.includes(expected);
}
