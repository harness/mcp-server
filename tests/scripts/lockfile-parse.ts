/**
 * Shared lockfile/shrinkwrap version parsing for security pin regression tests.
 */

export function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const unscopedPattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(unscopedPattern)) {
    versions.add(match[1]);
  }

  if (packageName.includes("/")) {
    const scopedPattern = new RegExp(
      `'${packageName.replace("/", "\\/")}@([0-9]+\\.[0-9]+\\.[0-9]+)':`,
      "g",
    );
    for (const match of lockfileText.matchAll(scopedPattern)) {
      versions.add(match[1]);
    }
  }

  return [...versions];
}

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
