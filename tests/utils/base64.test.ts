import { describe, expect, it } from "vitest";
import {
  assertValidBase64,
  decodeBase64ToUtf8,
  encodeBase64,
  estimateBase64DecodedBytes,
  isValidBase64,
  normalizeBase64,
} from "../../src/utils/base64.js";

describe("base64 helpers", () => {
  it("normalizeBase64 strips whitespace before validation", () => {
    const wrapped = "aGVsbG8=\n";
    expect(normalizeBase64(wrapped)).toBe("aGVsbG8=");
    expect(isValidBase64(normalizeBase64(wrapped))).toBe(true);
  });

  it("rejects invalid padding placement and non-base64 characters", () => {
    expect(isValidBase64("abc")).toBe(false);
    expect(isValidBase64("abcd=")).toBe(false);
    expect(isValidBase64("ab=cdef")).toBe(false);
  });

  it("assertValidBase64 returns normalized input and throws on empty or invalid data", () => {
    expect(assertValidBase64("YQ==", "payload")).toBe("YQ==");
    expect(() => assertValidBase64("   ", "payload")).toThrow(/must not be empty/);
    expect(() => assertValidBase64("not!!", "payload")).toThrow(/valid base64/);
  });

  it("estimateBase64DecodedBytes accounts for padding bytes", () => {
    expect(estimateBase64DecodedBytes("YQ==")).toBe(1);
    expect(estimateBase64DecodedBytes(encodeBase64("hello"))).toBe(5);
  });

  it("decodeBase64ToUtf8 returns undefined for binary payloads that are not valid UTF-8", () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    expect(decodeBase64ToUtf8(binary)).toBeUndefined();
    expect(decodeBase64ToUtf8(encodeBase64("plain text"))).toBe("plain text");
  });
});
