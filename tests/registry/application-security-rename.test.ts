/**
 * STO + SCS → application_security merge (P2).
 *
 * Non-breaking rename: legacy toolset names (`sto`, `scs`) and every legacy
 * resourceType alias must resolve to the canonical `application_security_*`
 * names. URL parsing for `/sto/issues` and `/sto/exemptions` must feed types the
 * registry understands (security_issue / security_exemption).
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import { applicationSecurityToolset } from "../../src/registry/toolsets/application-security.js";
import { applyUrlDefaults, parseHarnessUrl } from "../../src/utils/url-parser.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "error",
    ...overrides,
  } as Config;
}

describe("application_security merge — toolset aliases", () => {
  it.each(["sto", "scs"] as const)(
    "HARNESS_TOOLSETS='%s' enables the merged application_security toolset",
    (legacyToolset) => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: legacyToolset }));
      const names = registry.getAllToolsets().map((t) => t.name);
      expect(names).toEqual(["application_security"]);
    },
  );

  it("declares sto and scs as legacy toolset aliases on the canonical toolset", () => {
    expect(applicationSecurityToolset.name).toBe("application_security");
    expect(applicationSecurityToolset.aliases).toEqual(expect.arrayContaining(["sto", "scs"]));
  });
});

describe("application_security merge — resourceType aliases", () => {
  const registry = new Registry(makeConfig());

  it.each(
    applicationSecurityToolset.resources.flatMap((res) =>
      (res.aliases ?? []).map((alias) => [alias, res.resourceType] as const),
    ),
  )("resolves legacy %s to canonical %s", (legacy, canonical) => {
    expect(registry.getResource(legacy).resourceType).toBe(canonical);
    expect(registry.getResource(legacy)).toBe(registry.getResource(canonical));
  });

  it("enumerates only canonical application_security_* names", () => {
    const types = registry.getAllResourceTypes();
    for (const res of applicationSecurityToolset.resources) {
      expect(types).toContain(res.resourceType);
      for (const alias of res.aliases ?? []) {
        expect(types).not.toContain(alias);
      }
    }
  });

  it("carries sto/scs search aliases on merged resources where declared", () => {
    const stoResources = applicationSecurityToolset.resources.filter((r) =>
      r.searchAliases?.includes("sto"),
    );
    const scsResources = applicationSecurityToolset.resources.filter((r) =>
      r.searchAliases?.includes("scs"),
    );
    expect(stoResources.length).toBeGreaterThan(0);
    expect(scsResources.length).toBeGreaterThan(0);
  });
});

describe("application_security merge — STO URL → registry", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));
  const issuesUrl =
    "https://app.harness.io/ng/account/acc/all/orgs/myOrg/projects/myProj/sto/issues";
  const exemptionsUrl =
    "https://app.harness.io/ng/account/acc/all/orgs/myOrg/projects/myProj/sto/exemptions";

  it("parses STO issues list URLs to security_issue", () => {
    const parsed = parseHarnessUrl(issuesUrl);
    expect(parsed.resource_type).toBe("security_issue");
    expect(parsed.org_id).toBe("myOrg");
    expect(parsed.project_id).toBe("myProj");
  });

  it("parses STO exemptions list URLs to security_exemption", () => {
    const parsed = parseHarnessUrl(exemptionsUrl);
    expect(parsed.resource_type).toBe("security_exemption");
  });

  it("applyUrlDefaults yields resource types the registry resolves", () => {
    for (const url of [issuesUrl, exemptionsUrl]) {
      const input = applyUrlDefaults({}, url) as Record<string, unknown>;
      const resourceType = input.resource_type as string;
      expect(() => registry.getResource(resourceType)).not.toThrow();
      expect(registry.getResource(resourceType).resourceType.startsWith("application_security")).toBe(
        true,
      );
    }
  });
});
