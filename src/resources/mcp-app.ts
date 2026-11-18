import { readFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import { MCP_APP_MIME_TYPE, MCP_APP_RESOURCE_URI, mcpAppsEnabled } from "../apps/mcp-apps.js";

const log = createLogger("resource:mcp-app");

/** Written by `pnpm build:apps` (apps/harness-app) next to the compiled server. */
const APP_HTML_URL = new URL("../ui/harness-app.html", import.meta.url);

/** No external origins: the view gets all data through the host's MCP connection. */
const UI_META = { ui: { csp: {}, prefersBorder: false } };

const MISSING_BUILD_HTML =
  "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Harness</title></head>" +
  "<body><!-- Harness view bundle not built. Run pnpm build. --></body></html>";

let cachedHtml: string | undefined;

export function loadAppHtml(url: URL = APP_HTML_URL): string {
  if (cachedHtml !== undefined && url === APP_HTML_URL) return cachedHtml;
  let html: string;
  try {
    html = readFileSync(url, "utf8");
  } catch (err) {
    log.warn("Harness view bundle missing; serving an empty view", { path: url.pathname, error: String(err) });
    html = MISSING_BUILD_HTML;
  }
  if (url === APP_HTML_URL) cachedHtml = html;
  return html;
}

export function registerMcpAppResource(server: McpServer, config: Config): void {
  if (!mcpAppsEnabled(config)) return;

  server.registerResource(
    "harness-app",
    MCP_APP_RESOURCE_URI,
    {
      title: "Harness view",
      description: "Interactive Harness view (pipeline executions, dashboards) for hosts that support MCP Apps.",
      mimeType: MCP_APP_MIME_TYPE,
      _meta: UI_META,
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: MCP_APP_MIME_TYPE,
        text: loadAppHtml(),
        _meta: UI_META,
      }],
    }),
  );
}
