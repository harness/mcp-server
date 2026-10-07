export type LaterGrant = "refresh" | "jwt-bearer";

export interface PocConfig {
  port: number;
  publicUrl: string;
  oktaIssuer: string;
  oktaAudience?: string;
  oktaClientId: string;
  oktaClientSecret: string;
  oktaScopes: string;
  keycloakBaseUrl: string;
  keycloakForwardedHost?: string;
  keycloakRealm: string;
  keycloakClientId: string;
  keycloakClientSecret: string;
  keycloakIdpHint: string;
  keycloakScopes: string;
  laterGrant: LaterGrant;
  externalSubClaim: string;
  vaultPath: string;
  linkTtlSeconds: number;
  harnessApiBase: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env.poc before starting the POC proxy.`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function loadPocConfig(): PocConfig {
  const laterGrant = optional("POC_LATER_GRANT") ?? "refresh";
  if (laterGrant !== "refresh" && laterGrant !== "jwt-bearer") {
    throw new Error("POC_LATER_GRANT must be refresh or jwt-bearer.");
  }
  const port = Number(optional("POC_PORT") ?? "3005");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("POC_PORT must be an integer port.");
  }
  const publicUrl = (optional("POC_PUBLIC_URL") ?? `http://127.0.0.1:${port}`).replace(/\/+$/, "");
  return {
    port,
    publicUrl,
    oktaIssuer: required("OKTA_ISSUER").replace(/\/+$/, ""),
    oktaAudience: optional("OKTA_AUDIENCE"),
    oktaClientId: required("OKTA_CLIENT_ID"),
    oktaClientSecret: required("OKTA_CLIENT_SECRET"),
    oktaScopes: optional("OKTA_SCOPES") ?? "openid profile email",
    keycloakBaseUrl: required("KEYCLOAK_BASE_URL").replace(/\/+$/, ""),
    keycloakForwardedHost: optional("KEYCLOAK_FORWARDED_HOST"),
    keycloakRealm: optional("KEYCLOAK_REALM") ?? "HarnessIDP",
    keycloakClientId: optional("KEYCLOAK_CLIENT_ID") ?? "jpmc-harness-api-proxy",
    keycloakClientSecret: required("KEYCLOAK_CLIENT_SECRET"),
    keycloakIdpHint: optional("KEYCLOAK_IDP_HINT") ?? "okta",
    keycloakScopes: optional("KEYCLOAK_SCOPES") ?? "openid profile email organization",
    laterGrant,
    externalSubClaim: optional("POC_EXTERNAL_SUB_CLAIM") ?? "external_sub",
    vaultPath: optional("POC_VAULT_PATH") ?? ".poc/vault.json",
    linkTtlSeconds: Number(optional("POC_LINK_TTL_SECONDS") ?? "300"),
    harnessApiBase: (optional("HARNESS_API_BASE") ?? "https://mcp.harness-test.com").replace(/\/+$/, ""),
  };
}

export function keycloakRealmUrl(config: PocConfig): string {
  return `${config.keycloakBaseUrl}/realms/${encodeURIComponent(config.keycloakRealm)}`;
}

// Keycloak derives the token `iss` from these headers (KC_PROXY_HEADERS=xforwarded), so
// back-channel calls through a port-forward must present the public host or the Harness
// gateway rejects the token with "Jwt issuer is not configured".
export function keycloakForwardedHeaders(config: PocConfig): Record<string, string> {
  if (!config.keycloakForwardedHost) return {};
  return {
    "X-Forwarded-Host": config.keycloakForwardedHost,
    "X-Forwarded-Proto": "https",
    "X-Forwarded-Port": "443",
  };
}
