/**
 * Deterministic keyed JSON-tree inspector and patcher.
 *
 * Used for JSON-as-Code resources such as `policy_set`, `cost_perspective`,
 * `idp_scorecard`, `kg_type`, and JSON dashboards/views.
 *
 * Array elements are always addressed by a logical key field (e.g. `identifier`,
 * `id`, `uuid`, `name`) — never by raw positional index.
 */

import {
  assertDynamicReplacementAllowed,
  DEFAULT_FLAVORS,
  describeValue,
} from "./provenance.js";
import { verifyScopedSemanticDiff } from "./yaml-cst.js";
import { decodeNodeRef, makeNodeRef } from "./yaml-cst.js";
import {
  CodeEngineError,
  type CodeDiagnostic,
  type FieldChangeSummary,
  type InspectedNode,
  type PatchOperation,
  type PatchOpName,
  type ResourceCodeSpec,
  type SelectorTarget,
  type ValueDescriptor,
} from "./types.js";

const JSON_SUPPORTED_OPS: readonly PatchOpName[] = [
  "set",
  "unset",
  "upsert_item",
  "remove_item",
];

const COMMON_KEY_FIELDS = ["identifier", "id", "uuid", "name", "key", "tileId", "ruleId"] as const;

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

interface IndexedJsonNode {
  selector: string;
  kind: string;
  id: string;
  name?: string;
  nodeType?: string;
  obj: Record<string, unknown>;
  rootPath: (string | number)[];
  childrenCount?: number;
}

function inferItemKey(item: Record<string, unknown>, keyFields?: readonly string[]): { field: string; value: string } | undefined {
  const candidates = keyFields ?? COMMON_KEY_FIELDS;
  for (const k of candidates) {
    const val = item[k];
    if (typeof val === "string" && val.length > 0) return { field: k, value: val };
    if (typeof val === "number") return { field: k, value: String(val) };
  }
  return undefined;
}

function indexJsonDocument(root: Record<string, unknown>, codeSpec: ResourceCodeSpec): IndexedJsonNode[] {
  const nodes: IndexedJsonNode[] = [];
  const rootId =
    (typeof root.identifier === "string" && root.identifier) ||
    (typeof root.id === "string" && root.id) ||
    (typeof root.uuid === "string" && root.uuid) ||
    "root";

  nodes.push({
    selector: "root",
    kind: "document",
    id: rootId,
    name: typeof root.name === "string" ? root.name : undefined,
    nodeType: typeof root.type === "string" ? root.type : typeof root.kind === "string" ? root.kind : undefined,
    obj: root,
    rootPath: [],
    childrenCount: Object.keys(root).length,
  });

  const indexedArrayPaths = new Set<string>();

  for (const col of codeSpec.collections ?? []) {
    indexedArrayPaths.add(col.path);
    const parts = col.path.split(".").filter(Boolean);
    let cur: unknown = root;
    const curPath: (string | number)[] = [];
    for (const p of parts) {
      if (!isPlainRecord(cur)) {
        cur = undefined;
        break;
      }
      cur = cur[p];
      curPath.push(p);
    }
    if (Array.isArray(cur)) {
      cur.forEach((rawEl, idx) => {
        if (!isPlainRecord(rawEl)) return;
        const inner =
          col.itemWrapperKey && isPlainRecord(rawEl[col.itemWrapperKey])
            ? (rawEl[col.itemWrapperKey] as Record<string, unknown>)
            : rawEl;
        const itemPath =
          col.itemWrapperKey && inner !== rawEl ? [...curPath, idx, col.itemWrapperKey] : [...curPath, idx];
        const keyHit = inferItemKey(inner, col.keyFields);
        if (!keyHit) return;
        nodes.push({
          selector: `${col.segment}:${keyHit.value}`,
          kind: col.segment,
          id: keyHit.value,
          name: col.labelField && typeof inner[col.labelField] === "string" ? (inner[col.labelField] as string) : typeof inner.name === "string" ? inner.name : undefined,
          nodeType: col.typeField && typeof inner[col.typeField] === "string" ? (inner[col.typeField] as string) : typeof inner.type === "string" ? inner.type : undefined,
          obj: inner,
          rootPath: itemPath,
        });
      });
    }
  }

  // Auto-discover top-level keyed arrays & object sections so any JSON resource gets useful outlines
  for (const [k, v] of Object.entries(root)) {
    if (indexedArrayPaths.has(k)) continue;
    if (Array.isArray(v)) {
      v.forEach((el, idx) => {
        if (!isPlainRecord(el)) return;
        const keyHit = inferItemKey(el);
        if (!keyHit) return;
        const singular = k.endsWith("ies") ? `${k.slice(0, -3)}y` : k.endsWith("s") ? k.slice(0, -1) : k;
        nodes.push({
          selector: `${singular}:${keyHit.value}`,
          kind: singular,
          id: keyHit.value,
          name: typeof el.name === "string" ? el.name : undefined,
          nodeType: typeof el.type === "string" ? el.type : typeof el.dataType === "string" ? el.dataType : undefined,
          obj: el,
          rootPath: [k, idx],
        });
      });
    } else if (isPlainRecord(v)) {
      nodes.push({
        selector: `section:${k}`,
        kind: "section",
        id: k,
        obj: v,
        rootPath: [k],
        childrenCount: Object.keys(v).length,
      });
    }
  }

  return nodes;
}

export function inspectJsonDocument(params: {
  doc: Record<string, unknown>;
  codeSpec: ResourceCodeSpec;
  revPrefix: string;
  view: "outline" | "select";
  select?: string;
  cursor?: string;
  pageSize?: number;
}): { nodes: InspectedNode[]; totalNodes: number; truncated: boolean; nextCursor?: string } {
  const { doc, codeSpec, revPrefix, view, select, cursor, pageSize = 30 } = params;
  const flavors = codeSpec.dynamicExpressions ?? DEFAULT_FLAVORS;
  const allNodes = indexJsonDocument(doc, codeSpec);

  let matched = allNodes;
  if (view === "select" && select) {
    const queries = select.split(",").map((s) => s.trim()).filter(Boolean);
    matched = allNodes.filter((n) =>
      queries.some(
        (q) =>
          n.selector === q ||
          n.id === q ||
          n.selector.toLowerCase().includes(q.toLowerCase()) ||
          (n.name && n.name.toLowerCase().includes(q.toLowerCase())),
      ),
    );
  }

  const offset = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
  const slice = matched.slice(offset, offset + pageSize);
  const detailed = view === "select" || matched.length <= 10;

  const inspected: InspectedNode[] = slice.map((n) => {
    const fields: Record<string, ValueDescriptor> = {};
    for (const [k, v] of Object.entries(n.obj)) {
      if (!detailed && n.selector === "root" && Array.isArray(v) && v.length > 3) {
        fields[k] = { kind: "array", value: `[${v.length} items]` };
        continue;
      }
      fields[k] = describeValue(v, flavors);
    }
    return {
      selector: n.selector,
      node_ref: makeNodeRef(revPrefix, n.selector),
      kind: n.kind,
      id: n.id,
      ...(n.name ? { name: n.name } : {}),
      ...(n.nodeType ? { node_type: n.nodeType } : {}),
      supported_ops: JSON_SUPPORTED_OPS,
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
      ...(n.childrenCount !== undefined ? { children_count: n.childrenCount } : {}),
    };
  });

  const hasMore = offset + pageSize < matched.length;
  return {
    nodes: inspected,
    totalNodes: matched.length,
    truncated: hasMore,
    ...(hasMore ? { nextCursor: String(offset + pageSize) } : {}),
  };
}

function resolveJsonTarget(
  root: Record<string, unknown>,
  nodes: IndexedJsonNode[],
  target: SelectorTarget | undefined,
  revPrefix: string,
): IndexedJsonNode {
  let raw = "root";
  if (typeof target === "string" && target.trim()) {
    raw = target.trim();
  } else if (target && typeof target === "object") {
    if ("node_ref" in target) raw = target.node_ref;
    else if ("selector" in target && typeof target.selector === "string") raw = target.selector;
  }

  if (raw.startsWith("nr_")) {
    const decoded = decodeNodeRef(raw);
    if (!decoded) throw new CodeEngineError("TARGET_NOT_FOUND", `Malformed node_ref "${raw}".`);
    if (decoded.revPrefix !== revPrefix) {
      throw new CodeEngineError("REVISION_CONFLICT", `node_ref "${raw}" was created for an older revision.`);
    }
    raw = decoded.selector;
  }

  if (raw === "root" || raw === "/") return nodes[0]!;

  const exact = nodes.filter((n) => n.selector === raw);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) {
    throw new CodeEngineError("TARGET_AMBIGUOUS", `Selector "${raw}" matched ${exact.length} JSON nodes.`, [
      { code: "TARGET_AMBIGUOUS", severity: "error", selector: raw, message: "Ambiguous selector", candidates: exact.map((e) => e.selector) },
    ]);
  }

  // Keyed dotted path resolution: e.g. `policies[identifier=foo]` or `viewPreferences`
  if (!/\[\d+\]/.test(raw)) {
    const parts = raw.split(".").filter(Boolean);
    let cur: unknown = root;
    const curPath: (string | number)[] = [];
    let ok = true;
    for (const p of parts) {
      const m = /^([A-Za-z0-9_-]+)(?:\[([A-Za-z0-9_-]+)=([^\]]+)\])?$/.exec(p);
      if (!m || !isPlainRecord(cur)) {
        ok = false;
        break;
      }
      cur = cur[m[1]!];
      curPath.push(m[1]!);
      if (m[2] && m[3] !== undefined) {
        if (!Array.isArray(cur)) {
          ok = false;
          break;
        }
        const hits: Array<{ el: Record<string, unknown>; idx: number }> = [];
        cur.forEach((el, idx) => {
          if (isPlainRecord(el) && String(el[m[2]!]) === m[3]) hits.push({ el, idx });
        });
        if (hits.length > 1) {
          throw new CodeEngineError("TARGET_AMBIGUOUS", `Path "${raw}" matched ${hits.length} elements.`);
        }
        if (hits.length === 0) {
          ok = false;
          break;
        }
        cur = hits[0]!.el;
        curPath.push(hits[0]!.idx);
      }
    }
    if (ok && isPlainRecord(cur)) {
      return {
        selector: raw,
        kind: "object",
        id: parts[parts.length - 1]!,
        obj: cur,
        rootPath: curPath,
      };
    }
  }

  throw new CodeEngineError("TARGET_NOT_FOUND", `Selector "${raw}" did not match any node in JSON resource.`, [
    {
      code: "TARGET_NOT_FOUND",
      severity: "error",
      selector: raw,
      message: `No node matched "${raw}".`,
      candidates: nodes.slice(0, 10).map((n) => n.selector),
    },
  ]);
}

export function applyJsonPatches(params: {
  doc: Record<string, unknown>;
  codeSpec: ResourceCodeSpec;
  revPrefix: string;
  operations: readonly PatchOperation[];
}): {
  patchedDoc: Record<string, unknown>;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
} {
  const { doc, codeSpec, revPrefix, operations } = params;
  if (operations.length === 0) {
    throw new CodeEngineError("INVALID_PATCH_OPERATION", "At least one patch operation is required.");
  }

  const clone = structuredClone(doc);
  const flavors = codeSpec.dynamicExpressions ?? DEFAULT_FLAVORS;
  const changes: FieldChangeSummary[] = [];
  const diagnostics: CodeDiagnostic[] = [];
  const touched = new Map<string, number>();
  const allowedPaths: Array<(string | number)[]> = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    const nodes = indexJsonDocument(clone, codeSpec);
    const targetNode = resolveJsonTarget(clone, nodes, op.target, revPrefix);

    if (op.op === "set" || op.op === "unset") {
      if (!op.field) {
        throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (${op.op}) requires "field".`);
      }
      const parts = op.field.split(".").filter(Boolean);
      const fullPath = [...targetNode.rootPath, ...parts];
      const canonical = fullPath.map(String).join(".");
      if (touched.has(canonical)) {
        throw new CodeEngineError("OVERLAPPING_OPERATIONS", `Duplicate mutation on "${canonical}".`);
      }
      touched.set(canonical, i);

      let container = targetNode.obj;
      for (const seg of parts.slice(0, -1)) {
        const next = container[seg];
        if (next === undefined) {
          if (op.op === "unset") {
            container = undefined as never;
            break;
          }
          const created: Record<string, unknown> = {};
          container[seg] = created;
          container = created;
        } else if (isPlainRecord(next)) {
          container = next;
        } else {
          throw new CodeEngineError("INVALID_PATCH_OPERATION", `Cannot traverse non-object field "${seg}".`);
        }
      }
      if (!container) continue;

      const leaf = parts[parts.length - 1]!;
      const rawBefore = container[leaf];
      const beforeDesc = describeValue(rawBefore, flavors);
      assertDynamicReplacementAllowed({
        before: beforeDesc,
        replaceDynamic: op.replace_dynamic,
        selector: targetNode.selector,
        field: op.field,
      });

      if (op.op === "set") {
        if (op.value === undefined) {
          throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (set) requires "value".`);
        }
        if (JSON.stringify(rawBefore) === JSON.stringify(op.value)) continue;
        container[leaf] = structuredClone(op.value);
        changes.push({
          target: targetNode.selector,
          field: op.field,
          op: "set",
          before: beforeDesc,
          after: describeValue(op.value, flavors),
          source: "authored",
        });
        allowedPaths.push(fullPath);
      } else {
        if (!(leaf in container)) continue;
        delete container[leaf];
        changes.push({
          target: targetNode.selector,
          field: op.field,
          op: "unset",
          before: beforeDesc,
          after: { kind: "absent" },
          source: "authored",
        });
        allowedPaths.push(fullPath);
      }
      continue;
    }

    if (op.op === "upsert_item" || op.op === "remove_item") {
      if (!op.field || !op.key_field || !op.key_value) {
        throw new CodeEngineError(
          "INVALID_PATCH_OPERATION",
          `Operation #${i + 1} (${op.op}) requires "field", "key_field", and "key_value".`,
        );
      }
      const parts = op.field.split(".").filter(Boolean);
      const arrPath = [...targetNode.rootPath, ...parts];
      const lockKey = `${arrPath.join(".")}[${op.key_field}=${op.key_value}]`;
      if (touched.has(lockKey)) {
        throw new CodeEngineError("OVERLAPPING_OPERATIONS", `Duplicate list operation on "${lockKey}".`);
      }
      touched.set(lockKey, i);

      let parent = targetNode.obj;
      for (const seg of parts.slice(0, -1)) {
        if (!isPlainRecord(parent[seg])) {
          if (op.op === "remove_item") {
            parent = undefined as never;
            break;
          }
          parent[seg] = {};
        }
        parent = parent[seg] as Record<string, unknown>;
      }
      if (!parent) continue;
      const arrKey = parts[parts.length - 1]!;
      let arr = parent[arrKey];
      if (arr === undefined) {
        if (op.op === "remove_item") continue;
        arr = [];
        parent[arrKey] = arr;
      }
      if (!Array.isArray(arr)) {
        throw new CodeEngineError("INVALID_PATCH_OPERATION", `Field "${op.field}" is not an array.`);
      }

      const matches: number[] = [];
      arr.forEach((el, idx) => {
        if (isPlainRecord(el) && String(el[op.key_field!]) === op.key_value) matches.push(idx);
      });
      if (matches.length > 1) {
        throw new CodeEngineError("TARGET_AMBIGUOUS", `Array "${op.field}" has ${matches.length} entries with ${op.key_field}="${op.key_value}".`);
      }

      if (op.op === "upsert_item") {
        if (!isPlainRecord(op.value)) {
          throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (upsert_item) requires an object "value".`);
        }
        const nextItem = { ...structuredClone(op.value), [op.key_field]: op.key_value };
        if (matches.length === 1) {
          const idx = matches[0]!;
          const prev = arr[idx];
          if (JSON.stringify(prev) === JSON.stringify(nextItem)) continue;
          arr[idx] = nextItem;
          changes.push({
            target: targetNode.selector,
            field: `${op.field}[${op.key_field}=${op.key_value}]`,
            op: "upsert_item",
            before: describeValue(prev, flavors),
            after: describeValue(nextItem, flavors),
            source: "authored",
          });
        } else {
          arr.push(nextItem);
          changes.push({
            target: targetNode.selector,
            field: `${op.field}[${op.key_field}=${op.key_value}]`,
            op: "upsert_item",
            before: { kind: "absent" },
            after: describeValue(nextItem, flavors),
            source: "authored",
          });
        }
        allowedPaths.push(arrPath);
      } else {
        if (matches.length === 0) continue;
        const idx = matches[0]!;
        const prev = arr[idx];
        arr.splice(idx, 1);
        changes.push({
          target: targetNode.selector,
          field: `${op.field}[${op.key_field}=${op.key_value}]`,
          op: "remove_item",
          before: describeValue(prev, flavors),
          after: { kind: "absent" },
          source: "authored",
        });
        allowedPaths.push(arrPath);
      }
      continue;
    }

    throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation "${op.op}" is not supported on JSON documents.`);
  }

  if (changes.length > 0) {
    verifyScopedSemanticDiff(doc, clone, allowedPaths);
  }

  return { patchedDoc: clone, changes, diagnostics };
}
