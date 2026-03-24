/**
 * T5-v2: SCS Benchmark — Integration tests against live Harness QA environment.
 *
 * 16 scenarios across 3 tiers exercising the registry dispatch layer.
 * Requires real credentials — skipped when HARNESS_API_KEY is not set.
 *
 * Env vars (set in shell or .env):
 *   HARNESS_API_KEY           — PAT token (pat.<accountId>.<tokenId>.<secret>)
 *   HARNESS_ACCOUNT_ID        — (optional if PAT format, auto-extracted)
 *   HARNESS_DEFAULT_ORG_ID    — default: "SSCA"
 *   HARNESS_DEFAULT_PROJECT_ID — default: "SSCA_Sanity_Automation"
 *   HARNESS_BASE_URL          — default: "https://app.harness.io"
 *
 * Run:
 *   pnpm test -- tests/integration/scs-benchmark.test.ts
 *   HARNESS_API_KEY=pat.xxx pnpm test -- tests/integration/scs-benchmark.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { compactItems } from "../../src/utils/compact.js";
import type { Config } from "../../src/config.js";

// ---------------------------------------------------------------------------
// Config — pulled from env, with SCS QA defaults
// ---------------------------------------------------------------------------
const API_KEY = process.env.HARNESS_API_KEY ?? "";
const ACCOUNT_ID = process.env.HARNESS_ACCOUNT_ID ?? "";
const BASE_URL = process.env.HARNESS_BASE_URL ?? "https://qa.harness.io";
const ORG_ID = process.env.HARNESS_DEFAULT_ORG_ID ?? "SSCA";
const PROJECT_ID = process.env.HARNESS_DEFAULT_PROJECT_ID ?? "SSCA_Sanity_Automation";

const HAS_CREDENTIALS = API_KEY.length > 0;

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: API_KEY,
    HARNESS_ACCOUNT_ID: ACCOUNT_ID || extractAccountId(API_KEY),
    HARNESS_BASE_URL: BASE_URL,
    HARNESS_DEFAULT_ORG_ID: ORG_ID,
    HARNESS_DEFAULT_PROJECT_ID: PROJECT_ID,
    HARNESS_API_TIMEOUT_MS: 30_000,
    HARNESS_MAX_RETRIES: 2,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_ALLOW_HTTP: false,
    JWT_ALGORITHM: "HS256" as const,
    LOG_LEVEL: "error",
    HARNESS_TOOLSETS: "scs",
  };
}

function extractAccountId(pat: string): string {
  const parts = pat.split(".");
  return parts.length >= 3 && parts[0] === "pat" ? parts[1]! : "unknown";
}

// ---------------------------------------------------------------------------
// Shared state — populated by Tier 1, consumed by Tier 2+
// ---------------------------------------------------------------------------
interface BenchmarkState {
  sourceId: string;
  artifactId: string;
  repoId: string;
  orchestrationId: string;
  purl: string;
}

const state: BenchmarkState = {
  sourceId: "",
  artifactId: "",
  repoId: "",
  orchestrationId: "",
  purl: "",
};

// ---------------------------------------------------------------------------
// Helper: measure response size in bytes (for token analysis)
// ---------------------------------------------------------------------------
function jsonBytes(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe.skipIf(!HAS_CREDENTIALS)("SCS Benchmark (live API)", () => {
  let client: HarnessClient;
  let registry: Registry;

  beforeAll(() => {
    const config = makeConfig();
    client = new HarnessClient(config);
    registry = new Registry(config);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tier 1 — Direct operations (no entity IDs needed upfront)
  // ═══════════════════════════════════════════════════════════════════════

  describe("Tier 1: Direct operations", () => {
    it("S01: List artifact sources", async () => {
      const result = await registry.dispatch(client, "scs_artifact_source", "list", {}) as Record<string, unknown>;
      expect(result).toBeDefined();

      // SCS list responses are arrays or have items
      const items = Array.isArray(result) ? result : (result as Record<string, unknown[]>).content ?? result;
      expect(Array.isArray(items) || typeof result === "object").toBe(true);

      // Capture a source_id for Tier 2
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0] as Record<string, unknown>;
        state.sourceId = String(first.id ?? first.source_id ?? first.identifier ?? "");
      }

      console.log(`  S01: ${Array.isArray(items) ? items.length : "?"} sources, ${jsonBytes(result)} bytes`);
      console.log(`  Captured source_id: ${state.sourceId}`);
    }, 30_000);

    it("S02: Search artifact sources", async () => {
      const result = await registry.dispatch(client, "scs_artifact_source", "list", {
        search_term: "ecr",
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S02: search_term=ecr, ${jsonBytes(result)} bytes`);
    }, 30_000);

    it("S03: List code repositories", async () => {
      const result = await registry.dispatch(client, "code_repo_security", "list", {}) as unknown;
      expect(result).toBeDefined();

      // Capture a repo_id for Tier 2
      const items = Array.isArray(result) ? result : [];
      if (items.length > 0) {
        const first = items[0] as Record<string, unknown>;
        state.repoId = String(first.id ?? first.repo_id ?? first.identifier ?? "");
      }

      console.log(`  S03: ${items.length} repos, ${jsonBytes(result)} bytes`);
      console.log(`  Captured repo_id: ${state.repoId}`);
    }, 30_000);

    it("S04: Search code repositories", async () => {
      const result = await registry.dispatch(client, "code_repo_security", "list", {
        search_term: "PDF",
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S04: search_term=PDF, ${jsonBytes(result)} bytes`);
    }, 30_000);

    it("S05: List with pagination (size=5)", async () => {
      const result = await registry.dispatch(client, "scs_artifact_source", "list", {
        page: 0,
        size: 5,
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S05: page=0 size=5, ${jsonBytes(result)} bytes`);
    }, 30_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tier 2 — Entity ID required (uses IDs captured in Tier 1)
  // ═══════════════════════════════════════════════════════════════════════

  describe("Tier 2: Entity ID required", () => {
    it("S06: List artifacts from a source", async () => {
      if (!state.sourceId) {
        console.log("  S06: SKIPPED — no source_id from S01");
        return;
      }

      const result = await registry.dispatch(client, "artifact_security", "list", {
        source_id: state.sourceId,
      }) as unknown;
      expect(result).toBeDefined();

      // Capture artifact_id and orchestration_id from the artifact list
      const items = Array.isArray(result) ? result : [];
      for (const item of items) {
        const a = item as Record<string, unknown>;
        if (!state.artifactId) {
          state.artifactId = String(a.id ?? a.artifact_id ?? a.identifier ?? "");
        }
        // orchestration_id lives inside the artifact's orchestration object
        if (!state.orchestrationId) {
          const orch = a.orchestration as Record<string, unknown> | undefined;
          if (orch?.id) {
            state.orchestrationId = String(orch.id);
          }
        }
        if (state.artifactId && state.orchestrationId) break;
      }

      console.log(`  S06: ${items.length} artifacts from source ${state.sourceId}, ${jsonBytes(result)} bytes`);
      console.log(`  Captured artifact_id: ${state.artifactId}`);
      console.log(`  Captured orchestration_id: ${state.orchestrationId}`);
    }, 30_000);

    it("S07: Get artifact overview", async () => {
      if (!state.sourceId || !state.artifactId) {
        console.log("  S07: SKIPPED — no source_id or artifact_id");
        return;
      }

      const result = await registry.dispatch(client, "artifact_security", "get", {
        source_id: state.sourceId,
        artifact_id: state.artifactId,
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S07: artifact overview, ${jsonBytes(result)} bytes`);
    }, 30_000);

    it("S08: List artifact components", async () => {
      if (!state.artifactId) {
        console.log("  S08: SKIPPED — no artifact_id");
        return;
      }

      const result = await registry.dispatch(client, "scs_artifact_component", "list", {
        artifact_id: state.artifactId,
      }) as unknown;
      expect(result).toBeDefined();

      // Capture a purl for remediation test — search for first component with a non-empty purl
      const components = Array.isArray(result) ? result : [];
      for (const comp of components) {
        const c = comp as Record<string, unknown>;
        const p = c.purl ?? c.packageUrl;
        if (p && String(p).length > 0) {
          state.purl = String(p);
          break;
        }
      }

      console.log(`  S08: ${components.length} components, ${jsonBytes(result)} bytes`);
      console.log(`  Captured purl: ${state.purl ? state.purl.slice(0, 80) : "(none)"}`);
    }, 30_000);

    it("S09: List compliance results", async () => {
      if (!state.artifactId) {
        console.log("  S09: SKIPPED — no artifact_id");
        return;
      }

      const result = await registry.dispatch(client, "scs_compliance_result", "list", {
        artifact_id: state.artifactId,
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S09: compliance results, ${jsonBytes(result)} bytes`);
    }, 30_000);

    it("S10: Filter compliance by standard (CIS)", async () => {
      if (!state.artifactId) {
        console.log("  S10: SKIPPED — no artifact_id");
        return;
      }

      const result = await registry.dispatch(client, "scs_compliance_result", "list", {
        artifact_id: state.artifactId,
        standards: ["CIS"],
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S10: compliance standards=CIS, ${jsonBytes(result)} bytes`);
    }, 30_000);

    it("S11: Get chain of custody", async () => {
      if (!state.artifactId) {
        console.log("  S11: SKIPPED — no artifact_id");
        return;
      }

      const result = await registry.dispatch(client, "scs_chain_of_custody", "get", {
        artifact_id: state.artifactId,
      }) as unknown;
      expect(result).toBeDefined();

      const events = Array.isArray(result) ? result : [];
      console.log(`  S11: chain of custody, ${events.length} events, ${jsonBytes(result)} bytes`);
      // Note: orchestration_id is captured from S06 (artifact list), not here
    }, 30_000);

    it("S12: Download SBOM", async () => {
      if (!state.orchestrationId) {
        console.log("  S12: SKIPPED — no orchestration_id");
        return;
      }

      try {
        const result = await registry.dispatch(client, "scs_sbom", "get", {
          orchestration_id: state.orchestrationId,
        }) as unknown;
        expect(result).toBeDefined();
        console.log(`  S12: SBOM download, ${jsonBytes(result)} bytes`);
      } catch (err) {
        // Orchestration may reference stale/cleaned-up SBOM data — log but don't fail
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  S12: SBOM not available (orchestration may be stale): ${msg.slice(0, 120)}`);
      }
    }, 30_000);

    it("S13: Get remediation", async () => {
      if (!state.artifactId || !state.purl) {
        console.log("  S13: SKIPPED — no artifact_id or purl");
        return;
      }

      try {
        const result = await registry.dispatch(client, "scs_artifact_remediation", "get", {
          artifact_id: state.artifactId,
          purl: state.purl,
        }) as unknown;
        expect(result).toBeDefined();
        console.log(`  S13: remediation, ${jsonBytes(result)} bytes`);
      } catch (err) {
        // Remediation is code-repo only; container image artifacts will 404
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  S13: remediation error (expected for non-code-repo): ${msg.slice(0, 120)}`);
      }
    }, 30_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tier 3 — Cross-cutting (pagination, multi-filter, compact, repo overview)
  // ═══════════════════════════════════════════════════════════════════════

  describe("Tier 3: Cross-cutting", () => {
    it("S14: Pagination fidelity (size=5 vs size=10)", async () => {
      const result5 = await registry.dispatch(client, "scs_artifact_source", "list", {
        page: 0, size: 5,
      }) as unknown;
      const result10 = await registry.dispatch(client, "scs_artifact_source", "list", {
        page: 0, size: 10,
      }) as unknown;

      const items5 = Array.isArray(result5) ? result5 : [];
      const items10 = Array.isArray(result10) ? result10 : [];

      // Note: upstream SCS API may ignore page_size (known issue).
      // We log the actual counts for analysis rather than hard-asserting.
      console.log(`  S14: size=5 → ${items5.length} items (${jsonBytes(result5)} bytes)`);
      console.log(`  S14: size=10 → ${items10.length} items (${jsonBytes(result10)} bytes)`);
      console.log(`  S14: pagination effective: ${items5.length !== items10.length || items5.length <= 5}`);

      // At minimum, both should return valid results
      expect(result5).toBeDefined();
      expect(result10).toBeDefined();
    }, 60_000);

    it("S15: Multi-filter compliance (standards + status)", async () => {
      if (!state.artifactId) {
        console.log("  S15: SKIPPED — no artifact_id");
        return;
      }

      // Test ensureArray normalization: pass scalar string (LLM behavior)
      const resultScalar = await registry.dispatch(client, "scs_compliance_result", "list", {
        artifact_id: state.artifactId,
        standards: "CIS",
        status: "FAILED",
      }) as unknown;
      expect(resultScalar).toBeDefined();

      // Test array form (correct behavior)
      const resultArray = await registry.dispatch(client, "scs_compliance_result", "list", {
        artifact_id: state.artifactId,
        standards: ["CIS", "OWASP"],
        status: ["FAILED"],
      }) as unknown;
      expect(resultArray).toBeDefined();

      console.log(`  S15: scalar filter → ${jsonBytes(resultScalar)} bytes`);
      console.log(`  S15: array filter → ${jsonBytes(resultArray)} bytes`);
    }, 60_000);

    it("S16: scsCleanExtract effectiveness (null/empty field stripping)", async () => {
      // Dispatch a list call — the response goes through scsCleanExtract
      const result = await registry.dispatch(client, "scs_artifact_source", "list", {}) as unknown;
      expect(result).toBeDefined();

      // Verify that scsCleanExtract has stripped null/empty fields
      const json = JSON.stringify(result);
      const hasNullLiterals = (json.match(/:null[,}]/g) ?? []).length;
      const hasEmptyStrings = (json.match(/:""[,}]/g) ?? []).length;
      const hasEmptyArrays = (json.match(/:\[\][,}]/g) ?? []).length;

      console.log(`  S16: response ${jsonBytes(result)} bytes`);
      console.log(`  S16: null fields: ${hasNullLiterals}, empty strings: ${hasEmptyStrings}, empty arrays: ${hasEmptyArrays}`);
      console.log(`  S16: clean extract effective: ${hasNullLiterals === 0 && hasEmptyStrings === 0 && hasEmptyArrays === 0}`);

      // scsCleanExtract should have removed all nulls, empty strings, and empty arrays
      expect(hasNullLiterals).toBe(0);
      expect(hasEmptyStrings).toBe(0);
      expect(hasEmptyArrays).toBe(0);
    }, 30_000);

    it("S17: Code repo overview", async () => {
      if (!state.repoId) {
        console.log("  S17: SKIPPED — no repo_id from S03");
        return;
      }

      const result = await registry.dispatch(client, "code_repo_security", "get", {
        repo_id: state.repoId,
      }) as unknown;
      expect(result).toBeDefined();
      console.log(`  S17: repo overview, ${jsonBytes(result)} bytes`);
    }, 30_000);

    it("S18: Compact mode effectiveness for SCS (T9-v2)", async () => {
      // Fetch two representative SCS list responses
      const sources = await registry.dispatch(client, "scs_artifact_source", "list", {}) as unknown;
      const repos = await registry.dispatch(client, "code_repo_security", "list", {}) as unknown;
      let artifacts: unknown = [];
      if (state.sourceId) {
        artifacts = await registry.dispatch(client, "artifact_security", "list", {
          source_id: state.sourceId,
        }) as unknown;
      }

      // --- Finding 1: Structural gap ---
      // harness-list.ts applies compactItems only when isRecord(result) && result.items.
      // SCS extractors return raw arrays, so compact mode is NEVER applied.
      const sourcesIsArray = Array.isArray(sources);
      const sourcesHasItems = !sourcesIsArray && typeof sources === "object" && sources !== null
        && "items" in (sources as Record<string, unknown>);
      console.log(`  S18: ═══ Compact Mode Analysis (T9-v2) ═══`);
      console.log(`  S18: SCS response is raw array: ${sourcesIsArray}`);
      console.log(`  S18: SCS response has .items:   ${sourcesHasItems}`);
      console.log(`  S18: → compact mode currently applied to SCS: ${sourcesHasItems}`);

      // --- Finding 2: What would compactItems do if applied? ---
      const testSets: { name: string; data: unknown }[] = [
        { name: "artifact_sources", data: sources },
        { name: "code_repos", data: repos },
        { name: "artifacts", data: artifacts },
      ];

      // SCS-critical fields that compactItems would drop
      const SCS_CRITICAL_FIELDS = new Set([
        "id", "url", "digest", "components_count", "updated",
        "scorecard", "policy_enforcement", "orchestration",
        "artifact_type", "signing", "sto_issue_count",
        "vulnerability_count", "slsa_verification",
        "source_type", "registry_type", "registry_url",
        "repo_name", "repo_url", "branch", "default_branch",
        "purl", "package_name", "package_version", "package_license",
      ]);

      for (const { name, data } of testSets) {
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) {
          console.log(`  S18: ${name}: (empty, skipped)`);
          continue;
        }

        const rawBytes = jsonBytes(items);
        const compacted = compactItems(items);
        const compactBytes = jsonBytes(compacted);
        const reduction = rawBytes > 0 ? Math.round((1 - compactBytes / rawBytes) * 100) : 0;

        // Identify which critical SCS fields survive vs are dropped
        const sampleRaw = items[0] as Record<string, unknown>;
        const sampleCompact = compacted[0] as Record<string, unknown>;
        const rawKeys = new Set(Object.keys(sampleRaw));
        const compactKeys = new Set(Object.keys(sampleCompact));
        const droppedKeys = [...rawKeys].filter(k => !compactKeys.has(k));
        const droppedCritical = droppedKeys.filter(k => SCS_CRITICAL_FIELDS.has(k));
        const survivingKeys = [...compactKeys];

        console.log(`  S18: ${name}: ${items.length} items, ${rawBytes}→${compactBytes} bytes (${reduction}% reduction)`);
        console.log(`  S18:   surviving fields (${survivingKeys.length}): ${survivingKeys.join(", ")}`);
        console.log(`  S18:   dropped total: ${droppedKeys.length}, dropped CRITICAL: ${droppedCritical.length}`);
        if (droppedCritical.length > 0) {
          console.log(`  S18:   ⚠️  lost critical: ${droppedCritical.join(", ")}`);
        }
      }

      // The test passes — this is an analysis scenario, not a correctness assertion.
      // The key finding is documented in console output for the T9-v2 report.
      expect(sources).toBeDefined();
    }, 60_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Summary — printed after all tests
  // ═══════════════════════════════════════════════════════════════════════

  it("Summary: captured entity IDs", () => {
    console.log("\n  ═══ SCS Benchmark State ═══");
    console.log(`  source_id:        ${state.sourceId || "(not captured)"}`);
    console.log(`  artifact_id:      ${state.artifactId || "(not captured)"}`);
    console.log(`  repo_id:          ${state.repoId || "(not captured)"}`);
    console.log(`  orchestration_id: ${state.orchestrationId || "(not captured)"}`);
    console.log(`  purl:             ${state.purl ? state.purl.slice(0, 80) : "(not captured)"}`);
    console.log("  ═══════════════════════════\n");
  });
});
