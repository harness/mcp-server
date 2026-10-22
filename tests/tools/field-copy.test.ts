import { describe, it, expect } from "vitest";
import { fieldCopy, type FieldCopyKey } from "../../src/tools/field-copy.js";

const KEYS = [
  "diagnose.options",
  "execute.queries",
  "confirm.execute",
  "confirm.create",
  "confirm.update",
  "confirm.delete",
  "execute.wait",
  "execute.wait_timeout_seconds",
  "execute.wait_poll_interval_seconds",
  "create.params",
] as const satisfies readonly FieldCopyKey[];

describe("fieldCopy", () => {
  it("every key has shorter compact copy than full", () => {
    for (const key of KEYS) {
      expect(fieldCopy(key, "compact").length, key).toBeLessThan(fieldCopy(key, "full").length);
    }
  });

  it("compact confirm copy keeps user-intent and decline-is-final rules", () => {
    for (const key of ["confirm.execute", "confirm.create", "confirm.update", "confirm.delete"] as const) {
      const text = fieldCopy(key, "compact");
      expect(text, key).toMatch(/only with user intent/i);
      expect(text, key).toMatch(/never overrides a user's decline/i);
    }
  });

  it("full and compact strings are non-empty for every key", () => {
    for (const key of KEYS) {
      expect(fieldCopy(key, "full").trim(), `${key} full`).not.toBe("");
      expect(fieldCopy(key, "compact").trim(), `${key} compact`).not.toBe("");
    }
  });
});
