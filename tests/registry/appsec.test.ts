import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { ConfigSchema, resolveAppSecApiKey, resolveProductBaseUrl, type Config } from "../../src/config.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import { mergeConfigWithSessionHeaders } from "../../src/utils/session-headers.js";
import type { HarnessClientInterface } from "../../src/registry/types.js";

const VALID_API_UUID = "c7e8f4ca-f821-332c-8510-84d79605d652";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.testaccount.tok.sec",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_APPSEC_BASE_URL: "https://api.traceable.ai",
    HARNESS_APPSEC_UI_URL: "https://app.traceable.ai",
    HARNESS_APPSEC_API_KEY: "traceable-token-xyz",
    HARNESS_TOOLSETS: "+appsec",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 0,
    HARNESS_RATE_LIMIT_RPS: 100,
    HARNESS_LOG_UNSAFE_BODIES: false,
    LOG_LEVEL: "error",
    ...overrides,
  } as Config;
}

function makeMockClient(responseImpl: (opts: Record<string, unknown>) => unknown) {
  const calls: Array<Record<string, unknown>> = [];
  const client: HarnessClientInterface = {
    account: "testaccount",
    getCurrentUserId: vi.fn(async () => "user-1"),
    request: vi.fn(async (opts) => {
      calls.push(opts as unknown as Record<string, unknown>);
      return responseImpl(opts as unknown as Record<string, unknown>) as never;
    }),
  };
  return { client, calls };
}

describe("AppSec Toolset & Config", () => {
  describe("Opt-In Exposure & Contract", () => {
    it("is opt-in: excluded from default registry and loaded when HARNESS_TOOLSETS includes +appsec", () => {
      const defaultReg = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
      expect(defaultReg.getAllResourceTypes()).not.toContain("appsec_api");
      expect(defaultReg.getAllResourceTypes()).not.toContain("appsec_vulnerability");

      const optInReg = new Registry(makeConfig({ HARNESS_TOOLSETS: "+appsec" }));
      expect(optInReg.getAllResourceTypes()).toContain("appsec_api");
      expect(optInReg.getAllResourceTypes()).toContain("appsec_vulnerability");
      expect(optInReg.getAllResourceTypes()).not.toContain("appsec_query");
    });

    it("defines compactItem on every AppSec list resource and never sets skipCompact", () => {
      const reg = new Registry(makeConfig());
      const appsecToolset = reg.getAllToolsets().find((t) => t.name === "appsec")!;
      expect(appsecToolset).toBeDefined();

      for (const res of appsecToolset.resources) {
        if (res.operations.list) {
          expect(res.compactItem, `${res.resourceType} missing compactItem`).toBeTypeOf("function");
          expect(res.operations.list.skipCompact, `${res.resourceType}.list should not set skipCompact`).toBeUndefined();
        }
      }
    });
  });

  describe("Config & Product Auth Isolation (No Harness Credential Egress)", () => {
    it("strips trailing /graphql from HARNESS_APPSEC_BASE_URL in resolveProductBaseUrl", () => {
      const cfg = makeConfig({ HARNESS_APPSEC_BASE_URL: "https://api-dev.traceable.ai/graphql" });
      expect(resolveProductBaseUrl(cfg, "appsec")).toBe("https://api-dev.traceable.ai");
    });

    it("rejects HARNESS_APPSEC_API_KEY in multi-user and oauth modes", () => {
      expect(() =>
        ConfigSchema.parse({
          HARNESS_MCP_MODE: "multi-user",
          HARNESS_APPSEC_API_KEY: "secret",
        }),
      ).toThrow(/HARNESS_APPSEC_API_KEY must not be set in multi-user mode/);

      expect(() =>
        ConfigSchema.parse({
          HARNESS_MCP_MODE: "oauth",
          HARNESS_APPSEC_API_KEY: "secret",
        }),
      ).toThrow(/HARNESS_APPSEC_API_KEY must not be set in oauth mode/);
    });

    it("resolves only explicit HARNESS_APPSEC_API_KEY in single-user mode and never falls back to HARNESS_API_KEY", () => {
      expect(
        resolveAppSecApiKey({
          HARNESS_MCP_MODE: "single-user",
          HARNESS_APPSEC_API_KEY: "traceable-explicit",
        }),
      ).toBe("traceable-explicit");

      expect(
        resolveAppSecApiKey({
          HARNESS_MCP_MODE: "single-user",
          HARNESS_APPSEC_API_KEY: undefined,
        }),
      ).toBeUndefined();

      expect(
        resolveAppSecApiKey({
          HARNESS_MCP_MODE: "multi-user",
          HARNESS_APPSEC_API_KEY: "traceable-explicit",
        }),
      ).toBeUndefined();
    });

    it("sends Authorization header without Harness-Account or accountIdentifier query param when HARNESS_APPSEC_API_KEY is set", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { dataTypes: { results: [] } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      try {
        const cfg = makeConfig({
          HARNESS_APPSEC_BASE_URL: "https://api-dev.traceable.ai/graphql",
          HARNESS_APPSEC_API_KEY: "traceable-secret-token",
        });
        const client = new HarnessClient(cfg);
        const registry = new Registry(cfg);

        await registry.dispatch(client, "appsec_datatype", "list", {});

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
        expect(calledUrl).toBe("https://api-dev.traceable.ai/graphql");
        const headers = calledInit?.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("traceable-secret-token");
        expect(headers["Harness-Account"]).toBeUndefined();
        expect(headers["x-api-key"]).toBeUndefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("fails closed in single-user mode when HARNESS_APPSEC_API_KEY is unset (never sends HARNESS_API_KEY)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      try {
        const cfg = makeConfig({ HARNESS_APPSEC_API_KEY: undefined });
        const client = new HarnessClient(cfg);
        const registry = new Registry(cfg);

        await expect(registry.dispatch(client, "appsec_datatype", "list", {})).rejects.toThrow(
          /HARNESS_API_KEY is never forwarded to Traceable/,
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("fails closed in multi-user mode when x-harness-appsec-api-key is absent (never sends session x-api-key to Traceable)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      try {
        const cfg = makeConfig({
          HARNESS_MCP_MODE: "multi-user",
          HARNESS_API_KEY: "",
          HARNESS_APPSEC_API_KEY: undefined,
        });
        const sessionCfg = mergeConfigWithSessionHeaders(cfg, {
          "x-harness-api-key": "pat.sessionuser.tok.sec",
        });
        const client = new HarnessClient(sessionCfg);

        await expect(
          client.request({
            method: "POST",
            path: "/graphql",
            product: "appsec",
            headers: { "x-api-key": "pat.sessionuser.tok.sec" },
            body: { query: "{ __typename }" },
          }),
        ).rejects.toThrow(/x-harness-appsec-api-key/);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("authenticates multi-user sessions when x-harness-appsec-api-key is supplied on session headers", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { dataTypes: { results: [] } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      try {
        const baseCfg = makeConfig({
          HARNESS_MCP_MODE: "multi-user",
          HARNESS_API_KEY: "",
          HARNESS_ACCOUNT_ID: "",
          HARNESS_APPSEC_API_KEY: undefined,
        });
        const sessionCfg = mergeConfigWithSessionHeaders(baseCfg, {
          "x-harness-api-key": "pat.sessionuser.tok.sec",
          "x-harness-appsec-api-key": "traceable-per-session-token",
        });
        const client = new HarnessClient(sessionCfg);
        const registry = new Registry(sessionCfg);

        await registry.dispatch(client, "appsec_datatype", "list", {});

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [, calledInit] = fetchSpy.mock.calls[0]!;
        const headers = calledInit?.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("traceable-per-session-token");
        expect(headers["x-api-key"]).toBeUndefined();
        expect(headers["x-harness-appsec-api-key"]).toBeUndefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("fails closed in oauth mode when x-harness-appsec-api-key is absent (never forwards HarnessID Bearer token to Traceable)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      try {
        const cfg = makeConfig({
          HARNESS_MCP_MODE: "oauth",
          HARNESS_API_KEY: "",
          HARNESS_APPSEC_API_KEY: undefined,
        });
        const client = new HarnessClient(cfg);
        client.setBearerTokenResolver(() => "harnessid-oauth-jwt-token");
        const registry = new Registry(cfg);

        await expect(registry.dispatch(client, "appsec_datatype", "list", {})).rejects.toThrow(
          /x-harness-appsec-api-key/,
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("authenticates oauth sessions when x-harness-appsec-api-key is supplied and survives index.ts sessionConfig spread", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { dataTypes: { results: [] } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      try {
        const baseCfg = makeConfig({
          HARNESS_MCP_MODE: "oauth",
          HARNESS_API_KEY: "",
          HARNESS_ACCOUNT_ID: "",
          HARNESS_APPSEC_API_KEY: undefined,
        });
        const headerConfig = mergeConfigWithSessionHeaders(baseCfg, {
          "x-harness-appsec-api-key": "traceable-oauth-session-token",
        });
        // Mirrors src/index.ts: const sessionConfig = { ...headerConfig, HARNESS_ACCOUNT_ID: oauthCredential.accountId }
        const sessionConfig = { ...headerConfig, HARNESS_ACCOUNT_ID: "oauth-account-123" };
        const client = new HarnessClient(sessionConfig);
        client.setAccountIdResolver(() => "oauth-account-123");
        client.setBearerTokenResolver(() => "harnessid-oauth-jwt-token");
        const registry = new Registry(sessionConfig);

        await registry.dispatch(client, "appsec_datatype", "list", {});

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
        expect(calledUrl).toBe("https://api.traceable.ai/graphql");
        const headers = calledInit?.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("traceable-oauth-session-token");
        expect(headers["Harness-Account"]).toBeUndefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe("appsec_api", () => {
    it("injects isLearnt=true and apiDiscoveryState defaults, flattens metrics, builds deep links, and does not mutate input", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          entities: {
            total: 1,
            results: [
              {
                entityId: "api-123",
                name: "POST /v1/payments",
                serviceName: "checkout-svc",
                environment: "prod",
                riskScore: 85,
                riskScoreCategory: "HIGH",
                numCalls: { sum: { value: 4200 } },
                errorCount: { sum: { value: 12 } },
              },
            ],
          },
        },
      }));

      const registry = new Registry(makeConfig());
      const input: Record<string, unknown> = {
        name_regex: ".*payments.*",
        has_pii: true,
        environment: "prod",
      };
      const res = (await registry.dispatch(client, "appsec_api", "list", input)) as {
        items: Array<Record<string, unknown>>;
        total: number;
        filter_url: string;
      };

      // Ensure no _-prefixed keys were written onto input
      expect(Object.keys(input).filter((k) => k.startsWith("_"))).toEqual([]);

      expect(calls).toHaveLength(1);
      const body = calls[0]!.body as { query: string; variables: Record<string, unknown> };
      expect(body.variables.scope).toBe("API");
      const filterBy = body.variables.filterBy as Array<Record<string, unknown>>;
      expect(filterBy).toEqual(
        expect.arrayContaining([
          { keyExpression: { key: "isLearnt" }, operator: "EQUALS", value: true, type: "ATTRIBUTE" },
          {
            keyExpression: { key: "apiDiscoveryState" },
            operator: "IN",
            value: ["DISCOVERED", "UNDER_DISCOVERY"],
            type: "ATTRIBUTE",
          },
          { keyExpression: { key: "name" }, operator: "LIKE", value: ".*payments.*", type: "ATTRIBUTE" },
          { keyExpression: { key: "hasPii" }, operator: "EQUALS", value: true, type: "ATTRIBUTE" },
        ]),
      );

      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({
        id: "api-123",
        name: "POST /v1/payments",
        numCalls: 4200,
        errorCount: 12,
        url: "https://app.traceable.ai/inventory/endpoint/api-123",
      });
      expect(res.filter_url).toContain("https://app.traceable.ai/inventory/api-endpoints?");
    });
  });

  describe("appsec_api_spec & appsec_api_span (with Redaction & Bounding)", () => {
    it("extracts OpenAPI YAML specification in appsec_api_spec.get", async () => {
      const { client } = makeMockClient(() => ({
        data: {
          apiInsightByApiId: {
            apiDefinition: {
              definition: "openapi: 3.0.0\ninfo:\n  title: Payments API\n",
            },
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_api_spec", "get", {
        api_id: "api-123",
      })) as Record<string, unknown>;

      expect(res.api_id).toBe("api-123");
      expect(res.definition).toContain("openapi: 3.0.0");
      expect(res.url).toBe("https://app.traceable.ai/inventory/endpoint/api-123");
    });

    it("redacts Authorization/Cookie/Set-Cookie headers, redacts all cookie values, and bounds large bodies in appsec_api_span.list", async () => {
      const hugeText = "x".repeat(3000);
      const { client } = makeMockClient(() => ({
        data: {
          submitAnalyticsQueryBatch: {
            batchId: "b1",
            state: "COMPLETED",
            query_list: {
              results: [
                {
                  id: { value: "span-1" },
                  traceId: { value: "trace-1" },
                  apiId: { value: "api-123" },
                  apiName: { value: "POST /v1/payments" },
                  statusCode: { value: "200" },
                  sessionId: { value: "raw-session-token-123" },
                  spanRequestHeaders: {
                    value: JSON.stringify({
                      "content-type": "application/json",
                      Authorization: "Bearer super-secret-jwt",
                      Cookie: "sid=secret-cookie",
                      "x-api-key": "secret-api-key",
                    }),
                  },
                  spanRequestCookies: {
                    value: JSON.stringify({
                      session_id: "cookie-secret-val",
                      theme: "dark",
                    }),
                  },
                  spanRequestBody: {
                    value: JSON.stringify({ amount: 100, password: "my-secret-password" }),
                  },
                  spanResponseHeaders: {
                    value: JSON.stringify({
                      "Set-Cookie": "sid=new-secret",
                      "x-request-id": "req-1",
                    }),
                  },
                  spanResponseCookies: {
                    value: JSON.stringify({ sid: "new-secret" }),
                  },
                  spanResponseBody: { value: hugeText },
                },
              ],
            },
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_api_span", "list", {
        api_id: "api-123",
      })) as { items: Array<Record<string, unknown>>; total: number };

      expect(res.total).toBe(1);
      const span = res.items[0]!;
      expect(span.session_id).toBe("[REDACTED]");
      expect(span.request_headers).toEqual({
        "content-type": "application/json",
        Authorization: "[REDACTED]",
        Cookie: "[REDACTED]",
        "x-api-key": "[REDACTED]",
      });
      expect(span.request_cookies).toEqual({
        session_id: "[REDACTED]",
        theme: "[REDACTED]",
      });
      expect(span.response_headers).toEqual({
        "Set-Cookie": "[REDACTED]",
        "x-request-id": "req-1",
      });
      expect(span.response_cookies).toEqual({
        sid: "[REDACTED]",
      });
      expect(span.request_body).toEqual({
        amount: 100,
        password: "[REDACTED]",
      });
      expect(typeof span.response_body).toBe("string");
      expect((span.response_body as string).length).toBeLessThan(2100);
      expect(span.response_body as string).toMatch(/\.\.\.\[truncated\]$/);
    });
  });

  describe("appsec_entity", () => {
    it("automatically injects isAiAsset=true and isLearnt=true for MCP assetType queries", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: { entities: { total: 1, results: [{ entityId: "mcp-1", name: "github-mcp" }] } },
      }));
      const registry = new Registry(makeConfig());
      await registry.dispatch(client, "appsec_entity", "list", {
        scope: "APPLICATION_ASSET",
        asset_type: "MCP_TOOL",
      });

      const body = calls[0]!.body as { variables: { filterBy: Array<Record<string, unknown>> } };
      expect(body.variables.filterBy).toEqual(
        expect.arrayContaining([
          { keyExpression: { key: "isLearnt" }, operator: "EQUALS", value: true, type: "ATTRIBUTE" },
          { keyExpression: { key: "isAiAsset" }, operator: "EQUALS", value: true, type: "ATTRIBUTE" },
          { keyExpression: { key: "assetType" }, operator: "IN", value: ["MCP_TOOL"], type: "ATTRIBUTE" },
        ]),
      );
    });

    it("uses type: ID and idScope for MCP_TOOL get and builds base64 sidesheet URLs for ACTOR list", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          entities: {
            total: 1,
            results: [{ entityId: "actor@example.com", actorId: "actor@example.com", status: "THREAT_ACTOR" }],
          },
        },
      }));
      const registry = new Registry(makeConfig());

      const actorList = (await registry.dispatch(client, "appsec_entity", "list", {
        scope: "ACTOR",
        actor_status: "THREAT_ACTOR",
      })) as { items: Array<Record<string, unknown>> };

      const expectedB64 = Buffer.from("actor@example.com", "utf8").toString("base64");
      expect(actorList.items[0]!.url).toContain(`sheet=threat-actors-v1-sidesheet~${expectedB64}`);

      await registry.dispatch(client, "appsec_entity", "get", {
        entity_id: "tool-uuid-1",
        scope: "MCP_TOOL",
      });
      const getVars = (calls[1]!.body as { variables: { filterBy: unknown[] } }).variables;
      expect(getVars.filterBy).toEqual([
        { operator: "EQUALS", value: "tool-uuid-1", type: "ID", idScope: "MCP_TOOL" },
      ]);
    });
  });

  describe("appsec_vulnerability", () => {
    it("normalizes shorthand severities and includes mandatory SOURCES, STATUS, and results selection", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          vulnerabilitiesV3: {
            total: 2,
            results: [
              {
                VULNERABILITY_ID: { value: "vuln-1", type: "STRING" },
                DISPLAY_NAME: { value: "BOLA in Payments", type: "STRING" },
                SEVERITY: { value: "VULNERABILITY_SEVERITY_CRITICAL", type: "STRING" },
              },
            ],
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_vulnerability", "list", {
        severity: "CRITICAL,HIGH",
        environment_id: "prod",
      })) as { items: Array<Record<string, unknown>>; total: number };

      const query = (calls[0]!.body as { query: string }).query;
      expect(query).toContain("VULNERABILITY_SOURCE_TYPE_RUNTIME_PROTECTION");
      expect(query).toContain("VULNERABILITY_STATUS_OPEN");
      expect(query).toContain("VULNERABILITY_SEVERITY_CRITICAL");
      expect(query).toContain("VULNERABILITY_SEVERITY_HIGH");
      expect(query).toContain("key: ENVIRONMENT_ID");
      expect(res.items[0]).toMatchObject({
        id: "vuln-1",
        VULNERABILITY_ID: "vuln-1",
        DISPLAY_NAME: "BOLA in Payments",
        SEVERITY: "VULNERABILITY_SEVERITY_CRITICAL",
      });
    });

    it("fetches distinct enum values via execute action enum_values", async () => {
      const { client } = makeMockClient(() => ({
        data: {
          STATUS: {
            results: [
              { STATUS: { value: "VULNERABILITY_STATUS_OPEN" }, count: { value: 10 } },
              { STATUS: { value: "VULNERABILITY_STATUS_FIXED" }, count: { value: 5 } },
            ],
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatchExecute(
        client as never,
        "appsec_vulnerability",
        "enum_values",
        {
          body: { filter_enum_keys: ["STATUS"] },
        },
      )) as { supported_values: Record<string, { values: string[] }> };

      expect(res.supported_values.STATUS?.values).toEqual([
        "VULNERABILITY_STATUS_OPEN",
        "VULNERABILITY_STATUS_FIXED",
      ]);
    });
  });

  describe("appsec_threat_activity", () => {
    it("expands start/end time into 4 mandatory ±7-day filters and excludes Internal/Tagged/Excluded", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          threatActivity: {
            total: 1,
            results: [
              {
                ID: { value: "ta-99", type: "STRING" },
                BEHAVIOUR: { value: "SQL Injection", type: "STRING" },
                EVENT_CATEGORY: { value: "API Protection", type: "STRING" },
              },
            ],
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const startMs = 1_700_000_000_000;
      const endMs = 1_700_086_400_000;
      const oneWeekMs = 604_800_000;

      const res = (await registry.dispatch(client, "appsec_threat_activity", "list", {
        start_time: startMs,
        end_time: endMs,
        event_category: "API Protection",
      })) as { items: Array<Record<string, unknown>> };

      const query = (calls[0]!.body as { query: string }).query;
      expect(query).toContain(`{ key: START_TIME_MILLIS, operator: LESS_THAN, value: ${endMs} }`);
      expect(query).toContain(`{ key: START_TIME_MILLIS, operator: GREATER_THAN, value: ${startMs - oneWeekMs} }`);
      expect(query).toContain(`{ key: LAST_SEEN_MILLIS, operator: LESS_THAN, value: ${endMs + oneWeekMs} }`);
      expect(query).toContain(`{ key: LAST_SEEN_MILLIS, operator: GREATER_THAN, value: ${startMs} }`);
      expect(query).toContain(`{ key: ACTIVITY_STATUS, operator: NOT_IN, value: ["Internal", "Tagged", "Excluded"] }`);
      expect(res.items[0]!.id).toBe("ta-99");
      expect(res.items[0]!.url).toContain("threat-activity-v2-detail~");
    });
  });

  describe("appsec_security_event & appsec_ast_scan", () => {
    it("enforces explore groupBy <-> selection symmetry and apis_under_threat filter_url", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          explore: {
            total: 1,
            results: [
              {
                apiId: { value: "api-1" },
                apiName: { value: "GET /users" },
                count_id: { value: 55 },
              },
            ],
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_security_event", "list", {
        mode: "apis_under_threat",
        group_by: "apiId,apiName",
      })) as { items: Array<Record<string, unknown>>; filter_url: string };

      const body = calls[0]!.body as { query: string; variables: Record<string, unknown> };
      expect(body.query).toContain(`apiId: selection(expression: { key: "apiId" }) { value type }`);
      expect(body.query).toContain(`apiName: selection(expression: { key: "apiName" }) { value type }`);
      expect(body.query).toContain(`count_id: selection(expression: { key: "id" }, aggregation: COUNT) { value type }`);
      expect(res.items[0]).toEqual({ apiId: "api-1", apiName: "GET /users", count_id: 55 });
      expect(res.filter_url).toContain("https://app.traceable.ai/apis-under-threat");
    });

    it("applies IS_METADATA=false when suite_id is provided on appsec_ast_scan", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          searchAst: {
            total: 1,
            results: [
              {
                SCAN_STATUS: { value: "COMPLETED" },
                SCAN_SUITE_ID: { value: "suite-1" },
                SCAN_RUN_NUMBER: { value: 12 },
              },
            ],
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_ast_scan", "list", {
        suite_id: "suite-1",
      })) as { items: Array<Record<string, unknown>>; filter_url: string };

      const query = (calls[0]!.body as { query: string }).query;
      expect(query).toContain("{ key: IS_METADATA, operator: EQUALS, value: false }");
      expect(query).toContain("SCAN_STATUS: selection(key: SCAN_STATUS)");
      expect(res.items[0]!.SCAN_RUN_NUMBER).toBe(12);
      expect(res.filter_url).toContain("api-testing-scans-v2/scan-v2/suite-1/scan-runs");
    });
  });

  describe("appsec_inventory_trend", () => {
    it("runs preflight for current count and calculates backward daily trend and N-days-ago count without mutating input", async () => {
      const now = new Date();
      const todayKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        .toISOString()
        .slice(0, 10);
      const yesterdayKey = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86_400_000,
      )
        .toISOString()
        .slice(0, 10);

      let callIndex = 0;
      const { client, calls } = makeMockClient(() => {
        callIndex++;
        if (callIndex === 1) {
          return { data: { entities: { total: 100, results: [] } } };
        }
        return {
          data: {
            submitAnalyticsQueryBatch: {
              batchId: "batch-1",
              state: "COMPLETED",
              opened_events: {
                results: [
                  { intervalStart: `${todayKey}T00:00:00Z`, count: { value: 5 } },
                  { intervalStart: `${yesterdayKey}T00:00:00Z`, count: { value: 10 } },
                ],
              },
              closed_events: {
                results: [
                  { intervalStart: `${todayKey}T00:00:00Z`, count: { value: 2 } },
                  { intervalStart: `${yesterdayKey}T00:00:00Z`, count: { value: 3 } },
                ],
              },
            },
          },
        };
      });

      const registry = new Registry(makeConfig());
      const input: Record<string, unknown> = {
        trend_type: "apis",
        period_days: 3,
      };
      const res = (await registry.dispatch(client, "appsec_inventory_trend", "list", input)) as {
        current_count: number;
        count_n_days_ago: number;
        items: Array<{ date: string; count: number }>;
      };

      expect(Object.keys(input)).toEqual(["trend_type", "period_days"]);
      expect(calls).toHaveLength(2);
      expect(res.current_count).toBe(100);
      expect(res.count_n_days_ago).toBe(90);
      expect(res.items[0]).toMatchObject({ date: todayKey, count: 100 });
      expect(res.items[1]).toMatchObject({ date: yesterdayKey, count: 90 });
    });
  });

  describe("appsec_datatype", () => {
    it("expands category names ('Financial Information') and matches individual datatype names", async () => {
      const { client } = makeMockClient(() => ({
        data: {
          dataTypes: {
            results: [
              { id: "dt-1", name: "VISA Credit Card", sensitivity: "HIGH", dataSuppression: true },
              { id: "dt-2", name: "SSN", sensitivity: "HIGH", dataSuppression: true },
              { id: "dt-3", name: "hostname", sensitivity: "LOW", dataSuppression: false },
            ],
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_datatype", "list", {
        names: "Financial Information",
      })) as { items: Array<Record<string, unknown>>; total: number };

      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({
        id: "dt-1",
        dataTypeId: "dt-1",
        name: "VISA Credit Card",
      });
    });
  });

  describe("appsec_fraud_policy & appsec_derivation_config (JEXL Injection & Validation)", () => {
    it("creates a fraud policy, validates SELECT SQL query, and requires a UUID api_id", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          CreateFraudPolicy: {
            fraud_policy: {
              id: "fp-1",
              name: "high-velocity-transfers",
              disabled: true,
            },
          },
        },
      }));
      const registry = new Registry(makeConfig());
      const res = (await registry.dispatch(client, "appsec_fraud_policy", "create", {
        body: {
          policy_name: "high-velocity-transfers",
          description: "Detect rapid wire transfers",
          sql_query: "SELECT actor_id, COUNT(*) FROM customer_events GROUP BY actor_id",
          api_id: VALID_API_UUID,
        },
      })) as Record<string, unknown>;

      expect(calls).toHaveLength(1);
      expect(res).toMatchObject({
        status: "SUCCESS",
        id: "fp-1",
        name: "high-velocity-transfers",
        disabled: true,
      });

      await expect(
        registry.dispatch(client, "appsec_fraud_policy", "create", {
          body: {
            policy_name: "bad-policy",
            description: "Invalid SQL",
            sql_query: "DROP TABLE customer_events",
            api_id: VALID_API_UUID,
          },
        }),
      ).rejects.toThrow(/sql_query must be a valid SELECT query/);

      await expect(
        registry.dispatch(client, "appsec_fraud_policy", "create", {
          body: {
            policy_name: "bad-api-id",
            description: "Non-UUID API ID",
            sql_query: "SELECT * FROM customer_events",
            api_id: "not-a-uuid",
          },
        }),
      ).rejects.toThrow(/must be a valid UUID/);
    });

    it("creates a derivation config with a valid UUID api_id and blocks JEXL quote injection in api_id", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: {
          CreateDerivationConfig: {
            derivation_config: {
              id: "dc-1",
              name: "ai-generated-derivation-config-1",
              disabled: true,
            },
          },
        },
      }));
      const registry = new Registry(makeConfig());

      const res = (await registry.dispatch(client, "appsec_derivation_config", "create", {
        body: {
          api_id: VALID_API_UUID,
          features: [
            {
              name: "payment_amount",
              expression: "$s.request_body.amount",
              explanation: "Extracts payment amount",
              type: "number",
            },
          ],
        },
      })) as Record<string, unknown>;

      expect(res.status).toBe("SUCCESS");
      const innerJson = JSON.parse(
        (calls[0]!.body as { variables: { derivation_config: string } }).variables.derivation_config,
      );
      expect(innerJson.scope).toBe(`$s.api_id.equals('${VALID_API_UUID}')`);
      expect(innerJson.attributes[0].name).toBe("payment_amount");

      // Block JEXL injection payload in api_id
      await expect(
        registry.dispatch(client, "appsec_derivation_config", "create", {
          body: {
            api_id: "x') || true || ('",
            features: [{ name: "payment_amount", expression: "$s.id" }],
          },
        }),
      ).rejects.toThrow(/must be a valid UUID/);

      await expect(
        registry.dispatch(client, "appsec_derivation_config", "create", {
          body: {
            api_id: VALID_API_UUID,
            features: [{ name: "InvalidCamelCase", expression: "$s.id" }],
          },
        }),
      ).rejects.toThrow(/snake_case/);
    });
  });

  describe("Pagination & Error Extraction", () => {
    it("truncates fractional limit and offset values to integers before sending to GraphQL", async () => {
      const { client, calls } = makeMockClient(() => ({
        data: { entities: { total: 0, results: [] } },
      }));
      const registry = new Registry(makeConfig());
      await registry.dispatch(client, "appsec_api", "list", { limit: 2.7, offset: 4.9 });

      const vars = (calls[0]!.body as { variables: { limit: number; offset: number } }).variables;
      expect(vars.limit).toBe(2);
      expect(vars.offset).toBe(4);
    });

    it("surfaces GraphQL errors[] in HTTP 200 responses as HarnessApiError", async () => {
      const { client } = makeMockClient(() => ({
        errors: [{ message: "Field 'invalidField' doesn't exist on type 'Query'" }],
      }));
      const registry = new Registry(makeConfig());

      await expect(registry.dispatch(client, "appsec_datatype", "list", {})).rejects.toThrow(
        /Field 'invalidField' doesn't exist/,
      );
    });
  });
});
