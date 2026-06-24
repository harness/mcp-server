import { describe, it, expect, vi, afterEach } from "vitest";
import type { HarnessClient } from "../../src/client/harness-client.js";
import * as bundled from "../../src/tools/entity-schema/bundled.js";
import { buildLiveSchemaCacheKey } from "../../src/tools/entity-schema/cache-keys.js";
import { createLiveSchemaFetcher } from "../../src/tools/entity-schema/live.js";
import type { EntitySchemaCacheEntry } from "../../src/tools/entity-schema/types.js";

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

  describe("bundledSnapshotMatchesScope", () => {
    it("accepts bundled project snapshot when org/project match vendored metadata", () => {
      expect(
        bundled.bundledSnapshotMatchesScope("connector", "project", "default", "aidevops"),
      ).toBe(true);
    });

    it("rejects bundled project snapshot when org differs from vendored metadata", () => {
      expect(
        bundled.bundledSnapshotMatchesScope("connector", "project", "other-org", "aidevops"),
      ).toBe(false);
    });

    it("rejects bundled project snapshot when project differs from vendored metadata", () => {
      expect(
        bundled.bundledSnapshotMatchesScope("connector", "project", "default", "other-project"),
      ).toBe(false);
    });

    it("rejects bundled org snapshot when org differs from vendored metadata", () => {
      expect(bundled.bundledSnapshotMatchesScope("connector", "org", "other-org")).toBe(false);
    });

    it("accepts account-scoped snapshots without org/project identifiers", () => {
      expect(bundled.bundledSnapshotMatchesScope("connector", "account")).toBe(true);
    });
  });

  it("does not serve a bundled org snapshot for a different org", async () => {
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
      scope: "org",
      orgId: "not-default",
    });

    expect(result).toEqual({ schema: liveSchema, source: "ng-yaml-schema" });
    expect(client.request).toHaveBeenCalledTimes(1);
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

  it("preloads bundled snapshots under scope-specific cache keys", () => {
    const runtimeCache = new Map<string, EntitySchemaCacheEntry>();
    const accountId = "VpehPBwPQ9qKsX-xDP8SFg";

    bundled.preloadBundledEntitySchemas(runtimeCache, accountId);

    const matchingKey = buildLiveSchemaCacheKey("connector", accountId, "project", {
      orgId: "default",
      projectId: "aidevops",
    });
    const mismatchedKey = buildLiveSchemaCacheKey("connector", accountId, "project", {
      orgId: "other-org",
      projectId: "other-project",
    });

    expect(runtimeCache.has(matchingKey)).toBe(true);
    expect(runtimeCache.has(mismatchedKey)).toBe(false);
  });
});
