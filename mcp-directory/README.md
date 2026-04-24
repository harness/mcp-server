# MCPB directory bundle files

This directory contains the tracked metadata copied to the root of the Anthropic MCP Directory bundle.
The bundle root also includes `icon.png`, which is the same Harness logo tracked at the repository root.

- `manifest.json` follows MCPB manifest spec `0.3`.
- `icon.png` is the bundle icon referenced by the manifest.

Build the staging directory before packing:

```bash
pnpm install --frozen-lockfile
pnpm prepare:mcpb
```

Pack `dist/mcpb/`, not the repository root. The staging directory contains only the files needed at runtime: `manifest.json`, `icon.png`, `build/`, `package.json`, `LICENSE`, and production `node_modules/` installed with npm's flat layout.