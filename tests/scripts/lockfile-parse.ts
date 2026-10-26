import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { expect } from "vitest";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Versions declared on pnpm lock `  pkg@x.y.z:` package lines (unscoped and scoped). */
export function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const escaped = escapeRegExp(packageName);
  const quoted = packageName.includes("/")
    ? `'${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)'`
    : `${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)`;
  const pattern = new RegExp(`^\\s+${quoted}:`, "gm");
  const versions = new Set<string>();
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]!);
  }
  return [...versions];
}

/** Also matches importer spec lines like `express-rate-limit@8.3.2(express@5.2.1):`. */
export function parsePnpmLockPackageVersionsLoose(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const pattern = new RegExp(`${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]!);
  }
  return [...versions];
}

export function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

export function readInstalledPackageVersion(packageRoot: string, packageName: string): string {
  const require = createRequire(join(packageRoot, "package.json"));
  const segments = packageName.startsWith("@") ? packageName.split("/") : [packageName];
  const fallbackPath = join(packageRoot, "node_modules", ...segments, "package.json");

  let packageJsonPath: string;
  try {
    packageJsonPath = require.resolve(`${packageName}/package.json`);
  } catch {
    packageJsonPath = fallbackPath;
  }

  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}
