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
        spec: { authentication: { config: { password: "s3cret", username: "admin" } } },
      },
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    const spec = (result.connector as Record<string, unknown>).spec as Record<string, unknown>;
    const auth = spec.authentication as Record<string, unknown>;
    const config = auth.config as Record<string, unknown>;
    expect(config.password).toBe("[REDACTED]");
    expect(config.username).toBe("admin");
  });

  it("redacts credentials key entirely", () => {
    const input = {
      authentication: { credentials: { password: "s3cret", username: "admin" } },
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    const auth = result.authentication as Record<string, unknown>;
    expect(auth.credentials).toBe("[REDACTED]");
  });

  it("redacts webhookUrl and similar compound URL keys", () => {
    const input = {
      webhookUrl: "https://hooks.example.com/secret",
      webhook_url: "https://hooks.example.com/w2",
      "webhook-url": "https://hooks.example.com/w3",
      callbackUrl: "https://cb.example.com/c1",
      endpointUrl: "https://api.example.com/e1",
      name: "safe",
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    expect(result.webhookUrl).toBe("[REDACTED]");
    expect(result.webhook_url).toBe("[REDACTED]");
    expect(result["webhook-url"]).toBe("[REDACTED]");
    expect(result.callbackUrl).toBe("[REDACTED]");
    expect(result.endpointUrl).toBe("[REDACTED]");
    expect(result.name).toBe("safe");
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

  it("redacts objects beyond depth limit instead of leaking", () => {
    let obj: Record<string, unknown> = { token: "deep-secret" };
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj };
    }
    const result = JSON.stringify(redactSensitiveFields(obj));
    expect(result).not.toContain("deep-secret");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts token-style keys: access_token, refresh_token, id_token, credentials", () => {
    const input = {
      access_token: "at_123",
      refresh_token: "rt_456",
      id_token: "idt_789",
      credentials: "cred_abc",
      session_token: "st_def",
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    for (const key of Object.keys(input)) {
      expect(result[key]).toBe("[REDACTED]");
    }
  });

  it("redacts kebab-case sensitive keys", () => {
    const input = {
      "private-key": "ssh-rsa AAAA",
      "client-secret": "abc123",
      "access-token": "eyJhbG",
      "refresh-token": "rt_kebab",
      "id-token": "idt_kebab",
      "session-token": "st_kebab",
    };
    const result = redactSensitiveFields(input) as Record<string, unknown>;
    for (const key of Object.keys(input)) {
      expect(result[key]).toBe("[REDACTED]");
    }
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

  it("scrubs inline secrets on parse failure", () => {
    const raw = 'token: "my-secret-value", name: "safe"';
    const result = redactJsonString(raw);
    expect(result).not.toContain("my-secret-value");
    expect(result).toContain("[REDACTED]");
    expect(result).toContain("safe");
  });

  it("redacts full bearer token including dots in non-JSON text", () => {
    const raw = "authorization: Bearer abc.def.ghi";
    const result = redactJsonString(raw);
    expect(result).not.toContain("abc.def.ghi");
    expect(result).not.toContain("Bearer");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts webhook, encrypted, secret_key, ssh_key in non-JSON text", () => {
    const raw = "webhook=https://hook.example.com, encrypted=ciphertext123, secret_key=sk_live_abc, ssh_key=AAAA";
    const result = redactJsonString(raw);
    expect(result).not.toContain("https://hook.example.com");
    expect(result).not.toContain("ciphertext123");
    expect(result).not.toContain("sk_live_abc");
    expect(result).not.toContain("AAAA");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts quoted values with spaces in non-JSON text", () => {
    const raw = 'token: "my secret value", name: "safe"';
    const result = redactJsonString(raw);
    expect(result).not.toContain("my secret value");
    expect(result).toContain("[REDACTED]");
    expect(result).toContain("safe");
  });

  it("truncates scrubbed non-JSON output", () => {
    const result = redactJsonString("not-json{{{", 5);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("redacts kebab-case keys in non-JSON text", () => {
    const raw = "private-key: ssh-rsa AAAA, client-secret: abc123, access-token: eyJhbG";
    const result = redactJsonString(raw);
    expect(result).not.toContain("ssh-rsa AAAA");
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("eyJhbG");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts kebab-case keys in JSON objects", () => {
    const json = JSON.stringify({ "private-key": "secret_value", name: "safe" });
    const result = redactJsonString(json);
    expect(result).not.toContain("secret_value");
    expect(result).toContain("[REDACTED]");
    expect(result).toContain("safe");
  });
});
