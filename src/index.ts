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
import { configureElicitation } from "./utils/elicitation.js";

const log = createLogger("main");

const PIPELINE_VERSION_HEADER = "x-harness-pipeline-version";

function parsePipelineVersionHeader(req: import("express").Request): "0" | "1" | undefined {
  const raw = req.headers[PIPELINE_VERSION_HEADER];
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === "0" || s === "1") return s;
  return undefined;
}

function mergeConfigWithPipelineVersion(baseConfig: Config, req: import("express").Request): Config {
  const pv = parsePipelineVersionHeader(req);
  if (pv === undefined) return baseConfig;
  return { ...baseConfig, HARNESS_PIPELINE_VERSION: pv };
}

/**
 * Create a fully-configured MCP server instance with all tools, resources, and prompts.
 */
function createHarnessServer(config: Config): McpServer {
  const client = new HarnessClient(config);
  const registry = new Registry(config);

  const server = new McpServer(
    {
      name: "harness-mcp-server",
      version: "2.0.0",
      icons: [{ src: "https://app.harness.io/favicon.ico" }],
      websiteUrl: "https://harness.io",
    },
    {
      capabilities: { logging: {} },
      instructions: [
        "Harness MCP server — manage CI/CD pipelines, code repos, PRs, services, environments, and more.",
        "",
        "URL SHORTCUT: All harness_ tools accept a `url` parameter. Paste any Harness UI URL and identifiers (org, project, resource type, ID) are auto-extracted. This works for nested resources too — a PR URL auto-extracts repo_id and pr_number.",
        "",
        "COMMON PATTERNS:",
        "• Get PR details: harness_get(url='<Harness PR URL>')",
        "• List PR comments: harness_list(url='<Harness PR URL>', resource_type='pr_comment')",
        "• List PR activity: harness_list(url='<Harness PR URL>', resource_type='pr_activity') — returns all comments, reviews, status changes",
        "• Get pipeline: harness_get(url='<Harness pipeline URL>')",
        "• Run pipeline: harness_execute(url='<Harness pipeline URL>', action='run', inputs={branch: 'main'})",
        "• Diagnose failure: harness_diagnose(url='<Harness execution URL>')",
        "",
        "DISCOVERY: Use harness_describe() to list all resource types, or harness_describe(resource_type='<type>') for operations and fields.",
        "SCHEMA: Use harness_schema(resource_type='<type>') to fetch the exact JSON Schema for create/update body payloads.",
        "",
        "PR RESOURCES: pull_request, pr_comment, pr_activity, pr_reviewer, pr_check — all accept URL or explicit repo_id + pr_number.",
        ...(config.HARNESS_PIPELINE_VERSION === "1"
          ? ["", "PIPELINE VERSION: This account uses v1 pipelines. Use resource_type='pipeline_v1' for all pipeline operations."]
          : ["", "PIPELINE VERSION: This account uses v0 pipelines. Use resource_type='pipeline' for all pipeline operations."]),
      ].join("\n"),
    },
  );

  configureElicitation({ skip: config.HARNESS_SKIP_ELICITATION });
  registerAllTools(server, registry, client, config);
  registerAllResources(server, registry, client, config);
  registerAllPrompts(server);

  return server;
}

/**
 * Write a diagnostic line directly to a log file.
 * Used during disconnect/crash when stderr (console.error) may already be dead
 * because Claude Code closed the pipe.
 */
function logToFile(message: string, data?: Record<string, unknown>): void {
  try {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      module: "stdio-lifecycle",
      msg: message,
      ...data,
    });
    // Try env var first, then fall back to ~/.claude/harness-mcp.log
    const logPath = process.env.HARNESS_MCP_LOG_FILE
      ?? (process.env.HOME ? `${process.env.HOME}/.claude/harness-mcp.log` : undefined);
    if (logPath) {
      // Sync write — process may exit immediately after this
      require("node:fs").appendFileSync(logPath, entry + "\n");
    }
    // Also try stderr in case it's still alive
    console.error(entry);
  } catch {
    // Nothing we can do — both file and stderr are dead
  }
}

/**
 * Start the server in stdio mode — single persistent connection.
 */
async function startStdio(config: Config): Promise<void> {
  const server = createHarnessServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("harness-mcp-server connected via stdio", {
    pid: process.pid,
    node_version: process.version,
    uptime_s: Math.round(process.uptime()),
  });

  // --- Stdio disconnect diagnostics ---
  // Without these handlers, disconnects are completely silent because
  // stderr (where the logger writes) is piped through the same connection
  // that just broke. logToFile writes directly to disk as a fallback.
  let lastActivityTs = Date.now();
  const originalSend = transport.send.bind(transport) as (msg: never) => Promise<void>;
  transport.send = async (msg: never) => {
    lastActivityTs = Date.now();
    return originalSend(msg);
  };

  process.stdin.on("end", () => {
    logToFile("stdin EOF — parent disconnected", {
      idle_ms: Date.now() - lastActivityTs,
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
    });
    process.exit(0);
  });

  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    logToFile("stdout error — pipe broken", {
      code: err.code,
      idle_ms: Date.now() - lastActivityTs,
      uptime_s: Math.round(process.uptime()),
    });
    if (err.code === "EPIPE" || err.code === "ERR_STREAM_DESTROYED") {
      process.exit(0);
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`Received ${signal}, closing stdio transport...`, {
      idle_ms: Date.now() - lastActivityTs,
      uptime_s: Math.round(process.uptime()),
    });
    await transport.close();
    await server.close();
    log.info("Stdio server closed");
    process.exit(0);
  };

  process.on("SIGINT", () => { shutdown("SIGINT"); });
  process.on("SIGTERM", () => { shutdown("SIGTERM"); });
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, x-harness-pipeline-version");
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

  // TTL reaper — evicts idle sessions and expired rate-limit entries
  const reaper = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        log.info("Reaping idle session", { sessionId: id });
        destroySession(id);
      }
    }
    // Evict expired rate-limit entries to prevent unbounded map growth
    for (const [ip, entry] of ipHits) {
      if (now >= entry.resetAt) {
        ipHits.delete(ip);
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
      const sessionConfig = mergeConfigWithPipelineVersion(config, req);
      server = createHarnessServer(sessionConfig);
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

  // Graceful shutdown — drain in-flight requests, then close all sessions
  const httpServer = app.listen(port, host, () => {
    log.info(`harness-mcp-server listening on http://${host}:${port}`);
    log.info(`  POST   /mcp    — MCP endpoint (session-based, DNS rebinding protected)`);
    log.info(`  GET    /mcp    — SSE stream (progress, elicitation)`);
    log.info(`  DELETE /mcp    — Terminate session`);
    log.info(`  GET    /health — Health check`);
  });

  let draining = false;

  const shutdown = (signal: string): void => {
    if (draining) return; // prevent double-shutdown
    draining = true;
    log.info(`Received ${signal}, draining...`);

    // 1. Stop accepting new connections
    httpServer.close(() => {
      log.info("HTTP server closed — no new connections");
    });

    // 2. Reject new requests immediately via middleware
    app.use((_req, res, _next) => {
      res.status(503).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Server is shutting down" },
        id: null,
      });
    });

    // 3. Close all sessions (terminates SSE streams, notifies transports)
    clearInterval(reaper);
    for (const [id] of sessions) {
      destroySession(id);
    }

    // 4. Allow in-flight responses to flush, then exit
    const DRAIN_TIMEOUT_MS = 10_000;
    setTimeout(() => {
      log.warn("Drain timeout — forcing exit");
      process.exit(1);
    }, DRAIN_TIMEOUT_MS).unref();

    // Check periodically if all connections are closed
    const drainCheck = setInterval(() => {
      httpServer.getConnections((err, count) => {
        if (err || count === 0) {
          clearInterval(drainCheck);
          log.info("All connections drained, exiting");
          process.exit(0);
        }
        log.debug("Draining...", { connections: count });
      });
    }, 500);
    drainCheck.unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function main(): Promise<void> {
  // Global error handlers — must be installed before anything else.
  // Node 20+ defaults --unhandled-rejections=throw, so unhandled rejections
  // crash the process. We catch them to log context before exiting.
  process.on("unhandledRejection", (reason) => {
    const data = { error: String(reason), stack: (reason as Error)?.stack };
    log.error("Unhandled promise rejection — exiting", data);
    logToFile("unhandledRejection — exiting", data);
    process.exit(1);
  });
  process.on("uncaughtException", (err) => {
    const data = { error: err.message, stack: err.stack, code: (err as NodeJS.ErrnoException).code };
    log.error("Uncaught exception — exiting", data);
    logToFile("uncaughtException — exiting", data);
    process.exit(1);
  });

  const config = loadConfig();
  setLogLevel(config.LOG_LEVEL);

  const { transport, port } = parseArgs();

  log.info("Starting harness-mcp-server", {
    transport,
    baseUrl: config.HARNESS_BASE_URL,
    accountId: config.HARNESS_ACCOUNT_ID,
    defaultOrg: config.HARNESS_ORG,
    defaultProject: config.HARNESS_PROJECT ?? "(none)",
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
