#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
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
import { parseArgs, resolvePort, getVersion } from "./utils/cli.js";
import { configureElicitation } from "./utils/elicitation.js";
import { resolveHttpHostValidationOptions } from "./utils/http-hosts.js";
import { createHttpAuthMiddleware, validateHttpAuthForBindHost } from "./utils/http-auth.js";
import { loadEnvFile } from "./utils/env.js";
import { createAuditManager, type AuditManager } from "./audit/index.js";
import { mergeConfigWithSessionHeaders, MissingSessionCredentialsError } from "./utils/session-headers.js";


const log = createLogger("main");

interface HarnessServerResult {
  server: McpServer;
  auditManager: AuditManager;
}

/**
 * Create a fully-configured MCP server instance with all tools, resources, and prompts.
 * @param sharedAuditManager When set (HTTP mode), reuse this manager instead of creating one per session.
 */
function createHarnessServer(config: Config, sharedAuditManager?: AuditManager): HarnessServerResult {
  const auditManager = sharedAuditManager ?? createAuditManager(config);
  const client = new HarnessClient(config);
  const registry = new Registry(config, { auditManager });

  const server = new McpServer(
    {
      name: "harness-mcp-server",
      version: getVersion(),
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
        "DISCOVERY: Use harness_describe() to list all resource types, harness_describe(search_term='...') to find types by keyword, or harness_describe(resource_type='<type>') for operations and fields. Always search before telling the user a capability is unavailable.",
        "SCHEMA: Use harness_schema(resource_type='<type>') to fetch the exact JSON Schema for create/update body payloads.",
        "",
        "ENTITY SELECTION: When the user references an ordinal ('first repo', 'second artifact', 'latest execution'), pick the item at that index from the list response (0 = first, -1 = last). Do NOT substitute a different item or pick by name unless the user asks by name. If the list is empty, say so — never guess an ID.",
        "",
        "PR RESOURCES: pull_request, pr_comment, pr_activity, pr_reviewer, pr_check — all accept URL or explicit repo_id + pr_number.",
        ...(config.HARNESS_PIPELINE_VERSION === "1"
          ? ["", "PIPELINES: Both v0 ('pipeline') and v1 ('pipeline_v1') are available. Default to v1. Use harness_describe for version detection hints."]
          : ["", "PIPELINES: Both v0 ('pipeline') and v1 ('pipeline_v1') are available. Default to v0 unless user explicitly requests v1 or 'agent pipeline'. Use harness_describe for version detection hints."]),
      ].join("\n"),
    },
  );

  configureElicitation({ autoApproveRisk: config.HARNESS_AUTO_APPROVE_RISK as import("./registry/types.js").AutoApproveRisk });
  registerAllTools(server, registry, client, config);
  registerAllResources(server, registry, client, config);
  registerAllPrompts(server);

  return { server, auditManager };
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
      appendFileSync(logPath, entry + "\n");
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
  const { server, auditManager } = createHarnessServer(config);
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
  process.stdin.on("data", () => { lastActivityTs = Date.now(); });

  process.stdin.on("end", () => {
    logToFile("stdin EOF — parent disconnected", {
      idle_ms: Date.now() - lastActivityTs,
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
    });
    auditManager.close().catch(() => {}).finally(() => process.exit(0));
  });

  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    logToFile("stdout error — pipe broken", {
      code: err.code,
      idle_ms: Date.now() - lastActivityTs,
      uptime_s: Math.round(process.uptime()),
    });
    if (err.code === "EPIPE" || err.code === "ERR_STREAM_DESTROYED") {
      auditManager.close().catch(() => {}).finally(() => process.exit(0));
    }
  });

  let keepaliveTimer: ReturnType<typeof setInterval> | undefined;

  const shutdown = async (signal: string): Promise<void> => {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    log.info(`Received ${signal}, closing stdio transport...`, {
      idle_ms: Date.now() - lastActivityTs,
      uptime_s: Math.round(process.uptime()),
    });
    await auditManager.close();
    await transport.close();
    await server.close();
    log.info("Stdio server closed");
    process.exit(0);
  };

  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((err) => {
      logToFile("shutdown failed", { signal: "SIGINT", error: String(err) });
      process.exit(1);
    });
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((err) => {
      logToFile("shutdown failed", { signal: "SIGTERM", error: String(err) });
      process.exit(1);
    });
  });

  // Keepalive check — detect half-dead connections where stdin hasn't sent EOF
  // but the parent process is gone. Exit immediately if reparented to init (ppid 1);
  // otherwise wait for idle timeout + stdin not readable.
  const KEEPALIVE_CHECK_MS = 30_000;
  const KEEPALIVE_TIMEOUT_MS = 5 * 60_000;
  keepaliveTimer = setInterval(() => {
    const idleMs = Date.now() - lastActivityTs;
    const reparented = process.ppid === 1;
    const stdinDead = !process.stdin.readable;

    if (reparented || (idleMs > KEEPALIVE_TIMEOUT_MS && stdinDead)) {
      logToFile("parent gone — exiting", {
        idle_ms: idleMs,
        reparented,
        stdin_readable: process.stdin.readable,
        uptime_s: Math.round(process.uptime()),
      });
      auditManager.close().catch(() => {}).finally(() => process.exit(0));
    }
  }, KEEPALIVE_CHECK_MS);
  keepaliveTimer.unref();
}

// ---------------------------------------------------------------------------
// Session store — maps session IDs to their MCP server + transport instances.
// ---------------------------------------------------------------------------
interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

const REAP_INTERVAL_MS = 60_000; // check every minute

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

  validateHttpAuthForBindHost(host, config);

  const app = createMcpExpressApp(resolveHttpHostValidationOptions(host, config));

  // CORS — allow GET, POST, DELETE for session-based MCP
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", `http://${host}:${port}`);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, mcp-session-id, x-harness-api-key, x-harness-account-id, x-harness-org, x-harness-project, x-harness-pipeline-version, x-harness-auto-approve-risk");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
    next();
  });

  // Auth gate before body parsing — reject unauthenticated requests without allocating body memory
  app.use(createHttpAuthMiddleware(config.HARNESS_MCP_AUTH_TOKEN));

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

  const maxBodySize = config.HARNESS_MAX_BODY_SIZE_MB * 1024 * 1024;
  const { json } = await import("express");
  app.use(json({ limit: maxBodySize }));

  // ---- Session store ----
  const sessions = new Map<string, Session>();
  const sharedAuditManager = createAuditManager(config);

  async function destroySession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.delete(sessionId);
    await session.transport.close().catch(() => {});
    await session.server.close().catch(() => {});
    log.info("Session destroyed", { sessionId, remaining: sessions.size });
  }

  // TTL reaper — evicts idle sessions and expired rate-limit entries
  const reaper = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > config.MCP_SESSION_TTL_MS) {
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
      const sessionConfig = mergeConfigWithSessionHeaders(config, req.headers);
      const result = createHarnessServer(sessionConfig, sharedAuditManager);
      server = result.server;
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
      if (err instanceof MissingSessionCredentialsError) {
        log.warn("Session rejected — missing credentials", { error: err.message });
        if (!res.headersSent) {
          res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: err.message },
            id: null,
          });
        }
        return;
      }
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

  const shutdown = async (signal: string): Promise<void> => {
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
    await Promise.allSettled(
      [...sessions.keys()].map((id) => destroySession(id)),
    );
    await sharedAuditManager.close().catch(() => {});

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
  // Parse CLI args first to get env file path
  const { transport, envFile } = parseArgs();

  // Load .env file (custom path if specified, otherwise .env in current directory)
  loadEnvFile(envFile);

  // Resolve the HTTP port after dotenv is loaded so --env-file PORT is honored.
  const port = resolvePort();

  // Global error handlers for runtime errors.
  // Node 20+ defaults --unhandled-rejections=throw, so unhandled rejections
  // crash the process. We catch them to log context before exiting.
  // Note: CLI parsing and .env loading happen before these handlers are installed,
  // which is intentional — CLI errors should fail fast.
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

  if (config.HARNESS_MCP_MODE === "multi-user" && transport === "stdio") {
    throw new Error(
      "Multi-user mode is only supported with HTTP transport. " +
      "Use --transport http or set HARNESS_MCP_MODE=single-user for stdio.",
    );
  }

  log.info("Starting harness-mcp-server", {
    transport,
    mode: config.HARNESS_MCP_MODE,
    baseUrl: config.HARNESS_BASE_URL,
    accountId: config.HARNESS_ACCOUNT_ID || "(per-session)",
    defaultOrg: config.HARNESS_ORG ?? "(none)",
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
