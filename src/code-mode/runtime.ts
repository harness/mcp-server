/**
 * Client- / Gateway-side MCP "Code Mode" Sandbox Runtime (`src/code-mode/runtime.ts`).
 *
 * Note on MCP Protocol Architecture:
 *  - "Code Mode" (programmatic tool calling) is a host/client orchestration pattern,
 *    NOT a wire primitive of the MCP specification.
 *  - This module executes agent-authored JavaScript inside a locked-down `node:vm`
 *    context with only typed `mcp.*` tool bindings (`list`, `get`, `create`, `update`,
 *    `delete`, `execute`, `describe`, `schema`, `search`, `diagnose`, `status`) and
 *    deterministic `YAML` helpers exposed.
 *  - Intermediate tool responses stay inside sandbox memory; ONLY the bounded JSON
 *    return value (capped by `maxReturnBytes`) enters model context, with telemetry
 *    recording `wireBytesConsumed` vs `modelVisibleBytes` to quantify context savings
 *    for multi-resource edits and HQL query authoring loops.
 */

import vm from "node:vm";
import YAML from "yaml";

export interface McpToolInvoker {
  callTool(name: string, args: Record<string, unknown>): Promise<{
    isError?: boolean;
    structuredContent?: unknown;
    content?: Array<{ type: string; text?: string }>;
  }>;
}

export interface CodeModeExecutionOptions {
  /** Wall-clock timeout in milliseconds (default 5000ms). */
  timeoutMs?: number;
  /** Maximum serialized bytes allowed back into model context (default 16384B). */
  maxReturnBytes?: number;
  /** Maximum MCP tool invocations allowed inside a single script (default 50). */
  maxToolCalls?: number;
}

export interface CodeModeExecutionMetrics {
  toolCalls: number;
  toolNames: string[];
  /** Total bytes returned by MCP tools into the sandbox (kept out of LLM context). */
  sandboxConsumedBytes: number;
  /** Serialized bytes actually returned to the LLM context. */
  modelVisibleBytes: number;
  durationMs: number;
}

export interface CodeModeExecutionResult<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
  metrics: CodeModeExecutionMetrics;
}

function parseToolPayload(res: Awaited<ReturnType<McpToolInvoker["callTool"]>>): {
  parsed: unknown;
  rawBytes: number;
} {
  const text = (res.content ?? [])
    .map((c) => (typeof c.text === "string" ? c.text : ""))
    .join("");
  const rawBytes = Buffer.byteLength(text, "utf8");
  if (res.isError) {
    throw new Error(text || "MCP tool returned error");
  }
  if (res.structuredContent !== undefined) {
    return { parsed: structuredClone(res.structuredContent), rawBytes };
  }
  if (!text) return { parsed: null, rawBytes: 0 };
  try {
    return { parsed: JSON.parse(text) as unknown, rawBytes };
  } catch {
    return { parsed: text, rawBytes };
  }
}

/**
 * Execute an async JavaScript body (`async ({ harness, YAML }) => { ... }`) against
 * an `McpToolInvoker`, isolating intermediate MCP responses from model context.
 */
export async function executeInCodeMode<T = unknown>(
  invoker: McpToolInvoker,
  codeBody: string,
  options?: CodeModeExecutionOptions,
): Promise<CodeModeExecutionResult<T>> {
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const maxReturnBytes = options?.maxReturnBytes ?? 16_384;
  const maxToolCalls = options?.maxToolCalls ?? 50;
  const start = Date.now();

  let toolCalls = 0;
  const toolNames: string[] = [];
  let sandboxConsumedBytes = 0;

  const invoke = async (toolName: string, args: Record<string, unknown> = {}): Promise<unknown> => {
    if (toolCalls >= maxToolCalls) {
      throw new Error(`Code Mode call budget exceeded (max ${maxToolCalls} tool calls).`);
    }
    toolCalls++;
    toolNames.push(toolName);
    const raw = await invoker.callTool(toolName, args);
    const { parsed, rawBytes } = parseToolPayload(raw);
    sandboxConsumedBytes += rawBytes;
    return parsed;
  };

  const harnessApi = Object.freeze({
    list: (args: Record<string, unknown>) => invoke("harness_list", args),
    get: (args: Record<string, unknown>) => invoke("harness_get", args),
    create: (args: Record<string, unknown>) => invoke("harness_create", args),
    update: (args: Record<string, unknown>) => invoke("harness_update", args),
    delete: (args: Record<string, unknown>) => invoke("harness_delete", args),
    execute: (args: Record<string, unknown>) => invoke("harness_execute", args),
    describe: (args: Record<string, unknown> = {}) => invoke("harness_describe", args),
    schema: (args: Record<string, unknown>) => invoke("harness_schema", args),
    search: (args: Record<string, unknown>) => invoke("harness_search", args),
    diagnose: (args: Record<string, unknown>) => invoke("harness_diagnose", args),
    status: (args: Record<string, unknown> = {}) => invoke("harness_status", args),
  });

  const yamlHelpers = Object.freeze({
    parse: (s: string) => YAML.parse(s),
    parseDocument: (s: string) => YAML.parseDocument(s, { keepSourceTokens: true }),
    stringify: (v: unknown) => YAML.stringify(v),
  });

  // Null-prototype sandbox: no process, no fs, no network, no timers, no require/import
  const sandbox = Object.create(null) as Record<string, unknown>;
  sandbox.Object = Object;
  sandbox.Array = Array;
  sandbox.String = String;
  sandbox.Number = Number;
  sandbox.Boolean = Boolean;
  sandbox.Math = Math;
  sandbox.Date = Date;
  sandbox.RegExp = RegExp;
  sandbox.JSON = JSON;
  sandbox.Map = Map;
  sandbox.Set = Set;
  sandbox.Promise = Promise;
  sandbox.Error = Error;
  sandbox.__ctx = Object.freeze({ harness: harnessApi, YAML: yamlHelpers });

  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });

  const wrappedSource = `(async ({ harness, YAML }) => {\n${codeBody}\n})(__ctx)`;

  try {
    const script = new vm.Script(wrappedSource, { filename: "code-mode-sandbox.mjs" });
    const promise = script.runInContext(context, { timeout: timeoutMs }) as Promise<unknown>;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const rawOut = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Code Mode async timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });

    const serialized = JSON.stringify(rawOut ?? null);
    const modelVisibleBytes = Buffer.byteLength(serialized, "utf8");
    if (modelVisibleBytes > maxReturnBytes) {
      return {
        ok: false,
        error: `Code Mode return value (${modelVisibleBytes}B) exceeds maxReturnBytes (${maxReturnBytes}B). Return a compact summary/diff instead of raw documents.`,
        metrics: {
          toolCalls,
          toolNames,
          sandboxConsumedBytes,
          modelVisibleBytes: 0,
          durationMs: Date.now() - start,
        },
      };
    }

    return {
      ok: true,
      result: JSON.parse(serialized) as T,
      metrics: {
        toolCalls,
        toolNames,
        sandboxConsumedBytes,
        modelVisibleBytes,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    // Sanitize error message length so raw documents inside thrown errors cannot leak into LLM context
    const rawMsg = err instanceof Error ? err.message : String(err);
    const boundedMsg = rawMsg.length > 500 ? `${rawMsg.slice(0, 500)}… (truncated)` : rawMsg;
    return {
      ok: false,
      error: boundedMsg,
      metrics: {
        toolCalls,
        toolNames,
        sandboxConsumedBytes,
        modelVisibleBytes: Buffer.byteLength(boundedMsg, "utf8"),
        durationMs: Date.now() - start,
      },
    };
  }
}
