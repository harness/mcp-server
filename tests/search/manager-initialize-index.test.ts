import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Registry } from "../../src/registry/index.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { SearchManager } from "../../src/search/manager.js";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_MCP_MODE: "single-user" as const,
    HARNESS_SEARCH_PROVIDER: "local" as const,
    ...overrides,
  };
}

function makeClient(account = "acct-1"): HarnessClient {
  return { account } as HarnessClient;
}

describe("SearchManager.initializeIndex", () => {
  let indexSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(LocalSearchProvider.prototype, "initialize").mockResolvedValue();
    vi.spyOn(LocalSearchProvider.prototype, "isAvailable").mockReturnValue(true);
    indexSpy = vi.spyOn(LocalSearchProvider.prototype, "index").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pre-indexes tier-1 list results into entities corpus", async () => {
    const dispatch = vi.fn()
      .mockResolvedValueOnce({ items: [{ identifier: "pipe-1", name: "Deploy" }] })
      .mockResolvedValue({ items: [] });

    const registry = {
      supportsOperation: vi.fn((_t: string, op: string) => op === "list"),
      dispatch,
    } as unknown as Registry;

    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();
    await mgr.initializeIndex(registry, makeClient());

    expect(dispatch).toHaveBeenCalled();
    expect(indexSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pipeline:pipe-1",
        corpus: "entities",
        accountId: "acct-1",
        metadata: expect.objectContaining({
          resource_type: "pipeline",
          identifier: "pipe-1",
          name: "Deploy",
        }),
      }),
    );
  });

  it("skips items missing identifier and id", async () => {
    const dispatch = vi.fn((_client, resourceType: string) => {
      if (resourceType === "pipeline") {
        return Promise.resolve({ items: [{ name: "No Id" }] });
      }
      if (resourceType === "service") {
        return Promise.resolve({ items: [{ id: "svc-1", name: "Payments" }] });
      }
      return Promise.resolve({ items: [] });
    });

    const registry = {
      supportsOperation: vi.fn((_t: string, op: string) => op === "list"),
      dispatch,
    } as unknown as Registry;

    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();
    indexSpy.mockClear();
    await mgr.initializeIndex(registry, makeClient());

    const indexedIds = indexSpy.mock.calls.map(([item]) => item.id);
    expect(indexedIds).toEqual(["service:svc-1"]);
  });

  it("continues after per-type list failures", async () => {
    const dispatch = vi.fn((_client, resourceType: string) => {
      if (resourceType === "pipeline") return Promise.reject(new Error("list failed"));
      if (resourceType === "connector") {
        return Promise.resolve({ items: [{ identifier: "conn-1", name: "GitHub" }] });
      }
      return Promise.resolve({ items: [] });
    });

    const registry = {
      supportsOperation: vi.fn((_t: string, op: string) => op === "list"),
      dispatch,
    } as unknown as Registry;

    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();
    indexSpy.mockClear();
    await mgr.initializeIndex(registry, makeClient());

    expect(indexSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "connector:conn-1",
        corpus: "entities",
      }),
    );
  });

  it("does not pre-index entities in multi-user mode with local provider", async () => {
    const dispatch = vi.fn().mockResolvedValue({ items: [{ identifier: "pipe-1" }] });
    const registry = {
      supportsOperation: vi.fn((_t: string, op: string) => op === "list"),
      dispatch,
    } as unknown as Registry;

    const mgr = new SearchManager(makeConfig({ HARNESS_MCP_MODE: "multi-user" }) as never);
    await mgr.initialize();
    indexSpy.mockClear();
    await mgr.initializeIndex(registry, makeClient());

    expect(dispatch).not.toHaveBeenCalled();
    expect(indexSpy).not.toHaveBeenCalled();
  });
});
