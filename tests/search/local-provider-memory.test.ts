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
  it("identifies per-account entity keys", () => {
    expect(isResourceAccountKey("entities:acc1")).toBe(true);
    expect(isResourceAccountKey("entities:global")).toBe(false);
    expect(isResourceAccountKey("knowledge:global")).toBe(false);
    expect(isResourceAccountKey("resources:acc1")).toBe(false);
  });

  it("caps entities corpus items even when permanent", () => {
    expect(needsPerKeyCap("entities", undefined)).toBe(true);
    expect(needsPerKeyCap("knowledge", undefined)).toBe(false);
    expect(needsPerKeyCap("docs", Date.now() + 60_000)).toBe(true);
  });

  it("counts resource account keys excluding global", () => {
    const store = new Map<string, unknown[]>([
      ["entities:acc1", []],
      ["entities:acc2", []],
      ["entities:global", []],
      ["knowledge:global", [{}]],
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
      ["entities:old", []],
      ["entities:new", []],
      ["knowledge:global", []],
    ]);
    const accessed = new Map([
      ["entities:old", 100],
      ["entities:new", 500],
    ]);
    expect(findLruKey(store, accessed, isResourceAccountKey)).toBe("entities:old");
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
