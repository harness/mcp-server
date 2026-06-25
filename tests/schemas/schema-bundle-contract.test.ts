import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  SCHEMAS,
  VALID_SCHEMAS,
  V0_SCHEMA_KEYS,
  V1_SCHEMA_KEYS,
} from "../../src/data/schemas/index.js";

const ROOT = join(import.meta.dirname, "../..");

/** Parse `new Set(["a", "b"])` or `["a", "b"]` array literals from build scripts. */
function extractStringSet(source: string, constName: string): Set<string> {
  const setMatch = source.match(
    new RegExp(`const ${constName} = new Set\\(\\[([^\\]]*)\\]\\)`),
  );
  const arrayMatch = source.match(
    new RegExp(`const ${constName} = \\[([^\\]]*)\\]`),
  );
  const raw = setMatch?.[1] ?? arrayMatch?.[1];
  if (raw == null) {
    throw new Error(`Could not find ${constName} in script source`);
  }
  const names = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  return new Set(names);
}

const REMOVED_V1_SCHEMAS = ["trigger", "service", "infra"] as const;
const REMOVED_V1_KEYS = REMOVED_V1_SCHEMAS.map((name) => `${name}_v1`);

describe("schema bundle contract", () => {
  it("keeps sync-schemas.js and check-schema-coverage.js v1 lists aligned", () => {
    const syncScript = readFileSync(join(ROOT, "scripts/sync-schemas.js"), "utf8");
    const coverageScript = readFileSync(join(ROOT, "scripts/check-schema-coverage.js"), "utf8");

    const syncedInSync = extractStringSet(syncScript, "V1_SCHEMAS");
    const syncedInCoverage = extractStringSet(coverageScript, "SYNCED_V1");

    expect(syncedInSync).toEqual(syncedInCoverage);
  });

  it("does not list v1 schemas removed from harness-schema upstream", () => {
    const coverageScript = readFileSync(join(ROOT, "scripts/check-schema-coverage.js"), "utf8");
    const syncedV1 = extractStringSet(coverageScript, "SYNCED_V1");

    for (const name of REMOVED_V1_SCHEMAS) {
      expect(syncedV1.has(name)).toBe(false);
    }
  });

  it("bundles only the expected v1 schema modules on disk", () => {
    const v1Dir = join(ROOT, "src/data/schemas/v1");
    const files = readdirSync(v1Dir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => name.replace(/\.ts$/, ""))
      .sort();

    expect(files).toEqual(["inputSet", "overlayInputSet", "pipeline", "template"]);
  });

  it("exports schema keys that match bundled modules", () => {
    expect(V0_SCHEMA_KEYS.sort()).toEqual(["pipeline", "template", "trigger"]);
    expect(V1_SCHEMA_KEYS.sort()).toEqual([
      "inputSet_v1",
      "overlayInputSet_v1",
      "pipeline_v1",
      "template_v1",
    ]);
    expect(VALID_SCHEMAS.sort()).toEqual(
      [...V0_SCHEMA_KEYS, ...V1_SCHEMA_KEYS, "agent-pipeline"].sort(),
    );
    expect(Object.keys(SCHEMAS).sort()).toEqual(VALID_SCHEMAS.sort());
  });

  it("does not expose removed v1 schema keys in the bundled index", () => {
    for (const key of REMOVED_V1_KEYS) {
      expect(VALID_SCHEMAS).not.toContain(key);
      expect(SCHEMAS).not.toHaveProperty(key);
    }
  });

  it("rewrites v1 pipeline definitions to the public schema key namespace", () => {
    const definitions = SCHEMAS.pipeline_v1.definitions as Record<string, unknown>;
    expect(definitions).toHaveProperty("pipeline_v1");
    expect(definitions).not.toHaveProperty("pipeline");
    expect(SCHEMAS.pipeline_v1.title).toBe("pipeline_v1");
  });

  it("rewrites v1 template definitions to the public schema key namespace", () => {
    const definitions = SCHEMAS.template_v1.definitions as Record<string, unknown>;
    expect(definitions).toHaveProperty("template_v1");
    expect(definitions).not.toHaveProperty("pipeline");
    expect(SCHEMAS.template_v1.title).toBe("template_v1");
  });
});
