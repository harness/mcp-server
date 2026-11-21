/**
 * Value provenance detection & dynamic-expression guardrails.
 *
 * Protects Harness runtime inputs (`<+input>`), JEXL expressions (`<+...>`),
 * v1 pipeline expressions (`${{ inputs.* }}`), and IDP parameter expressions
 * (`${{ parameters.* }}`) from silent literal replacement unless the caller
 * sets `replace_dynamic: true`.
 */

import {
  CodeEngineError,
  type DynamicExpressionFlavor,
  type ValueDescriptor,
} from "./types.js";

const HARNESS_RUNTIME_INPUT_RE = /<\+input>/;
const HARNESS_JEXL_EXPR_RE = /<\+[^>]+>/;
const V1_RUNTIME_INPUT_RE = /\$\{\{\s*inputs\.[A-Za-z0-9_.-]+/;
const V1_ANY_EXPR_RE = /\$\{\{[\s\S]*?\}\}/;
const IDP_PARAM_EXPR_RE = /\$\{\{\s*parameters\.[A-Za-z0-9_.-]+\s*\}\}/;

export const DEFAULT_FLAVORS: readonly DynamicExpressionFlavor[] = [
  "harness_jexl",
  "v1_expr",
  "idp_param",
];

/**
 * Classify a value into its provenance descriptor, bounding large strings/containers
 * so inspection responses never dump bulky payloads into LLM context.
 */
export function describeValue(
  value: unknown,
  flavors: readonly DynamicExpressionFlavor[] = DEFAULT_FLAVORS,
  opts?: { source?: "template_input" | "template_owned"; owningTemplate?: string; maxStringChars?: number },
): ValueDescriptor {
  if (opts?.source === "template_owned") {
    return {
      kind: "template_owned",
      owning_template: opts.owningTemplate,
      ...(value !== undefined ? { value: summarizeScalarOrShape(value, opts?.maxStringChars) } : {}),
    };
  }

  if (value === undefined) {
    return { kind: "absent" };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const bounded = truncateStr(value, opts?.maxStringChars);
    const boundedExpr = truncateStr(trimmed, opts?.maxStringChars);
    const exprField = boundedExpr !== bounded ? { expression: boundedExpr } : {};
    if (flavors.includes("harness_jexl")) {
      if (HARNESS_RUNTIME_INPUT_RE.test(trimmed)) {
        return { kind: "runtime_input", value: bounded, ...exprField };
      }
      if (HARNESS_JEXL_EXPR_RE.test(trimmed)) {
        return { kind: "expression", value: bounded, ...exprField };
      }
    }
    if (flavors.includes("v1_expr")) {
      if (V1_RUNTIME_INPUT_RE.test(trimmed)) {
        return { kind: "runtime_input", value: bounded, ...exprField };
      }
      if (V1_ANY_EXPR_RE.test(trimmed)) {
        return { kind: "expression", value: bounded, ...exprField };
      }
    }
    if (flavors.includes("idp_param") && IDP_PARAM_EXPR_RE.test(trimmed)) {
      return { kind: "expression", value: bounded, ...exprField };
    }

    if (opts?.source === "template_input") {
      return {
        kind: "template_input",
        value: truncateStr(value, opts?.maxStringChars),
        owning_template: opts.owningTemplate,
      };
    }

    return { kind: "literal", value: truncateStr(value, opts?.maxStringChars) };
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    if (opts?.source === "template_input") {
      return { kind: "template_input", value, owning_template: opts.owningTemplate };
    }
    return { kind: "literal", value };
  }

  if (Array.isArray(value)) {
    return { kind: "array", value: `[${value.length} items]` };
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return { kind: "object", value: keys.slice(0, 12) };
  }

  return { kind: "literal", value: String(value) };
}

function truncateStr(s: string, maxChars = 240): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}… (${s.length} chars)`;
}

function summarizeScalarOrShape(value: unknown, maxChars = 240): unknown {
  if (typeof value === "string") return truncateStr(value, maxChars);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).slice(0, 12);
  return value;
}

/**
 * Returns true if `descriptor` represents a dynamic expression (`runtime_input` or `expression`).
 */
export function isDynamicValue(descriptor: ValueDescriptor): boolean {
  return descriptor.kind === "runtime_input" || descriptor.kind === "expression";
}

/**
 * Throw `DYNAMIC_VALUE_REPLACEMENT_REQUIRED` if an operation attempts to overwrite or unset
 * a dynamic expression without `replace_dynamic: true`.
 */
export function assertDynamicReplacementAllowed(params: {
  before: ValueDescriptor;
  replaceDynamic: boolean | undefined;
  selector: string;
  field: string;
}): void {
  const { before, replaceDynamic, selector, field } = params;
  if (!isDynamicValue(before) || replaceDynamic === true) {
    return;
  }
  const expr = before.expression ?? String(before.value ?? "");
  throw new CodeEngineError(
    "DYNAMIC_VALUE_REPLACEMENT_REQUIRED",
    `Field "${field}" on "${selector}" currently holds a dynamic ${before.kind} (${expr}). Pass replace_dynamic: true to explicitly replace it.`,
    [
      {
        code: "DYNAMIC_VALUE_REPLACEMENT_REQUIRED",
        severity: "error",
        selector,
        field,
        message: `Current value is a ${before.kind}: ${expr}`,
        remediation:
          "Set replace_dynamic: true in the patch operation only if the caller intends to replace the runtime input or expression with a fixed value.",
      },
    ],
  );
}

/**
 * Check whether a string contains a deferred Harness expression (used by schema validator
 * so `<+input>` or `${{ inputs.foo }}` on numeric/boolean/enum fields is preserved for runtime).
 */
export function containsDeferredExpression(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return HARNESS_JEXL_EXPR_RE.test(value) || V1_ANY_EXPR_RE.test(value);
}
