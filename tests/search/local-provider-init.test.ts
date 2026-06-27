import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const pipelineMock = vi.fn();

vi.mock("@huggingface/transformers", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { cacheDir: "" },
}));

import { LocalSearchProvider, DEFAULT_EMBEDDING_MODEL } from "../../src/search/local-provider.js";

describe("LocalSearchProvider initialization options", () => {
  beforeEach(() => {
    pipelineMock.mockReset();
    pipelineMock.mockResolvedValue(async () => ({
      data: new Float32Array(384),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the default embedding model when model option is omitted", async () => {
    const provider = new LocalSearchProvider();
    await provider.initialize();

    expect(pipelineMock).toHaveBeenCalledWith(
      "feature-extraction",
      DEFAULT_EMBEDDING_MODEL,
      { dtype: "fp32" },
    );
    expect(provider.isAvailable()).toBe(true);
  });

  it("loads a custom embedding model from options", async () => {
    const provider = new LocalSearchProvider({ model: "custom/search-model" });
    await provider.initialize();

    expect(pipelineMock).toHaveBeenCalledWith(
      "feature-extraction",
      "custom/search-model",
      { dtype: "fp32" },
    );
  });

  it("unrefs the eviction timer so short-lived benchmark processes can exit", async () => {
    const unref = vi.fn();
    const intervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue({ unref } as never);

    const provider = new LocalSearchProvider();
    await provider.initialize();

    expect(intervalSpy).toHaveBeenCalledOnce();
    expect(unref).toHaveBeenCalledOnce();
  });
});
