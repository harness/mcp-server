import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parse resolved package versions from pnpm-lock.yaml package keys.
 * Handles unquoted names, quoted scoped packages, and peer-dependency suffixes.
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();

  const unquoted = new RegExp(
    `^\\s+${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(unquoted)) {
    versions.add(match[1]!);
  }

  const quotedScoped = new RegExp(
    `^\\s+'${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?'?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(quotedScoped)) {
    versions.add(match[1]!);
  }

  return [...versions];
}

/**
 * Read a package version from node_modules, including transitive-only pnpm virtual-store installs.
 */
export function readInstalledPackageVersion(packageRoot: string, packageName: string): string | null {
  const directManifest = join(packageRoot, "node_modules", packageName, "package.json");
  if (existsSync(directManifest)) {
    const version = JSON.parse(readFileSync(directManifest, "utf8")).version;
    return typeof version === "string" && version.length > 0 ? version : null;
  }

  const pnpmDir = join(packageRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) {
    return null;
  }

  const prefix = `${packageName}@`;
  for (const entry of readdirSync(pnpmDir)) {
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const nestedManifest = join(pnpmDir, entry, "node_modules", packageName, "package.json");
    if (!existsSync(nestedManifest)) {
      continue;
    }
    const version = JSON.parse(readFileSync(nestedManifest, "utf8")).version;
    if (typeof version === "string" && version.length > 0) {
      return version;
    }
  }

  return null;
}
