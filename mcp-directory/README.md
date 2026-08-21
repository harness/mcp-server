# MCPB directory bundle files

This directory contains the tracked metadata copied to the root of the Anthropic MCP Directory bundle.
The bundle root also includes `icon.png`, which is the same 512×512 Harness logo tracked at the repository root.

- `manifest.json` follows MCPB manifest spec `0.3`.
- `icon.png` is the bundle icon referenced by the manifest.

Build, validate, and pack the bundle:

```bash
pnpm install --frozen-lockfile
pnpm prepare:mcpb
```

The staging directory at `dist/mcpb/` contains only the files needed at runtime: `manifest.json`, `icon.png`, `server/`, `package.json`, `npm-shrinkwrap.json`, `LICENSE`, and production `node_modules/`. The versioned output is `dist/harness-mcp-server-<version>.mcpb`.

The `Release` GitHub Actions workflow attaches this cross-platform bundle to every `v*.*.*` GitHub Release. Its manual `release_tag` input safely backfills an existing release from that exact tag.
