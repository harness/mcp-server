/**
 * Long-term maintainability guardrails for the Resource-as-Code (`src/code-engine/`)
 * and Code Mode (`src/code-mode/`) architecture.
 *
 * Runs automatically as part of `pnpm standards:check`.
 *
 * Enforces:
 *  1. Every `ResourceDefinition.codeSpec` is 100% pure JSON-serializable data (no closures/functions).
 *  2. Every `codeSpec.format` is backed by a registered `CodeCodec` in `CODEC_REGISTRY`.
 *  3. Every `codeSpec.schemaRef` points to an actually registered schema in `SCHEMAS` or `LIVE_ENTITY_SCHEMAS`
 *     (prevents silent drift when schemas are renamed or re-synced).
 *  4. Every `codeSpec.validateAction` references an existing `executeActions` entry on the same resource
 *     with `operationPolicy.risk === "read"`.
 *  5. Every writable `codeSpec` resource with `operations.update` also defines `operations.get` with
 *     symmetric scope configuration.
 *  6. `src/code-engine/` and `src/code-mode/` never write to stdout, never call raw `fetch()`, and never
 *     instantiate `HarnessClient` or call `client.request()` directly (all I/O routes through `Registry.dispatch`).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CODEC_REGISTRY, resolveEffectiveCodeSpec } from "../../src/code-engine/index.js";
import { SCHEMAS } from "../../src/data/schemas/index.js";
import { ALL_TOOLSET_NAMES, Registry } from "../../src/registry/index.js";
import { LIVE_ENTITY_SCHEMAS } from "../../src/tools/entity-schema/live.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODE_ENGINE_DIR = join(REPO_ROOT, "src/code-engine");
const CODE_MODE_DIR = join(REPO_ROOT, "src/code-mode");

const ALL_ENABLED_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
  HARNESS_TOOLSETS: ALL_TOOLSET_NAMES.map((name) => `+${name}`).join(","),
} as const;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function assertPureJsonValue(value: unknown, path: string, violations: string[]): void {
  if (value === null || value === undefined) return;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return;
  if (t === "function" || t === "symbol" || t === "bigint") {
    violations.push(`${path}: non-JSON type "${t}" (codeSpec must be pure serializable data)`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertPureJsonValue(item, `${path}[${idx}]`, violations));
    return;
  }
  if (t === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      violations.push(`${path}: non-plain object prototype`);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertPureJsonValue(v, `${path}.${k}`, violations);
    }
  }
}

describe("Coding standards — Resource-as-Code & Code Mode maintainability contracts", () => {
  const registry = new Registry(ALL_ENABLED_CONFIG as never);
  const allTypes = registry.getAllResourceTypes();

  it("every explicit and auto-inferred codeSpec is pure JSON data backed by a registered CodeCodec", () => {
    const violations: string[] = [];

    for (const rt of allTypes) {
      const def = registry.getResource(rt);
      if (def.codeSpec) {
        assertPureJsonValue(def.codeSpec, `${rt}.codeSpec`, violations);
      }
      const effective = resolveEffectiveCodeSpec(def);
      assertPureJsonValue(effective, `${rt}.effectiveCodeSpec`, violations);

      if (!CODEC_REGISTRY.has(effective.format)) {
        violations.push(`${rt}: format "${effective.format}" has no registered CodeCodec`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every codeSpec.schemaRef points to a valid bundled or live-entity schema key", () => {
    const violations: string[] = [];

    for (const rt of allTypes) {
      const def = registry.getResource(rt);
      const effective = resolveEffectiveCodeSpec(def);
      if (!effective.schemaRef) continue;

      if (effective.schemaRef.kind === "bundled" && !(effective.schemaRef.key in SCHEMAS)) {
        violations.push(`${rt}: schemaRef bundled key "${effective.schemaRef.key}" is missing from SCHEMAS`);
      }
      if (effective.schemaRef.kind === "live_bundled" && !(effective.schemaRef.key in LIVE_ENTITY_SCHEMAS)) {
        violations.push(`${rt}: schemaRef live_bundled key "${effective.schemaRef.key}" is missing from LIVE_ENTITY_SCHEMAS`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every codeSpec.validateAction references an existing read-risk executeAction on the same resource", () => {
    const violations: string[] = [];

    for (const rt of allTypes) {
      const def = registry.getResource(rt);
      const action = def.codeSpec?.validateAction;
      if (!action) continue;

      const spec = def.executeActions?.[action];
      if (!spec) {
        violations.push(`${rt}: codeSpec.validateAction "${action}" does not exist in executeActions`);
      } else if (spec.operationPolicy.risk !== "read") {
        violations.push(`${rt}: codeSpec.validateAction "${action}" must have risk: "read", found "${spec.operationPolicy.risk}"`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every resource with explicit writable codeSpec defines both get and update with symmetric scope", () => {
    const violations: string[] = [];

    for (const rt of allTypes) {
      const def = registry.getResource(rt);
      if (!def.codeSpec) continue;
      const codec = CODEC_REGISTRY.get(def.codeSpec.format);
      if (!codec?.supportsWrite) {
        if (!def.operations.get) {
          violations.push(`${rt}: read-only codeSpec requires operations.get`);
        }
        continue;
      }
      if (!def.operations.get) {
        violations.push(`${rt}: writable codeSpec requires operations.get`);
      }
      if (def.codeSpec.writeShape && !def.operations.update) {
        violations.push(`${rt}: codeSpec with writeShape requires operations.update`);
      }
      if (def.operations.get && def.operations.update) {
        const getScope = def.operations.get.scope ?? def.scope;
        const updateScope = def.operations.update.scope ?? def.scope;
        if (getScope !== updateScope) {
          violations.push(`${rt}: scope mismatch between get (${getScope}) and update (${updateScope})`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("code-engine and code-mode modules preserve transport, client singleton, and dispatch boundaries", () => {
    const violations: string[] = [];
    const files = [...walkTsFiles(CODE_ENGINE_DIR), ...walkTsFiles(CODE_MODE_DIR)];

    for (const file of files) {
      const relPath = relative(REPO_ROOT, file).replace(/\\/g, "/");
      const src = readFileSync(file, "utf8");

      if (/\bconsole\.log\s*\(/.test(src)) {
        violations.push(`${relPath}: console.log() forbidden (corrupts stdio JSON-RPC)`);
      }
      if (/\bawait fetch\s*\(|\breturn fetch\s*\(/.test(src)) {
        violations.push(`${relPath}: raw fetch() forbidden`);
      }
      if (/new\s+HarnessClient\s*\(/.test(src)) {
        violations.push(`${relPath}: new HarnessClient() forbidden`);
      }
      if (/client\.request\s*[<(]/.test(src)) {
        violations.push(`${relPath}: direct client.request() forbidden (use registry.dispatch)`);
      }
      if (/from\s+["']@modelcontextprotocol\/server/.test(src)) {
        violations.push(`${relPath}: code-engine/code-mode must stay transport-agnostic (no McpServer import)`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
