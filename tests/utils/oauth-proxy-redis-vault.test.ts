import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../../src/config.js";
import {
  RedisOAuthProxyVault,
  type OAuthVaultRedis,
} from "../../src/utils/oauth-proxy-redis-vault.js";
import type { OAuthBrokerTransaction } from "../../src/utils/oauth-proxy-vault.js";

class MemoryRedis implements OAuthVaultRedis {
  readonly values = new Map<string, { value: string; expiresAt?: number }>();

  async connect(): Promise<void> {}

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    options?: { nx?: boolean; px?: number },
  ): Promise<boolean> {
    if (options?.nx && this.live(key)) return false;
    this.values.set(key, {
      value,
      expiresAt: options?.px === undefined ? undefined : Date.now() + options.px,
    });
    return true;
  }

  async getDel(key: string): Promise<string | null> {
    const value = await this.get(key);
    this.values.delete(key);
    return value;
  }

  async del(keys: string[]): Promise<void> {
    for (const key of keys) this.values.delete(key);
  }

  async eval(_script: string, keys: string[], args: string[]): Promise<unknown> {
    const current = await this.get(keys[0]);
    if (current !== args[0]) return 0;
    await this.del([keys[0]]);
    return 1;
  }

  private live(key: string): { value: string; expiresAt?: number } | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry;
  }
}

function vaultPair(): { redis: MemoryRedis; first: RedisOAuthProxyVault; second: RedisOAuthProxyVault } {
  const redis = new MemoryRedis();
  const key = randomBytes(32);
  return {
    redis,
    first: new RedisOAuthProxyVault(key, "harness-mcp:oauth", redis),
    second: new RedisOAuthProxyVault(key, "harness-mcp:oauth", redis),
  };
}

function brokerTransaction(overrides: Partial<OAuthBrokerTransaction> = {}): OAuthBrokerTransaction {
  return {
    clientId: "cursor-harness-mcp",
    redirectUri: "http://localhost:8787/callback",
    clientState: "client-state",
    resource: "https://mcp.example.com/mcp",
    scope: "openid",
    codeChallenge: "challenge",
    upstreamState: "upstream-state",
    upstreamCodeVerifier: "verifier",
    upstreamNonce: "nonce",
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe("Redis OAuth proxy vault", () => {
  it("shares encrypted refresh tokens across vault instances", async () => {
    const { redis, first, second } = vaultPair();
    await first.putRecord("https://okta.example", "user-1", {
      linked: true,
      refreshToken: "secret-refresh-token",
      updatedAt: "2026-10-07T00:00:00Z",
    });

    expect(await second.getRecord("https://okta.example", "user-1")).toMatchObject({
      refreshToken: "secret-refresh-token",
    });
    expect(JSON.stringify([...redis.values.values()])).not.toContain("secret-refresh-token");
  });

  it("lets only one pod take a broker transaction", async () => {
    const { first, second } = vaultPair();
    await first.putBrokerTransaction("txn-1", brokerTransaction());

    const taken = await second.takeBrokerTransactionByUpstreamState("upstream-state");
    expect(taken?.id).toBe("txn-1");
    expect(await first.takeBrokerTransactionByUpstreamState("upstream-state")).toBeUndefined();
  });

  it("redeems an authorization code once", async () => {
    const { first, second } = vaultPair();
    await first.putBrokerCode("digest", {
      clientId: "cursor-harness-mcp",
      redirectUri: "http://localhost:8787/callback",
      resource: "https://mcp.example.com/mcp",
      scope: "openid",
      codeChallenge: "challenge",
      upstreamIssuer: "https://okta.example",
      upstreamSubject: "user-1",
      upstreamTokens: {
        accessToken: "upstream-access",
        tokenType: "Bearer",
      },
      expiresAt: Date.now() + 60_000,
    });

    expect((await second.takeBrokerCode("digest"))?.upstreamSubject).toBe("user-1");
    expect(await first.takeBrokerCode("digest")).toBeUndefined();
  });

  it("drops expired link transactions", async () => {
    const { first } = vaultPair();
    await first.putTransaction("txn-1", {
      issuer: "https://okta.example",
      subject: "user-1",
      state: "state-1",
      codeVerifier: "verifier",
      expiresAt: Date.now() - 1_000,
    });

    expect(await first.getTransaction("txn-1")).toBeUndefined();
    expect(await first.takeTransactionByState("state-1")).toBeUndefined();
  });

  it("takes broker transactions by Harness state and clears sibling indexes", async () => {
    const { first } = vaultPair();
    await first.putBrokerTransaction("txn-1", brokerTransaction({ harnessState: "harness-state-1" }));

    const taken = await first.takeBrokerTransactionByHarnessState("harness-state-1");
    expect(taken?.id).toBe("txn-1");
    expect(await first.takeBrokerTransactionByUpstreamState("upstream-state")).toBeUndefined();
  });

  it("replaces stale broker indexes when upstream state changes", async () => {
    const { first, second } = vaultPair();
    await first.putBrokerTransaction("txn-1", brokerTransaction({ upstreamState: "old-state" }));
    await first.putBrokerTransaction("txn-1", brokerTransaction({ upstreamState: "new-state" }));

    expect(await second.takeBrokerTransactionByUpstreamState("old-state")).toBeUndefined();
    expect((await second.takeBrokerTransactionByUpstreamState("new-state"))?.id).toBe("txn-1");
  });

  it("deleteBrokerTransaction removes broker lookup indexes", async () => {
    const { first } = vaultPair();
    await first.putBrokerTransaction("txn-1", brokerTransaction({ harnessState: "harness-state-1" }));
    await first.deleteBrokerTransaction("txn-1");

    expect(await first.takeBrokerTransactionByUpstreamState("upstream-state")).toBeUndefined();
    expect(await first.takeBrokerTransactionByHarnessState("harness-state-1")).toBeUndefined();
  });

  it("serializes refresh work for the same user", async () => {
    const { first } = vaultPair();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const firstDone = first.withLock("https://okta.example\nuser-1", async () => {
      markStarted?.();
      await new Promise<void>((release) => { releaseFirst = release; });
      order.push("first");
    });
    await started;
    const secondDone = first.withLock("https://okta.example\nuser-1", async () => {
      order.push("second");
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(order).toEqual([]);
    releaseFirst?.();
    await Promise.all([firstDone, secondDone]);
    expect(order).toEqual(["first", "second"]);
  });
});

describe("oauth-proxy vault mode configuration", () => {
  const proxyEnv = {
    HARNESS_MCP_MODE: "oauth-proxy",
    HARNESS_BASE_URL: "https://mcp.example.com/cli",
    HARNESS_MCP_OAUTH_ISSUER: "https://id.example.com/idp/realms/HarnessIDP",
    HARNESS_MCP_OAUTH_RESOURCE: "https://mcp.example.com/mcp",
    HARNESS_MCP_OAUTH_CLIENT_ID: "harness-mcp-proxy",
    HARNESS_MCP_OAUTH_CLIENT_SECRET: "harness-secret",
    HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL: "https://mcp.example.com",
    HARNESS_MCP_OAUTH_PROXY_VAULT_KEY: randomBytes(32).toString("base64"),
    HARNESS_MCP_UPSTREAM_ISSUER: "https://login.example.com/oauth2/default",
    HARNESS_MCP_UPSTREAM_AUDIENCE: "harness-mcp",
    HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID: "upstream-client",
    HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET: "upstream-secret",
  };

  it("keeps the local file vault by default", () => {
    const config = ConfigSchema.parse(proxyEnv);
    expect(config.HARNESS_MCP_OAUTH_PROXY_VAULT_MODE).toBe("file");
  });

  it("requires a redis URL when redis mode is selected", () => {
    expect(() => ConfigSchema.parse({
      ...proxyEnv,
      HARNESS_MCP_OAUTH_PROXY_VAULT_MODE: "redis",
    })).toThrow("HARNESS_MCP_OAUTH_PROXY_REDIS_URL");
    expect(() => ConfigSchema.parse({
      ...proxyEnv,
      HARNESS_MCP_OAUTH_PROXY_VAULT_MODE: "redis",
      HARNESS_MCP_OAUTH_PROXY_REDIS_URL: "https://redis.example.com",
    })).toThrow("redis:// or rediss://");
  });

  it("accepts an in-cluster redis URL", () => {
    const config = ConfigSchema.parse({
      ...proxyEnv,
      HARNESS_MCP_OAUTH_PROXY_VAULT_MODE: "redis",
      HARNESS_MCP_OAUTH_PROXY_REDIS_URL: "redis://oauth-vault:6379/0",
    });
    expect(config.HARNESS_MCP_OAUTH_PROXY_REDIS_KEY_PREFIX).toBe("harness-mcp:oauth");
  });

  it("requires HTTPS upstream and proxy URLs unless HARNESS_ALLOW_HTTP is set", () => {
    expect(() => ConfigSchema.parse({
      ...proxyEnv,
      HARNESS_MCP_UPSTREAM_ISSUER: "http://login.example.com/oauth2/default",
    })).toThrow("Upstream issuer, JWKS, and OAuth proxy public URLs must use HTTPS");

    const allowed = ConfigSchema.parse({
      ...proxyEnv,
      HARNESS_ALLOW_HTTP: "true",
      HARNESS_MCP_UPSTREAM_ISSUER: "http://login.example.com/oauth2/default",
    });
    expect(allowed.HARNESS_MCP_UPSTREAM_ISSUER).toBe("http://login.example.com/oauth2/default");
  });

  it("rejects oauth-proxy vault keys that are not 32 bytes", () => {
    expect(() => ConfigSchema.parse({
      ...proxyEnv,
      HARNESS_MCP_OAUTH_PROXY_VAULT_KEY: Buffer.from("short").toString("base64"),
    })).toThrow("32-byte key");
  });
});
