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
  it("strips embedded whitespace and newlines", () => {
    const raw = Buffer.from("hello", "utf8").toString("base64");
    const wrapped = `${raw.slice(0, 3)}\n ${raw.slice(3)}`;
    expect(normalizeBase64(wrapped)).toBe(raw);
  });
});

describe("isValidBase64", () => {
  it("accepts well-formed strings with no padding, one =, or two ==", () => {
    expect(isValidBase64("TWFu")).toBe(true);
    expect(isValidBase64("TWE=")).toBe(true);
    expect(isValidBase64("TW==")).toBe(true);
  });

  it("rejects empty, wrong-length, and non-alphabet characters", () => {
    expect(isValidBase64("")).toBe(false);
    expect(isValidBase64("abc")).toBe(false);
    expect(isValidBase64("ab=c")).toBe(false);
    expect(isValidBase64("ab!c")).toBe(false);
  });

  it("rejects padding in the middle or more than two trailing =", () => {
    expect(isValidBase64("a=b=")).toBe(false);
    expect(isValidBase64("abc===")).toBe(false);
  });
});

describe("assertValidBase64", () => {
  it("returns normalized input for valid base64", () => {
    const encoded = Buffer.from("payload", "utf8").toString("base64");
    expect(assertValidBase64(` ${encoded} `, "body.content_base64")).toBe(encoded);
  });

  it("throws with the field label for empty or malformed values", () => {
    expect(() => assertValidBase64("   ", "body.actions[0].payload")).toThrow(
      /body\.actions\[0\]\.payload must not be empty/,
    );
    expect(() => assertValidBase64("not-valid!!", "body.content_base64")).toThrow(
      /body\.content_base64 must be valid base64/,
    );
  });
});

describe("estimateBase64DecodedBytes", () => {
  it("accounts for zero, one, and two padding bytes", () => {
    expect(estimateBase64DecodedBytes("TWFu")).toBe(3);
    expect(estimateBase64DecodedBytes("TWE=")).toBe(2);
    expect(estimateBase64DecodedBytes("TW==")).toBe(1);
  });
});

describe("encodeBase64", () => {
  it("encodes UTF-8 text", () => {
    expect(encodeBase64("café")).toBe(Buffer.from("café", "utf8").toString("base64"));
  });
});

describe("decodeBase64ToUtf8", () => {
  it("round-trips UTF-8 text and tolerates wrapped input", () => {
    const encoded = encodeBase64("hello world");
    expect(decodeBase64ToUtf8(encoded)).toBe("hello world");
    expect(decodeBase64ToUtf8(`\n${encoded}\n`)).toBe("hello world");
  });

  it("returns undefined for invalid base64", () => {
    expect(decodeBase64ToUtf8("not-valid-base64!!")).toBeUndefined();
  });

  it("returns undefined when decoded bytes are not valid UTF-8", () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    expect(decodeBase64ToUtf8(binary)).toBeUndefined();
  });
});
