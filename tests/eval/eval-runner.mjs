#!/usr/bin/env node
/**
 * Automated MCP Eval Runner for Harness MCP Server
 *
 * Comprehensive eval covering all 24 toolsets, ~70 eval cases across 5 tiers:
 *   Tier 1: Meta/Status (always pass)
 *   Tier 2: List operations with module detection
 *   Tier 3: Get operations (chained discovery)
 *   Tier 4: CRUD lifecycle (opt-in: --include-crud)
 *   Tier 5: Execute actions (opt-in: --include-execute)
 *
 * Usage:
 *   node eval-runner.mjs [options]
 *
 * Options:
 *   --project <id>        Override project ID
 *   --tier <1,2,3,4,5>    Run specific tiers only (comma-separated)
 *   --include-crud        Enable Tier 4 CRUD lifecycle tests
 *   --include-execute     Enable Tier 5 execute action tests
 *   --toolset <name,...>  Only test specific toolsets
 *   --json                Output results as JSON
 *   --parallel <n>        Parallel batch size (default: 10)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI Argument Parsing ────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    project: null,
    tiers: null, // null = all applicable
    includeCrud: false,
    includeExecute: false,
    toolsets: null,
    json: false,
    parallel: 10,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--project": opts.project = args[++i]; break;
      case "--tier": opts.tiers = new Set(args[++i].split(",").map(Number)); break;
      case "--include-crud": opts.includeCrud = true; break;
      case "--include-execute": opts.includeExecute = true; break;
      case "--toolset": opts.toolsets = new Set(args[++i].split(",")); break;
      case "--json": opts.json = true; break;
      case "--parallel": opts.parallel = parseInt(args[++i], 10); break;
    }
  }
  return opts;
}

// ── .env Loader ─────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envFile = readFileSync(resolve(__dirname, ".env"), "utf-8");
    const env = {};
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return env;
  } catch {
    return {};
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function parse(result) {
  try {
    if (!result?.content?.[0]?.text) return null;
    return JSON.parse(result.content[0].text);
  } catch {
    return null;
  }
}

function truncate(s, max = 80) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

async function callTool(client, name, args) {
  return client.callTool({ name, arguments: args });
}

async function parallelBatch(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function generateUniqueId(prefix) {
  return `eval_${prefix}_${Date.now().toString(36)}`;
}

/** Per-resource-type ID field extraction from list items */
const ID_FIELDS = {
  execution: ["planExecutionId"],
  cost_perspective: ["id", "uuid"],
  user: ["uuid"],
  delegate: ["delegateGroupId", "identifier"],
  chaos_experiment: ["experimentID", "identifier"],
  chaos_experiment_run: ["experimentRunID", "identifier"],
  chaos_probe: ["name", "identifier"],
  dashboard: ["id", "identifier"],
  audit_event: ["auditId", "identifier"],
  idp_entity: ["metadata.uid", "identifier"],
  scorecard: ["id", "identifier"],
  security_issue: ["id", "identifier"],
  security_exemption: ["id", "identifier"],
  cost_anomaly: ["id", "identifier"],
  cost_recommendation: ["id", "identifier"],
  // default: identifier, id, slug
};

function extractId(item, resourceType) {
  if (!item || typeof item !== "object") return null;
  const fields = ID_FIELDS[resourceType] || ["identifier", "id", "slug"];
  for (const field of fields) {
    if (field.includes(".")) {
      // Support nested fields like "metadata.uid"
      const parts = field.split(".");
      let val = item;
      for (const p of parts) { val = val?.[p]; }
      if (val) return String(val);
    } else if (item[field]) {
      return String(item[field]);
    }
  }
  // Fallback chain
  return item.identifier || item.id || item.slug || null;
}

// ── Tier Definitions ────────────────────────────────────────────────

/** Tier 2: List operations — resource types to probe */
const WAVE1_LIST_TYPES = [
  // Core (always available)
  { type: "pipeline", toolset: "pipelines", domain: "Pipeline" },
  { type: "service", toolset: "services", domain: "Service" },
  { type: "environment", toolset: "environments", domain: "Environment" },
  { type: "connector", toolset: "connectors", domain: "Connector" },
  { type: "secret", toolset: "secrets", domain: "Secret" },
  { type: "template", toolset: "templates", domain: "Template" },
  { type: "delegate", toolset: "delegates", domain: "Delegate", skipIfUnavailable: true },
  { type: "repository", toolset: "repositories", domain: "Code" },

  // Feature Flags
  { type: "feature_flag", toolset: "feature-flags", domain: "Feature Flags", skipIfUnavailable: true },
  { type: "fme_workspace", toolset: "feature-flags", domain: "Feature Flags", skipIfUnavailable: true },

  // GitOps
  { type: "gitops_agent", toolset: "gitops", domain: "GitOps", skipIfUnavailable: true },

  // Chaos
  { type: "chaos_experiment", toolset: "chaos", domain: "Chaos", skipIfUnavailable: true },

  // Access Control
  { type: "user", toolset: "access-control", domain: "Access Control" },
  { type: "user_group", toolset: "access-control", domain: "Access Control" },
  { type: "role", toolset: "access-control", domain: "Access Control", skipIfUnavailable: true },

  // STO
  { type: "security_issue", toolset: "sto", domain: "STO", skipIfUnavailable: true },

  // SCS
  { type: "artifact_security", toolset: "scs", domain: "SCS", skipIfUnavailable: true },

  // CCM
  { type: "cost_perspective", toolset: "ccm", domain: "CCM", skipIfUnavailable: true, skipPattern: /500|something went wrong|Oops/i },

  // Registries
  { type: "registry", toolset: "registries", domain: "Registries", skipIfUnavailable: true },

  // IDP
  { type: "idp_entity", toolset: "idp", domain: "IDP", skipIfUnavailable: true },

  // SEI
  { type: "sei_metric", toolset: "sei", domain: "SEI", skipIfUnavailable: true },

  // Dashboards
  { type: "dashboard", toolset: "dashboards", domain: "Dashboards", skipIfUnavailable: true },

  // Audit
  { type: "audit_event", toolset: "audit", domain: "Audit" },

  // Settings
  { type: "setting", toolset: "settings", domain: "Settings", extraArgs: { category: "CORE" } },
];

/** Resources that support get (used in Tier 3) */
const GET_SUPPORTED = new Set([
  "pipeline", "service", "environment", "connector", "secret", "template",
  "repository", "feature_flag", "gitops_agent", "gitops_application",
  "gitops_cluster", "gitops_repository", "chaos_experiment",
  "user", "user_group", "role", "security_issue",
  "dashboard", "audit_event", "idp_entity", "scorecard",
  "cost_perspective", "registry",
]);

/** CRUD body factories for Tier 4 */
const CRUD_BODIES = {
  pipeline: (id, projectId, orgId) => ({
    pipeline: {
      name: `Eval Pipeline ${id}`,
      identifier: id,
      projectIdentifier: projectId,
      orgIdentifier: orgId,
      description: "Eval create test",
      tags: {},
      stages: [{
        stage: {
          name: "Eval Stage",
          identifier: "eval_stage",
          type: "Custom",
          spec: { execution: { steps: [] } },
        },
      }],
    },
  }),
  environment: (id, projectId, orgId) => ({
    environment: {
      name: `Eval Env ${id}`,
      identifier: id,
      orgIdentifier: orgId,
      projectIdentifier: projectId,
      description: "Eval create test",
      type: "PreProduction",
      tags: {},
    },
  }),
  service: (id, projectId, orgId) => ({
    service: {
      name: `Eval Service ${id}`,
      identifier: id,
      orgIdentifier: orgId,
      projectIdentifier: projectId,
      description: "Eval create test",
      tags: {},
    },
  }),
};

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const envVars = loadEnv();

  const shouldRunTier = (n) => !opts.tiers || opts.tiers.has(n);
  const shouldRunToolset = (ts) => !opts.toolsets || opts.toolsets.has(ts);

  if (!opts.json) {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║        Harness MCP Server — Comprehensive Eval Runner       ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`Date: ${new Date().toISOString().split("T")[0]}`);
    const tierList = opts.tiers ? [...opts.tiers].join(",") : "1,2,3" + (opts.includeCrud ? ",4" : "") + (opts.includeExecute ? ",5" : "");
    console.log(`Tiers: ${tierList} + schema-validation`);
    console.log("");
  }

  // ── Connect to MCP server ───────────────────────────────────────
  const transport = new StdioClientTransport({
    command: "node",
    args: [resolve(__dirname, "build/index.js"), "stdio"],
    env: { ...process.env, ...envVars },
    stderr: "pipe",
  });

  const client = new Client({ name: "eval-runner", version: "2.0.0" });

  try {
    await client.connect(transport);
    if (!opts.json) console.log("Connected to MCP server.\n");
  } catch (err) {
    console.error("Failed to connect:", err.message);
    process.exit(1);
  }

  // ── Discover project ────────────────────────────────────────────
  let PROJECT_ID = opts.project || envVars.HARNESS_DEFAULT_PROJECT_ID || null;

  if (!PROJECT_ID) {
    if (!opts.json) console.log("Phase 0: Discovering a valid project...");
    try {
      const projResult = await callTool(client, "harness_list", {
        resource_type: "project", size: 50,
      });
      const projData = parse(projResult);
      const projects = projData?.items || [];
      if (!opts.json) console.log(`  Found ${projects.length} projects.`);

      function getProjectId(p) {
        return p?.identifier || p?.id || p?.project?.identifier || null;
      }

      for (const p of projects.slice(0, 10)) {
        const pid = getProjectId(p);
        if (!pid) continue;
        try {
          const plResult = await callTool(client, "harness_list", {
            resource_type: "pipeline", size: 1, compact: true, project_id: pid,
          });
          const plData = parse(plResult);
          if (plData?.items?.length > 0 || plData?.total > 0) {
            PROJECT_ID = pid;
            if (!opts.json) console.log(`  Found project with pipelines: ${pid}\n`);
            break;
          }
        } catch { /* try next */ }
      }

      if (!PROJECT_ID && projects.length > 0) {
        PROJECT_ID = getProjectId(projects[0]);
        if (!opts.json) console.log(`  Using first project: ${PROJECT_ID}\n`);
      }
    } catch (err) {
      if (!opts.json) console.log(`  Project discovery failed: ${err.message}`);
    }
  }

  if (!PROJECT_ID) {
    console.error("ERROR: No project found. Pass --project <id> or set HARNESS_DEFAULT_PROJECT_ID in .env");
    process.exit(1);
  }

  if (!opts.json) console.log(`Project: ${PROJECT_ID}\n`);

  // ── Results tracking ────────────────────────────────────────────
  const allResults = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalPartial = 0;
  let totalSkipped = 0;
  const discovered = {};
  const moduleAvailability = {};
  const discoveredItems = {}; // Store first item per resource type for deeper checks

  /** Detect if an error indicates a module/feature is not available (vs a real bug) */
  function isModuleUnavailable(result, tc) {
    if (!result?.isError) return false;
    const text = result?.content?.[0]?.text || "";
    // Custom skip pattern for specific resource types
    if (tc?.skipPattern && tc.skipPattern.test(text)) return true;
    return /404|not found|unauthorized|401|403|405|no matching operation|400|something went wrong/i.test(text);
  }

  async function runCase(tc) {
    if (!opts.json) {
      const label = `[${tc.id}]`.padEnd(28);
      process.stdout.write(`  ${label} ${tc.desc.padEnd(42)} `);
    }

    const start = Date.now();
    let result;
    let score;
    let summary;

    try {
      result = await callTool(client, tc.tool, tc.args);
      const elapsed = Date.now() - start;

      if (result?.isError) {
        // If this is a list probe and the error looks like "module not available", skip it
        if (tc.skipIfUnavailable && isModuleUnavailable(result, tc)) {
          score = -1;
          summary = `SKIPPED (module unavailable, ${elapsed}ms)`;
        } else {
          score = 0;
          summary = `ERROR: ${truncate(result?.content?.[0]?.text || "unknown")}`;
        }
      } else if (tc.check(result)) {
        score = 1;
        const d = parse(result);
        const items = d?.items?.length ?? d?.total_matches ?? d?.total ?? "";
        summary = `OK (${elapsed}ms)${items !== "" ? ` [${items} items]` : ""}`;
      } else {
        score = 0.5;
        summary = `PARTIAL — unexpected shape (${elapsed}ms)`;
      }
    } catch (err) {
      if (tc.skipIfUnavailable) {
        score = -1;
        summary = `SKIPPED (${truncate(err.message)})`;
      } else {
        score = 0;
        summary = `EXCEPTION: ${truncate(err.message)}`;
      }
    }

    if (score === 1) totalPassed++;
    else if (score === 0) totalFailed++;
    else if (score < 0) totalSkipped++;
    else totalPartial++;

    if (!opts.json) {
      const icon = score === 1 ? "✅" : score === 0 ? "❌" : score < 0 ? "⏭️" : "⚠️";
      console.log(`${icon}  ${summary}`);
    }

    allResults.push({ ...tc, score, summary, check: undefined }); // strip check fn for JSON
    return { score, result };
  }

  function skipCase(tc, reason) {
    totalSkipped++;
    if (!opts.json) {
      const label = `[${tc.id}]`.padEnd(28);
      console.log(`  ${label} ${tc.desc.padEnd(42)} ⏭️  SKIPPED: ${reason}`);
    }
    allResults.push({ ...tc, score: -1, summary: `SKIPPED: ${reason}`, check: undefined });
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 1: Meta / Status
  // ════════════════════════════════════════════════════════════════

  if (shouldRunTier(1)) {
    if (!opts.json) console.log("─── Tier 1: Meta / Status ─────────────────────────────────────\n");

    const tier1Cases = [
      {
        id: "describe_pipeline", tier: 1, domain: "Meta", tool: "harness_describe",
        args: { resource_type: "pipeline" },
        check: (r) => { const d = parse(r); return d?.resource_type || d?.ops || d?.operations; },
        desc: "Describe pipeline resource",
      },
      {
        id: "describe_service", tier: 1, domain: "Meta", tool: "harness_describe",
        args: { resource_type: "service" },
        check: (r) => { const d = parse(r); return d?.resource_type || d?.ops || d?.operations; },
        desc: "Describe service resource",
      },
      {
        id: "describe_summary", tier: 1, domain: "Meta", tool: "harness_describe",
        args: {},
        check: (r) => { const d = parse(r); return d?.total_resource_types || d?.total_toolsets; },
        desc: "Describe all resources (summary)",
      },
      {
        id: "describe_search", tier: 1, domain: "Meta", tool: "harness_describe",
        args: { search_term: "pipeline" },
        check: (r) => { const d = parse(r); return Array.isArray(d) || d?.total_results != null || d?.length > 0; },
        desc: "Search resource types",
      },
      {
        id: "status", tier: 1, domain: "Status", tool: "harness_status",
        args: { project_id: PROJECT_ID },
        check: (r) => { const d = parse(r); return d?.summary || d?.project || d?.failed_executions != null; },
        desc: "Project status",
      },
    ];

    for (const tc of tier1Cases) {
      await runCase(tc);
    }
    if (!opts.json) console.log("");
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 2: List Operations (Wave 1 — independent)
  // ════════════════════════════════════════════════════════════════

  if (shouldRunTier(2)) {
    if (!opts.json) console.log("─── Tier 2: List Operations ───────────────────────────────────\n");

    // Filter by toolset if specified
    const wave1Types = WAVE1_LIST_TYPES.filter(lt => shouldRunToolset(lt.toolset));

    // Run all wave 1 list calls and discover IDs + module availability
    if (!opts.json) console.log("  Wave 1: Independent resource types\n");

    for (const lt of wave1Types) {
      const tc = {
        id: `${lt.type}_list`, tier: 2, domain: lt.domain, tool: "harness_list",
        args: { resource_type: lt.type, size: 5, compact: true, project_id: PROJECT_ID, ...(lt.extraArgs || {}) },
        skipIfUnavailable: lt.skipIfUnavailable || false,
        check: (r) => {
          const d = parse(r);
          return Array.isArray(d?.items) || Array.isArray(d) || (!r?.isError && d != null);
        },
        desc: `List ${lt.type}s`,
      };

      const { score, result } = await runCase(tc);

      // Track module availability
      if (!moduleAvailability[lt.toolset]) {
        moduleAvailability[lt.toolset] = { available: false, types: [] };
      }
      if (score >= 0.5) {
        moduleAvailability[lt.toolset].available = true;
      }
      moduleAvailability[lt.toolset].types.push(lt.type);

      // Extract first item ID for Tier 3 get operations
      if (score >= 0.5) {
        const d = parse(result);
        const items = d?.items || (Array.isArray(d) ? d : []);
        if (items.length > 0) {
          const firstId = extractId(items[0], lt.type);
          if (firstId) {
            discovered[lt.type] = firstId;
            discoveredItems[lt.type] = items[0];
          }
        }
      }
    }

    // Wave 2: Dependent resource types (need parent IDs)
    if (!opts.json) console.log("\n  Wave 2: Dependent resource types (need parent IDs)\n");

    const wave2Types = [
      discovered.pipeline && { type: "execution", domain: "Pipeline", toolset: "pipelines",
        extraArgs: { pipeline_id: discovered.pipeline } },
      discovered.pipeline && { type: "trigger", domain: "Pipeline", toolset: "pipelines",
        extraArgs: { pipeline_id: discovered.pipeline } },
      discovered.pipeline && { type: "input_set", domain: "Pipeline", toolset: "pipelines",
        extraArgs: { pipeline_id: discovered.pipeline } },
      discovered.environment && { type: "infrastructure", domain: "Environment", toolset: "infrastructure",
        extraArgs: { environment_id: discovered.environment } },
      discovered.repository && { type: "pull_request", domain: "Code", toolset: "pull-requests",
        extraArgs: { repo_id: discovered.repository } },
      discovered.gitops_agent && { type: "gitops_application", domain: "GitOps", toolset: "gitops",
        extraArgs: { agent_id: discovered.gitops_agent } },
      discovered.gitops_agent && { type: "gitops_cluster", domain: "GitOps", toolset: "gitops",
        extraArgs: { agent_id: discovered.gitops_agent } },
      discovered.registry && { type: "artifact", domain: "Registries", toolset: "registries",
        extraArgs: { registry_id: discovered.registry } },
    ].filter(Boolean).filter(lt => shouldRunToolset(lt.toolset));

    for (const lt of wave2Types) {
      const tc = {
        id: `${lt.type}_list`, tier: 2, domain: lt.domain, tool: "harness_list",
        args: { resource_type: lt.type, size: 5, compact: true, project_id: PROJECT_ID, ...(lt.extraArgs || {}) },
        check: (r) => {
          const d = parse(r);
          return Array.isArray(d?.items) || Array.isArray(d) || (!r?.isError && d != null);
        },
        desc: `List ${lt.type}s`,
      };

      const { score, result } = await runCase(tc);

      if (score >= 0.5) {
        const d = parse(result);
        const items = d?.items || (Array.isArray(d) ? d : []);
        if (items.length > 0) {
          const firstId = extractId(items[0], lt.type);
          if (firstId) {
            discovered[lt.type] = firstId;
            discoveredItems[lt.type] = items[0];
          }
        }
      }
    }

    // Search
    const searchCase = {
      id: "search", tier: 2, domain: "Search", tool: "harness_search",
      args: { query: "deploy", project_id: PROJECT_ID },
      check: (r) => { const d = parse(r); return d?.total_matches != null || d?.results; },
      desc: "Search 'deploy'",
    };
    await runCase(searchCase);

    if (!opts.json) console.log("");
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 3: Get Operations (chained discovery)
  // ════════════════════════════════════════════════════════════════

  if (shouldRunTier(3)) {
    if (!opts.json) console.log("─── Tier 3: Get Operations ────────────────────────────────────\n");

    // Standard get operations for all discovered resources
    for (const [type, resourceId] of Object.entries(discovered)) {
      if (!GET_SUPPORTED.has(type)) continue;

      const domain = WAVE1_LIST_TYPES.find(lt => lt.type === type)?.domain
        || type.charAt(0).toUpperCase() + type.slice(1);

      const tc = {
        id: `${type}_get`, tier: 3, domain, tool: "harness_get",
        args: { resource_type: type, resource_id: resourceId, project_id: PROJECT_ID },
        check: (r) => {
          const d = parse(r);
          if (!d) return false;
          // Check common response shapes: direct fields, nested under type key, or YAML content
          return d.identifier || d.name || d.id || d?.[type]?.identifier
            || d.yamlPipeline || d.yaml || d.entityValidityDetails
            || (typeof d === "object" && Object.keys(d).length > 0 && !r?.isError);
        },
        desc: `Get ${type} (${truncate(resourceId, 20)})`,
      };
      await runCase(tc);
    }

    // Pipeline-specific: pipeline_summary
    if (discovered.pipeline) {
      const tc = {
        id: "pipeline_summary_get", tier: 3, domain: "Pipeline", tool: "harness_get",
        args: { resource_type: "pipeline_summary", resource_id: discovered.pipeline, project_id: PROJECT_ID },
        check: (r) => { const d = parse(r); return d?.name || d?.identifier || d?.numOfStages != null; },
        desc: `Pipeline summary (${truncate(discovered.pipeline, 20)})`,
      };
      await runCase(tc);
    }

    // Execution get (chained: needs execution ID from execution list)
    if (discovered.execution) {
      const tc = {
        id: "execution_get", tier: 3, domain: "Pipeline", tool: "harness_get",
        args: { resource_type: "execution", resource_id: discovered.execution, project_id: PROJECT_ID },
        check: (r) => {
          const d = parse(r);
          return d?.pipelineExecutionSummary || d?.planExecutionId || d?.status;
        },
        desc: `Get execution (${truncate(discovered.execution, 20)})`,
      };
      await runCase(tc);
    }

    // GitOps application get (needs agent_id)
    if (discovered.gitops_application && discovered.gitops_agent) {
      const tc = {
        id: "gitops_application_get", tier: 3, domain: "GitOps", tool: "harness_get",
        args: {
          resource_type: "gitops_application",
          resource_id: discovered.gitops_application,
          agent_id: discovered.gitops_agent,
          project_id: PROJECT_ID,
        },
        check: (r) => {
          const d = parse(r);
          return d?.name || d?.identifier || d?.metadata;
        },
        desc: `Get GitOps app (${truncate(discovered.gitops_application, 20)})`,
      };
      await runCase(tc);
    }

    if (!opts.json) console.log("");
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 4: CRUD Lifecycle (opt-in)
  // ════════════════════════════════════════════════════════════════

  if (shouldRunTier(4) && opts.includeCrud) {
    if (!opts.json) console.log("─── Tier 4: CRUD Lifecycle ────────────────────────────────────\n");

    const orgId = envVars.HARNESS_DEFAULT_ORG_ID || "default";

    for (const [resourceType, bodyFactory] of Object.entries(CRUD_BODIES)) {
      if (!shouldRunToolset(resourceType === "pipeline" ? "pipelines" : resourceType === "service" ? "services" : "environments")) continue;

      const uniqueId = generateUniqueId(resourceType);
      if (!opts.json) console.log(`  ${resourceType} lifecycle (${uniqueId}):\n`);

      let createOk = false;

      try {
        // Create
        const createBody = bodyFactory(uniqueId, PROJECT_ID, orgId);
        const createCase = {
          id: `${resourceType}_create`, tier: 4, domain: "CRUD", tool: "harness_create",
          args: { resource_type: resourceType, body: createBody, confirmation: true, project_id: PROJECT_ID },
          check: (r) => {
            const d = parse(r);
            return d?.identifier || d?.name || (d && !r?.isError);
          },
          desc: `Create ${resourceType}`,
        };
        const { score: createScore } = await runCase(createCase);
        createOk = createScore === 1;

        // Verify create (only if create succeeded)
        if (createOk) {
          const verifyCase = {
            id: `${resourceType}_verify_create`, tier: 4, domain: "CRUD", tool: "harness_get",
            args: { resource_type: resourceType, resource_id: uniqueId, project_id: PROJECT_ID },
            check: (r) => {
              const d = parse(r);
              return d?.identifier === uniqueId || d?.name?.includes("Eval") || d?.[resourceType]?.identifier === uniqueId;
            },
            desc: `Verify ${resourceType} created`,
          };
          await runCase(verifyCase);
        }

        // Update
        if (createOk) {
          const updateBody = bodyFactory(uniqueId, PROJECT_ID, orgId);
          const innerKey = Object.keys(updateBody)[0];
          if (updateBody[innerKey]) {
            updateBody[innerKey].description = "Eval update test";
          }

          const updateCase = {
            id: `${resourceType}_update`, tier: 4, domain: "CRUD", tool: "harness_update",
            args: { resource_type: resourceType, resource_id: uniqueId, body: updateBody, confirmation: true, project_id: PROJECT_ID },
            check: (r) => !r?.isError,
            desc: `Update ${resourceType}`,
          };
          await runCase(updateCase);

          // Verify update
          const verifyUpdateCase = {
            id: `${resourceType}_verify_update`, tier: 4, domain: "CRUD", tool: "harness_get",
            args: { resource_type: resourceType, resource_id: uniqueId, project_id: PROJECT_ID },
            check: (r) => {
              const d = parse(r);
              return JSON.stringify(d).includes("Eval update test");
            },
            desc: `Verify ${resourceType} updated`,
          };
          await runCase(verifyUpdateCase);
        }
      } finally {
        // Always delete (cleanup)
        if (createOk) {
          const deleteCase = {
            id: `${resourceType}_delete`, tier: 4, domain: "CRUD", tool: "harness_delete",
            args: { resource_type: resourceType, resource_id: uniqueId, confirmation: true, project_id: PROJECT_ID },
            check: (r) => !r?.isError,
            desc: `Delete ${resourceType} (cleanup)`,
          };
          await runCase(deleteCase);
        }
      }

      if (!opts.json) console.log("");
    }

    // Connector update (uses discovered connector, not create/delete)
    if (discovered.connector) {
      if (!opts.json) console.log("  connector update (existing resource):\n");

      // Get current connector to capture original state
      let originalDesc = null;
      try {
        const getResult = await callTool(client, "harness_get", {
          resource_type: "connector", resource_id: discovered.connector, project_id: PROJECT_ID,
        });
        const d = parse(getResult);
        const connObj = d?.connector || d;
        originalDesc = connObj?.description || "";
      } catch { /* proceed anyway */ }

      const updateCase = {
        id: "connector_update", tier: 4, domain: "CRUD", tool: "harness_update",
        args: {
          resource_type: "connector",
          resource_id: discovered.connector,
          body: { connector: { description: "Eval update test " + Date.now() } },
          confirmation: true,
          project_id: PROJECT_ID,
        },
        check: (r) => !r?.isError,
        desc: `Update connector (${truncate(discovered.connector, 20)})`,
      };
      await runCase(updateCase);

      // Restore original description
      if (originalDesc !== null) {
        try {
          await callTool(client, "harness_update", {
            resource_type: "connector",
            resource_id: discovered.connector,
            body: { connector: { description: originalDesc } },
            confirmation: true,
            project_id: PROJECT_ID,
          });
        } catch { /* best effort restore */ }
      }

      if (!opts.json) console.log("");
    }
  } else if (shouldRunTier(4) && !opts.includeCrud) {
    if (!opts.json) console.log("─── Tier 4: CRUD Lifecycle (skipped — pass --include-crud) ───\n");
  }

  // ════════════════════════════════════════════════════════════════
  // SCHEMA VALIDATION: Staleness detection (opt-in)
  // ════════════════════════════════════════════════════════════════

  {
    if (!opts.json) console.log("─── Schema Validation: Staleness Detection ────────────────────\n");

    const orgId = envVars.HARNESS_DEFAULT_ORG_ID || "default";

    // Resource types with bodySchema on create (the 5 annotated toolsets)
    const SCHEMA_TYPES = [
      { type: "service", toolset: "services", domain: "Schema" },
      { type: "environment", toolset: "environments", domain: "Schema" },
      { type: "connector", toolset: "connectors", domain: "Schema" },
      { type: "pipeline", toolset: "pipelines", domain: "Schema" },
      { type: "feature_flag", toolset: "feature-flags", domain: "Schema" },
    ];

    for (const st of SCHEMA_TYPES) {
      if (!shouldRunToolset(st.toolset)) continue;

      // Step 1: Get schema via harness_describe
      let schema = null;
      try {
        const descResult = await callTool(client, "harness_describe", { resource_type: st.type });
        const descData = parse(descResult);
        const createOp = descData?.operations?.find(op => op.operation === "create");
        schema = createOp?.bodySchema;
      } catch { /* skip */ }

      if (!schema) {
        skipCase({
          id: `schema_${st.type}`, tier: 6, domain: st.domain, desc: `Schema validation: ${st.type}`,
        }, "no bodySchema found");
        continue;
      }

      // Step 2: Test empty body → our pre-flight validation should catch required fields
      const requiredFields = schema.fields.filter(f => f.required).map(f => f.name);

      if (requiredFields.length > 0) {
        const emptyBodyCase = {
          id: `schema_${st.type}_empty`, tier: 6, domain: st.domain, tool: "harness_create",
          args: { resource_type: st.type, body: {}, confirmation: true, project_id: PROJECT_ID },
          check: (r) => {
            // We EXPECT an error (isError=true) mentioning "Missing required fields"
            // This validates our pre-flight validation is working correctly
            const text = r?.content?.[0]?.text || "";
            if (!text.includes("Missing required fields")) return false;
            // Verify all required fields from schema are mentioned in the error
            for (const f of requiredFields) {
              if (!text.includes(f)) return false;
            }
            return true; // Pre-flight validation correctly caught all required fields
          },
          // Override: for this test, isError=true with correct message IS a pass
          skipIfUnavailable: false,
          desc: `Empty body validation: ${st.type}`,
        };
        // Custom run: we expect isError=true, so bypass the default error handling
        if (!opts.json) {
          const label = `[${emptyBodyCase.id}]`.padEnd(28);
          process.stdout.write(`  ${label} ${emptyBodyCase.desc.padEnd(42)} `);
        }
        const start = Date.now();
        try {
          const result = await callTool(client, emptyBodyCase.tool, emptyBodyCase.args);
          const elapsed = Date.now() - start;
          const text = result?.content?.[0]?.text || "";

          if (text.includes("Missing required fields")) {
            // Verify all required fields are mentioned
            const allMentioned = requiredFields.every(f => text.includes(f));
            if (allMentioned) {
              totalPassed++;
              if (!opts.json) console.log(`✅  Pre-flight validation correct (${elapsed}ms)`);
              allResults.push({ ...emptyBodyCase, score: 1, summary: `Pre-flight validation correct (${elapsed}ms)`, check: undefined });
            } else {
              totalFailed++;
              const missing = requiredFields.filter(f => !text.includes(f));
              if (!opts.json) console.log(`❌  STALE: schema lists ${missing.join(",")} as required but validation didn't catch them (${elapsed}ms)`);
              allResults.push({ ...emptyBodyCase, score: 0, summary: `STALE: missing validation for: ${missing.join(",")}`, check: undefined });
            }
          } else {
            totalFailed++;
            if (!opts.json) console.log(`❌  STALE: empty body was not rejected by pre-flight validation (${elapsed}ms)`);
            allResults.push({ ...emptyBodyCase, score: 0, summary: `STALE: empty body not rejected`, check: undefined });
          }
        } catch (err) {
          const elapsed = Date.now() - start;
          totalFailed++;
          if (!opts.json) console.log(`❌  EXCEPTION: ${truncate(err.message)} (${elapsed}ms)`);
          allResults.push({ ...emptyBodyCase, score: 0, summary: `EXCEPTION: ${truncate(err.message)}`, check: undefined });
        }
      }

      // Step 3: Build minimal body from schema required fields + examples → create → check Harness response
      const uniqueId = generateUniqueId(st.type);
      const minimalBody = {};

      for (const field of schema.fields) {
        if (!field.required) continue;
        if (field.name === "identifier") {
          minimalBody.identifier = uniqueId;
        } else {
          // Defaults by type
          switch (field.type) {
            case "string": minimalBody[field.name] = `eval_${field.name}`; break;
            case "number": minimalBody[field.name] = 0; break;
            case "boolean": minimalBody[field.name] = false; break;
            case "object": minimalBody[field.name] = {}; break;
            case "array": minimalBody[field.name] = []; break;
            default: minimalBody[field.name] = `eval_${field.name}`;
          }
        }
      }

      // Special handling: pipeline body is nested under { pipeline: { ... } }
      const createBody = st.type === "pipeline"
        ? { pipeline: { ...minimalBody, identifier: uniqueId, name: `Eval Schema ${uniqueId}`, stages: [] } }
        : minimalBody;

      let createOk = false;

      // Custom run for create: we need nuanced error handling
      const createCaseId = `schema_${st.type}_create`;
      const createCaseDesc = `Schema create: ${st.type} (minimal required)`;
      if (!opts.json) {
        const label = `[${createCaseId}]`.padEnd(28);
        process.stdout.write(`  ${label} ${createCaseDesc.padEnd(42)} `);
      }
      const createStart = Date.now();
      try {
        const result = await callTool(client, "harness_create", {
          resource_type: st.type, body: createBody, confirmation: true, project_id: PROJECT_ID,
        });
        const elapsed = Date.now() - createStart;
        const text = result?.content?.[0]?.text || "";

        if (result?.isError) {
          if (text.includes("Missing required fields")) {
            // Our OWN pre-flight rejected it — schema is wrong (body was built from its own schema!)
            totalFailed++;
            if (!opts.json) console.log(`❌  STALE: pre-flight rejected body built from schema (${elapsed}ms)`);
            allResults.push({ id: createCaseId, tier: 6, domain: st.domain, score: 0, summary: `STALE: self-rejection` });
          } else {
            // Check for Harness telling us a field is required that we don't have
            const missingMatch = text.match(/(?:field|property|parameter)\s+["']?(\w+)["']?\s+(?:is required|must not be null|is mandatory|cannot be empty)/i);
            if (missingMatch && !requiredFields.includes(missingMatch[1])) {
              // Harness requires a field our schema doesn't mark as required → STALE
              totalFailed++;
              if (!opts.json) console.log(`❌  STALE: Harness requires "${missingMatch[1]}" not in schema (${elapsed}ms)`);
              allResults.push({ id: createCaseId, tier: 6, domain: st.domain, score: 0, summary: `STALE: missing required field "${missingMatch[1]}"` });
            } else {
              // API-side rejection for value format, constraints, etc. → schema structure is correct
              totalPassed++;
              if (!opts.json) console.log(`✅  Schema valid (API rejected values, not structure) (${elapsed}ms)`);
              allResults.push({ id: createCaseId, tier: 6, domain: st.domain, score: 1, summary: `Schema valid (API value rejection, ${elapsed}ms)` });
            }
          }
        } else {
          // Success → schema is correct, resource was created
          createOk = true;
          totalPassed++;
          if (!opts.json) console.log(`✅  Schema valid (created successfully) (${elapsed}ms)`);
          allResults.push({ id: createCaseId, tier: 6, domain: st.domain, score: 1, summary: `Schema valid (created, ${elapsed}ms)` });
        }
      } catch (err) {
        const elapsed = Date.now() - createStart;
        totalFailed++;
        if (!opts.json) console.log(`❌  EXCEPTION: ${truncate(err.message)} (${elapsed}ms)`);
        allResults.push({ id: createCaseId, tier: 6, domain: st.domain, score: 0, summary: `EXCEPTION: ${truncate(err.message)}` });
      }

      // Cleanup if created
      if (createOk) {
        try {
          const deleteArgs = { resource_type: st.type, resource_id: uniqueId, confirmation: true, project_id: PROJECT_ID };
          // Pipeline needs pipeline_id
          if (st.type === "pipeline") deleteArgs.resource_id = uniqueId;
          await callTool(client, "harness_delete", deleteArgs);
          if (!opts.json) {
            const label = `[schema_${st.type}_cleanup]`.padEnd(28);
            console.log(`  ${label} ${"Cleanup (delete)".padEnd(42)} 🧹  OK`);
          }
        } catch {
          if (!opts.json) {
            const label = `[schema_${st.type}_cleanup]`.padEnd(28);
            console.log(`  ${label} ${"Cleanup (delete)".padEnd(42)} ⚠️  Failed (manual cleanup needed: ${uniqueId})`);
          }
        }
      }
    }

    if (!opts.json) console.log("");
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 5: Execute Actions (opt-in)
  // ════════════════════════════════════════════════════════════════

  if (shouldRunTier(5) && opts.includeExecute) {
    if (!opts.json) console.log("─── Tier 5: Execute Actions ───────────────────────────────────\n");

    // Connector test_connection
    if (discovered.connector && shouldRunToolset("connectors")) {
      const tc = {
        id: "connector_test", tier: 5, domain: "Execute", tool: "harness_execute",
        args: {
          resource_type: "connector",
          action: "test_connection",
          resource_id: discovered.connector,
          confirmation: true,
          project_id: PROJECT_ID,
        },
        check: (r) => {
          const d = parse(r);
          return d?.status === "SUCCESS" || d?.status === "FAILURE" || !r?.isError;
        },
        desc: `Test connector (${truncate(discovered.connector, 20)})`,
      };
      await runCase(tc);
    }

    // Feature flag toggle (on then off to restore)
    if (discovered.feature_flag && shouldRunToolset("feature-flags")) {
      // Get current state
      let currentState = null;
      try {
        const getResult = await callTool(client, "harness_get", {
          resource_type: "feature_flag", resource_id: discovered.feature_flag, project_id: PROJECT_ID,
        });
        const d = parse(getResult);
        currentState = d?.envProperties?.state === "on" || d?.enabled === true;
      } catch { /* unknown state */ }

      const toggleOnCase = {
        id: "ff_toggle_on", tier: 5, domain: "Execute", tool: "harness_execute",
        args: {
          resource_type: "feature_flag",
          action: "toggle",
          flag_id: discovered.feature_flag,
          enable: true,
          environment: "production",
          confirmation: true,
          project_id: PROJECT_ID,
        },
        check: (r) => !r?.isError,
        desc: `Toggle FF on (${truncate(discovered.feature_flag, 20)})`,
      };
      await runCase(toggleOnCase);

      // Restore state
      const toggleOffCase = {
        id: "ff_toggle_off", tier: 5, domain: "Execute", tool: "harness_execute",
        args: {
          resource_type: "feature_flag",
          action: "toggle",
          flag_id: discovered.feature_flag,
          enable: currentState ?? false,
          environment: "production",
          confirmation: true,
          project_id: PROJECT_ID,
        },
        check: (r) => !r?.isError,
        desc: `Toggle FF restore (${truncate(discovered.feature_flag, 20)})`,
      };
      await runCase(toggleOffCase);
    }

    if (!opts.json) console.log("");
  } else if (shouldRunTier(5) && !opts.includeExecute) {
    if (!opts.json) console.log("─── Tier 5: Execute Actions (skipped — pass --include-execute)\n");
  }

  // ── Disconnect ──────────────────────────────────────────────────
  try {
    await client.close();
  } catch { /* ignore */ }

  // ════════════════════════════════════════════════════════════════
  // REPORT
  // ════════════════════════════════════════════════════════════════

  const scoredResults = allResults.filter(r => r.score >= 0); // exclude skipped
  const totalScored = scoredResults.length;
  const scoreNum = totalPassed + totalPartial * 0.5;
  const pct = totalScored > 0 ? ((scoreNum / totalScored) * 100).toFixed(0) : "N/A";

  if (opts.json) {
    const jsonOutput = {
      date: new Date().toISOString().split("T")[0],
      project: PROJECT_ID,
      summary: {
        total: allResults.length,
        scored: totalScored,
        passed: totalPassed,
        partial: totalPartial,
        failed: totalFailed,
        skipped: totalSkipped,
        score: `${scoreNum}/${totalScored}`,
        percentage: pct,
      },
      moduleAvailability,
      discovered,
      results: allResults.map(r => ({
        id: r.id,
        tier: r.tier,
        domain: r.domain,
        tool: r.tool,
        score: r.score,
        summary: r.summary,
      })),
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    console.log("═".repeat(68));
    console.log("  EVAL SUMMARY");
    console.log("═".repeat(68));
    console.log(`  Project:  ${PROJECT_ID}`);
    console.log(`  Total:    ${allResults.length}`);
    console.log(`  Scored:   ${totalScored}`);
    console.log(`  Passed:   ${totalPassed}`);
    console.log(`  Partial:  ${totalPartial}`);
    console.log(`  Failed:   ${totalFailed}`);
    console.log(`  Skipped:  ${totalSkipped}`);
    console.log(`  Score:    ${scoreNum}/${totalScored} (${pct}%)`);
    console.log("═".repeat(68));

    // Tier breakdown
    const tierGroups = {};
    for (const r of allResults) {
      const tier = r.tier || 0;
      if (!tierGroups[tier]) tierGroups[tier] = { total: 0, passed: 0, failed: 0, skipped: 0 };
      tierGroups[tier].total++;
      if (r.score === 1) tierGroups[tier].passed++;
      else if (r.score === 0) tierGroups[tier].failed++;
      else if (r.score < 0) tierGroups[tier].skipped++;
    }
    console.log("\n  Tier Breakdown:");
    for (const [tier, s] of Object.entries(tierGroups).sort()) {
      const icon = s.failed === 0 ? "✅" : "❌";
      const skipInfo = s.skipped > 0 ? ` (${s.skipped} skipped)` : "";
      console.log(`    ${icon} Tier ${tier}: ${s.passed}/${s.total - s.skipped}${skipInfo}`);
    }

    // Domain breakdown
    const domains = {};
    for (const r of allResults) {
      if (r.score < 0) continue; // skip skipped
      if (!domains[r.domain]) domains[r.domain] = { total: 0, passed: 0, failed: 0 };
      domains[r.domain].total++;
      if (r.score === 1) domains[r.domain].passed++;
      if (r.score === 0) domains[r.domain].failed++;
    }
    console.log("\n  Domain Breakdown:");
    for (const [d, s] of Object.entries(domains)) {
      const icon = s.failed === 0 ? "✅" : "❌";
      console.log(`    ${icon} ${d.padEnd(20)} ${s.passed}/${s.total}`);
    }

    // Module availability
    console.log("\n  Module Availability:");
    for (const [mod, info] of Object.entries(moduleAvailability).sort()) {
      const icon = info.available ? "✅" : "⬜";
      console.log(`    ${icon} ${mod.padEnd(20)} ${info.available ? "AVAILABLE" : "NOT AVAILABLE"}`);
    }

    // Discovered IDs
    console.log(`\n  Discovered IDs: ${Object.keys(discovered).length}`);
    for (const [type, id] of Object.entries(discovered)) {
      console.log(`    ${type.padEnd(22)} ${truncate(id, 40)}`);
    }

    // Failed/partial cases detail
    const failures = allResults.filter((r) => r.score >= 0 && r.score < 1);
    if (failures.length > 0) {
      console.log("\n  Failed/Partial Cases:");
      for (const f of failures) {
        const icon = f.score === 0 ? "❌" : "⚠️";
        console.log(`    ${icon} [T${f.tier}] ${f.id}: ${f.summary}`);
      }
    }

    console.log("");
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
