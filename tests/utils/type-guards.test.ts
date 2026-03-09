import { describe, it, expect } from "vitest";
import { isRecord, asRecord, asString, asNumber } from "../../src/utils/type-guards.js";

describe("type guards", () => {
  describe("isRecord", () => {
    it("returns true for plain objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it("returns false for non-objects", () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord("string")).toBe(false);
      expect(isRecord(42)).toBe(false);
      expect(isRecord(true)).toBe(false);
    });

    it("returns false for arrays", () => {
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2])).toBe(false);
    });
  });

  describe("asRecord", () => {
    it("returns the object when it is a record", () => {
      const obj = { key: "value" };
      expect(asRecord(obj)).toBe(obj);
    });

    it("returns undefined for non-records", () => {
      expect(asRecord(null)).toBeUndefined();
      expect(asRecord("string")).toBeUndefined();
      expect(asRecord([1, 2])).toBeUndefined();
    });
  });

  describe("asString", () => {
    it("returns the string when value is a string", () => {
      expect(asString("hello")).toBe("hello");
      expect(asString("")).toBe("");
    });

    it("returns undefined for non-strings", () => {
      expect(asString(42)).toBeUndefined();
      expect(asString(null)).toBeUndefined();
      expect(asString(undefined)).toBeUndefined();
      expect(asString({})).toBeUndefined();
    });
  });

  describe("asNumber", () => {
    it("returns the number when value is a number", () => {
      expect(asNumber(42)).toBe(42);
      expect(asNumber(0)).toBe(0);
      expect(asNumber(-1.5)).toBe(-1.5);
    });

    it("returns undefined for non-numbers", () => {
      expect(asNumber("42")).toBeUndefined();
      expect(asNumber(null)).toBeUndefined();
      expect(asNumber(undefined)).toBeUndefined();
      expect(asNumber({})).toBeUndefined();
    });
  });
});
