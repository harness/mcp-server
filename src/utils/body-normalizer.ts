/**
 * Normalize request bodies for Harness NG APIs.
 * - Strip null/undefined to avoid "Unable to process JSON" from invalid values.
 * - Unwrap common wrapper keys (environment, service, connector) when APIs expect the entity at top level.
 */

/** Recursively remove null and undefined so they are omitted from JSON. */
export function stripNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map((x) => (x === null || x === undefined ? x : stripNulls(x)));
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const v2 = stripNulls(v);
      if (v2 !== undefined) out[k] = v2;
    }
    return out;
  }
  return obj;
}

/** Return body[wrapperKey] if present, else body. Use when API expects the entity at top level. */
export function unwrapBody(body: unknown, wrapperKey: string): unknown {
  if (body !== null && typeof body === "object" && wrapperKey in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>)[wrapperKey];
  }
  return body;
}

/**
 * Options for the standardized body builder factory.
 */
export interface BodyBuilderOptions {
  /** Unwrap a wrapper key (e.g., "service", "connector", "environment") */
  unwrapKey?: string;
  /** Wrap the body under a key (e.g., "service" → {"service": {...}}). Use when API expects wrapped bodies. */
  wrapKey?: string;
  /** Auto-inject identifier from input field if missing from body */
  injectIdentifier?: { inputField: string; bodyField: string };
  /** Auto-inject additional fields if missing */
  injectFields?: Array<{ from: string; to: string; onlyIfMissing?: boolean }>;
}

/**
 * Factory: returns a bodyBuilder function that handles unwrap, stripNulls, and field injection.
 * Replaces repetitive inline bodyBuilder patterns across toolsets.
 */
export function buildBodyNormalized(opts: BodyBuilderOptions = {}): (input: Record<string, unknown>) => unknown {
  return (input: Record<string, unknown>) => {
    let body = input.body;

    // Step 1a: Unwrap wrapper key if configured
    if (opts.unwrapKey) {
      body = unwrapBody(body, opts.unwrapKey) ?? body;
    }

    // Step 1b: Wrap body under key if configured (e.g., {"environment": {...}})
    if (opts.wrapKey && typeof body === "object" && body !== null) {
      // Only wrap if the body is NOT already wrapped with the key
      if (!(opts.wrapKey in (body as Record<string, unknown>))) {
        body = { [opts.wrapKey]: body };
      }
    }

    // Step 2: Inject identifier if configured and missing
    if (opts.injectIdentifier && typeof body === "object" && body !== null) {
      const rec = body as Record<string, unknown>;
      if (rec[opts.injectIdentifier.bodyField] == null && input[opts.injectIdentifier.inputField]) {
        rec[opts.injectIdentifier.bodyField] = input[opts.injectIdentifier.inputField];
      }
    }

    // Step 3: Inject additional fields
    if (opts.injectFields && typeof body === "object" && body !== null) {
      const rec = body as Record<string, unknown>;
      for (const f of opts.injectFields) {
        if (f.onlyIfMissing && rec[f.to] != null) continue;
        if (input[f.from] != null) rec[f.to] = input[f.from];
      }
    }

    // Step 4: Strip nulls
    const out = stripNulls(body);
    return typeof out === "object" && out !== null ? out : body;
  };
}
