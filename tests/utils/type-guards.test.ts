import { describe, it, expect } from "vitest";
import { isRecord, asRecord, asString, asNumber, coerceRecord } from "../../src/utils/type-guards.js";

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

  describe("coerceRecord", () => {
    it("parses valid JSON object string", () => {
      expect(coerceRecord('{"a":1}')).toEqual({ a: 1 });
    });

    it("returns undefined for non-JSON string", () => {
      expect(coerceRecord("not json")).toBeUndefined();
    });

    it("returns undefined for JSON array string", () => {
      expect(coerceRecord("[]")).toBeUndefined();
    });

    it("returns undefined for JSON null string", () => {
      expect(coerceRecord("null")).toBeUndefined();
    });

    it("returns undefined for number", () => {
      expect(coerceRecord(42)).toBeUndefined();
    });

    it("passes through plain object", () => {
      const obj = { a: 1 };
      expect(coerceRecord(obj)).toBe(obj);
    });

    it("returns undefined for undefined", () => {
      expect(coerceRecord(undefined)).toBeUndefined();
    });

    it("returns undefined for null", () => {
      expect(coerceRecord(null)).toBeUndefined();
    });

    it("returns undefined for boolean", () => {
      expect(coerceRecord(true)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(coerceRecord("")).toBeUndefined();
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
