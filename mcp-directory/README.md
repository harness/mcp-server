# MCPB directory bundle files

This directory contains the tracked metadata copied to the root of the Anthropic MCP Directory bundle.
The bundle root also includes `icon.png`, which is the same Harness logo tracked at the repository root.

- `manifest.json` follows MCPB manifest spec `0.3`.
- `icon.png` is the bundle icon referenced by the manifest.

Build the server before packing, then copy these files to the bundle root alongside `build/`, `package.json`, `LICENSE`, and production `node_modules/`:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm prune --prod
cp mcp-directory/manifest.json manifest.json
# Keep the repository-root icon.png at the bundle root.
```

The packed bundle should contain production dependencies only. If a pnpm-based bundle keeps the virtual store layout, make sure top-level `node_modules` links exist for direct runtime dependencies such as `@hono/node-server` and `hono`.
