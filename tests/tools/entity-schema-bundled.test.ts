import { describe, it, expect, vi, afterEach } from "vitest";
import type { HarnessClient } from "../../src/client/harness-client.js";
import * as bundled from "../../src/tools/entity-schema/bundled.js";
import { createLiveSchemaFetcher } from "../../src/tools/entity-schema/live.js";
import { buildLiveSchemaCacheKey } from "../../src/tools/entity-schema/cache-keys.js";
import type { EntitySchemaCacheEntry } from "../../src/tools/entity-schema/types.js";
import { ENTITY_BUNDLED_META } from "../../src/data/schemas/entities/index.js";

const BUNDLED_ACCOUNT_ID = ENTITY_BUNDLED_META["connector.account"]!.accountId;

describe("entity schema bundled + live fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns bundled snapshot without hitting live API", async () => {
    const fallback = { type: "object", properties: { name: { type: "string" } } };
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue(fallback);

    const client = {
      account: "acct-123",
      request: vi.fn().mockRejectedValue(new Error("API unavailable")),
    } as unknown as HarnessClient;

    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(true);

    const fetcher = createLiveSchemaFetcher(client);
    const result = await fetcher.fetch("connector", { scope: "account" });

    expect(result).toEqual({ schema: fallback, source: "bundled" });
    expect(client.request).not.toHaveBeenCalled();
  });

  it("bundledSnapshotsMatchAccount is false for mismatched account", () => {
    expect(bundled.bundledSnapshotsMatchAccount("other-account")).toBe(false);
  });

  it("throws for project scope without org_id before returning bundled schema", async () => {
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue({ type: "object" });
    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(true);

    const client = {
      account: "acct-123",
      request: vi.fn(),
    } as unknown as HarnessClient;

    const fetcher = createLiveSchemaFetcher(client);

    await expect(fetcher.fetch("connector", { scope: "project" })).rejects.toThrow(
      /org_id is required/,
    );
    expect(client.request).not.toHaveBeenCalled();
  });

  it("does not serve a bundled project snapshot for a different org/project", async () => {
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue({ type: "object", properties: { bundled: {} } });
    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(true);

    const liveSchema = {
      type: "object",
      properties: { live: { type: "string" } },
    };
    const client = {
      account: "acct-123",
      request: vi.fn().mockResolvedValue({ data: liveSchema }),
    } as unknown as HarnessClient;

    const fetcher = createLiveSchemaFetcher(client);
    const result = await fetcher.fetch("connector", {
      scope: "project",
      orgId: "not-default",
      projectId: "not-aidevops",
    });

    expect(result).toEqual({ schema: liveSchema, source: "ng-yaml-schema" });
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it("throws for org scope without org_id before bundled or live fetch", async () => {
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue({ type: "object" });
    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(true);

    const client = {
      account: "acct-123",
      request: vi.fn(),
    } as unknown as HarnessClient;

    const fetcher = createLiveSchemaFetcher(client);

    await expect(fetcher.fetch("connector", { scope: "org" })).rejects.toThrow(
      /org_id is required when scope is 'org'/,
    );
    expect(client.request).not.toHaveBeenCalled();
  });

  it("throws for project scope without project_id before bundled or live fetch", async () => {
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue({ type: "object" });
    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(true);

    const client = {
      account: "acct-123",
      request: vi.fn(),
    } as unknown as HarnessClient;

    const fetcher = createLiveSchemaFetcher(client);

    await expect(
      fetcher.fetch("connector", { scope: "project", orgId: "default" }),
    ).rejects.toThrow(/project_id is required when scope is 'project'/);
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe("preloadBundledEntitySchemas", () => {
  it("warms the runtime cache when the account matches vendored snapshots", () => {
    const cache = new Map<string, EntitySchemaCacheEntry>();
    const count = bundled.preloadBundledEntitySchemas(cache, BUNDLED_ACCOUNT_ID);

    expect(count).toBeGreaterThan(0);
    expect(cache.size).toBeGreaterThan(0);
    const accountEntry = cache.get(
      buildLiveSchemaCacheKey("connector", BUNDLED_ACCOUNT_ID, "account"),
    );
    expect(accountEntry?.source).toBe("bundled");
    expect(accountEntry?.schema).toBeDefined();
  });

  it("does not warm cache when account id does not match vendored snapshots", () => {
    const cache = new Map<string, EntitySchemaCacheEntry>();
    bundled.preloadBundledEntitySchemas(cache, "other-account");
    expect(cache.size).toBe(0);
  });

  it("does not overwrite existing cache entries", () => {
    const cache = new Map<string, EntitySchemaCacheEntry>();
    const existingKey = buildLiveSchemaCacheKey("connector", BUNDLED_ACCOUNT_ID, "account");
    const marker = { schema: { type: "object", marker: true }, source: "ng-yaml-schema" as const };
    cache.set(existingKey, marker);

    bundled.preloadBundledEntitySchemas(cache, BUNDLED_ACCOUNT_ID);
    expect(cache.get(existingKey)).toBe(marker);
  });
});
