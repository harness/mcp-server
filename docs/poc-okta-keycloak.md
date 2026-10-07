# Local POC: Okta as upstream identity provider, Keycloak as HarnessID

This runs a local proxy inside the MCP server repo. Okta is the upstream identity provider. QA Keycloak stands in for HarnessID.

The production MCP request path is unchanged. The proxy is a separate process.

Default later-call mode is the refresh-token option. Set `POC_LATER_GRANT=jwt-bearer` to test the JWT Authorization Grant instead.

## 1. Point at the public QA HarnessID host

```text
KEYCLOAK_BASE_URL=https://id.harness-test.com/idp
```

`mcp.harness-test.com` only trusts tokens with `iss=https://id.harness-test.com/idp/realms/HarnessIDP`. Keycloak stamps `iss` from the host the browser used on the authorize request, so a port-forward (`http://127.0.0.1:8080/idp`) produces tokens the gateway rejects with 401 `Jwt issuer is not configured`. Sending `X-Forwarded-Host` on back-channel calls does not fix this: the code keeps the browser's issuer, and userinfo and refresh then fail with `Invalid token issuer`.

Keep the port-forward only for admin API access (`kubectl -n harness port-forward pod/harness-keycloak-1 8080:8080`).

## 2. Create the Okta app

In the Okta admin console, create an OIDC web application.

- Sign-in method: OIDC
- Application type: Web Application
- Grant type: Authorization Code
- Client authentication: client secret

Add both redirect URIs:

```text
http://127.0.0.1:3005/okta/callback
https://id.harness-test.com/idp/realms/HarnessIDP/broker/okta/endpoint
```

The second URI is Keycloak's broker callback on the public host.

Assign your test user to the app.

Use a custom authorization server, normally `default`, so the access token is a JWT:

```text
OKTA_ISSUER=https://<your-org>.okta.com/oauth2/default
```

On that authorization server, add this application as an access policy client and include `openid`, `profile`, and `email`.

Copy the client ID and client secret into `.env.poc`.

## 3. Create the Keycloak client

In the QA realm `HarnessIDP`, create a confidential OpenID Connect client:


| Setting               | Value                            |     |
| --------------------- | -------------------------------- | --- |
| Client ID             | `jpmc-harness-api-proxy`         |     |
| Client authentication | On                               |     |
| Standard flow         | On                               |     |
| Direct access grants  | Off                              |     |
| Valid redirect URIs   | `http://127.0.0.1:3005/callback` |     |
| Web origins           | `http://127.0.0.1:3005`          |     |
| Use refresh tokens    | On                               |     |


Copy the client secret into `KEYCLOAK_CLIENT_SECRET`.

For the refresh-token POC, leave `POC_LATER_GRANT=refresh`. Keycloak returns a refresh token from the authorization-code login. The proxy stores it in `.poc/vault.json`. That file is plaintext and is only for this local test.

## 4. Add Okta as a Keycloak identity provider

Create an OpenID Connect identity provider:


| Setting            | Value                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| Alias              | `okta`                                                                        |
| Discovery endpoint | `https://<your-org>.okta.com/oauth2/default/.well-known/openid-configuration` |
| Client ID          | the Okta app client ID                                                        |
| Client secret      | the Okta app client secret                                                    |
| Sync mode          | Import                                                                        |


Use alias `okta`, because the proxy sends `kc_idp_hint=okta`.

On the identity provider, open Advanced and confirm the redirect URI shown there matches the second Okta redirect URI.

## 5. Add the subject mapper

The proxy accepts the HarnessID login only when the ID token contains the same Okta user ID as the Okta access token.

On client `jpmc-harness-api-proxy`, open its dedicated client scope and add a mapper:


| Setting           | Value                        |
| ----------------- | ---------------------------- |
| Mapper type       | User Session Note            |
| User Session Note | `broker.user.id` |
| Token Claim Name  | `external_sub`               |
| Add to ID token   | On                           |


If the POC says the subjects do not match, decode the ID token and either point `POC_EXTERNAL_SUB_CLAIM` at the claim that contains the Okta user ID, or change the mapper's token claim name.

## 6. First broker login

The QA realm browser flow is `harness-custom-flow-1`: cookie, then organization selection, then that organization's identity provider. It never redirects to the realm `okta` provider, so `kc_idp_hint=okta` does nothing and no Okta link is stored. A normal Google session is enough for the proxy to accept the login by email.

On client `jpmc-harness-api-proxy` only, set Advanced → Authentication flow overrides → Browser flow to the built-in `browser` flow. That flow's Identity Provider Redirector honors `kc_idp_hint`. Other QA clients stay on `harness-custom-flow-1`.

The proxy sends `prompt=login`, so an existing Harness SSO cookie cannot skip Okta. On the first Okta login, Keycloak shows review-profile and confirm-link. Finish those pages. After that, the user's Identity provider links tab shows `okta`.

## 7. Run the proxy

From the MCP server repo:

```bash
cp .env.poc.example .env.poc
# fill in the Okta and Keycloak secrets

pnpm poc:proxy
```

Open `http://127.0.0.1:3005`.

1. Sign in with Okta. This produces the upstream token.
2. Click **Call the Harness proxy**. The first call has no Harness link, so the page returns a link URL.
3. Open that URL. The browser goes to Keycloak, then Okta, then back to the proxy.
4. The proxy exchanges the authorization code, checks the Okta subject, stores the refresh token, and calls the Keycloak userinfo endpoint with the Harness access token.
5. Click **Call the Harness proxy** again. This call uses the refresh-token grant and does not open the Harness login.

The proxy does not print the Harness access token or the refresh token. It prints the userinfo `sub`, email, and username so you can see which Harness user was selected.

To inspect the second call directly:

```bash
curl -s -X POST http://127.0.0.1:3005/harness/call \
  -H "Authorization: Bearer <okta-access-token>"
```

A linked user returns the Harness user profile. An unlinked user returns `authorization_required` and a `verification_uri_complete`.

## 8. Optional JWT bearer mode

Use this only after the refresh-token path works. In `.env.poc`:

```text
POC_LATER_GRANT=jwt-bearer
```

Restart the proxy and delete `.poc/vault.json` so the first login runs again.

In Keycloak, on the Okta identity provider:

- Turn on JWT Authorization Grant.
- Set the issuer to `OKTA_ISSUER`.
- Use the Okta JWKS URL, `${OKTA_ISSUER}/v1/keys`.

On the client:

- Turn on JWT Authorization Grant.
- Allow only the `okta` identity provider.
- Under Advanced, OpenID Connect Compatibility Modes, set the custom audience for `okta` to the `aud` claim in the Okta access token.

The first browser login still creates the identity link. Later `POST /harness/call` requests send:

```text
grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
assertion=<Okta access token>
```

If Keycloak rejects the audience or cannot find the linked user, the proxy returns the Keycloak error text. Fix the audience or the `external_sub` mapper before treating that as a product failure.

## What this POC does not prove

- It does not perform an upstream token exchange from Token A to Token B. One Okta access token stands in for the token the proxy receives.
- The local vault is not encrypted and is not a JPMC token vault.
- It does not call the Harness product API. It calls the Keycloak userinfo endpoint through the port-forward to prove which user the Harness token represents.

