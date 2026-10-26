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

/** Read a top-level shrinkwrap package version (npm v7+ lockfile layout). */
export function parseNpmShrinkwrapPackageVersion(
  shrinkwrapText: string,
  packageName: string,
): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}
