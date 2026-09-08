# HarnessID OAuth for a self-hosted MCP server

This mode makes the HTTP MCP endpoint an OAuth 2.1 protected resource. MCP clients
discover HarnessID through RFC 9728, complete Authorization Code with PKCE, and send
the resulting access token as `Authorization: Bearer <token>`.

## Authorization boundary

HarnessID authenticates the user who connects to MCP, and the MCP server validates
that user's access token before accepting any MCP request. The server then forwards
the same access token to the Harness Platform API for every call made in that
session, so Harness RBAC and audit records reflect the logged-in user. No
deployment-level `HARNESS_API_KEY` is involved — it must not be set in this mode.

The account ID is read from the access-token claim named by
`HARNESS_MCP_OAUTH_ACCOUNT_CLAIM` (`account_id` by default), which the HarnessID
`organization` scope populates. A session is bound to the `sub` and account of the
token that created it. Later requests may carry a refreshed token for the same user,
but a token for a different user or account is rejected.

## QA HarnessID setup

QA HarnessID realm: `https://id.harness-test.com/idp/realms/HarnessIDP`

Configure a public OpenID Connect client in that realm:

- Client ID: `mcp-client` (or allow RFC 7591 dynamic client registration)
- Client authentication: off
- Standard flow: on
- PKCE method: `S256`
- Redirect URIs: the callback URIs used by the MCP clients under test
- Assigned scopes: `openid`, `profile`, `email`, and the `organization` scope that
  emits the Harness account ID
- Access-token signing algorithm: `RS256`

The issuer in HarnessID's metadata and in the token `iss` claim must exactly match
`HARNESS_MCP_OAUTH_ISSUER`, including the `/idp` path segment.

Verify a token before pointing a client at the server:

```bash
curl -sS https://id.harness-test.com/idp/realms/HarnessIDP/.well-known/openid-configuration
```

A valid access token for this setup decodes to `iss` of
`https://id.harness-test.com/idp/realms/HarnessIDP`, `azp` of `mcp-client`, a `scope`
containing `organization:<accountId>`, and a top-level `account_id` claim.

## Run the MCP server

Build the server:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Set these values for QA:

```bash
export HARNESS_MCP_MODE=oauth
export HARNESS_MCP_OAUTH_ISSUER=https://id.harness-test.com/idp/realms/HarnessIDP
export HARNESS_MCP_OAUTH_RESOURCE=https://mcp.harness-test.com/mcp
export HARNESS_MCP_OAUTH_CLIENT_ID=mcp-client
export HARNESS_MCP_OAUTH_SCOPES="openid profile email organization"

export HARNESS_BASE_URL=https://qa.harness.io
export HARNESS_MCP_ALLOWED_HOSTS=mcp.harness-test.com
export HOST=0.0.0.0
export PORT=3000

pnpm start:http
```

`HARNESS_MCP_OAUTH_JWKS_URI` defaults to
`https://id.harness-test.com/idp/realms/HarnessIDP/protocol/openid-connect/certs`;
set it only when HarnessID publishes keys elsewhere.

`HARNESS_BASE_URL` is the Harness Platform API host, which is a different host from
the MCP endpoint — `mcp.harness-test.com` serves only `/mcp` and its
`.well-known` metadata, and returns 404 for API paths.

Terminate TLS at the ingress or reverse proxy. `HARNESS_MCP_OAUTH_RESOURCE` must be
the external HTTPS URL used by clients, not the pod or cluster-local URL.

Do not set `HARNESS_MCP_AUTH_TOKEN` or `HARNESS_API_KEY` in OAuth mode.

## Check discovery and authentication

Protected-resource metadata:

```bash
curl -sS https://mcp.harness-test.com/.well-known/oauth-protected-resource/mcp
```

Expected fields:

```json
{
  "resource": "https://mcp.harness-test.com/mcp",
  "authorization_servers": ["https://id.harness-test.com/idp/realms/HarnessIDP"],
  "scopes_supported": ["openid", "profile", "email", "organization"],
  "bearer_methods_supported": ["header"]
}
```

An unauthenticated MCP request must return HTTP 401 with a discovery challenge:

```bash
curl -i https://mcp.harness-test.com/mcp
```

Expected header:

```http
WWW-Authenticate: Bearer resource_metadata="https://mcp.harness-test.com/.well-known/oauth-protected-resource/mcp"
```

Configure the MCP client with the resource URL:

```json
{
  "mcpServers": {
    "harness-qa": {
      "url": "https://mcp.harness-test.com/mcp"
    }
  }
}
```

If the client asks for a client ID, use `mcp-client`. After browser login, verify
that the client can initialize a session and list tools.

## Validation failures

- `OAuth access token required`: the client did not send a Bearer token.
- `Invalid OAuth access token` with an authorized-party error: the token was issued
  to a client other than `HARNESS_MCP_OAUTH_CLIENT_ID`.
- Issuer error: HarnessID metadata, the token `iss`, and `HARNESS_MCP_OAUTH_ISSUER`
  differ — most often the `/idp` path segment is missing on one side.
- `Jwt issuer is not configured` from the gateway rather than the MCP server: the
  ingress in front of the deployment validates JWTs itself and has no provider
  registered for the HarnessID issuer. This is fixed in the deployment's gateway
  configuration, not in the MCP server.
- Signing-key error: `kid` is absent from the configured JWKS or the key is not an
  RS256 signing key.
- Missing-account error: the token has no `account_id` claim, so the `organization`
  scope was not granted or not requested.
- Repeated login or HTTP 403 after initialization: a later request is using a token
  for a different `sub` or account; OAuth sessions are bound to the user who
  initialized them.
