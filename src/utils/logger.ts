/**
 * stderr-only structured logger.
 * CRITICAL: Never write to stdout — it's reserved for JSON-RPC in stdio transport.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let globalLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export interface Logger {
  debug: (msg: string, data?: Record<string, unknown>) => void;
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
}

export interface AuditEntry {
  operation: string;
  resource_type: string;
  resource_id?: string;
  action?: string;
  org_id?: string;
  project_id?: string;
  outcome: "success" | "error";
  error?: string;
}

const auditLogger = {
  _log: null as Logger | null,
  get(): Logger {
    if (!this._log) this._log = createLogger("audit");
    return this._log;
  },
};

export function logAudit(entry: AuditEntry): void {
  const { outcome, error, ...rest } = entry;
  const data: Record<string, unknown> = { ...rest, outcome };
  if (error) data.error = error;
  if (outcome === "error") {
    auditLogger.get().warn("audit", data);
  } else {
    auditLogger.get().info("audit", data);
  }
}

export function createLogger(module: string): Logger {
  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[globalLevel]) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      module,
      msg: message,
      ...data,
    };

    console.error(JSON.stringify(entry));
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
  };
}
