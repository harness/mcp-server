import { describe, it, expect } from "vitest";
import { ConfigSchema, loadConfig, extractAccountIdFromToken } from "../src/config.js";

describe("extractAccountIdFromToken", () => {
  it("extracts account ID from a valid PAT", () => {
    expect(extractAccountIdFromToken("pat.acct123.tokenId.secret")).toBe("acct123");
  });

  it("extracts account ID from a PAT with extra dots in secret", () => {
    expect(extractAccountIdFromToken("pat.acct123.tokenId.secret.extra")).toBe("acct123");
  });

  it("returns undefined for non-PAT tokens", () => {
    expect(extractAccountIdFromToken("sat.acct123.tokenId.secret")).toBeUndefined();
  });

  it("returns undefined for tokens with too few segments", () => {
    expect(extractAccountIdFromToken("pat.acct123")).toBeUndefined();
  });

  it("returns undefined for empty account ID segment", () => {
    expect(extractAccountIdFromToken("pat..tokenId.secret")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(extractAccountIdFromToken("")).toBeUndefined();
  });
});

describe("ConfigSchema", () => {
  const validConfig = {
    HARNESS_API_KEY: "pat.acct123.tokenId.secret",
    HARNESS_ACCOUNT_ID: "acct123",
  };

  it("parses valid full config", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_BASE_URL: "https://custom.harness.io",
      HARNESS_ORG: "myorg",
      HARNESS_PROJECT: "myproject",
      HARNESS_API_TIMEOUT_MS: "5000",
      HARNESS_MAX_RETRIES: "5",
      LOG_LEVEL: "debug",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_BASE_URL).toBe("https://custom.harness.io");
      expect(result.data.HARNESS_ORG).toBe("myorg");
      expect(result.data.HARNESS_PROJECT).toBe("myproject");
      expect(result.data.HARNESS_API_TIMEOUT_MS).toBe(5000);
      expect(result.data.HARNESS_MAX_RETRIES).toBe(5);
      expect(result.data.LOG_LEVEL).toBe("debug");
    }
  });

  it("fails when HARNESS_API_KEY is missing", () => {
    const result = ConfigSchema.safeParse({ HARNESS_ACCOUNT_ID: "acct123" });
    expect(result.success).toBe(false);
  });

  it("HARNESS_ACCOUNT_ID is optional in schema", () => {
    const result = ConfigSchema.safeParse({ HARNESS_API_KEY: "pat.acct123.tok.sec" });
    expect(result.success).toBe(true);
  });

  it("fails when HARNESS_API_KEY is empty", () => {
    const result = ConfigSchema.safeParse({ HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "acct" });
    expect(result.success).toBe(false);
  });

  it("applies default HARNESS_BASE_URL", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_BASE_URL).toBe("https://app.harness.io");
    }
  });

  it("applies default HARNESS_ORG", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_ORG).toBe("default");
    }
  });

  it("applies default LOG_LEVEL", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  it("treats empty LOG_LEVEL as unset and defaults to info", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, LOG_LEVEL: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  it("applies default timeout and retries", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_API_TIMEOUT_MS).toBe(30000);
      expect(result.data.HARNESS_MAX_RETRIES).toBe(3);
    }
  });

  it("coerces string numbers for timeout and retries", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_API_TIMEOUT_MS: "10000",
      HARNESS_MAX_RETRIES: "2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_API_TIMEOUT_MS).toBe(10000);
      expect(result.data.HARNESS_MAX_RETRIES).toBe(2);
    }
  });

  it("HARNESS_PROJECT is optional", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_PROJECT).toBeUndefined();
    }
  });

  it("HARNESS_TOOLSETS is optional", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_TOOLSETS).toBeUndefined();
    }
  });
});

describe("ConfigSchema — boolean env var coercion", () => {
  const validConfig = {
    HARNESS_API_KEY: "pat.acct123.tokenId.secret",
    HARNESS_ACCOUNT_ID: "acct123",
  };

  it.each(["true", "1", "yes", "YES", "True"])("HARNESS_SKIP_ELICITATION=%s → true", (val) => {
    const result = ConfigSchema.safeParse({ ...validConfig, HARNESS_SKIP_ELICITATION: val });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_SKIP_ELICITATION).toBe(true);
  });

  it.each(["false", "0", "no", "NO", "False", ""])("HARNESS_SKIP_ELICITATION=%s → false", (val) => {
    const result = ConfigSchema.safeParse({ ...validConfig, HARNESS_SKIP_ELICITATION: val });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_SKIP_ELICITATION).toBe(false);
  });

  it("HARNESS_SKIP_ELICITATION defaults to false when unset", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_SKIP_ELICITATION).toBe(false);
  });

  it("HARNESS_ENFORCE_PIPELINE_VERSION defaults to false when unset", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_ENFORCE_PIPELINE_VERSION).toBe(false);
  });

  it("HARNESS_ENFORCE_PIPELINE_VERSION=true enables enforcement", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, HARNESS_ENFORCE_PIPELINE_VERSION: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_ENFORCE_PIPELINE_VERSION).toBe(true);
  });

  it("HARNESS_READ_ONLY=false is actually false", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, HARNESS_READ_ONLY: "false" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_READ_ONLY).toBe(false);
  });

  it("HARNESS_READ_ONLY=true is true", () => {
    const result = ConfigSchema.safeParse({ ...validConfig, HARNESS_READ_ONLY: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.HARNESS_READ_ONLY).toBe(true);
  });
});

describe("ConfigSchema — HTTPS enforcement", () => {
  const validConfig = {
    HARNESS_API_KEY: "pat.acct123.tokenId.secret",
    HARNESS_ACCOUNT_ID: "acct123",
  };

  it("rejects http:// base URL by default", () => {
    expect(() =>
      ConfigSchema.parse({
        ...validConfig,
        HARNESS_BASE_URL: "http://localhost:8080",
      }),
    ).toThrow("HARNESS_BASE_URL must use HTTPS");
  });

  it("accepts http:// base URL when HARNESS_ALLOW_HTTP=true", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_BASE_URL: "http://localhost:8080",
      HARNESS_ALLOW_HTTP: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_BASE_URL).toBe("http://localhost:8080");
    }
  });

  it("always accepts https:// base URL", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_BASE_URL: "https://custom.harness.io",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_BASE_URL).toBe("https://custom.harness.io");
    }
  });
});

describe("loadConfig — account ID extraction", () => {
  const originalEnv = process.env;

  function withEnv(env: Record<string, string>, fn: () => void) {
    const prev = { ...process.env };
    // Clear all env vars and set only what's provided
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
    try {
      fn();
    } finally {
      for (const key of Object.keys(process.env)) {
        delete process.env[key];
      }
      Object.assign(process.env, prev);
    }
  }

  it("uses explicit HARNESS_ACCOUNT_ID when provided", () => {
    withEnv(
      { HARNESS_API_KEY: "pat.fromtoken.tok.sec", HARNESS_ACCOUNT_ID: "explicit" },
      () => {
        const config = loadConfig();
        expect(config.HARNESS_ACCOUNT_ID).toBe("explicit");
      },
    );
  });

  it("extracts account ID from PAT when HARNESS_ACCOUNT_ID is not set", () => {
    withEnv({ HARNESS_API_KEY: "pat.extracted123.tok.sec" }, () => {
      const config = loadConfig();
      expect(config.HARNESS_ACCOUNT_ID).toBe("extracted123");
    });
  });

  it("throws when HARNESS_ACCOUNT_ID missing and API key is not a PAT", () => {
    withEnv({ HARNESS_API_KEY: "sat.notapat.tok.sec" }, () => {
      expect(() => loadConfig()).toThrow(
        "HARNESS_ACCOUNT_ID is required when the API key is not a PAT",
      );
    });
  });
});
