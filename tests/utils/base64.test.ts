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
  it("strips all whitespace including newlines", () => {
    expect(normalizeBase64("YQ==\nYg==")).toBe("YQ==Yg==");
    expect(normalizeBase64("  YQ  ")).toBe("YQ");
  });
});

describe("isValidBase64", () => {
  it("accepts well-formed standard payloads", () => {
    expect(isValidBase64("YQ==")).toBe(true);
    expect(isValidBase64("YWI=")).toBe(true);
    expect(isValidBase64("YWJj")).toBe(true);
  });

  it("rejects empty, wrong length, and non-alphabet characters", () => {
    expect(isValidBase64("")).toBe(false);
    expect(isValidBase64("YQ=")).toBe(false);
    expect(isValidBase64("YQ!")).toBe(false);
    expect(isValidBase64("not-valid-base64!!")).toBe(false);
  });

  it("rejects padding in the middle or more than two padding bytes", () => {
    expect(isValidBase64("Y=Q=")).toBe(false);
    expect(isValidBase64("YQ===")).toBe(false);
  });
});

describe("assertValidBase64", () => {
  it("returns normalized base64 and uses the field label in errors", () => {
    expect(assertValidBase64("YQ==", "body.payload")).toBe("YQ==");
    expect(() => assertValidBase64("", "body.payload")).toThrow(/body\.payload must not be empty/);
    expect(() => assertValidBase64("!!!", "body.payload")).toThrow(/body\.payload must be valid base64/);
  });

  it("normalizes whitespace before validation", () => {
    expect(assertValidBase64("YQ==\n", "field")).toBe("YQ==");
  });
});

describe("estimateBase64DecodedBytes", () => {
  it("accounts for padding bytes", () => {
    expect(estimateBase64DecodedBytes("YQ==")).toBe(1);
    expect(estimateBase64DecodedBytes("YWI=")).toBe(2);
    expect(estimateBase64DecodedBytes("YWJj")).toBe(3);
  });
});

describe("encodeBase64 / decodeBase64ToUtf8", () => {
  it("round-trips UTF-8 text", () => {
    const text = "hello — world 🌍";
    const encoded = encodeBase64(text);
    expect(decodeBase64ToUtf8(encoded)).toBe(text);
  });

  it("returns undefined for invalid base64 input", () => {
    expect(decodeBase64ToUtf8("not-valid")).toBeUndefined();
  });

  it("returns undefined when decoded bytes are not valid UTF-8", () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    expect(decodeBase64ToUtf8(binary)).toBeUndefined();
  });
});
