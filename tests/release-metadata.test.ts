import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MCPB_CLI_PACKAGE,
  assetNameForVersion,
  bundlePackageJson,
  normalizeBundleManifest,
} from "../scripts/prepare-mcpb.js";

const root = process.cwd();

interface BundleManifest {
  version: string;
  server: {
    entry_point: string;
    mcp_config: {
      args: string[];
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

    expect(packageJson.version).toBe("3.2.23");
    expect(rootManifest.version).toBe(packageJson.version);
    expect(directoryManifest.version).toBe(packageJson.version);
  });

  it("uses a relocatable server entry point in packaged manifests", () => {
    for (const manifest of [readJson("manifest.json"), readJson("mcp-directory/manifest.json")]) {
      expect(manifest.server.entry_point).toBe("server/index.js");
      expect(manifest.server.mcp_config.args).toEqual([
        "${__dirname}/server/index.js",
        "stdio",
      ]);
    }
  });

  it("keeps bundle naming stable and can normalize legacy release manifests", () => {
    const legacyManifest = readJson("mcp-directory/manifest.json");
    legacyManifest.server.entry_point = "build/index.js";
    legacyManifest.server.mcp_config.args[0] = "${__dirname}/build/index.js";

    expect(assetNameForVersion("3.2.23")).toBe("harness-mcp-server-3.2.23.mcpb");
    expect(MCPB_CLI_PACKAGE).toBe("@anthropic-ai/mcpb@2.1.2");
    expect(normalizeBundleManifest(legacyManifest, "3.2.23").server).toMatchObject({
      entry_point: "server/index.js",
      mcp_config: { args: ["${__dirname}/server/index.js", "stdio"] },
    });
  });

  it("creates an npm-ci-compatible production package manifest", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const bundled = bundlePackageJson(packageJson);

    expect(bundled).not.toHaveProperty("devDependencies");
    expect(bundled).not.toHaveProperty("scripts");
    expect(bundled.dependencies).toEqual(packageJson.dependencies);
    expect(bundled.optionalDependencies).toEqual(packageJson.optionalDependencies);
    expect(bundled.overrides.sharp).toBe(packageJson.pnpm.overrides.sharp);
    expect(bundled.overrides).not.toHaveProperty("hono");
  });

  it("ships matching 512×512 directory icons", () => {
    const icons = [readFileSync(join(root, "icon.png")), readFileSync(join(root, "mcp-directory/icon.png"))];

    for (const icon of icons) {
      expect(icon.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(icon.readUInt32BE(16)).toBe(512);
      expect(icon.readUInt32BE(20)).toBe(512);
    }
    expect(icons[0].equals(icons[1])).toBe(true);
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
        default: "1800000",
        required: false,
        sensitive: false,
      });
    }
  });
});
