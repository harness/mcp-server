import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeTransitiveOverrides,
  isAtLeastVersion,
  parseMinimumOverrideVersion,
} from "../../scripts/npm-shrinkwrap-lib.mjs";

const ROOT = join(import.meta.dirname, "../..");

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, name), "utf8")) as Record<string, unknown>;
}

describe("npm-shrinkwrap-lib", () => {
  it("filters direct dependencies out of pnpm overrides", () => {
    const overrides = computeTransitiveOverrides({
      dependencies: { hono: "^4.12.27", "@hono/node-server": "^2.0.10", "adm-zip": "^0.6.0" },
      optionalDependencies: { "@huggingface/transformers": "^4.2.0" },
      pnpm: {
        overrides: {
          hono: ">=4.12.27",
          "@hono/node-server": ">=2.0.10",
          "adm-zip": ">=0.6.0",
          sharp: ">=0.35.0",
          "fast-uri": ">=3.1.4",
        },
      },
    });

    expect(overrides).toEqual({
      sharp: ">=0.35.0",
      "fast-uri": ">=3.1.4",
    });
    expect(overrides).not.toHaveProperty("hono");
    expect(overrides).not.toHaveProperty("@hono/node-server");
    expect(overrides).not.toHaveProperty("adm-zip");
    expect(overrides).not.toHaveProperty("@huggingface/transformers");
  });

  it("returns empty object when pnpm overrides are absent", () => {
    expect(computeTransitiveOverrides({ dependencies: { hono: "^4.12.27" } })).toEqual({});
  });

  it("parses minimum versions from override ranges", () => {
    expect(parseMinimumOverrideVersion(">=0.35.0")).toBe("0.35.0");
    expect(parseMinimumOverrideVersion("^7.3.5")).toBe("7.3.5");
    expect(parseMinimumOverrideVersion("not-a-version")).toBeNull();
  });

  it("compares semver patch levels for shrinkwrap security floors", () => {
    expect(isAtLeastVersion("0.35.3", "0.35.0")).toBe(true);
    expect(isAtLeastVersion("0.34.5", "0.35.0")).toBe(false);
    expect(isAtLeastVersion("4.12.27", "4.12.27")).toBe(true);
  });
});

describe("npm-shrinkwrap security contract", () => {
  const packageJson = readJson("package.json");
  const shrinkwrap = readJson("npm-shrinkwrap.json") as {
    packages?: Record<string, { version?: string }>;
  };

  it("mirrors transitive-only pnpm overrides for npm consumers", () => {
    const transitiveOverrides = computeTransitiveOverrides(packageJson as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      pnpm?: { overrides?: Record<string, string> };
    });

    expect(transitiveOverrides.sharp).toBe(">=0.35.0");
    expect(transitiveOverrides["fast-uri"]).toBe(">=3.1.4");
    expect(transitiveOverrides).not.toHaveProperty("hono");
  });

  it("ships patched sharp in npm-shrinkwrap (transitive via optional transformers)", () => {
    const sharpVersion = shrinkwrap.packages?.["node_modules/sharp"]?.version;
    const minimum = parseMinimumOverrideVersion(
      (packageJson.pnpm as { overrides?: Record<string, string> })?.overrides?.sharp ?? "",
    );

    expect(sharpVersion).toBeTypeOf("string");
    expect(minimum).toBe("0.35.0");
    expect(isAtLeastVersion(sharpVersion!, minimum!)).toBe(true);
  });

  it("ships secure adm-zip in npm-shrinkwrap", () => {
    const admZipVersion = shrinkwrap.packages?.["node_modules/adm-zip"]?.version;
    expect(admZipVersion).toBe("0.6.0");
  });
});
