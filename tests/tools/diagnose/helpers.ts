import { vi } from "vitest";
import type { Config } from "../../../src/config.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { Registry } from "../../../src/registry/index.js";
import type { DiagnoseContext, Extra } from "../../../src/tools/diagnose/types.js";

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test-account.token.secret",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_READ_ONLY: false,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    ...overrides,
  } as Config;
}

export function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

type DispatchMap = Record<string, Record<string, unknown>>;

export function makeRegistry(
  dispatchMap: DispatchMap = {},
  executeMap: DispatchMap = {},
): Registry {
  const dispatch = vi.fn(
    async (_client: HarnessClient, resourceType: string, op: string, _input: Record<string, unknown>) => {
      const resource = dispatchMap[resourceType];
      if (!resource) throw new Error(`No mock for resource "${resourceType}"`);
      const value = resource[op];
      if (value === undefined) throw new Error(`No mock for "${resourceType}.${op}"`);
      if (value instanceof Error) throw value;
      return value;
    },
  );

  const dispatchExecute = vi.fn(
    async (_client: HarnessClient, resourceType: string, action: string, _input: Record<string, unknown>) => {
      const resource = executeMap[resourceType];
      if (!resource) throw new Error(`No mock for execute resource "${resourceType}"`);
      const value = resource[action];
      if (value === undefined) throw new Error(`No mock for execute "${resourceType}.${action}"`);
      if (value instanceof Error) throw value;
      return value;
    },
  );

  return { dispatch, dispatchExecute } as unknown as Registry;
}

export function makeExtra(): Extra {
  return {
    _meta: {},
    sendNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as Extra;
}

export function makeContext(overrides: Partial<DiagnoseContext> & {
  dispatchMap?: DispatchMap;
  executeMap?: DispatchMap;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
} = {}): DiagnoseContext {
  const config = overrides.config ?? makeConfig();
  const client = overrides.client ?? makeClient();
  const registry = overrides.registry ?? makeRegistry(overrides.dispatchMap, overrides.executeMap);
  const extra = overrides.extra ?? makeExtra();
  const input = overrides.input ?? {};
  const args = overrides.args ?? {};

  return { client, registry, config, input, args, extra };
}
