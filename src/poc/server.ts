import express, { type Request, type Response } from "express";
import type { Server } from "node:http";
import type { PocConfig } from "./config.js";
import {
  exchangeKeycloakCode,
  exchangeKeycloakJwt,
  exchangeOktaCode,
  accessTokenSummary,
  findLinkedSubject,
  identityClaims,
  keycloakAuthorizeUrl,
  keycloakUserInfo,
  oktaAuthorizeUrl,
  probeHarnessApi,
  refreshKeycloakToken,
  type HarnessCall,
} from "./keycloak.js";
import { OktaVerifier, oktaUserInfo } from "./okta-jwt.js";
import { randomUrlToken } from "./pkce.js";
import { TokenVault, type VaultRecord } from "./vault.js";

interface OktaLogin {
  verifier: string;
  expiresAt: number;
}

export interface PocRuntime {
  config: PocConfig;
  vault: TokenVault;
  okta: OktaVerifier;
  fetchImpl?: typeof fetch;
}

export function createPocApp(runtime: PocRuntime): express.Express {
  const fetchImpl = runtime.fetchImpl ?? fetch;
  const oktaLogins = new Map<string, OktaLogin>();
  const browserTokens = new Map<string, string>();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, laterGrant: runtime.config.laterGrant });
  });

  app.get("/", (_req, res) => {
    res.type("html").send(page("Harness upstream-identity proxy POC", `
      <p>This proxy uses Okta as the upstream identity provider and Keycloak as HarnessID.</p>
      <p>Later requests use <strong>${escapeHtml(runtime.config.laterGrant)}</strong>.</p>
      <p><a href="/okta/login">1. Sign in with Okta</a></p>
    `));
  });

  app.get("/okta/login", (_req, res) => {
    const state = randomUrlToken();
    const verifier = randomUrlToken();
    oktaLogins.set(state, { verifier, expiresAt: Date.now() + 300_000 });
    res.redirect(oktaAuthorizeUrl(runtime.config, state, verifier));
  });

  app.get("/okta/callback", async (req, res) => {
    const state = queryValue(req.query.state);
    const code = queryValue(req.query.code);
    const login = state ? oktaLogins.get(state) : undefined;
    if (state) oktaLogins.delete(state);
    if (!login || login.expiresAt <= Date.now() || !code) {
      res.status(400).type("html").send(page("Okta login failed", "<p>The Okta login state expired. Start again.</p>"));
      return;
    }
    try {
      const token = await exchangeOktaCode(runtime.config, code, login.verifier, fetchImpl);
      const session = randomUrlToken();
      browserTokens.set(session, token);
      res.type("html").send(page("Okta token ready", `
        <p>The proxy has an Okta access token for this browser session.</p>
        <form method="post" action="/harness/call">
          <input type="hidden" name="session" value="${escapeHtml(session)}">
          <button type="submit">2. Call the Harness proxy</button>
        </form>
        <p>For curl, use this local token. It is shown only on this page:</p>
        <pre>${escapeHtml(token)}</pre>
      `));
    } catch (error) {
      res.status(502).type("html").send(page("Okta token exchange failed", `<pre>${escapeHtml(message(error))}</pre>`));
    }
  });

  app.get("/link", async (req, res) => {
    const txn = queryValue(req.query.txn);
    if (!txn) {
      res.status(400).send("Missing txn.");
      return;
    }
    const transaction = await runtime.vault.getTransaction(txn);
    if (!transaction) {
      res.status(400).type("html").send(page("Link expired", "<p>Start the proxy call again.</p>"));
      return;
    }
    res.redirect(keycloakAuthorizeUrl(runtime.config, transaction.state, transaction.codeVerifier));
  });

  app.get("/callback", async (req, res) => {
    const state = queryValue(req.query.state);
    const code = queryValue(req.query.code);
    const found = state ? await runtime.vault.findTransactionByState(state) : undefined;
    if (!found || !code) {
      res.status(400).type("html").send(page("Login failed", "<p>Missing or expired Keycloak state.</p>"));
      return;
    }
    const transaction = await runtime.vault.takeTransaction(found.id, state ?? "");
    if (!transaction) {
      res.status(400).type("html").send(page("Login failed", "<p>The linking transaction expired.</p>"));
      return;
    }
    try {
      const tokens = await exchangeKeycloakCode(runtime.config, code, transaction.codeVerifier, fetchImpl);
      const linkedSubject = findLinkedSubject(
        transaction.oktaSubject,
        runtime.config.keycloakIdpHint,
        [tokens.idToken, tokens.accessToken],
      );
      const harnessEmail = identityClaims(tokens.idToken).email;
      const emailMatches = sameEmail(transaction.oktaEmail, harnessEmail);
      if (!linkedSubject && !emailMatches) {
        res.status(400).type("html").send(page("Identity link rejected", `
          <p>The HarnessID login did not contain Okta subject <code>${escapeHtml(transaction.oktaSubject)}</code>.</p>
          <p>Keycloak does not put that subject in the token unless a client mapper copies the session note <code>broker.user.id</code> into claim <code>${escapeHtml(runtime.config.externalSubClaim)}</code>.</p>
          <pre>${escapeHtml(JSON.stringify(identityClaims(tokens.idToken), null, 2))}</pre>
        `));
        return;
      }
      if (runtime.config.laterGrant === "refresh" && !tokens.refreshToken) {
        res.status(400).type("html").send(page("Refresh token missing", `
          <p>HarnessID did not return a refresh token. Enable refresh tokens for ${escapeHtml(runtime.config.keycloakClientId)}, or set POC_LATER_GRANT=jwt-bearer.</p>
        `));
        return;
      }
      await runtime.vault.putRecord(transaction.oktaIssuer, transaction.oktaSubject, {
        linked: true,
        refreshToken: runtime.config.laterGrant === "refresh" ? tokens.refreshToken : undefined,
        updatedAt: new Date().toISOString(),
      });
      const info = await keycloakUserInfo(runtime.config, tokens.accessToken, fetchImpl);
      const calls = await probeHarnessApi(runtime.config.harnessApiBase, tokens.accessToken, fetchImpl);
      const linkNote = linkedSubject
        ? ""
        : "<p>HarnessID accepted the login by email, but this token has no Okta subject. The Okta identity provider is not linked on the Harness user yet.</p>";
      res.type("html").send(resultPage(runtime.config.laterGrant, info, tokens.expiresIn, tokens.accessToken, calls, linkNote));
    } catch (error) {
      res.status(502).type("html").send(page("HarnessID login failed", `<pre>${escapeHtml(message(error))}</pre>`));
    }
  });

  app.post("/harness/call", async (req, res) => {
    try {
      const token = await presentedToken(req, browserTokens);
      const user = await runtime.okta.verify(token);
      const record = await runtime.vault.getRecord(user.issuer, user.subject);
      if (canExchange(runtime, record)) {
        const exchanged = await exchangeExisting(runtime, record, token, fetchImpl);
        if (exchanged.ok) {
          const calls = await probeHarnessApi(runtime.config.harnessApiBase, exchanged.accessToken, fetchImpl);
          sendResult(res, exchanged.info, exchanged.expiresIn, exchanged.accessToken, calls);
          return;
        }
        if (exchanged.relink) {
          await runtime.vault.putRecord(user.issuer, user.subject, {
            linked: false,
            updatedAt: new Date().toISOString(),
          });
        } else {
          res.status(502).json({ error: "token_exchange_failed", message: exchanged.message });
          return;
        }
      }
      const txn = randomUrlToken();
      const state = randomUrlToken();
      const profile: Record<string, unknown> = await oktaUserInfo(runtime.config, token, fetchImpl).catch(() => ({}));
      const oktaEmail = typeof profile.email === "string" ? profile.email : undefined;
      await runtime.vault.putTransaction(txn, {
        oktaIssuer: user.issuer,
        oktaSubject: user.subject,
        oktaEmail,
        codeVerifier: randomUrlToken(),
        state,
        expiresAt: Date.now() + runtime.config.linkTtlSeconds * 1000,
      });
      const verificationUri = `${runtime.config.publicUrl}/link?txn=${encodeURIComponent(txn)}`;
      if (req.is("application/x-www-form-urlencoded") || queryValue(req.body?.session)) {
        res.type("html").send(page("Harness account is not linked", `
          <p>Complete one HarnessID login through Okta.</p>
          <p><a href="${escapeHtml(verificationUri)}">Link Harness account</a></p>
        `));
        return;
      }
      res.status(401).json({
        error: "authorization_required",
        verification_uri_complete: verificationUri,
        expires_in: runtime.config.linkTtlSeconds,
      });
    } catch (error) {
      res.status(401).json({ error: "invalid_token", message: message(error) });
    }
  });

  return app;
}

export function startPocProxy(runtime: PocRuntime): Server {
  return createPocApp(runtime).listen(runtime.config.port, "127.0.0.1");
}

function canExchange(runtime: PocRuntime, record: VaultRecord | undefined): boolean {
  if (!record?.linked) return false;
  if (runtime.config.laterGrant === "refresh") return Boolean(record.refreshToken);
  return true;
}

async function exchangeExisting(
  runtime: PocRuntime,
  record: VaultRecord | undefined,
  oktaToken: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; info: Record<string, unknown>; expiresIn?: number; accessToken: string } | { ok: false; relink: boolean; message: string }> {
  try {
    const user = await runtime.okta.verify(oktaToken);
    const tokens = runtime.config.laterGrant === "refresh"
      ? await refreshKeycloakToken(runtime.config, record?.refreshToken ?? "", fetchImpl)
      : await exchangeKeycloakJwt(runtime.config, oktaToken, fetchImpl);
    if (runtime.config.laterGrant === "refresh" && tokens.refreshToken) {
      await runtime.vault.putRecord(user.issuer, user.subject, {
        linked: true,
        refreshToken: tokens.refreshToken,
        updatedAt: new Date().toISOString(),
      });
    }
    const info = await keycloakUserInfo(runtime.config, tokens.accessToken, fetchImpl);
    return { ok: true, info, expiresIn: tokens.expiresIn, accessToken: tokens.accessToken };
  } catch (error) {
    const text = message(error);
    return { ok: false, relink: text.includes("invalid_grant"), message: text };
  }
}

function presentedToken(req: Request, browserTokens: Map<string, string>): string {
  const header = req.header("authorization");
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : undefined;
  if (match?.[1]) return match[1];
  const session = queryValue(req.body?.session);
  const token = session ? browserTokens.get(session) : undefined;
  if (!token) throw new Error("Missing Okta bearer token.");
  return token;
}

function sendResult(
  res: Response,
  info: Record<string, unknown>,
  expiresIn: number | undefined,
  accessToken: string,
  calls: HarnessCall[],
): void {
  if (res.req.is("application/json") || res.req.header("authorization")) {
    res.json({
      grant: "completed",
      expires_in: expiresIn,
      token_type: "Bearer",
      access_token: accessToken,
      token_claims: accessTokenSummary(accessToken),
      harness_user: publicUser(info),
      harness_calls: calls,
    });
    return;
  }
  res.type("html").send(resultPage("stored session", info, expiresIn, accessToken, calls));
}

function resultPage(
  grant: string,
  info: Record<string, unknown>,
  expiresIn: number | undefined,
  accessToken: string,
  calls: HarnessCall[],
  linkNote = "",
): string {
  const claims = accessTokenSummary(accessToken);
  const callRows = calls.map((call) => `
    <h2>${escapeHtml(String(call.status))} ${escapeHtml(call.path)}</h2>
    <pre>${escapeHtml(call.body)}</pre>
  `).join("");
  return page("Harness token issued", `
    <p>The proxy called HarnessID with <strong>${escapeHtml(grant)}</strong> and received a user access token.</p>
    <p>Expires in ${escapeHtml(String(expiresIn ?? "unknown"))} seconds. Use it as the MCP bearer token:</p>
    <pre>Authorization: Bearer ${escapeHtml(accessToken)}</pre>
    ${linkNote}
    <h2>Token claims</h2>
    <pre>${escapeHtml(JSON.stringify(claims, null, 2))}</pre>
    ${claims.azp === "mcp-client" ? "" : `<p>The hosted MCP client token uses <code>azp: mcp-client</code>. This token uses <code>azp: ${escapeHtml(String(claims.azp))}</code>. The calls below show whether the test host accepts it.</p>`}
    <h2>Harness user</h2>
    <pre>${escapeHtml(JSON.stringify(publicUser(info), null, 2))}</pre>
    <h2>Calls to the Harness test host</h2>
    ${callRows}
    <p><a href="/">Start over</a></p>
  `);
}

function publicUser(info: Record<string, unknown>): Record<string, unknown> {
  return {
    sub: info.sub ?? null,
    email: info.email ?? null,
    preferred_username: info.preferred_username ?? null,
  };
}

function sameEmail(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function queryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function message(error: unknown): string {
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
