/**
 * Phase 2 Wave 1 verification tests.
 *
 * Three categories:
 *   1. P2-6 — 404 error enrichment: SCS resources return diagnosticHint in error messages
 *   2. P2-2/P2-3A — Token reduction: field selection + pagination cap measurably reduce payload size
 *   3. P2-12 — Two-step guidance: descriptions guide LLM through the source→artifact flow
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import { scsCleanExtract, scsListExtract } from "../../src/registry/extractors.js";
import { scsToolset } from "../../src/registry/toolsets/scs.js";

// ---------------------------------------------------------------------------
// Helpers (same pattern as tool-handlers.test.ts)
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    LOG_LEVEL: "info",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept" }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    _tools: tools,
    async call(name: string, args: Record<string, unknown>, extra?: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const defaultExtra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, { ...defaultExtra, ...extra }) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  const item = result.content[0] as { type: "text"; text: string };
  return JSON.parse(item.text);
}

function jsonBytes(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. P2-6 — 404 Error Enrichment with diagnosticHint
// ═══════════════════════════════════════════════════════════════════════════

describe("P2-6: 404 errors include diagnosticHint for SCS resources", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "scs" }));
    mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    const { registerListTool } = await import("../../src/tools/harness-list.js");
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerListTool(server, registry, client);
    registerGetTool(server, registry, client);
  });

  it("harness_list 404 on artifact_security includes source discovery hint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_list", {
      resource_type: "artifact_security",
      params: { source_id: "nonexistent-source" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
    expect(data.error).toContain("scs_artifact_source");
    expect(data.error).toContain("source_id");
  });

  it("harness_list 404 on scs_artifact_component includes artifact discovery hint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_list", {
      resource_type: "scs_artifact_component",
      params: { artifact_id: "nonexistent-artifact" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
    expect(data.error).toContain("artifact_security");
  });

  it("harness_list 404 on scs_compliance_result includes artifact discovery hint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_list", {
      resource_type: "scs_compliance_result",
      params: { artifact_id: "nonexistent-artifact" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
  });

  it("harness_get 404 on artifact_security includes source verification hint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_get", {
      resource_type: "artifact_security",
      resource_id: "nonexistent-artifact",
      params: { source_id: "some-source" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
    expect(data.error).toContain("scs_artifact_source");
  });

  it("harness_get 404 on scs_sbom includes orchestration discovery hint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_get", {
      resource_type: "scs_sbom",
      resource_id: "nonexistent-orchestration",
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
    expect(data.error).toContain("orchestration_id");
    expect(data.error).toContain("scs_chain_of_custody");
  });

  it("harness_get 404 on scs_artifact_remediation mentions code repo limitation", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_get", {
      resource_type: "scs_artifact_remediation",
      resource_id: "some-artifact",
      params: { purl: "pkg:npm/express@4.18.0" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
    expect(data.error).toContain("code repo");
  });

  it("harness_list 400 error does NOT include diagnosticHint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Bad request: invalid filter", 400));
    const result = await server.call("harness_list", {
      resource_type: "scs_artifact_source",
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Bad request");
    expect(data.error).not.toContain("Recovery hint");
  });

  it("harness_list 404 on code_repo_security includes repo discovery hint", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_list", {
      resource_type: "code_repo_security",
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Recovery hint");
    expect(data.error).toContain("code_repo_security");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. P2-2/P2-3A — Token Reduction Measurement
// ═══════════════════════════════════════════════════════════════════════════

describe("P2-2: scsListExtract token reduction vs scsCleanExtract", () => {
  // Realistic SCS artifact source response with many fields
  const mockArtifactSources = Array.from({ length: 10 }, (_, i) => ({
    id: `src-${i}`,
    source_id: `src-${i}`,
    identifier: `src-${i}`,
    name: `ECR Registry ${i}`,
    artifact_type: "CONTAINER",
    source_type: "DOCKER_HUB",
    registry_type: "DOCKER",
    registry_url: `https://registry-${i}.example.com`,
    artifact_count: 10 + i,
    created: "2026-01-01T00:00:00Z",
    updated: "2026-03-25T00:00:00Z",
    // Fields that should be stripped by scsListExtract
    internal_metadata: { deployment_hash: "abc123", sync_version: 42 },
    audit_trail: [{ actor: "system", timestamp: "2026-01-01", action: "create" }],
    tags_metadata: { env: "qa", team: "scs" },
    access_policy: { read: ["admin"], write: ["admin"] },
    signing_config: null,
    attestation_sources: [],
    extra_config: "",
  }));

  // Realistic artifact security response
  const mockArtifacts = Array.from({ length: 10 }, (_, i) => ({
    id: `art-${i}`,
    artifact_id: `art-${i}`,
    name: `nginx:1.${i}`,
    tag: `1.${i}`,
    url: `https://registry.example.com/nginx:1.${i}`,
    digest: `sha256:${"a".repeat(64)}`,
    components_count: 50 + i,
    vulnerability_count: { critical: i, high: i * 2, medium: i * 3, low: i * 5 },
    sto_issue_count: i * 2,
    scorecard: { avg_score: `${7 + i * 0.1}`, total_checks: 12 },
    orchestration: { id: `orch-${i}`, pipeline: `build-${i}`, status: "SUCCESS" },
    policy_enforcement: { allow_list_violation_count: `${i}`, deny_list_violation_count: "0" },
    slsa_verification: { verified: true, level: "L3" },
    signing_status: "SIGNED",
    updated: "2026-03-25T10:00:00Z",
    created: "2026-03-20T10:00:00Z",
    // Noise fields
    internal_cache_key: `cache-${i}`,
    raw_scan_output: { scanner: "trivy", raw: "...long output..." },
    provenance_metadata: { builder_id: "github-actions", build_type: "slsa-v1" },
    full_digest_chain: [`sha256:${"b".repeat(64)}`, `sha256:${"c".repeat(64)}`],
  }));

  // Realistic component response
  const mockComponents = Array.from({ length: 10 }, (_, i) => ({
    purl: `pkg:npm/package-${i}@${i}.0.0`,
    package_name: `package-${i}`,
    package_version: `${i}.0.0`,
    package_license: i % 2 === 0 ? "MIT" : "Apache-2.0",
    dependency_type: i % 3 === 0 ? "DIRECT" : "TRANSITIVE",
    vulnerability_count: i,
    supplier: `org-${i}`,
    // Noise fields
    internal_analysis: { risk_score: 0.3, confidence: "HIGH" },
    raw_bom_entry: { format: "CycloneDX", version: "1.4" },
    hash_checksums: [`sha256:${"d".repeat(64)}`],
    origin_url: `https://npmjs.com/package/package-${i}`,
    description: `A long description of package ${i} that takes up many tokens and is not useful for the LLM conversation context.`,
  }));

  it("scsListExtract produces significantly smaller output than scsCleanExtract for artifact sources", () => {
    const findResource = (type: string) => scsToolset.resources.find(r => r.resourceType === type)!;
    const spec = findResource("scs_artifact_source").operations.list!;

    const cleanedSize = jsonBytes(scsCleanExtract(mockArtifactSources));
    const selectedSize = jsonBytes(spec.responseExtractor!(mockArtifactSources));

    const reductionPct = Math.round((1 - selectedSize / cleanedSize) * 100);
    console.log(`  P2-2 artifact_source: ${cleanedSize} → ${selectedSize} bytes (${reductionPct}% reduction)`);

    // Expect at least 30% reduction from field selection
    expect(reductionPct).toBeGreaterThanOrEqual(30);
  });

  it("scsListExtract produces significantly smaller output for artifact security list", () => {
    const findResource = (type: string) => scsToolset.resources.find(r => r.resourceType === type)!;
    const spec = findResource("artifact_security").operations.list!;

    const cleanedSize = jsonBytes(scsCleanExtract(mockArtifacts));
    const selectedSize = jsonBytes(spec.responseExtractor!(mockArtifacts));

    const reductionPct = Math.round((1 - selectedSize / cleanedSize) * 100);
    console.log(`  P2-2 artifact_security: ${cleanedSize} → ${selectedSize} bytes (${reductionPct}% reduction)`);

    expect(reductionPct).toBeGreaterThanOrEqual(20);
  });

  it("scsListExtract produces significantly smaller output for components list", () => {
    const findResource = (type: string) => scsToolset.resources.find(r => r.resourceType === type)!;
    const spec = findResource("scs_artifact_component").operations.list!;

    const cleanedSize = jsonBytes(scsCleanExtract(mockComponents));
    const selectedSize = jsonBytes(spec.responseExtractor!(mockComponents));

    const reductionPct = Math.round((1 - selectedSize / cleanedSize) * 100);
    console.log(`  P2-2 components: ${cleanedSize} → ${selectedSize} bytes (${reductionPct}% reduction)`);

    expect(reductionPct).toBeGreaterThanOrEqual(30);
  });

  it("field-selected responses still preserve all entity IDs needed for follow-up queries", () => {
    const findResource = (type: string) => scsToolset.resources.find(r => r.resourceType === type)!;

    // Artifact sources: must preserve id/source_id
    const sources = findResource("scs_artifact_source").operations.list!.responseExtractor!(mockArtifactSources) as Record<string, unknown>[];
    expect(sources[0]).toHaveProperty("id");
    expect(sources[0]).toHaveProperty("name");

    // Artifacts: must preserve id, orchestration (for SBOM), source_id
    const artifacts = findResource("artifact_security").operations.list!.responseExtractor!(mockArtifacts) as Record<string, unknown>[];
    expect(artifacts[0]).toHaveProperty("id");
    expect(artifacts[0]).toHaveProperty("orchestration");
    expect(artifacts[0]).toHaveProperty("vulnerability_count");
    expect(artifacts[0]).toHaveProperty("scorecard");

    // Components: must preserve purl (for remediation)
    const components = findResource("scs_artifact_component").operations.list!.responseExtractor!(mockComponents) as Record<string, unknown>[];
    expect(components[0]).toHaveProperty("purl");
    expect(components[0]).toHaveProperty("package_name");
    expect(components[0]).toHaveProperty("dependency_type");
  });

  it("field-selected responses strip non-actionable noise fields", () => {
    const findResource = (type: string) => scsToolset.resources.find(r => r.resourceType === type)!;

    const sources = findResource("scs_artifact_source").operations.list!.responseExtractor!(mockArtifactSources) as Record<string, unknown>[];
    expect(sources[0]).not.toHaveProperty("internal_metadata");
    expect(sources[0]).not.toHaveProperty("audit_trail");
    expect(sources[0]).not.toHaveProperty("tags_metadata");
    expect(sources[0]).not.toHaveProperty("access_policy");

    const artifacts = findResource("artifact_security").operations.list!.responseExtractor!(mockArtifacts) as Record<string, unknown>[];
    expect(artifacts[0]).not.toHaveProperty("internal_cache_key");
    expect(artifacts[0]).not.toHaveProperty("raw_scan_output");
    expect(artifacts[0]).not.toHaveProperty("provenance_metadata");

    const components = findResource("scs_artifact_component").operations.list!.responseExtractor!(mockComponents) as Record<string, unknown>[];
    expect(components[0]).not.toHaveProperty("internal_analysis");
    expect(components[0]).not.toHaveProperty("raw_bom_entry");
    expect(components[0]).not.toHaveProperty("description");
  });
});

describe("P2-3A: pagination cap reduces default item count", () => {
  it("all SCS list operations default to limit=10", () => {
    const listOps = scsToolset.resources
      .filter(r => r.operations.list)
      .map(r => ({ type: r.resourceType, limit: r.operations.list!.defaultQueryParams?.limit }));

    for (const { type, limit } of listOps) {
      expect(limit, `${type} should have defaultQueryParams.limit = "10"`).toBe("10");
    }

    console.log(`  P2-3A: ${listOps.length} SCS list operations all capped at limit=10`);
  });

  it("estimated token savings: 10 items vs 20 items (50% reduction)", () => {
    // Simulate: 20-item response vs 10-item response
    const items20 = Array.from({ length: 20 }, (_, i) => ({
      id: `item-${i}`, name: `Source ${i}`, artifact_type: "CONTAINER",
      registry_url: `https://reg-${i}.example.com`, artifact_count: i * 10,
    }));
    const items10 = items20.slice(0, 10);

    const bytes20 = jsonBytes(items20);
    const bytes10 = jsonBytes(items10);
    const reductionPct = Math.round((1 - bytes10 / bytes20) * 100);

    console.log(`  P2-3A: 20 items = ${bytes20} bytes, 10 items = ${bytes10} bytes (${reductionPct}% reduction)`);
    expect(reductionPct).toBeGreaterThanOrEqual(40);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. P2-12 — Two-Step Guidance Verification
// ═══════════════════════════════════════════════════════════════════════════

describe("P2-12: LLM guidance in tool descriptions", () => {
  it("scs_artifact_source description teaches two-step flow", () => {
    const res = scsToolset.resources.find(r => r.resourceType === "scs_artifact_source")!;
    // Must contain clear guidance about the two-step pattern
    expect(res.description).toContain("Two-step flow");
    expect(res.description).toContain("source_id");
  });

  it("artifact_security description explicitly states source_id prerequisite", () => {
    const res = scsToolset.resources.find(r => r.resourceType === "artifact_security")!;
    expect(res.description).toContain("source_id is required");
    expect(res.description).toContain("scs_artifact_source");
  });

  it("all SCS resources with required parent IDs have diagnosticHint with recovery path", () => {
    // Resources that depend on parent entity IDs
    const dependentResources = [
      { type: "artifact_security", parentHint: "scs_artifact_source" },
      { type: "scs_artifact_component", parentHint: "artifact_security" },
      { type: "scs_compliance_result", parentHint: "artifact_security" },
      { type: "scs_chain_of_custody", parentHint: "artifact_security" },
      { type: "scs_artifact_remediation", parentHint: "scs_artifact_component" },
      { type: "scs_sbom", parentHint: "scs_chain_of_custody" },
    ];

    for (const { type, parentHint } of dependentResources) {
      const res = scsToolset.resources.find(r => r.resourceType === type)!;
      expect(res.diagnosticHint, `${type} should have diagnosticHint`).toBeDefined();
      expect(
        res.diagnosticHint,
        `${type} diagnosticHint should reference parent resource ${parentHint}`,
      ).toContain(parentHint);
    }
  });

  it("harness_describe output includes diagnosticHint for SCS resources", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "scs" }));
    const desc = registry.describe();
    const scsToolsetDesc = (desc.toolsets as Record<string, { resources: { diagnosticHint?: string }[] }>).scs;
    expect(scsToolsetDesc).toBeDefined();

    // Every SCS resource should have diagnosticHint exposed via describe
    for (const res of scsToolsetDesc.resources) {
      expect(res.diagnosticHint, "diagnosticHint should be in describe output").toBeDefined();
    }
  });
});
