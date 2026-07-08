import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

interface BundleManifest {
  version: string;
  server: {
    mcp_config: {
      env: Record<string, string>;
    };
  };
  user_config: Record<string, { default?: string; sensitive?: boolean; required?: boolean }>;
}

function readJson(path: string): BundleManifest {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as BundleManifest;
}

describe("release metadata", () => {
  it("keeps package and bundle manifest versions in sync for the next release", () => {
    const packageJson = readJson("package.json");
    const rootManifest = readJson("manifest.json");
    const directoryManifest = readJson("mcp-directory/manifest.json");

    expect(packageJson.version).toBe("3.2.9");
    expect(rootManifest.version).toBe(packageJson.version);
    expect(directoryManifest.version).toBe(packageJson.version);
  });

  it("exposes FME config in packaged manifests", () => {
    for (const manifest of [readJson("manifest.json"), readJson("mcp-directory/manifest.json")]) {
      expect(manifest.server.mcp_config.env.HARNESS_FME_API_KEY).toBe("${user_config.HARNESS_FME_API_KEY}");
      expect(manifest.user_config.HARNESS_FME_API_KEY).toMatchObject({
        required: false,
        sensitive: true,
      });
      expect(manifest.server.mcp_config.env.HARNESS_FME_BASE_URL).toBe(
        "${user_config.HARNESS_FME_BASE_URL}",
      );
      expect(manifest.user_config.HARNESS_FME_BASE_URL).toMatchObject({
        default: "https://api.split.io",
        required: false,
        sensitive: false,
      });
    }
  });

  it("exposes HTTP session TTL config in packaged manifests", () => {
    for (const manifest of [readJson("manifest.json"), readJson("mcp-directory/manifest.json")]) {
      expect(manifest.server.mcp_config.env.MCP_SESSION_TTL_MS).toBe("${user_config.MCP_SESSION_TTL_MS}");
      expect(manifest.user_config.MCP_SESSION_TTL_MS).toMatchObject({
        default: "300000",
        required: false,
        sensitive: false,
      });
    }
  });
});
