/**
 * Schema-driven structural validator backed by the repo's auto-synced JSON Schemas
 * (`src/data/schemas/` via `pnpm sync-schemas` & `pnpm sync-entity-schemas`).
 *
 * Key design choices for long-term maintainability:
 *  - Zero hardcoded field catalogs in TypeScript: types, enums, required properties,
 *    and regex patterns (such as Harness duration patterns on `timeout`) are read
 *    directly from upstream-synced JSON Schemas.
 *  - Deferred Harness expressions (`<+input>`, `<+...>`, `${{ ... }}`) bypass static
 *    scalar type/enum checks so runtime-evaluated expressions remain valid.
 *  - Diagnostics are strictly bounded (`MAX_DIAGNOSTICS = 10`) so validation errors
 *    never flood model context.
 */

import type { SchemaName } from "../data/schemas/catalog.js";
import type { HarnessYamlScope } from "../tools/entity-schema/types.js";
import { containsDeferredExpression } from "./provenance.js";
import type { CodeDiagnostic, ResourceCodeSpec } from "./types.js";

const MAX_DIAGNOSTICS = 10;

type SchemaNode = Record<string, unknown>;

function isSchemaObject(v: unknown): v is SchemaNode {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function resolveSchemaRef(rootSchema: SchemaNode, ref: string): SchemaNode | undefined {
  if (!ref.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = rootSchema;
  for (const p of parts) {
    if (!isSchemaObject(cur)) return undefined;
    cur = cur[p];
  }
  return isSchemaObject(cur) ? cur : undefined;
}

function deref(rootSchema: SchemaNode, node: SchemaNode, seen = new Set<string>()): SchemaNode {
  const ref = typeof node.$ref === "string" ? node.$ref : undefined;
  if (!ref || seen.has(ref)) return node;
  seen.add(ref);
  const target = resolveSchemaRef(rootSchema, ref);
  if (!target) return node;
  return deref(rootSchema, target, seen);
}

/**
 * Resolve the JSON Schema object for a resource's `codeSpec` when bundled locally.
 */
export async function resolveBundledJsonSchema(
  codeSpec: ResourceCodeSpec,
  scope: HarnessYamlScope = "project",
): Promise<SchemaNode | undefined> {
  const ref = codeSpec.schemaRef;
  if (!ref) return undefined;
  if (ref.kind === "bundled") {
    const { SCHEMAS } = await import("../data/schemas/index.js");
    if (ref.key in SCHEMAS) {
      return SCHEMAS[ref.key as SchemaName] as SchemaNode;
    }
    return undefined;
  }
  if (ref.kind === "live_bundled") {
    const { getBundledEntitySchema } = await import("../tools/entity-schema/bundled.js");
    return (
      getBundledEntitySchema(ref.key, scope) ??
      getBundledEntitySchema(ref.key, "project") ??
      getBundledEntitySchema(ref.key, "account")
    );
  }
  return undefined;
}

/**
 * Lightweight recursive JSON Schema validator tailored for Harness entity schemas:
 *  - Validates `type`, `pattern`, `enum` (when non-empty; note Harness v0 schemas emit
 *    placeholder `enum: []` on polymorphic discriminator fields like `step.type`, which
 *    must NOT reject valid discriminator strings!), `required`, `properties`, and `items`.
 *  - Resolves `$ref`, `allOf`, and branches across `oneOf` / `anyOf` by picking the
 *    branch matching a discriminator (`type` / `kind`) when available so error messages
 *    pinpoint the exact violated field rather than dumping 30 union branch errors.
 */
export async function validateCandidateAgainstSchema(params: {
  candidate: unknown;
  codeSpec: ResourceCodeSpec;
  scope?: HarnessYamlScope;
}): Promise<CodeDiagnostic[]> {
  const { candidate, codeSpec, scope = "project" } = params;
  const rootSchema = await resolveBundledJsonSchema(codeSpec, scope);
  if (!rootSchema) return [];

  const diagnostics: CodeDiagnostic[] = [];
  validateNode(rootSchema, rootSchema, candidate, "", diagnostics, 0);
  return diagnostics.slice(0, MAX_DIAGNOSTICS);
}

function validateNode(
  rootSchema: SchemaNode,
  rawSchema: SchemaNode,
  value: unknown,
  path: string,
  diagnostics: CodeDiagnostic[],
  depth: number,
): void {
  if (diagnostics.length >= MAX_DIAGNOSTICS || depth > 24) return;
  if (value === undefined) return;

  // Deferred Harness runtime expressions (`<+input>`, `<+...>`, `${{ ... }}`) are legal
  // wherever an expression-capable scalar/object may be bound at runtime.
  if (containsDeferredExpression(value)) return;

  const schema = deref(rootSchema, rawSchema);

  // Handle allOf
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      if (isSchemaObject(sub)) {
        validateNode(rootSchema, sub, value, path, diagnostics, depth + 1);
      }
    }
  }

  // Handle JSON Schema Draft-07 conditional `if` / `then` / `else` (used heavily in Harness v0 schemas)
  if (isSchemaObject(schema.if)) {
    const condProbe: CodeDiagnostic[] = [];
    validateNode(rootSchema, schema.if, value, path, condProbe, depth + 1);
    if (condProbe.length === 0) {
      if (isSchemaObject(schema.then)) {
        validateNode(rootSchema, schema.then, value, path, diagnostics, depth + 1);
      }
    } else if (isSchemaObject(schema.else)) {
      validateNode(rootSchema, schema.else, value, path, diagnostics, depth + 1);
    }
  }

  // Handle `const`
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    diagnostics.push({
      code: "VALIDATION_FAILED",
      severity: "error",
      field: path || "<root>",
      message: `Expected constant ${JSON.stringify(schema.const)} at "${path || "<root>"}", got ${JSON.stringify(value)}.`,
    });
    return;
  }

  // Handle oneOf / anyOf with discriminator narrowing when possible
  const union = Array.isArray(schema.oneOf)
    ? schema.oneOf
    : Array.isArray(schema.anyOf)
      ? schema.anyOf
      : undefined;
  if (union && union.length > 0) {
    const matchedBranch = selectMatchingUnionBranch(rootSchema, union, value, depth);
    if (matchedBranch === "valid") {
      // Matched at least one branch cleanly
    } else if (isSchemaObject(matchedBranch)) {
      validateNode(rootSchema, matchedBranch, value, path, diagnostics, depth + 1);
    } else {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: path || "<root>",
        message: `Value at "${path || "<root>"}" does not match any allowed schema variant.`,
      });
      return;
    }
  }

  // Type check
  const expectedType = schema.type;
  if (typeof expectedType === "string") {
    if (!matchesJsonType(value, expectedType)) {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: path || "<root>",
        message: `Expected type "${expectedType}" at "${path || "<root>"}", got ${describeActualType(value)}.`,
      });
      return;
    }
  } else if (Array.isArray(expectedType) && expectedType.length > 0) {
    const ok = expectedType.some((t) => typeof t === "string" && matchesJsonType(value, t));
    if (!ok) {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: path || "<root>",
        message: `Expected one of [${expectedType.join(", ")}] at "${path || "<root>"}", got ${describeActualType(value)}.`,
      });
      return;
    }
  }

  // Enum check — skip empty `enum: []` (Harness schema generator artifact on polymorphic base types)
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    if (!schema.enum.some((allowed) => JSON.stringify(allowed) === JSON.stringify(value))) {
      const previewAllowed = schema.enum.slice(0, 10).map(String).join(", ");
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: path || "<root>",
        message: `Invalid value ${JSON.stringify(value)} at "${path || "<root>"}". Allowed: ${previewAllowed}${schema.enum.length > 10 ? "…" : ""}.`,
      });
      return;
    }
  }

  // Pattern check on strings (catches invalid timeout durations like `"twenty_mins"` or `"-5m"`)
  if (typeof value === "string" && typeof schema.pattern === "string") {
    try {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) {
        diagnostics.push({
          code: "VALIDATION_FAILED",
          severity: "error",
          field: path || "<root>",
          message: `Value "${value}" at "${path || "<root>"}" does not match schema pattern ${schema.pattern}.`,
        });
      }
    } catch {
      // Ignore non-JS regex dialects in external schemas
    }
  }

  // Numeric bounds
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: path || "<root>",
        message: `Value ${value} at "${path || "<root>"}" is below minimum ${schema.minimum}.`,
      });
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: path || "<root>",
        message: `Value ${value} at "${path || "<root>"}" exceeds maximum ${schema.maximum}.`,
      });
    }
  }

  // Object properties & required keys
  if (isSchemaObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (typeof reqKey === "string" && !(reqKey in value)) {
          diagnostics.push({
            code: "VALIDATION_FAILED",
            severity: "error",
            field: path ? `${path}.${reqKey}` : reqKey,
            message: `Missing required property "${reqKey}" at "${path || "<root>"}".`,
          });
          if (diagnostics.length >= MAX_DIAGNOSTICS) return;
        }
      }
    }

    const props = isSchemaObject(schema.properties) ? schema.properties : undefined;
    if (props) {
      for (const [k, v] of Object.entries(value)) {
        const propSchema = props[k];
        if (isSchemaObject(propSchema)) {
          validateNode(rootSchema, propSchema, v, path ? `${path}.${k}` : k, diagnostics, depth + 1);
          if (diagnostics.length >= MAX_DIAGNOSTICS) return;
        } else if (schema.additionalProperties === false) {
          diagnostics.push({
            code: "VALIDATION_FAILED",
            severity: "error",
            field: path ? `${path}.${k}` : k,
            message: `Unknown property "${k}" is not allowed at "${path || "<root>"}".`,
          });
          if (diagnostics.length >= MAX_DIAGNOSTICS) return;
        }
      }
    }
  }

  // Array items
  if (Array.isArray(value) && isSchemaObject(schema.items)) {
    for (let idx = 0; idx < value.length; idx++) {
      validateNode(rootSchema, schema.items, value[idx], `${path}[${idx}]`, diagnostics, depth + 1);
      if (diagnostics.length >= MAX_DIAGNOSTICS) return;
    }
  }
}

function selectMatchingUnionBranch(
  rootSchema: SchemaNode,
  branches: unknown[],
  value: unknown,
  depth: number,
): "valid" | SchemaNode | undefined {
  const schemaBranches = branches.filter(isSchemaObject).map((b) => deref(rootSchema, b));
  if (schemaBranches.length === 0) return "valid";

  // Try each branch silently; if any produces 0 diagnostics, union is satisfied!
  let bestBranch: SchemaNode | undefined;
  let fewestErrors = Number.POSITIVE_INFINITY;

  for (const branch of schemaBranches) {
    // Quick discriminator check when value is an object with `type`
    if (isSchemaObject(value) && typeof value.type === "string" && isSchemaObject(branch.properties)) {
      const tProp = isSchemaObject(branch.properties.type) ? deref(rootSchema, branch.properties.type) : undefined;
      if (tProp && Array.isArray(tProp.enum) && tProp.enum.length > 0 && !tProp.enum.includes(value.type)) {
        continue;
      }
      if (tProp && tProp.const !== undefined && tProp.const !== value.type) {
        continue;
      }
    }

    const probe: CodeDiagnostic[] = [];
    validateNode(rootSchema, branch, value, "", probe, depth + 1);
    if (probe.length === 0) return "valid";
    if (probe.length < fewestErrors) {
      fewestErrors = probe.length;
      bestBranch = branch;
    }
  }

  return bestBranch;
}

function matchesJsonType(value: unknown, expected: string): boolean {
  switch (expected) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return !!value && typeof value === "object" && !Array.isArray(value);
    default:
      return true;
  }
}

function describeActualType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
