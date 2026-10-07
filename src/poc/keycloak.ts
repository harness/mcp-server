import jwt from "jsonwebtoken";
import { keycloakForwardedHeaders, keycloakRealmUrl, type PocConfig } from "./config.js";
import { pkceChallenge } from "./pkce.js";

export interface KeycloakTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
}

export function keycloakAuthorizeUrl(config: PocConfig, state: string, verifier: string): string {
  const url = new URL(`${keycloakRealmUrl(config)}/protocol/openid-connect/auth`);
  url.searchParams.set("client_id", config.keycloakClientId);
  url.searchParams.set("redirect_uri", `${config.publicUrl}/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.keycloakScopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("kc_idp_hint", config.keycloakIdpHint);
  // A realm SSO cookie would otherwise skip the identity provider and reuse the
  // existing Harness session, so Okta never gets linked.
  url.searchParams.set("prompt", "login");
  return url.toString();
}

export function oktaAuthorizeUrl(config: PocConfig, state: string, verifier: string): string {
  const url = new URL(`${config.oktaIssuer}/v1/authorize`);
  url.searchParams.set("client_id", config.oktaClientId);
  url.searchParams.set("redirect_uri", `${config.publicUrl}/okta/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.oktaScopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeOktaCode(
  config: PocConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${config.publicUrl}/okta/callback`,
    client_id: config.oktaClientId,
    client_secret: config.oktaClientSecret,
    code_verifier: verifier,
  });
  const tokens = await postForm(`${config.oktaIssuer}/v1/token`, body, undefined, fetchImpl);
  return tokens.accessToken;
}

export function exchangeKeycloakCode(
  config: PocConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KeycloakTokens> {
  return keycloakGrant(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: `${config.publicUrl}/callback`,
    code_verifier: verifier,
  }, fetchImpl);
}

export function refreshKeycloakToken(
  config: PocConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KeycloakTokens> {
  return keycloakGrant(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: config.keycloakScopes,
  }, fetchImpl);
}

export function exchangeKeycloakJwt(
  config: PocConfig,
  assertion: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KeycloakTokens> {
  return keycloakGrant(config, {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
    scope: config.keycloakScopes,
  }, fetchImpl);
}

export interface HarnessCall {
  path: string;
  status: number;
  body: string;
}

const HARNESS_PROBE_PATHS = [
  "/cli/ng/api/user/currentUser",
  "/cli/ng/api/organizations?pageIndex=0&pageSize=5",
];

export function harnessProbePaths(accessToken: string): string[] {
  const accountId = tokenClaims(accessToken).account_id;
  if (typeof accountId !== "string" || accountId.length === 0) return [...HARNESS_PROBE_PATHS];
  return HARNESS_PROBE_PATHS.map((path) => appendQuery(path, "accountIdentifier", accountId));
}

export async function probeHarnessApi(
  baseUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HarnessCall[]> {
  const calls: HarnessCall[] = [];
  for (const path of harnessProbePaths(accessToken)) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    calls.push({
      path,
      status: response.status,
      body: clip(await response.text(), 1200),
    });
  }
  return calls;
}

export function accessTokenSummary(token: string): Record<string, unknown> {
  const claims = tokenClaims(token);
  return {
    iss: claims.iss ?? null,
    azp: claims.azp ?? null,
    aud: claims.aud ?? null,
    account_id: claims.account_id ?? null,
    scope: claims.scope ?? null,
    sub: claims.sub ?? null,
  };
}

export async function keycloakUserInfo(
  config: PocConfig,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(`${keycloakRealmUrl(config)}/protocol/openid-connect/userinfo`, {
    headers: {
      ...keycloakForwardedHeaders(config),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HarnessID userinfo failed with HTTP ${response.status}: ${clip(text)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

export function externalSubject(idToken: string | undefined, claim: string): string | undefined {
  const value = tokenClaims(idToken)[claim];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function tokenClaims(token: string | undefined): Record<string, unknown> {
  if (!token) return {};
  const payload = jwt.decode(token);
  if (!payload || typeof payload === "string") return {};
  return payload;
}

export function findLinkedSubject(
  oktaSubject: string,
  idpAlias: string,
  tokens: Array<string | undefined>,
): string | undefined {
  for (const token of tokens) {
    for (const value of Object.values(tokenClaims(token))) {
      if (typeof value !== "string") continue;
      if (
        value === oktaSubject
        || value === `${idpAlias}.${oktaSubject}`
        || value.endsWith(`.${oktaSubject}`)
      ) {
        return value;
      }
    }
  }
  return undefined;
}

export function identityClaims(token: string | undefined): Record<string, string> {
  const claims = tokenClaims(token);
  const selected = [
    "sub",
    "email",
    "preferred_username",
    "external_sub",
    "identity_provider",
    "identity_provider_identity",
    "broker.user.id",
  ];
  const result: Record<string, string> = {};
  for (const name of selected) {
    const value = claims[name];
    if (typeof value === "string" && value.length > 0) result[name] = value;
  }
  result.claim_names = Object.keys(claims).sort().join(", ");
  return result;
}

async function keycloakGrant(
  config: PocConfig,
  fields: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<KeycloakTokens> {
  const body = new URLSearchParams({
    ...fields,
    client_id: config.keycloakClientId,
    client_secret: config.keycloakClientSecret,
  });
  return postForm(
    `${keycloakRealmUrl(config)}/protocol/openid-connect/token`,
    body,
    basic(config.keycloakClientId, config.keycloakClientSecret),
    fetchImpl,
    keycloakForwardedHeaders(config),
  );
}

async function postForm(
  url: string,
  body: URLSearchParams,
  authorization: string | undefined,
  fetchImpl: typeof fetch,
  extraHeaders: Record<string, string> = {},
): Promise<KeycloakTokens> {
  const headers: Record<string, string> = {
    ...extraHeaders,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (authorization) headers.Authorization = authorization;
  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Token request to ${new URL(url).pathname} failed with HTTP ${response.status}: ${clip(text)}`);
  }
  const parsed = JSON.parse(text) as {
    access_token?: unknown;
    refresh_token?: unknown;
    id_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof parsed.access_token !== "string") {
    throw new Error("Token response did not include an access_token.");
  }
  return {
    accessToken: parsed.access_token,
    refreshToken: typeof parsed.refresh_token === "string" ? parsed.refresh_token : undefined,
    idToken: typeof parsed.id_token === "string" ? parsed.id_token : undefined,
    expiresIn: typeof parsed.expires_in === "number" ? parsed.expires_in : undefined,
  };
}

function basic(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function appendQuery(path: string, name: string, value: string): string {
  const url = new URL(path, "http://probe.local");
  url.searchParams.set(name, value);
  return `${url.pathname}${url.search}`;
}

function clip(value: string, max = 400): string {
  return value.replace(/\s+/g, " ").slice(0, max);
}
