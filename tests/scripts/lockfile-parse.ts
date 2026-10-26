/**
 * Shared lockfile/shrinkwrap parsers for security pin regression tests.
 */

export function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const escaped = packageName.replace("/", "\\/");
  const patterns = [
    new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm"),
    new RegExp(`^\\s+'${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)':`, "gm"),
  ];
  for (const pattern of patterns) {
    for (const match of lockfileText.matchAll(pattern)) {
      versions.add(match[1]!);
    }
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
