/**
 * Ensures every pnpm.overrides security floor has a dedicated pin regression suite.
 * When adding a new override on the security branch, extend one of the grouped lists below.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Packages asserted in tests/scripts/cve-dependency-pins.test.ts */
const CVE_PIN_PACKAGES = ["body-parser", "zod", "fast-uri", "ip-address"] as const;

/** Packages asserted in tests/scripts/http-framework-security-pins.test.ts */
const HTTP_FRAMEWORK_PIN_PACKAGES = ["hono", "@hono/node-server", "vite"] as const;

/** Packages asserted in tests/scripts/additional-pnpm-security-pins.test.ts */
const ADDITIONAL_PIN_PACKAGES = [
  "picomatch",
  "path-to-regexp",
  "express-rate-limit",
  "nanoid",
  "esbuild",
  "postcss",
  "source-map-js",
  "sharp",
  "protobufjs",
  "@opentelemetry/core",
  "qs",
  "proxy-addr",
] as const;

/** Patched in tests/scripts/adm-zip-security-lib.test.ts */
const ADM_ZIP_PIN_PACKAGES = ["adm-zip"] as const;

const PIN_SUITE_PACKAGES = new Set<string>([
  ...CVE_PIN_PACKAGES,
  ...HTTP_FRAMEWORK_PIN_PACKAGES,
  ...ADDITIONAL_PIN_PACKAGES,
  ...ADM_ZIP_PIN_PACKAGES,
]);

describe("pnpm security overrides catalog", () => {
  it("lists every package.json pnpm.overrides key in a pin regression suite", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    const overrideKeys = Object.keys(packageJson.pnpm.overrides).sort();
    expect(overrideKeys.length).toBeGreaterThan(0);

    const missing = overrideKeys.filter((name) => !PIN_SUITE_PACKAGES.has(name));
    expect(
      missing,
      `add ${missing.join(", ")} to a pin suite (cve, http-framework, additional, or adm-zip tests)`,
    ).toEqual([]);

    const orphans = [...PIN_SUITE_PACKAGES].filter((name) => !overrideKeys.includes(name));
    expect(
      orphans,
      `remove stale pin-suite entries or restore pnpm.overrides: ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});
