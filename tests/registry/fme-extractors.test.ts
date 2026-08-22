/**
 * Unit tests for FME response extractors.
 * Guards pagination projection ({data,totalCount} → {items,total}) and
 * trafficType.id flattening used by fme_feature_flag deep links.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";
import {
  flattenTrafficType,
  fmeGetExtract,
  fmeListExtract,
  fmeV4PaginatedListExtract,
} from "../../src/registry/extractors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "feature-flags",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (options: RequestOptions) => Promise<unknown>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("flattenTrafficType", () => {
  it("promotes trafficType.id to trafficTypeId when absent", () => {
    const item: Record<string, unknown> = {
      id: "flag-1",
      trafficType: { id: "tt-user", name: "user" },
    };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBe("tt-user");
  });

  it("does not overwrite an existing trafficTypeId", () => {
    const item: Record<string, unknown> = {
      trafficType: { id: "tt-user" },
      trafficTypeId: "existing",
    };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBe("existing");
  });

  it("ignores non-object trafficType values", () => {
    const item: Record<string, unknown> = { trafficType: "user" };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBeUndefined();
  });

  it("ignores array trafficType values", () => {
    const item: Record<string, unknown> = { trafficType: [{ id: "tt-user" }] };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBeUndefined();
  });
});

describe("fmeV4PaginatedListExtract", () => {
  it("promotes data to items and totalCount to total", () => {
    const raw = {
      data: [{ id: "tt1", name: "user" }],
      limit: 100,
      offset: 0,
      totalCount: 3,
    };
    expect(fmeV4PaginatedListExtract(raw)).toEqual({
      data: [{ id: "tt1", name: "user" }],
      items: [{ id: "tt1", name: "user" }],
      limit: 100,
      offset: 0,
      totalCount: 3,
      total: 3,
    });
  });

  it("falls back to data.length when totalCount is missing", () => {
    const raw = { data: [{ id: "a" }, { id: "b" }] };
    expect(fmeV4PaginatedListExtract(raw)).toMatchObject({ total: 2 });
  });

  it("returns raw payload unchanged when data is not an array", () => {
    const raw = { objects: [{ id: "legacy" }] };
    expect(fmeV4PaginatedListExtract(raw)).toBe(raw);
  });

  it("returns null/arrays unchanged", () => {
    expect(fmeV4PaginatedListExtract(null)).toBeNull();
    expect(fmeV4PaginatedListExtract([{ id: "x" }])).toEqual([{ id: "x" }]);
  });
});

describe("fmeListExtract", () => {
  it("flattens trafficType on each object in objects[]", () => {
    const raw = {
      objects: [
        { id: "flag-1", trafficType: { id: "tt-user" } },
        { id: "flag-2", trafficType: { id: "tt-account" } },
      ],
      offset: 0,
      limit: 20,
    };
    fmeListExtract(raw);
    const objects = (raw as { objects: Array<Record<string, unknown>> }).objects;
    expect(objects[0]!.trafficTypeId).toBe("tt-user");
    expect(objects[1]!.trafficTypeId).toBe("tt-account");
  });

  it("returns raw unchanged when objects is absent", () => {
    const raw = { data: [{ id: "x" }] };
    expect(fmeListExtract(raw)).toBe(raw);
  });
});

describe("fmeGetExtract", () => {
  it("flattens trafficType on a single item", () => {
    const raw: Record<string, unknown> = {
      id: "flag-1",
      trafficType: { id: "tt-user", name: "user" },
    };
    fmeGetExtract(raw);
    expect(raw.trafficTypeId).toBe("tt-user");
  });

  it("returns null/arrays unchanged", () => {
    expect(fmeGetExtract(null)).toBeNull();
    expect(fmeGetExtract([{ id: "x" }])).toEqual([{ id: "x" }]);
  });
});

describe("fme_feature_flag deep links", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get: openInHarness uses flattened trafficTypeId from nested trafficType", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        id: "my-flag",
        name: "My Flag",
        trafficType: { id: "tt-user", name: "user" },
      }),
    );

    const result = (await registry.dispatch(client, "fme_feature_flag", "get", {
      org_id: "myorg",
      project_id: "myproj",
      feature_flag_name: "my-flag",
    })) as { openInHarness?: string; trafficTypeId?: string };

    expect(result.trafficTypeId).toBe("tt-user");
    expect(result.openInHarness).toContain("/targets/tt-user/splits/my-flag");
  });

  it("list: per-item openInHarness uses flattened trafficTypeId", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        objects: [
          {
            id: "flag-a",
            name: "Flag A",
            trafficType: { id: "tt-user" },
          },
        ],
        offset: 0,
        limit: 20,
      }),
    );

    const result = (await registry.dispatch(client, "fme_feature_flag", "list", {
      workspace_id: "ws1",
    })) as { objects?: Array<{ openInHarness?: string; trafficTypeId?: string }> };

    const item = result.objects?.[0];
    expect(item?.trafficTypeId).toBe("tt-user");
    expect(item?.openInHarness).toContain("/targets/tt-user/splits/flag-a");
  });
});
