/**
 * SVG → PNG conversion via @resvg/resvg-js.
 *
 * MCP clients (Cursor, Claude Desktop) reject image/svg+xml — only raster
 * formats are supported. This converts our SVG strings to PNG buffers.
 *
 * Rendering runs in a child process so a native resvg panic (SIGSEGV) cannot
 * kill the MCP server. JS-level failures are surfaced as catchable errors.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface RenderPngOptions {
  /** Scale factor for higher DPI output. Default 2 (retina). */
  scale?: number;
}

const RENDER_TIMEOUT_MS = 30_000;

// Resolved once per module load — the path never changes at runtime.
let _childScriptPath: string | undefined;

function resolveChildScript(): string {
  if (_childScriptPath) return _childScriptPath;

  const dir = path.dirname(fileURLToPath(import.meta.url));
  const adjacent = path.join(dir, "render-png-child.js");
  if (existsSync(adjacent)) {
    _childScriptPath = adjacent;
    return _childScriptPath;
  }

  // Vitest loads parent from src/ but the child entry is compiled under build/.
  const packageRoot = path.resolve(dir, "../../..");
  const buildScript = path.join(packageRoot, "build/utils/svg/render-png-child.js");
  if (existsSync(buildScript)) {
    _childScriptPath = buildScript;
    return _childScriptPath;
  }

  throw new Error("render-png-child.js not found. Run pnpm build before rendering SVG.");
}

const SVG_WIDTH_RE = /\bwidth="([^"]+)"/i;
const SVG_HEIGHT_RE = /\bheight="([^"]+)"/i;

/** Reject obviously invalid SVG before spawning the native renderer. */
export function validateSvgInput(svgString: string): void {
  const trimmed = svgString.trim();
  if (!trimmed) {
    throw new Error("SVG input is empty");
  }
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error("SVG input missing <svg> root element");
  }

  for (const [attr, re] of [["width", SVG_WIDTH_RE], ["height", SVG_HEIGHT_RE]] as const) {
    const match = trimmed.match(re);
    if (!match?.[1]) continue;
    const value = Number.parseFloat(match[1]);
    if (Number.isNaN(value) || value <= 0) {
      throw new Error(`SVG has invalid ${attr}: ${match[1]}`);
    }
  }
}

function renderInChildProcess(svgString: string, scale: number): Promise<string> {
  const payload = JSON.stringify({ svg: svgString, scale });

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolveChildScript()], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`SVG render timed out after ${RENDER_TIMEOUT_MS}ms`));
    }, RENDER_TIMEOUT_MS);

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn SVG render child: ${err.message}`));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout) as { base64?: unknown };
          if (typeof parsed.base64 !== "string") {
            throw new Error("missing base64 field");
          }
          resolve(parsed.base64);
        } catch {
          reject(new Error(`SVG render produced invalid output${stderr ? `: ${stderr}` : ""}`));
        }
        return;
      }
      const detail = stderr.trim() || (signal ? `signal ${signal}` : `exit ${code}`);
      reject(new Error(`SVG render failed (${detail})`));
    });

    // Suppress EPIPE: if the child crashes before reading stdin, the broken
    // pipe emits an error on child.stdin. Without this handler it would be an
    // uncaught EventEmitter error that kills the parent — the close handler
    // below will still fire and surface the child's non-zero exit code.
    child.stdin.on("error", () => {});

    child.stdin.write(payload);
    child.stdin.end();
  });
}

export async function svgToPngBase64(svgString: string, options?: RenderPngOptions): Promise<string> {
  validateSvgInput(svgString);
  const scale = options?.scale ?? 2;
  return renderInChildProcess(svgString, scale);
}
