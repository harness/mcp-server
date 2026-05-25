import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts: Record<string, string>;
};

const root = process.cwd();

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageJson;
}

describe("documentation scripts", () => {
  it("rebuilds TypeScript before generating README counts", () => {
    const { scripts } = readPackageJson();

    expect(scripts["docs:generate"]).toBe("pnpm build && node scripts/generate-docs.js");
  });

  it("rebuilds TypeScript before checking README counts", () => {
    const { scripts } = readPackageJson();

    expect(scripts["docs:check"]).toBe("pnpm build && node scripts/generate-docs.js --check");
  });
});
