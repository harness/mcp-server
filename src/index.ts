#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { loadConfig, type Config } from "./config.js";
import { setLogLevel, createLogger } from "./utils/logger.js";
import { HarnessClient } from "./client/harness-client.js";
import { Registry } from "./registry/index.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";
import { parseArgs } from "./utils/cli.js";

const log = createLogger("main");

/**
 * Create a fully-configured MCP server instance with all tools, resources, and prompts.
 */
function createHarnessServer(config: Config): McpServer {
  const client = new HarnessClient(config);
  const registry = new Registry(config);

  const server = new McpServer(
    {
      name: "harness-mcp-server",
      version: "1.0.0",
      icons: [{ src: "https://app.harness.io/favicon.ico" }],
      websiteUrl: "https://harness.io",
    },
    { capabilities: { logging: {} } },
  );

  registerAllTools(server, registry, client, config);
  registerAllResources(server, registry, client, config);
  registerAllPrompts(server);

  return server;
}

/**
 * Start the server in stdio mode — single persistent connection.
 */
async function startStdio(config: Config): Promise<void> {
  const server = createHarnessServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("harness-mcp-server connected via stdio");
}

/**
 * Start the server in HTTP mode — stateless, one server+transport per POST request.
 * Uses the MCP SDK's Express adapter which provides automatic DNS rebinding protection
 * when bound to localhost (validates Host header against allowed hostnames).
 */
async function startHttp(config: Config, port: number): Promise<void> {
  const host = process.env.HOST || "127.0.0.1";
  const app = createMcpExpressApp({ host });

  const maxBodySize = config.HARNESS_MAX_BODY_SIZE_MB * 1024 * 1024;
  // Override the default express.json() limit to match our config
  const { json } = await import("express");
  app.use(json({ limit: maxBodySize }));

  // Block cross-origin requests — prevents CSRF from malicious websites
  // targeting the MCP server on localhost. Only same-origin requests are allowed.
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", `http://${host}:${port}`);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    next();
  });

  // Simple per-IP rate limiting: 60 requests per minute
  const ipHits = new Map<string, { count: number; resetAt: number }>();
  const RATE_WINDOW_MS = 60_000;
  const RATE_LIMIT = 60;

  app.use((req, res, next) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    let entry = ipHits.get(ip);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
      ipHits.set(ip, entry);
    }
    entry.count++;
    if (entry.count > RATE_LIMIT) {
      res.status(429).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Too many requests. Try again later." },
        id: null,
      });
      return;
    }
    next();
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // MCP endpoint — stateless: fresh server+transport per request
  app.post("/mcp", async (req, res) => {
    let server: McpServer | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    try {
      server = createHarnessServer(config);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on("close", () => {
        transport?.close();
        server?.close();
      });
    } catch (err) {
      log.error("Error handling MCP request", { error: String(err) });
      if (!res.headersSent) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Invalid request" },
          id: null,
        });
      }
      await transport?.close();
      await server?.close();
    }
  });

  // Reject other methods on /mcp
  app.all("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless MCP." },
      id: null,
    });
  });

  // Graceful shutdown
  const httpServer = app.listen(port, host, () => {
    log.info(`harness-mcp-server listening on http://${host}:${port}`);
    log.info(`  POST /mcp    — MCP endpoint (stateless, DNS rebinding protected)`);
    log.info(`  GET  /health — Health check`);
  });

  const shutdown = (): void => {
    log.info("Shutting down HTTP server...");
    httpServer.close(() => {
      log.info("HTTP server closed");
      process.exit(0);
    });
    // Force exit after 5s if connections linger
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  // Global error handlers — must be installed before anything else.
  process.on("unhandledRejection", (reason) => {
    log.error("Unhandled promise rejection", { error: String(reason), stack: (reason as Error)?.stack });
  });
  process.on("uncaughtException", (err) => {
    log.error("Uncaught exception — exiting", { error: err.message, stack: err.stack });
    process.exit(1);
  });

  const config = loadConfig();
  setLogLevel(config.LOG_LEVEL);

  const { transport, port } = parseArgs();

  log.info("Starting harness-mcp-server", {
    transport,
    baseUrl: config.HARNESS_BASE_URL,
    accountId: config.HARNESS_ACCOUNT_ID,
    defaultOrg: config.HARNESS_DEFAULT_ORG_ID,
    defaultProject: config.HARNESS_DEFAULT_PROJECT_ID ?? "(none)",
    toolsets: config.HARNESS_TOOLSETS ?? "(all)",
  });

  if (transport === "stdio") {
    await startStdio(config);
  } else {
    await startHttp(config, port);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
