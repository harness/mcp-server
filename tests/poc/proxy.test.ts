import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it } from "vitest";
import { pkceChallenge, randomUrlToken } from "../../src/poc/pkce.js";
import { externalSubject, findLinkedSubject, harnessProbePaths } from "../../src/poc/keycloak.js";
import { TokenVault, vaultKey } from "../../src/poc/vault.js";

describe("POC proxy helpers", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("creates an S256 PKCE challenge", () => {
    expect(pkceChallenge("verifier")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pkceChallenge("verifier")).toBe(pkceChallenge("verifier"));
  });

  it("stores a refresh token by Okta issuer and subject", async () => {
    directory = await mkdtemp(join(tmpdir(), "harness-poc-"));
    const vault = new TokenVault(join(directory, "vault.json"));
    await vault.putRecord("https://okta.example/oauth2/default", "user-1", {
      linked: true,
      refreshToken: "refresh-token",
      updatedAt: "2026-10-02T00:00:00Z",
    });
    const record = await vault.getRecord("https://okta.example/oauth2/default", "user-1");
    expect(record?.refreshToken).toBe("refresh-token");
    expect(vaultKey("https://okta.example/oauth2/default", "user-1")).toContain("user-1");
  });

  it("reads the external subject from the HarnessID ID token", () => {
    const token = jwt.sign({ external_sub: "okta-user" }, "poc-secret");
    expect(externalSubject(token, "external_sub")).toBe("okta-user");
    const brokerToken = jwt.sign({ "broker.user.id": "okta.okta-user" }, "poc-secret");
    expect(findLinkedSubject("okta-user", "okta", [brokerToken])).toBe("okta.okta-user");
    expect(randomUrlToken()).not.toBe(randomUrlToken());
  });

  it("adds accountIdentifier from the access token to Harness calls", () => {
    const token = jwt.sign({ account_id: "acct-1" }, "poc-secret");
    const paths = harnessProbePaths(token);
    expect(paths[0]).toBe("/cli/ng/api/user/currentUser?accountIdentifier=acct-1");
    expect(paths[1]).toContain("pageIndex=0");
    expect(paths[1]).toContain("accountIdentifier=acct-1");
    expect(harnessProbePaths(jwt.sign({ sub: "only" }, "poc-secret"))[0]).not.toContain("accountIdentifier");
  });
});
