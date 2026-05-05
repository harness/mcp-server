/**
 * Tests that project list deep links resolve correctly in multi-org accounts.
 * Covers the regression path where HARNESS_ORG is configured but items belong
 * to different orgs — each item's openInHarness must use its own orgIdentifier.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0,
    LOG_LEVEL: "error",
    ...overrides,
  };
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("project list deep links (multi-org)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("uses each item's orgIdentifier in openInHarness, not HARNESS_ORG", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: {
          content: [
            { project: { identifier: "proj-alpha", name: "Alpha", orgIdentifier: "org-a" } },
            { project: { identifier: "proj-beta", name: "Beta", orgIdentifier: "org-b" } },
            { project: { identifier: "proj-gamma", name: "Gamma", orgIdentifier: "default-org" } },
          ],
          totalElements: 3,
        },
      }),
    );

    const config = makeConfig({ HARNESS_ORG: "default-org" });
    const client = new HarnessClient(config);
    const registry = new Registry(config);

    // Account-scoped list — no explicit org_id
    const result = (await registry.dispatch(client, "project", "list", {})) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };

    expect(result.items).toHaveLength(3);

    // Each item should have its own org in the deep link
    const alphaLink = result.items[0]!.openInHarness as string;
    const betaLink = result.items[1]!.openInHarness as string;
    const gammaLink = result.items[2]!.openInHarness as string;

    expect(alphaLink).toContain("/orgs/org-a/projects/proj-alpha");
    expect(alphaLink).not.toContain("default-org");

    expect(betaLink).toContain("/orgs/org-b/projects/proj-beta");
    expect(betaLink).not.toContain("default-org");

    expect(gammaLink).toContain("/orgs/default-org/projects/proj-gamma");

    // None should contain [object Object] or literal {org}
    for (const item of result.items) {
      const link = item.openInHarness as string;
      expect(link).not.toContain("[object Object]");
      expect(link).not.toContain("{org}");
      expect(link).not.toContain("{project}");
    }
  });

  it("uses each item's orgIdentifier even when org_id is explicitly passed", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: {
          content: [
            { project: { identifier: "proj-x", name: "X", orgIdentifier: "explicit-org" } },
          ],
          totalElements: 1,
        },
      }),
    );

    const config = makeConfig({ HARNESS_ORG: "default-org" });
    const client = new HarnessClient(config);
    const registry = new Registry(config);

    const result = (await registry.dispatch(client, "project", "list", {
      org_id: "explicit-org",
    })) as { items: Array<Record<string, unknown>>; total: number };

    const link = result.items[0]!.openInHarness as string;
    expect(link).toContain("/orgs/explicit-org/projects/proj-x");
  });

  it("exposes identifier and name at top level (unwrapped from project wrapper)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: {
          content: [
            { project: { identifier: "my-proj", name: "My Project", orgIdentifier: "org1", description: "A project" } },
          ],
          totalElements: 1,
        },
      }),
    );

    const config = makeConfig();
    const client = new HarnessClient(config);
    const registry = new Registry(config);

    const result = (await registry.dispatch(client, "project", "list", {})) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };

    const item = result.items[0]!;
    expect(item.identifier).toBe("my-proj");
    expect(item.name).toBe("My Project");
    expect(item.orgIdentifier).toBe("org1");
    // Should NOT have a nested project wrapper
    expect(item).not.toHaveProperty("project");
  });

  it("single-item get still uses HARNESS_ORG as fallback for {org}", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: {
          project: { identifier: "my-proj", name: "My Project", orgIdentifier: "default-org" },
        },
      }),
    );

    const config = makeConfig({ HARNESS_ORG: "default-org" });
    const client = new HarnessClient(config);
    const registry = new Registry(config);

    const result = (await registry.dispatch(client, "project", "get", {
      project_id: "my-proj",
    })) as Record<string, unknown>;

    const link = result.openInHarness as string;
    expect(link).toContain("/orgs/default-org/projects/my-proj");
    expect(link).not.toContain("{org}");
  });
});
