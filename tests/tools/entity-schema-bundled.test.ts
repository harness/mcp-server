import { describe, it, expect, vi, afterEach } from "vitest";
import type { HarnessClient } from "../../src/client/harness-client.js";
import * as bundled from "../../src/tools/entity-schema/bundled.js";
import { createLiveSchemaFetcher } from "../../src/tools/entity-schema/live.js";

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

  it("returns cached live schema on repeated fetch for the same scope", async () => {
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue(undefined);
    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(false);

    const liveSchema = {
      type: "object",
      properties: { live: { type: "string" } },
    };
    const client = {
      account: "acct-123",
      request: vi.fn().mockResolvedValue({ data: liveSchema }),
    } as unknown as HarnessClient;

    const fetcher = createLiveSchemaFetcher(client);
    const params = {
      scope: "project" as const,
      orgId: "org-a",
      projectId: "proj-a",
    };

    const first = await fetcher.fetch("connector", params);
    const second = await fetcher.fetch("connector", params);

    expect(first).toEqual({ schema: liveSchema, source: "ng-yaml-schema" });
    expect(second).toEqual(first);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it("isolates live schema cache entries across org/project scopes", async () => {
    vi.spyOn(bundled, "getBundledEntitySchema").mockReturnValue(undefined);
    vi.spyOn(bundled, "bundledSnapshotsMatchAccount").mockReturnValue(false);

    const schemaA = { type: "object", properties: { orgA: { type: "string" } } };
    const schemaB = { type: "object", properties: { orgB: { type: "string" } } };
    const client = {
      account: "acct-123",
      request: vi
        .fn()
        .mockResolvedValueOnce({ data: schemaA })
        .mockResolvedValueOnce({ data: schemaB }),
    } as unknown as HarnessClient;

    const fetcher = createLiveSchemaFetcher(client);

    const resultA = await fetcher.fetch("connector", {
      scope: "project",
      orgId: "org-a",
      projectId: "proj-a",
    });
    const resultB = await fetcher.fetch("connector", {
      scope: "project",
      orgId: "org-b",
      projectId: "proj-b",
    });

    expect(resultA?.schema).toEqual(schemaA);
    expect(resultB?.schema).toEqual(schemaB);
    expect(client.request).toHaveBeenCalledTimes(2);
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
});
