import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  openVaultValue,
  sealVaultValue,
} from "../../src/utils/oauth-proxy-vault.js";

describe("OAuth proxy vault crypto", () => {
  const key = randomBytes(32);

  it("round-trips sealed vault payloads", () => {
    const payload = {
      records: { "issuer\nsubject": { linked: true, updatedAt: "2026-10-07T00:00:00Z" } },
      transactions: {},
      brokerTransactions: {},
      brokerCodes: {},
    };
    const sealed = sealVaultValue(key, payload);
    expect(openVaultValue<typeof payload>(key, sealed)).toEqual(payload);
  });

  it("rejects tampered or unknown vault envelopes", () => {
    expect(() => openVaultValue(key, JSON.stringify({ version: 2 }))).toThrow(
      "unsupported format",
    );
    expect(() => openVaultValue(key, "not-json")).toThrow();
  });
});
