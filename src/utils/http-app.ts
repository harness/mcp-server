import express, { type Express } from "express";
import { hostHeaderValidation, localhostHostValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import { createLogger } from "./logger.js";

const log = createLogger("http-app");
const LOCALHOST_BIND_HOSTS = ["127.0.0.1", "localhost", "::1"];

interface McpExpressHostOptions {
  host?: string;
  allowedHosts?: string[];
}

/**
 * Create an Express app with the MCP SDK's host-header protection, but without
 * the SDK factory's default 100 KB JSON parser. HTTP mode installs auth and the
 * configured body parser later so large valid MCP payloads honor server config.
 */
export function createHarnessHttpExpressApp(options: McpExpressHostOptions = {}): Express {
  const { host = "127.0.0.1", allowedHosts } = options;
  const app = express();

  if (allowedHosts) {
    app.use(hostHeaderValidation(allowedHosts));
  } else if (LOCALHOST_BIND_HOSTS.includes(host)) {
    app.use(localhostHostValidation());
  } else if (host === "0.0.0.0" || host === "::") {
    log.warn(
      `Server is binding to ${host} without DNS rebinding protection. ` +
      "Consider using HARNESS_MCP_ALLOWED_HOSTS to restrict allowed hosts, " +
      "or use authentication to protect your server.",
    );
  }

  return app;
}
