/**
 * Unit tests for shared base64 helpers used by repositories, file-store, and chaos toolsets.
 * Integration paths are covered elsewhere; these lock down validation and decode edge cases.
 */
import { describe, it, expect } from "vitest";
import {
  assertValidBase64,
  decodeBase64ToUtf8,
  encodeBase64,
  estimateBase64DecodedBytes,
  isValidBase64,
  normalizeBase64,
} from "../../src/utils/base64.js";

describe("normalizeBase64", () => {
  it("strips embedded whitespace", () => {
    expect(normalizeBase64("YWJj\nZGVm")).toBe("YWJjZGVm");
    expect(normalizeBase64(" YWJj ZGVm ")).toBe("YWJjZGVm");
  });
});

describe("isValidBase64", () => {
  it("accepts well-formed padded payloads", () => {
    expect(isValidBase64("YWJj")).toBe(true);
    expect(isValidBase64("YWJjZA==")).toBe(true);
    expect(isValidBase64("YWJjZGU=")).toBe(true);
  });

  it("rejects empty, wrong-length, and malformed charset input", () => {
    expect(isValidBase64("")).toBe(false);
    expect(isValidBase64("YWJjZ")).toBe(false);
    expect(isValidBase64("not-valid-base64!!")).toBe(false);
  });

  it("rejects padding that appears before the end", () => {
    expect(isValidBase64("Y=Jj")).toBe(false);
    expect(isValidBase64("YW==Jj")).toBe(false);
  });

  it("rejects more than two padding characters", () => {
    expect(isValidBase64("YWJjZ===")).toBe(false);
  });
});

describe("assertValidBase64", () => {
  it("returns normalized base64 and throws on invalid input", () => {
    expect(assertValidBase64("YWJj\nZGVm", "payload")).toBe("YWJjZGVm");
    expect(() => assertValidBase64("", "payload")).toThrow(/must not be empty/);
    expect(() => assertValidBase64("bad!!", "payload")).toThrow(/valid base64/);
  });
});

describe("estimateBase64DecodedBytes", () => {
  it("accounts for single and double padding", () => {
    expect(estimateBase64DecodedBytes("YWJj")).toBe(3);
    expect(estimateBase64DecodedBytes("YWJjZA==")).toBe(4);
    expect(estimateBase64DecodedBytes("YWJjZGU=")).toBe(5);
  });
});

describe("encodeBase64 / decodeBase64ToUtf8", () => {
  it("round-trips UTF-8 text", () => {
    const text = "hello world — unicode ✓";
    expect(decodeBase64ToUtf8(encodeBase64(text))).toBe(text);
  });

  it("returns undefined for malformed base64", () => {
    expect(decodeBase64ToUtf8("not-valid-base64!!")).toBeUndefined();
  });

  it("returns undefined for binary bytes that are not valid UTF-8", () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    expect(decodeBase64ToUtf8(binary)).toBeUndefined();
  });
});
