import { describe, it, expect } from "vitest";
import {
  countResourceAccountKeys,
  findLruKey,
  findSoonestExpiryIndex,
  isResourceAccountKey,
  needsPerKeyCap,
  totalItemCount,
} from "../../src/search/local-provider.js";

describe("local-provider memory bounds", () => {
  it("identifies per-account resources keys", () => {
    expect(isResourceAccountKey("resources:acc1")).toBe(true);
    expect(isResourceAccountKey("resources:global")).toBe(false);
    expect(isResourceAccountKey("mcp_resources:global")).toBe(false);
  });

  it("caps resources corpus items even when permanent", () => {
    expect(needsPerKeyCap("resources", undefined)).toBe(true);
    expect(needsPerKeyCap("mcp_resources", undefined)).toBe(false);
    expect(needsPerKeyCap("docs", Date.now() + 60_000)).toBe(true);
  });

  it("counts resource account keys excluding global", () => {
    const store = new Map<string, unknown[]>([
      ["resources:acc1", []],
      ["resources:acc2", []],
      ["resources:global", []],
      ["mcp_resources:global", [{}]],
    ]);
    expect(countResourceAccountKeys(store)).toBe(2);
  });

  it("totals items across all keys", () => {
    const store = new Map<string, unknown[]>([
      ["a", [1, 2]],
      ["b", [3]],
    ]);
    expect(totalItemCount(store)).toBe(3);
  });

  it("finds LRU key among resource account buckets", () => {
    const store = new Map<string, unknown[]>([
      ["resources:old", []],
      ["resources:new", []],
      ["mcp_resources:global", []],
    ]);
    const accessed = new Map([
      ["resources:old", 100],
      ["resources:new", 500],
    ]);
    expect(findLruKey(store, accessed, isResourceAccountKey)).toBe("resources:old");
  });

  it("finds soonest-to-expire item index", () => {
    const now = Date.now();
    const items = [
      { expiresAt: now + 60_000 },
      { expiresAt: now + 10_000 },
      { expiresAt: undefined },
    ];
    expect(findSoonestExpiryIndex(items)).toBe(1);
    expect(findSoonestExpiryIndex([{ expiresAt: undefined }])).toBe(-1);
  });
});
