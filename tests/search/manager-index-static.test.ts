import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Registry } from "../../src/registry/index.js";
import { SearchManager } from "../../src/search/manager.js";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_MCP_MODE: "single-user" as const,
    HARNESS_SEARCH_PROVIDER: "local" as const,
    ...overrides,
  };
}

function makeMockRegistry(overrides: Partial<Registry> = {}): Registry {
  return {
    getAllResourceTypes: () => ["pipeline", "broken_type"],
    getResource: vi.fn((rt: string) => {
      if (rt === "broken_type") throw new Error("resource not found");
      return {
        displayName: "Pipeline",
        description: "CI/CD pipeline",
        operations: { list: {}, get: {} },
        scope: "project",
      };
    }),
    ...overrides,
  } as unknown as Registry;
}

describe("SearchManager.indexStaticContent", () => {
  let indexSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(LocalSearchProvider.prototype, "initialize").mockResolvedValue();
    vi.spyOn(LocalSearchProvider.prototype, "isAvailable").mockReturnValue(true);
    indexSpy = vi.spyOn(LocalSearchProvider.prototype, "index").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("indexes resource definitions into knowledge corpus with permanent TTL", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();

    await mgr.indexStaticContent(makeMockRegistry());

    const resourceDefCalls = indexSpy.mock.calls
      .map(([item]) => item)
      .filter((item) => item.id.startsWith("resource-def:"));

    expect(resourceDefCalls.length).toBeGreaterThan(0);
    expect(resourceDefCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "resource-def:pipeline",
          corpus: "knowledge",
          ttlMs: 0,
          metadata: expect.objectContaining({
            type: "resource_definition",
            resource_type: "pipeline",
            display_name: "Pipeline",
          }),
        }),
      ]),
    );
  });

  it("indexes examples, bundled schemas, and entity schemas", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();

    await mgr.indexStaticContent(makeMockRegistry());

    const indexedIds = indexSpy.mock.calls.map(([item]) => item.id);
    expect(indexedIds.some((id) => id.startsWith("example:"))).toBe(true);
    expect(indexedIds.some((id) => id.startsWith("schema:"))).toBe(true);
    expect(indexedIds.some((id) => id.startsWith("entity-schema:"))).toBe(true);
  });

  it("swallows per-type registry errors and still indexes other types", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();

    await mgr.indexStaticContent(makeMockRegistry());

    expect(indexSpy.mock.calls.some(([item]) => item.id === "resource-def:pipeline")).toBe(true);
    expect(indexSpy.mock.calls.some(([item]) => item.id === "resource-def:broken_type")).toBe(false);
  });

  it("no-ops when provider is unavailable", async () => {
    vi.spyOn(LocalSearchProvider.prototype, "isAvailable").mockReturnValue(false);

    const mgr = new SearchManager(makeConfig() as never);
    await mgr.initialize();
    indexSpy.mockClear();

    await mgr.indexStaticContent(makeMockRegistry());

    expect(indexSpy).not.toHaveBeenCalled();
  });
});
