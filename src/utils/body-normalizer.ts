/**
 * Normalize request bodies for Harness NG APIs.
 * - Strip null/undefined to avoid "Unable to process JSON" from invalid values.
 * - Unwrap common wrapper keys (environment, service, connector) when APIs expect the entity at top level.
 * - Optionally synthesize ``body.yaml`` for APIs that require it (see ``ensureYamlWrapper``).
 *
 * Service/environment create do NOT need yaml synthesis — NG fills ``yaml`` server-side when
 * omitted. Infrastructure create/update DOES: NG returns ``yaml: must not be empty`` if the
 * client sends only flat JSON fields. Wire ``ensureYamlWrapper: "infrastructureDefinition"``
 * for those operations only.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

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
 * Ensure ``body.yaml`` is a non-empty string for NG APIs that reject missing yaml
 * even when the same entity fields are present as JSON (infra create/update).
 *
 * Unlike service/environment, NG does not synthesize infra yaml server-side.
 * Agents often send flat ``{ identifier, name, type, environmentRef, spec }``
 * (or a raw ``infrastructureDefinition:`` YAML string body). This helper:
 * - keeps an existing non-empty ``yaml`` string
 * - stringifies an object-shaped ``yaml`` under ``wrapperKey`` if needed
 * - otherwise builds ``yaml: "<wrapperKey>:\\n ..."`` from the remaining fields
 */
export function ensureYamlField(body: unknown, wrapperKey: string): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return body;
  const rec = body as Record<string, unknown>;
  const existing = rec.yaml;

  if (typeof existing === "string" && existing.trim()) {
    return body;
  }

  if (existing !== null && existing !== undefined && typeof existing === "object" && !Array.isArray(existing)) {
    const yamlObj =
      wrapperKey in (existing as Record<string, unknown>)
        ? existing
        : { [wrapperKey]: existing };
    return { ...rec, yaml: stringifyYaml(yamlObj) };
  }

  const { yaml: _ignored, ...fields } = rec;
  return {
    ...fields,
    yaml: stringifyYaml({ [wrapperKey]: fields }),
  };
}

function parseYamlBody(body: string): unknown {
  try {
    return parseYaml(body);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`body must be a JSON object or YAML object for this resource. Failed to parse YAML body: ${detail}`);
  }
}

function assertObjectBody(body: unknown): void {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("body must be a JSON object or YAML object for this resource.");
  }
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
  /**
   * Root key for synthesized ``body.yaml`` (e.g. ``infrastructureDefinition``).
   * When set, after unwrap/strip, ensure a non-empty ``yaml`` string exists —
   * NG ``POST/PUT /ng/api/infrastructures`` requires it; service/env must not
   * set this (NG fills yaml for those). See ``ensureYamlField``.
   */
  ensureYamlWrapper?: string;
}

function getInjectionTarget(body: unknown, wrapKey?: string): Record<string, unknown> | undefined {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return undefined;
  const rec = body as Record<string, unknown>;
  const wrapped = wrapKey ? rec[wrapKey] : undefined;
  return wrapped != null && typeof wrapped === "object" && !Array.isArray(wrapped)
    ? wrapped as Record<string, unknown>
    : rec;
}

function scalarIdentifier(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/**
 * Factory: returns a bodyBuilder function that handles unwrap, stripNulls, and field injection.
 * Replaces repetitive inline bodyBuilder patterns across toolsets.
 */
export function buildBodyNormalized(opts: BodyBuilderOptions = {}): (input: Record<string, unknown>) => unknown {
  return (input: Record<string, unknown>) => {
    let body = input.body;

    if (typeof body === "string") {
      body = parseYamlBody(body);
      assertObjectBody(body);
    } else if (body != null && (typeof body !== "object" || Array.isArray(body))) {
      assertObjectBody(body);
    }

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
    if (opts.injectIdentifier) {
      const rec = getInjectionTarget(body, opts.wrapKey);
      const inputIdentifier = scalarIdentifier(input[opts.injectIdentifier.inputField]);
      const bodyIdentifier = scalarIdentifier(rec?.[opts.injectIdentifier.bodyField]);
      if (rec && inputIdentifier && bodyIdentifier && inputIdentifier !== bodyIdentifier) {
        throw new Error(
          `Conflicting identifiers: input.${opts.injectIdentifier.inputField} gives "${inputIdentifier}" ` +
          `but body.${opts.injectIdentifier.bodyField} gives "${bodyIdentifier}". Ensure body matches resource_id/url/params.`,
        );
      }
      if (rec && rec[opts.injectIdentifier.bodyField] == null && inputIdentifier) {
        rec[opts.injectIdentifier.bodyField] = input[opts.injectIdentifier.inputField];
      }
    }

    // Step 3: Inject additional fields
    if (opts.injectFields) {
      const rec = getInjectionTarget(body, opts.wrapKey);
      for (const f of opts.injectFields) {
        if (!rec) continue;
        if (f.onlyIfMissing && rec[f.to] != null) continue;
        if (input[f.from] != null) rec[f.to] = input[f.from];
      }
    }

    // Step 4: Strip nulls
    let out = stripNulls(body);
    out = typeof out === "object" && out !== null ? out : body;

    // Step 5: NG APIs that require body.yaml (infrastructure create/update)
    if (opts.ensureYamlWrapper) {
      out = ensureYamlField(out, opts.ensureYamlWrapper);
    }

    return out;
  };
}
