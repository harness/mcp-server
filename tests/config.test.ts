import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  extractAccountIdFromToken,
  isPlaceholderCredential,
  loadConfig,
  resolveFmeApiKey,
} from "../src/config.js";

describe("extractAccountIdFromToken", () => {
  it("extracts account ID from a valid PAT", () => {
    expect(extractAccountIdFromToken("pat.acct123.tokenId.secret")).toBe("acct123");
  });

  it("extracts account ID from a PAT with extra dots in secret", () => {
    expect(extractAccountIdFromToken("pat.acct123.tokenId.secret.extra")).toBe("acct123");
  });

  it("extracts account ID from a valid SAT", () => {
    expect(extractAccountIdFromToken("sat.acct123.tokenId.secret")).toBe("acct123");
  });

  it("extracts account ID from token prefixes case-insensitively", () => {
    expect(extractAccountIdFromToken("SAT.acct123.tokenId.secret")).toBe("acct123");
  });

  it("returns undefined for unsupported token prefixes", () => {
    expect(extractAccountIdFromToken("api.acct123.tokenId.secret")).toBeUndefined();
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
    expect(() =>
      ConfigSchema.parse({ HARNESS_ACCOUNT_ID: "acct123" }),
    ).toThrow("HARNESS_API_KEY is required in single-user mode");
  });

  it("HARNESS_ACCOUNT_ID is optional in schema", () => {
    const result = ConfigSchema.safeParse({ HARNESS_API_KEY: "pat.acct123.tok.sec" });
    expect(result.success).toBe(true);
  });

  it("extracts HARNESS_ACCOUNT_ID from service account API keys", () => {
    const result = ConfigSchema.safeParse({
      HARNESS_API_KEY: "sat.acct123.tokenId.secret",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_ACCOUNT_ID).toBe("acct123");
    }
  });

  it("fails when HARNESS_API_KEY is empty", () => {
    expect(() =>
      ConfigSchema.parse({ HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "acct" }),
    ).toThrow("HARNESS_API_KEY is required in single-user mode");
  });

  it("applies default HARNESS_BASE_URL", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_BASE_URL).toBe("https://app.harness.io");
    }
  });

  it("defaults HARNESS_ORG to undefined when not provided", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_ORG).toBeUndefined();
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

  it("treats empty optional MCPB user config values as unset", () => {
    const result = ConfigSchema.safeParse({
      HARNESS_API_KEY: "pat.acct123.tokenId.secret",
      HARNESS_ACCOUNT_ID: "",
      HARNESS_ORG: "",
      HARNESS_PROJECT: "",
      HARNESS_BASE_URL: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_ACCOUNT_ID).toBe("acct123");
      expect(result.data.HARNESS_ORG).toBeUndefined();
      expect(result.data.HARNESS_PROJECT).toBeUndefined();
      expect(result.data.HARNESS_BASE_URL).toBe("https://app.harness.io");
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

  it("normalizes configured MCP allowed hosts during config validation", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_MCP_ALLOWED_HOSTS: "https://mcp.example.com, mcp.example.com:443, localhost",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_MCP_ALLOWED_HOSTS).toBe("mcp.example.com,localhost");
    }
  });

  it("defaults HARNESS_MCP_MODE to single-user", () => {
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_MCP_MODE).toBe("single-user");
    }
  });

  it("accepts multi-user mode without HARNESS_API_KEY", () => {
    const result = ConfigSchema.safeParse({
      HARNESS_MCP_MODE: "multi-user",
      HARNESS_ACCOUNT_ID: "acct123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_MCP_MODE).toBe("multi-user");
      expect(result.data.HARNESS_API_KEY).toBe("");
    }
  });

  it("rejects multi-user mode when HARNESS_API_KEY is set", () => {
    expect(() =>
      ConfigSchema.parse({
        ...validConfig,
        HARNESS_MCP_MODE: "multi-user",
      }),
    ).toThrow("HARNESS_API_KEY must not be set in multi-user mode");
  });

  it("requires HARNESS_API_KEY in single-user mode", () => {
    expect(() =>
      ConfigSchema.parse({
        HARNESS_MCP_MODE: "single-user",
        HARNESS_ACCOUNT_ID: "acct123",
      }),
    ).toThrow("HARNESS_API_KEY is required in single-user mode");
  });

  it("parses HTTP MCP auth token and unauthenticated opt-out config", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_MCP_AUTH_TOKEN: "shared-secret",
      HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_MCP_AUTH_TOKEN).toBe("shared-secret");
      expect(result.data.HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP).toBe(true);
    }
  });

  it("treats an empty HTTP MCP auth token as unset", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_MCP_AUTH_TOKEN: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_MCP_AUTH_TOKEN).toBeUndefined();
      expect(result.data.HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP).toBe(false);
    }
  });

  it("rejects malformed MCP allowed host entries during config validation", () => {
    expect(() =>
      ConfigSchema.parse({
        ...validConfig,
        HARNESS_MCP_ALLOWED_HOSTS: "mcp.example.com, http://",
      }),
    ).toThrow('Invalid HARNESS_MCP_ALLOWED_HOSTS entries: "http://"');
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

  it("rejects http:// FME base URL by default", () => {
    expect(() =>
      ConfigSchema.parse({
        ...validConfig,
        HARNESS_FME_BASE_URL: "http://localhost:9090",
      }),
    ).toThrow("HARNESS_FME_BASE_URL must use HTTPS");
  });

  it("accepts http:// FME base URL when HARNESS_ALLOW_HTTP=true", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_FME_BASE_URL: "http://localhost:9090",
      HARNESS_ALLOW_HTTP: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_FME_BASE_URL).toBe("http://localhost:9090");
    }
  });

  it("always accepts https:// FME base URL", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_FME_BASE_URL: "https://custom.split.io",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_FME_BASE_URL).toBe("https://custom.split.io");
    }
  });

  it("parses explicit FME API key config", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_FME_API_KEY: "fme-admin-key",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_FME_API_KEY).toBe("fme-admin-key");
    }
  });

  it("treats empty FME API key config as unset", () => {
    const result = ConfigSchema.safeParse({
      ...validConfig,
      HARNESS_FME_API_KEY: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HARNESS_FME_API_KEY).toBeUndefined();
    }
  });

  it("resolves FME auth from explicit key before Harness API key", () => {
    expect(resolveFmeApiKey({
      HARNESS_FME_API_KEY: "fme-admin-key",
      HARNESS_API_KEY: "pat.acct123.tokenId.secret",
    })).toBe("fme-admin-key");
  });

  it("falls back to non-placeholder Harness API key for FME auth", () => {
    expect(resolveFmeApiKey({
      HARNESS_FME_API_KEY: undefined,
      HARNESS_API_KEY: "pat.acct123.tokenId.secret",
    })).toBe("pat.acct123.tokenId.secret");
  });

  it("does not resolve hosted placeholder credentials for FME auth", () => {
    expect(isPlaceholderCredential("dummy")).toBe(true);
    expect(isPlaceholderCredential("pat.internal.internal.dummy")).toBe(true);
    expect(resolveFmeApiKey({
      HARNESS_FME_API_KEY: undefined,
      HARNESS_API_KEY: "dummy",
    })).toBeUndefined();
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

  it("extracts account ID from SAT when HARNESS_ACCOUNT_ID is not set", () => {
    withEnv({ HARNESS_API_KEY: "sat.extracted123.tok.sec" }, () => {
      const config = loadConfig();
      expect(config.HARNESS_ACCOUNT_ID).toBe("extracted123");
    });
  });

  it("throws when HARNESS_ACCOUNT_ID missing and API key has no account segment", () => {
    withEnv({ HARNESS_API_KEY: "opaque-token" }, () => {
      expect(() => loadConfig()).toThrow(
        "HARNESS_ACCOUNT_ID is required when the API key does not include an account ID segment",
      );
    });
  });
});
