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
});
