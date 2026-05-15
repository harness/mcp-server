import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8");

describe("release workflow", () => {
  it("does not fail when the package version is already published", () => {
    expect(workflow).toContain('npm view "$PKG_NAME@$PKG_VERSION" version');
    expect(workflow).toContain("Package $PKG_NAME@$PKG_VERSION already exists on npm; skipping publish.");
    expect(workflow).toContain("npm publish failed; rechecking npm in case another run published first.");
  });

  it("does not fail when the GitHub release already exists", () => {
    expect(workflow).toContain('gh release view "$GITHUB_REF_NAME"');
    expect(workflow).toContain("GitHub release $GITHUB_REF_NAME already exists; skipping create.");
  });
});
