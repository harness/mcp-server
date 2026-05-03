import { describe, it, expect } from "vitest";
import { redactSensitiveFields, redactJsonString } from "../../src/utils/redact.js";

describe("redactSensitiveFields", () => {
  it("redacts top-level sensitive keys", () => {
    const input = { name: "my-connector", token: "ghp_abc123", type: "GitHub" };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    expect(result.name).toBe("my-connector");
    expect(result.token).toBe("[REDACTED]");
    expect(result.type).toBe("GitHub");
  });

  it("redacts nested sensitive keys", () => {
    const input = {
      connector: {
        name: "test",
        spec: { authentication: { credentials: { password: "s3cret", username: "admin" } } },
      },
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    const creds = (result.connector as Record<string, unknown>).spec as Record<string, unknown>;
    const auth = creds.authentication as Record<string, unknown>;
    const credObj = auth.credentials as Record<string, unknown>;
    expect(credObj.password).toBe("[REDACTED]");
    expect(credObj.username).toBe("admin");
  });

  it("redacts various key patterns case-insensitively", () => {
    const input = {
      apiKey: "key1",
      API_KEY: "key2",
      secretKey: "key3",
      secret_key: "key4",
      clientSecret: "key5",
      client_secret: "key6",
      privateKey: "key7",
      private_key: "key8",
      accessKey: "key9",
      access_key: "key10",
      sshKey: "key11",
      ssh_key: "key12",
      bearer: "key13",
      authorization: "key14",
      webhook: "url1",
      passphrase: "phrase1",
      encrypted: "data1",
      credential: "cred1",
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    for (const key of Object.keys(input)) {
      expect(result[key]).toBe("[REDACTED]");
    }
  });

  it("does not redact non-sensitive keys", () => {
    const input = { identifier: "my-id", name: "my-name", description: "desc", orgId: "org1" };
    const result = redactSensitiveFields(input);
    expect(result).toEqual(input);
  });

  it("handles arrays with objects", () => {
    const input = [
      { name: "a", token: "t1" },
      { name: "b", secret: "s1" },
    ];
    const result = redactSensitiveFields(input) as Array<Record<string, unknown>>;
    expect(result[0]!.token).toBe("[REDACTED]");
    expect(result[1]!.secret).toBe("[REDACTED]");
    expect(result[0]!.name).toBe("a");
  });

  it("handles null and primitive values", () => {
    expect(redactSensitiveFields(null)).toBeNull();
    expect(redactSensitiveFields(undefined)).toBeUndefined();
    expect(redactSensitiveFields("hello")).toBe("hello");
    expect(redactSensitiveFields(42)).toBe(42);
  });

  it("does not mutate the original object", () => {
    const input = { token: "secret-value", name: "test" };
    redactSensitiveFields(input);
    expect(input.token).toBe("secret-value");
  });

  it("handles deeply nested objects up to depth limit", () => {
    let obj: Record<string, unknown> = { token: "deep-secret" };
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj };
    }
    const result = JSON.stringify(redactSensitiveFields(obj));
    expect(result).toContain("deep-secret");
  });
});

describe("redactJsonString", () => {
  it("redacts sensitive fields in a JSON string", () => {
    const json = JSON.stringify({ name: "test", password: "s3cret", identifier: "id1" });
    const result = redactJsonString(json);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("s3cret");
    expect(result).toContain("test");
  });

  it("truncates long output", () => {
    const json = JSON.stringify({ name: "a".repeat(2000) });
    const result = redactJsonString(json, 100);
    expect(result.length).toBeLessThanOrEqual(103);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns truncated input on parse failure", () => {
    const result = redactJsonString("not-json{{{", 5);
    expect(result).toBe("not-j");
  });
});
