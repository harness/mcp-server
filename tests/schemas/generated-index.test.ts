import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readWorkspaceFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("generated schema index", () => {
  it("exports SchemaEntry from the generated file and generator template", () => {
    const generatedIndex = readWorkspaceFile("src/data/schemas/index.ts");
    const generator = readWorkspaceFile("scripts/sync-schemas.js");

    expect(generatedIndex).toContain("export type SchemaEntry");
    expect(generator).toContain("export type SchemaEntry");
  });
});
