/**
 * Tests for list-filter enum canonicalization.
 *
 * Agents often send lowercase status/type values while APIs require
 * PascalCase or UPPERCASE. canonicalizeListFilterEnums rewrites
 * case-insensitive matches to the declared enum form and leaves
 * everything else alone.
 */
import { describe, it, expect, vi } from "vitest";
import { canonicalizeListFilterEnums } from "../../src/registry/enum-utils.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { FilterFieldSpec } from "../../src/registry/types.js";

describe("canonicalizeListFilterEnums", () => {
  const fields: FilterFieldSpec[] = [
    {
      name: "status",
      description: "status",
      enum: ["Pending", "Approved", "Rejected"],
      required: true,
    },
    {
      name: "severity_codes",
      description: "comma-separated",
      enum: ["Critical", "High", "Medium"],
    },
    { name: "search", description: "free text" },
  ];

  it("rewrites lowercase single values to canonical PascalCase", () => {
    const input: Record<string, unknown> = { status: "pending" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.status).toBe("Pending");
  });

  it("preserves already-canonical values", () => {
    const input: Record<string, unknown> = { status: "Approved" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.status).toBe("Approved");
  });

  it("rewrites mixed-case values", () => {
    const input: Record<string, unknown> = { status: "aPpRoVeD" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.status).toBe("Approved");
  });

  it("canonicalizes comma-separated multi-values token-by-token", () => {
    const input: Record<string, unknown> = { severity_codes: "critical,HIGH,medium" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.severity_codes).toBe("Critical,High,Medium");
  });

  it("passes through values with no case-insensitive match", () => {
    // Declared enums are documentation metadata that can lag the API, and some
    // resources apply their own fallback — never block an undeclared value here.
    const input: Record<string, unknown> = { status: "waiting" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.status).toBe("waiting");
  });

  it("canonicalizes known tokens and preserves unknown ones in a multi-value", () => {
    const input: Record<string, unknown> = { severity_codes: "critical,unknown-code" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.severity_codes).toBe("Critical,unknown-code");
  });

  it("leaves fields without enums untouched", () => {
    const input: Record<string, unknown> = { search: "log4j", status: "pending" };
    canonicalizeListFilterEnums(input, fields);
    expect(input.search).toBe("log4j");
    expect(input.status).toBe("Pending");
  });

  it("ignores non-string filter values", () => {
    const input: Record<string, unknown> = { status: 42 };
    canonicalizeListFilterEnums(input, fields);
    expect(input.status).toBe(42);
  });

  it("no-ops when the filter is omitted", () => {
    const input: Record<string, unknown> = {};
    canonicalizeListFilterEnums(input, fields);
    expect(input.status).toBeUndefined();
  });
});

describe("registry.dispatch — list filter enum canonicalization", () => {
  function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
      HARNESS_API_KEY: "pat.test",
      HARNESS_ACCOUNT_ID: "test-account",
      HARNESS_BASE_URL: "https://app.harness.io",
      HARNESS_ORG: "default",
      HARNESS_PROJECT: "test-project",
      HARNESS_API_TIMEOUT_MS: 30000,
      HARNESS_MAX_RETRIES: 3,
      LOG_LEVEL: "info",
      HARNESS_MAX_BODY_SIZE_MB: 10,
      HARNESS_RATE_LIMIT_RPS: 10,
      HARNESS_READ_ONLY: false,
      HARNESS_SKIP_ELICITATION: false,
      HARNESS_ALLOW_HTTP: false,
      HARNESS_FME_BASE_URL: "https://api.split.io",
      ...overrides,
    } as Config;
  }

  function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
    return {
      request: requestFn ?? vi.fn().mockResolvedValue({}),
      account: "test-account",
    } as unknown as HarnessClient;
  }

  it("sends canonical PascalCase status when agent passes lowercase", async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      exemptions: [],
      pagination: { page: 0, pageSize: 5, totalPages: 0, totalItems: 0 },
      counts: {},
    });
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "security_exemption", "list", {
      status: "pending",
      size: 5,
    });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const callArgs = requestSpy.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.status).toBe("Pending");
  });

  it("forwards an undeclared status untouched and lets the API decide", async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      exemptions: [],
      pagination: { page: 0, pageSize: 5, totalPages: 0, totalItems: 0 },
      counts: {},
    });
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "security_exemption", "list", {
      status: "waiting",
      size: 5,
    });

    const callArgs = requestSpy.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.status).toBe("waiting");
  });
});
