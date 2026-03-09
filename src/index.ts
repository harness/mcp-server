#!/usr/bin/env node

import { randomUUID } from "node:crypto";
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

// ---------------------------------------------------------------------------
// Session store — maps session IDs to their MCP server + transport instances.
// ---------------------------------------------------------------------------
interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

const SESSION_TTL_MS = 30 * 60_000; // 30 minutes
const REAP_INTERVAL_MS = 60_000;    // check every minute

/**
 * Start the server in HTTP mode — stateful, session-based.
 * Each `initialize` request creates a persistent session (server + transport).
 * Subsequent requests re-use the session via the `mcp-session-id` header.
 * GET /mcp opens an SSE stream for server-initiated messages (progress, elicitation).
 * DELETE /mcp terminates a session.
 * Uses the MCP SDK's Express adapter which provides automatic DNS rebinding protection
 * when bound to localhost (validates Host header against allowed hostnames).
 */
async function startHttp(config: Config, port: number): Promise<void> {
  const host = process.env.HOST || "127.0.0.1";
  const app = createMcpExpressApp({ host });

  const maxBodySize = config.HARNESS_MAX_BODY_SIZE_MB * 1024 * 1024;
  const { json } = await import("express");
  app.use(json({ limit: maxBodySize }));

  // CORS — allow GET, POST, DELETE for session-based MCP
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", `http://${host}:${port}`);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
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

  // ---- Session store ----
  const sessions = new Map<string, Session>();

  function destroySession(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.delete(sessionId);
    session.transport.close().catch(() => {});
    session.server.close().catch(() => {});
    log.info("Session destroyed", { sessionId, remaining: sessions.size });
  }

  // TTL reaper — evicts idle sessions
  const reaper = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        log.info("Reaping idle session", { sessionId: id });
        destroySession(id);
      }
    }
  }, REAP_INTERVAL_MS);
  reaper.unref();

  // ---- Routes ----

  // Health check (includes session count for observability)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sessions: sessions.size });
  });

  // POST /mcp — initialize new sessions or route to existing session
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Existing session — route request to its transport
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found. Send an initialize request to start a new session." },
          id: null,
        });
        return;
      }
      session.lastActivity = Date.now();
      try {
        await session.transport.handleRequest(req, res, req.body);
      } catch (err) {
        log.error("Error handling session request", { sessionId, error: String(err) });
        if (!res.headersSent) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Invalid request" },
            id: null,
          });
        }
      }
      return;
    }

    // No session header — must be an initialize request. Create a new session.
    let server: McpServer | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    try {
      server = createHarnessServer(config);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { server: server!, transport: transport!, lastActivity: Date.now() });
          log.info("Session created", { sessionId: id, total: sessions.size });
        },
      });

      transport.onclose = () => {
        if (transport!.sessionId) {
          destroySession(transport!.sessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log.error("Error initializing session", { error: String(err) });
      if (!res.headersSent) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Invalid request. Send a JSON-RPC initialize message to start a session." },
          id: null,
        });
      }
      await transport?.close();
      await server?.close();
    }
  });

  // GET /mcp — SSE stream for server-initiated messages (progress, elicitation)
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "mcp-session-id header is required. Initialize a session first via POST." },
        id: null,
      });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found. Send an initialize request to start a new session." },
        id: null,
      });
      return;
    }

    session.lastActivity = Date.now();
    try {
      await session.transport.handleRequest(req, res);
    } catch (err) {
      log.error("Error handling SSE request", { sessionId, error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Failed to establish SSE stream" },
          id: null,
        });
      }
    }
  });

  // DELETE /mcp — terminate a session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "mcp-session-id header is required." },
        id: null,
      });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found." },
        id: null,
      });
      return;
    }

    try {
      await session.transport.handleRequest(req, res);
    } catch (err) {
      log.error("Error handling DELETE request", { sessionId, error: String(err) });
    }
    destroySession(sessionId);
  });

  // Graceful shutdown — close all sessions
  const httpServer = app.listen(port, host, () => {
    log.info(`harness-mcp-server listening on http://${host}:${port}`);
    log.info(`  POST   /mcp    — MCP endpoint (session-based, DNS rebinding protected)`);
    log.info(`  GET    /mcp    — SSE stream (progress, elicitation)`);
    log.info(`  DELETE /mcp    — Terminate session`);
    log.info(`  GET    /health — Health check`);
  });

  const shutdown = (): void => {
    log.info("Shutting down HTTP server...");
    clearInterval(reaper);
    for (const [id] of sessions) {
      destroySession(id);
    }
    httpServer.close(() => {
      log.info("HTTP server closed");
      process.exit(0);
    });
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
