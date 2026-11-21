import type { CodeFormat } from "./types.js";

/** Lightweight codec metadata for discovery paths that must not load codec implementations. */
export const CODEC_CAPABILITIES: Readonly<Record<CodeFormat, { supportsWrite: boolean }>> = {
  yaml: { supportsWrite: true },
  json: { supportsWrite: true },
  rego: { supportsWrite: true },
  antlr4: { supportsWrite: false },
};
