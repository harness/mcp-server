import { describe, expect, it } from "vitest";
import {
  assertValidBase64,
  decodeBase64ToUtf8,
  encodeBase64,
  estimateBase64DecodedBytes,
  isValidBase64,
  normalizeBase64,
} from "../../src/utils/base64.js";

describe("normalizeBase64", () => {
  it("strips all whitespace before validation", () => {
    expect(normalizeBase64("YQ==\nYQ==")).toBe("YQ==YQ==");
    expect(normalizeBase64("  YQ==  ")).toBe("YQ==");
  });
});

describe("isValidBase64", () => {
  it("accepts canonical padded payloads", () => {
    expect(isValidBase64("YQ==")).toBe(true);
    expect(isValidBase64("YWI=")).toBe(true);
    expect(isValidBase64("YWJj")).toBe(true);
  });

  it("rejects empty, wrong length, bad charset, and misplaced padding", () => {
    expect(isValidBase64("")).toBe(false);
    expect(isValidBase64("YQ=")).toBe(false);
    expect(isValidBase64("not-valid!!")).toBe(false);
    expect(isValidBase64("Y=Q=")).toBe(false);
    expect(isValidBase64("YQ=ABC")).toBe(false);
  });
});

describe("assertValidBase64", () => {
  it("returns normalized input and uses the field label in errors", () => {
    expect(assertValidBase64(" YQ== ", "body.content_base64")).toBe("YQ==");
    expect(() => assertValidBase64("", "body.content_base64")).toThrow(
      "body.content_base64 must not be empty.",
    );
    expect(() => assertValidBase64("!!!", "actions[0].payload")).toThrow(
      "actions[0].payload must be valid base64.",
    );
  });
});

describe("estimateBase64DecodedBytes", () => {
  it("accounts for one and two padding bytes", () => {
    expect(estimateBase64DecodedBytes("YQ==")).toBe(1);
    expect(estimateBase64DecodedBytes("YWI=")).toBe(2);
    expect(estimateBase64DecodedBytes("YWJj")).toBe(3);
  });
});

describe("encodeBase64 / decodeBase64ToUtf8", () => {
  it("round-trips UTF-8 text", () => {
    const encoded = encodeBase64("hello harness");
    expect(decodeBase64ToUtf8(encoded)).toBe("hello harness");
  });

  it("returns undefined for invalid base64 instead of throwing", () => {
    expect(decodeBase64ToUtf8("not-base64!!")).toBeUndefined();
  });

  it("returns undefined for binary payloads that are not valid UTF-8", () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    expect(decodeBase64ToUtf8(binary)).toBeUndefined();
  });
});
