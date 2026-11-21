/**
 * Round-trip Concrete Syntax Tree (CST) YAML inspector and patcher.
 *
 * Built on `yaml` (`YAML.parseDocument`), preserving comments, blank lines,
 * key ordering, scalar quoting, and block scalars (`|`).
 *
 * Maintainability guarantee:
 *  - Zero per-resource AST functions: hierarchical trees (stages -> stepGroups ->
 *    parallel -> steps/rollbackSteps, phases -> activities, etc.) are walked by a
 *    single generic interpreter over pure-data `YamlTreeGrammarSpec` (`codeSpec.treeGrammar`).
 *  - Flat/nested resources without a custom `treeGrammar` are indexed automatically
 *    from `codeSpec.collections` + top-level sections + keyed dotted paths.
 *  - Enforces template ownership (`FIELD_OWNED_BY_TEMPLATE` vs `templateInputs`),
 *    loop/matrix instance protection (`MATRIX_INSTANCE_UNSUPPORTED`), YAML alias/anchor
 *    safety (`ALIAS_TARGET_UNSAFE`), and semantic diff bounds (`UNINTENDED_DIFF_DETECTED`).
 */

import YAML, {
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  type Document,
  type Node as YamlAstNode,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import {
  assertDynamicReplacementAllowed,
  DEFAULT_FLAVORS,
  describeValue,
} from "./provenance.js";
import {
  CodeEngineError,
  type CodeDiagnostic,
  type DynamicExpressionFlavor,
  type FieldChangeSummary,
  type InspectedNode,
  type PatchOperation,
  type PatchOpName,
  type ResourceCodeSpec,
  type SelectorTarget,
  type StructuredStepSelector,
  type ValueDescriptor,
  type YamlChildContainerRule,
  type YamlTreeGrammarSpec,
} from "./types.js";

const DEFAULT_SUPPORTED_OPS: readonly PatchOpName[] = [
  "set",
  "unset",
  "upsert_item",
  "remove_item",
];

interface ResolvedYamlNode {
  selector: string;
  kind: string;
  id: string;
  name?: string;
  nodeType?: string;
  mapNode: YAMLMap;
  rootPath: (string | number)[];
  templateInfo?: {
    templateRef: string;
    versionLabel?: string;
    templateInputsMap?: YAMLMap;
    templateInputsPath?: (string | number)[];
  };
  hasLoopStrategy?: boolean;
  childrenCount?: number;
}

export function makeNodeRef(revPrefix: string, selector: string): string {
  const encoded = Buffer.from(selector, "utf8").toString("base64url");
  return `nr_${revPrefix}_${encoded}`;
}

export function decodeNodeRef(nodeRef: string): { revPrefix: string; selector: string } | undefined {
  const match = /^nr_([a-f0-9]{8,16})_([A-Za-z0-9_-]+)$/.exec(nodeRef);
  if (!match) return undefined;
  try {
    const selector = Buffer.from(match[2]!, "base64url").toString("utf8");
    return { revPrefix: match[1]!, selector };
  } catch {
    return undefined;
  }
}

function parseYamlCst(source: string): Document.Parsed {
  const doc = YAML.parseDocument(source, { keepSourceTokens: true });
  if (doc.errors.length > 0) {
    const first = doc.errors[0]!;
    throw new CodeEngineError("VALIDATION_FAILED", `Invalid YAML syntax: ${first.message}`, [
      {
        code: "VALIDATION_FAILED",
        severity: "error",
        message: first.message,
      },
    ]);
  }
  return doc;
}

function getMapChild(
  map: YAMLMap,
  key: string,
): { node: YamlAstNode | null; pairIndex: number } | undefined {
  for (let i = 0; i < map.items.length; i++) {
    const pair = map.items[i]!;
    if (!isPair(pair)) continue;
    const k = isScalar(pair.key) ? String(pair.key.value) : undefined;
    if (k === key) {
      return { node: (pair.value as YamlAstNode | null) ?? null, pairIndex: i };
    }
  }
  return undefined;
}

function getScalarStr(map: YAMLMap, key: string): string | undefined {
  const hit = getMapChild(map, key);
  if (!hit || !isScalar(hit.node) || hit.node.value == null) return undefined;
  return String(hit.node.value);
}

function getFirstScalarStr(map: YAMLMap, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = getScalarStr(map, k);
    if (v) return v;
  }
  return undefined;
}

function resolveDottedChild(
  startMap: YAMLMap,
  dottedPath: string,
): { node: YamlAstNode | null | undefined; pathSegments: string[] } {
  const parts = dottedPath.split(".").filter(Boolean);
  let cur: YamlAstNode | null | undefined = startMap;
  for (const p of parts) {
    if (!cur || !isMap(cur)) return { node: undefined, pathSegments: parts };
    cur = getMapChild(cur, p)?.node;
  }
  return { node: cur, pathSegments: parts };
}

function collectReferencedAnchors(root: unknown): Set<string> {
  const referenced = new Set<string>();
  const visit = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    if (isAlias(n)) {
      if (n.source) referenced.add(n.source);
      return;
    }
    if (isMap(n)) {
      for (const pair of n.items) {
        visit(pair.key);
        visit(pair.value);
      }
    } else if (isSeq(n)) {
      for (const item of n.items) visit(item);
    }
  };
  visit(root);
  return referenced;
}

function assertNoSharedAnchorOrAliasOnPath(
  doc: Document.Parsed,
  pathSegments: readonly (string | number)[],
  selector: string,
): void {
  const referencedAnchors = collectReferencedAnchors(doc.contents);
  let cur: unknown = doc.contents;
  for (const seg of pathSegments) {
    if (!cur || typeof cur !== "object") break;
    if (isAlias(cur)) {
      throw new CodeEngineError(
        "ALIAS_TARGET_UNSAFE",
        `Target "${selector}" traverses a YAML alias (*${cur.source}), so a local edit cannot be guaranteed.`,
        [
          {
            code: "ALIAS_TARGET_UNSAFE",
            severity: "error",
            selector,
            message: `Path traverses YAML alias *${cur.source}. Inline the anchored block before applying a scoped edit.`,
          },
        ],
      );
    }
    const anchor = (cur as { anchor?: string }).anchor;
    if (anchor && referencedAnchors.has(anchor)) {
      throw new CodeEngineError(
        "ALIAS_TARGET_UNSAFE",
        `Target "${selector}" is inside YAML anchor &${anchor}, which is referenced by aliases elsewhere in the document.`,
        [
          {
            code: "ALIAS_TARGET_UNSAFE",
            severity: "error",
            selector,
            message: `Mutating &${anchor} would silently alter aliased nodes elsewhere in the YAML.`,
          },
        ],
      );
    }
    if (isMap(cur) && typeof seg === "string") {
      cur = getMapChild(cur, seg)?.node;
    } else if (isSeq(cur) && typeof seg === "number") {
      cur = cur.items[seg];
    } else {
      break;
    }
  }
  if (cur && typeof cur === "object" && isAlias(cur)) {
    throw new CodeEngineError(
      "ALIAS_TARGET_UNSAFE",
      `Field on "${selector}" is authored via YAML alias (*${cur.source}).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Generic Declarative Tree-Grammar Interpreter
// ---------------------------------------------------------------------------

function extractTemplateInfo(
  map: YAMLMap,
  basePath: (string | number)[],
): ResolvedYamlNode["templateInfo"] {
  const tmpl = getMapChild(map, "template")?.node;
  if (tmpl && isMap(tmpl)) {
    const templateRef = getScalarStr(tmpl, "templateRef") ?? getScalarStr(tmpl, "uses");
    if (templateRef) {
      const versionLabel = getScalarStr(tmpl, "versionLabel") ?? getScalarStr(tmpl, "version");
      const hasTemplateInputs = Boolean(getMapChild(tmpl, "templateInputs"));
      const hasWith = Boolean(getMapChild(tmpl, "with"));
      const inputsKey = hasTemplateInputs ? "templateInputs" : hasWith ? "with" : "inputs";
      const inputsNode = getMapChild(tmpl, inputsKey)?.node;
      return {
        templateRef,
        versionLabel,
        templateInputsMap: inputsNode && isMap(inputsNode) ? inputsNode : undefined,
        templateInputsPath: [...basePath, "template", inputsKey],
      };
    }
  }
  return undefined;
}

function indexByTreeGrammar(doc: Document.Parsed, grammar: YamlTreeGrammarSpec): ResolvedYamlNode[] {
  const nodes: ResolvedYamlNode[] = [];
  if (!doc.contents || !isMap(doc.contents)) return nodes;

  let rootMap: YAMLMap = doc.contents;
  let rootPrefix: (string | number)[] = [];
  if (grammar.rootWrapperKey) {
    const wrapped = getMapChild(doc.contents, grammar.rootWrapperKey)?.node;
    if (wrapped && isMap(wrapped)) {
      rootMap = wrapped;
      rootPrefix = [grammar.rootWrapperKey];
    }
  }

  const rootSeg = grammar.rootSegment ?? grammar.rootWrapperKey ?? "root";
  const rootId = getFirstScalarStr(rootMap, grammar.rootIdFields ?? ["identifier", "id"]) ?? rootSeg;
  nodes.push({
    selector: rootSeg,
    kind: rootSeg,
    id: rootId,
    name: getScalarStr(rootMap, "name"),
    mapNode: rootMap,
    rootPath: rootPrefix,
    templateInfo: extractTemplateInfo(rootMap, rootPrefix),
  });

  const walkContainer = (
    parentMap: YAMLMap,
    parentPath: (string | number)[],
    selectorPrefix: string,
    rule: YamlChildContainerRule,
    leafSegmentOverride?: string,
  ): void => {
    const { node: seqNode, pathSegments } = resolveDottedChild(parentMap, rule.sequencePath);
    if (!seqNode || !isSeq(seqNode)) return;
    const seqPath = [...parentPath, ...pathSegments];

    const walkSequenceItems = (seq: YAMLSeq, currentSeqPath: (string | number)[]): void => {
      seq.items.forEach((rawItem, idx) => {
        if (!isMap(rawItem)) return;
        const itemPath = [...currentSeqPath, idx];

        // 1. Transparent pass-through grouping keys (e.g. `parallel` or `parallel.steps`)
        for (const ptKey of rule.passThroughKeys ?? []) {
          const { node: ptNode, pathSegments: ptSegs } = resolveDottedChild(rawItem, ptKey);
          if (ptNode && isSeq(ptNode)) {
            walkSequenceItems(ptNode, [...itemPath, ...ptSegs]);
            return;
          }
        }

        // 2. Match first variant rule
        for (const variant of rule.variants) {
          let targetMap: YAMLMap | undefined;
          let targetPath: (string | number)[];
          if (variant.wrapperKey) {
            const inner = getMapChild(rawItem, variant.wrapperKey)?.node;
            if (!inner || !isMap(inner)) continue;
            targetMap = inner;
            targetPath = [...itemPath, variant.wrapperKey];
          } else {
            targetMap = rawItem;
            targetPath = itemPath;
          }

          const idVal = getFirstScalarStr(targetMap, variant.idFields);
          if (!idVal) continue;

          let nodeType = variant.typeFields ? getFirstScalarStr(targetMap, variant.typeFields) : undefined;
          if (!nodeType && variant.shorthandTypeKeys) {
            nodeType = variant.shorthandTypeKeys.find((k) => getMapChild(targetMap!, k)?.node !== undefined);
          }

          // Count immediate children across declared child containers & self-recursions
          let childrenCount: number | undefined;
          const allChildSeqPaths = [
            ...(variant.childContainers?.map((c) => c.sequencePath) ?? []),
            ...(variant.recurseSameLevelOn?.map((r) => r.sequencePath) ?? []),
          ];
          if (allChildSeqPaths.length > 0) {
            childrenCount = 0;
            for (const sp of allChildSeqPaths) {
              const childSeq = resolveDottedChild(targetMap, sp).node;
              if (childSeq && isSeq(childSeq)) childrenCount += childSeq.items.length;
            }
          }

          const effectiveSeg =
            leafSegmentOverride && !variant.recurseSameLevelOn?.length && !variant.childContainers?.length
              ? leafSegmentOverride
              : variant.segment;
          const selector = selectorPrefix
            ? `${selectorPrefix}/${effectiveSeg}:${idVal}`
            : `${effectiveSeg}:${idVal}`;

          nodes.push({
            selector,
            kind: effectiveSeg === "group" ? "step_group" : effectiveSeg,
            id: idVal,
            name: getScalarStr(targetMap, "name"),
            nodeType,
            mapNode: targetMap,
            rootPath: targetPath,
            templateInfo: extractTemplateInfo(targetMap, targetPath),
            hasLoopStrategy: Boolean(getMapChild(targetMap, "strategy")?.node),
            ...(childrenCount !== undefined ? { children_count: childrenCount, childrenCount } : {}),
          });

          // Recurse into child container rules
          for (const childRule of variant.childContainers ?? []) {
            walkContainer(targetMap, targetPath, selector, childRule);
          }

          // Recurse at same variant level (e.g. `stepGroup.steps` / `stepGroup.rollbackSteps`)
          for (const rec of variant.recurseSameLevelOn ?? []) {
            walkContainer(
              targetMap,
              targetPath,
              selector,
              {
                sequencePath: rec.sequencePath,
                passThroughKeys: rule.passThroughKeys,
                variants: rule.variants,
              },
              rec.overrideSegment ?? leafSegmentOverride,
            );
          }

          break;
        }
      });
    };

    walkSequenceItems(seqNode, seqPath);
  };

  for (const container of grammar.containers) {
    walkContainer(rootMap, rootPrefix, "", container);
  }

  return nodes;
}

function indexGenericYamlNodes(doc: Document.Parsed, codeSpec: ResourceCodeSpec): ResolvedYamlNode[] {
  const nodes: ResolvedYamlNode[] = [];
  if (!doc.contents || !isMap(doc.contents)) return nodes;

  let rootMap: YAMLMap = doc.contents;
  let rootPrefix: (string | number)[] = [];
  if (doc.contents.items.length === 1) {
    const only = doc.contents.items[0]!;
    if (isPair(only) && isScalar(only.key) && only.value && isMap(only.value)) {
      rootMap = only.value;
      rootPrefix = [String(only.key.value)];
    }
  }

  const rootId =
    getScalarStr(rootMap, "identifier") ??
    getScalarStr(rootMap, "id") ??
    (rootPrefix[0] ? String(rootPrefix[0]) : "root");
  nodes.push({
    selector: "root",
    kind: rootPrefix[0] ? String(rootPrefix[0]) : "document",
    id: rootId,
    name: getScalarStr(rootMap, "name"),
    nodeType: getScalarStr(rootMap, "type") ?? getScalarStr(rootMap, "kind"),
    mapNode: rootMap,
    rootPath: rootPrefix,
    childrenCount: rootMap.items.length,
  });

  for (const col of codeSpec.collections ?? []) {
    const relParts = col.path.split(".").filter(Boolean);
    const trimmedParts =
      rootPrefix.length === 1 && relParts[0] === rootPrefix[0] ? relParts.slice(1) : relParts;
    let cur: YamlAstNode | null | undefined = rootMap;
    const curPath: (string | number)[] = [...rootPrefix];
    for (const p of trimmedParts) {
      if (!cur || !isMap(cur)) {
        cur = undefined;
        break;
      }
      cur = getMapChild(cur, p)?.node;
      curPath.push(p);
    }
    if (cur && isSeq(cur)) {
      cur.items.forEach((rawItem, idx) => {
        if (!isMap(rawItem)) return;
        const wrappedHit = col.itemWrapperKey ? getMapChild(rawItem, col.itemWrapperKey)?.node : undefined;
        const inner = wrappedHit && isMap(wrappedHit) ? wrappedHit : rawItem;
        const innerPath =
          col.itemWrapperKey && inner !== rawItem ? [...curPath, idx, col.itemWrapperKey] : [...curPath, idx];
        const keyVal = getFirstScalarStr(inner, col.keyFields);
        if (!keyVal) return;
        nodes.push({
          selector: `${col.segment}:${keyVal}`,
          kind: col.segment,
          id: keyVal,
          name: col.labelField ? getScalarStr(inner, col.labelField) : getScalarStr(inner, "name"),
          nodeType: col.typeField ? getScalarStr(inner, col.typeField) : getScalarStr(inner, "type"),
          mapNode: inner,
          rootPath: innerPath,
        });
      });
    }
  }

  for (const pair of rootMap.items) {
    if (!isPair(pair) || !isScalar(pair.key)) continue;
    const key = String(pair.key.value);
    if (pair.value && isMap(pair.value)) {
      nodes.push({
        selector: `section:${key}`,
        kind: "section",
        id: key,
        mapNode: pair.value,
        rootPath: [...rootPrefix, key],
        childrenCount: pair.value.items.length,
      });
    }
  }

  return nodes;
}

function indexDocumentNodes(doc: Document.Parsed, codeSpec: ResourceCodeSpec): ResolvedYamlNode[] {
  if (codeSpec.treeGrammar) {
    return indexByTreeGrammar(doc, codeSpec.treeGrammar);
  }
  return indexGenericYamlNodes(doc, codeSpec);
}

// ---------------------------------------------------------------------------
// Node Field Summarization & Provenance
// ---------------------------------------------------------------------------

function summarizeYamlNodeFields(
  resolved: ResolvedYamlNode,
  flavors: readonly DynamicExpressionFlavor[],
  detailed: boolean,
): Record<string, ValueDescriptor> {
  const fields: Record<string, ValueDescriptor> = {};
  const jsObj = resolved.mapNode.toJSON() as Record<string, unknown> | null;
  if (!jsObj || typeof jsObj !== "object") return fields;

  const skipStructuralKeys = new Set(["stages", "steps", "rollbackSteps", "parallel"]);
  const skipInOutlineKeys = new Set(["description", "command", "script", "identifier", "id", "name", "type"]);
  for (const [k, v] of Object.entries(jsObj)) {
    if (skipStructuralKeys.has(k)) continue;
    if (!detailed && skipInOutlineKeys.has(k)) continue;
    if (k === "spec" && v && typeof v === "object" && !Array.isArray(v)) {
      const specObj = v as Record<string, unknown>;
      for (const [sk, sv] of Object.entries(specObj)) {
        if (skipStructuralKeys.has(sk) || sk === "execution") continue;
        if (!detailed && (skipInOutlineKeys.has(sk) || (sv && typeof sv === "object"))) continue;
        fields[`spec.${sk}`] = describeValue(sv, flavors);
      }
      continue;
    }
    if (k === "template" && resolved.templateInfo) {
      const tmplInputs = resolved.templateInfo.templateInputsMap?.toJSON() as Record<string, unknown> | undefined;
      if (tmplInputs && typeof tmplInputs === "object") {
        flattenTemplateInputs(tmplInputs, "", fields, flavors, resolved.templateInfo.templateRef);
      }
      continue;
    }
    if (!detailed && v && typeof v === "object") continue;
    fields[k] = describeValue(v, flavors);
  }
  return fields;
}

function flattenTemplateInputs(
  obj: Record<string, unknown>,
  prefix: string,
  out: Record<string, ValueDescriptor>,
  flavors: readonly DynamicExpressionFlavor[],
  owningTemplate: string,
  depth = 0,
): void {
  if (depth > 3) return;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenTemplateInputs(v as Record<string, unknown>, key, out, flavors, owningTemplate, depth + 1);
    } else {
      out[`template_input.${key}`] = describeValue(v, flavors, {
        source: "template_input",
        owningTemplate,
      });
    }
  }
}

function toInspectedNode(
  resolved: ResolvedYamlNode,
  revPrefix: string,
  flavors: readonly DynamicExpressionFlavor[],
  detailed: boolean,
): InspectedNode {
  const fields = summarizeYamlNodeFields(resolved, flavors, detailed);
  const editableInputs = Object.keys(fields)
    .filter((k) => k.startsWith("template_input."))
    .map((k) => k.slice("template_input.".length));

  return {
    selector: resolved.selector,
    node_ref: makeNodeRef(revPrefix, resolved.selector),
    kind: resolved.kind,
    id: resolved.id,
    ...(resolved.name ? { name: resolved.name } : {}),
    ...(resolved.nodeType ? { node_type: resolved.nodeType } : {}),
    ...(resolved.templateInfo
      ? {
          template: {
            template_ref: resolved.templateInfo.templateRef,
            ...(resolved.templateInfo.versionLabel ? { version_label: resolved.templateInfo.versionLabel } : {}),
            editable_inputs: editableInputs,
          },
        }
      : {}),
    supported_ops: DEFAULT_SUPPORTED_OPS,
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
    ...(resolved.childrenCount !== undefined ? { children_count: resolved.childrenCount } : {}),
  };
}

// ---------------------------------------------------------------------------
// Selector Normalization & Deterministic Resolution
// ---------------------------------------------------------------------------

function normalizeSelectorTarget(
  target: SelectorTarget | undefined,
  expectedRevPrefix?: string,
): { rawSelector: string } {
  if (target === undefined || target === "") {
    return { rawSelector: "root" };
  }
  if (typeof target === "string") {
    const trimmed = target.trim();
    if (trimmed.startsWith("nr_")) {
      const decoded = decodeNodeRef(trimmed);
      if (!decoded) {
        throw new CodeEngineError("TARGET_NOT_FOUND", `Malformed node_ref "${trimmed}".`);
      }
      if (expectedRevPrefix && decoded.revPrefix !== expectedRevPrefix) {
        throw new CodeEngineError(
          "REVISION_CONFLICT",
          `node_ref "${trimmed}" belongs to revision prefix "${decoded.revPrefix}", but document is at "${expectedRevPrefix}". Re-inspect the resource.`,
        );
      }
      return { rawSelector: decoded.selector };
    }
    return { rawSelector: trimmed || "root" };
  }
  if ("node_ref" in target) {
    return normalizeSelectorTarget(target.node_ref, expectedRevPrefix);
  }
  if ("selector" in target) {
    if (typeof target.selector === "string") {
      return normalizeSelectorTarget(target.selector, expectedRevPrefix);
    }
    return { rawSelector: formatStructuredStepSelector(target.selector) };
  }
  return { rawSelector: "root" };
}

function formatStructuredStepSelector(sel: StructuredStepSelector): string {
  const parts: string[] = [];
  if (sel.stage_id) parts.push(`stage:${sel.stage_id}`);
  if (sel.group_ids?.length) {
    for (const g of sel.group_ids) parts.push(`group:${g}`);
  }
  if (sel.step_id) {
    parts.push(`${sel.section === "rollback" ? "rollback_step" : "step"}:${sel.step_id}`);
  }
  return parts.join("/") || "root";
}

function matchNodesForQuery(nodes: ResolvedYamlNode[], query: string): ResolvedYamlNode[] {
  if (!query || query === "*" || query === "all") return nodes;
  if (query === "root" || query === "/") return nodes.slice(0, 1);

  const exact = nodes.filter((n) => n.selector === query);
  if (exact.length > 0) return exact;

  const querySegs = query.split("/").filter(Boolean);
  const segMatches = nodes.filter((n) => {
    const nSegs = n.selector.split("/").filter(Boolean);
    let pos = 0;
    for (const qs of querySegs) {
      const found = nSegs.indexOf(qs, pos);
      if (found === -1) return false;
      pos = found + 1;
    }
    return true;
  });
  if (segMatches.length > 0) return segMatches;

  return nodes.filter((n) => n.id === query);
}

function resolveWriteTarget(
  doc: Document.Parsed,
  nodes: ResolvedYamlNode[],
  target: SelectorTarget | undefined,
  revPrefix: string,
): ResolvedYamlNode {
  const { rawSelector } = normalizeSelectorTarget(target, revPrefix);
  if (rawSelector === "root") {
    if (nodes[0]) return nodes[0];
    throw new CodeEngineError("TARGET_NOT_FOUND", "Document has no root map node.");
  }

  const exact = nodes.filter((n) => n.selector === rawSelector);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) {
    throw new CodeEngineError("TARGET_AMBIGUOUS", `Selector "${rawSelector}" matched ${exact.length} nodes.`, [
      {
        code: "TARGET_AMBIGUOUS",
        severity: "error",
        selector: rawSelector,
        message: `Multiple nodes matched "${rawSelector}".`,
        candidates: exact.map((m) => m.selector),
      },
    ]);
  }

  if (rawSelector.includes(":")) {
    const querySegs = rawSelector.split("/").filter(Boolean);
    const segMatches = nodes.filter((n) => {
      const nSegs = n.selector.split("/").filter(Boolean);
      const lastQuery = querySegs[querySegs.length - 1]!;
      const lastNode = nSegs[nSegs.length - 1]!;
      if (lastQuery.split(":")[0] !== lastNode.split(":")[0]) return false;
      let pos = 0;
      for (const qs of querySegs) {
        const found = nSegs.indexOf(qs, pos);
        if (found === -1) return false;
        pos = found + 1;
      }
      return true;
    });
    if (segMatches.length === 1) return segMatches[0]!;
    if (segMatches.length > 1) {
      throw new CodeEngineError(
        "TARGET_AMBIGUOUS",
        `Selector "${rawSelector}" is ambiguous across ${segMatches.length} nodes: ${segMatches.map((m) => m.selector).join(", ")}`,
        [
          {
            code: "TARGET_AMBIGUOUS",
            severity: "error",
            selector: rawSelector,
            message: `Ambiguous selector matched ${segMatches.length} nodes.`,
            remediation: "Pass one of the full canonical selectors listed in candidates.",
            candidates: segMatches.map((m) => m.selector),
          },
        ],
      );
    }

    const lastSeg = querySegs[querySegs.length - 1]!;
    const instanceMatch = /^(step|rollback_step|stage|group):(.+?)(?:_\d+|\[\d+\])$/.exec(lastSeg);
    if (instanceMatch) {
      const baseId = instanceMatch[2]!;
      const authored = nodes.find((n) => n.id === baseId && n.hasLoopStrategy);
      if (authored) {
        throw new CodeEngineError(
          "MATRIX_INSTANCE_UNSUPPORTED",
          `Target "${rawSelector}" addresses a single expanded loop/matrix instance of "${authored.selector}", which cannot be edited independently.`,
          [
            {
              code: "MATRIX_INSTANCE_UNSUPPORTED",
              severity: "error",
              selector: rawSelector,
              message: `Node "${authored.selector}" uses a loop/matrix strategy; individual expanded instances share the same authored definition.`,
              remediation: `Target the authored node "${authored.selector}" directly, or parameterize via a matrix variable.`,
              candidates: [authored.selector],
            },
          ],
        );
      }
    }
  }

  const genericResolved = resolveGenericDottedYamlMap(doc, rawSelector);
  if (genericResolved) return genericResolved;

  const candidateHints = nodes
    .filter((n) => n.selector.toLowerCase().includes(rawSelector.replace(/^[a-z_]+:/i, "").toLowerCase()))
    .slice(0, 8)
    .map((n) => n.selector);

  throw new CodeEngineError("TARGET_NOT_FOUND", `Target "${rawSelector}" did not match any authored node.`, [
    {
      code: "TARGET_NOT_FOUND",
      severity: "error",
      selector: rawSelector,
      message: `No authored node found for selector "${rawSelector}".`,
      remediation: "Call harness_get with view='outline' or select to inspect valid canonical selectors.",
      ...(candidateHints.length > 0 ? { candidates: candidateHints } : {}),
    },
  ]);
}

function resolveGenericDottedYamlMap(doc: Document.Parsed, pathExpr: string): ResolvedYamlNode | undefined {
  if (!doc.contents || !isMap(doc.contents)) return undefined;
  if (/\[\d+\]/.test(pathExpr)) return undefined;

  const tokenRe = /^([A-Za-z0-9_-]+)(?:\[([A-Za-z0-9_-]+)=([^\]]+)\])?$/;
  const tokens: Array<{ prop: string; keyField?: string; keyVal?: string }> = [];
  for (const part of pathExpr.split(".")) {
    if (!part) continue;
    const m = tokenRe.exec(part);
    if (!m) return undefined;
    tokens.push({ prop: m[1]!, keyField: m[2], keyVal: m[3] });
  }
  if (tokens.length === 0) return undefined;

  let cur: YamlAstNode | null | undefined = doc.contents;
  const rootPath: (string | number)[] = [];
  if (!getMapChild(doc.contents, tokens[0]!.prop) && doc.contents.items.length === 1) {
    const only = doc.contents.items[0]!;
    if (isPair(only) && isScalar(only.key) && only.value && isMap(only.value)) {
      cur = only.value;
      rootPath.push(String(only.key.value));
    }
  }

  for (const tok of tokens) {
    if (!cur || !isMap(cur)) return undefined;
    cur = getMapChild(cur, tok.prop)?.node;
    rootPath.push(tok.prop);
    if (tok.keyField && tok.keyVal !== undefined) {
      if (!cur || !isSeq(cur)) return undefined;
      const matches: Array<{ map: YAMLMap; idx: number; wrapper?: string }> = [];
      cur.items.forEach((el, idx) => {
        if (!isMap(el)) return;
        if (getScalarStr(el, tok.keyField!) === tok.keyVal) {
          matches.push({ map: el, idx });
          return;
        }
        if (
          el.items.length === 1 &&
          isPair(el.items[0]!) &&
          isScalar(el.items[0]!.key) &&
          el.items[0]!.value &&
          isMap(el.items[0]!.value)
        ) {
          const inner = el.items[0]!.value;
          const wk = String(el.items[0]!.key.value);
          if (getScalarStr(inner, tok.keyField!) === tok.keyVal) {
            matches.push({ map: inner, idx, wrapper: wk });
          }
        }
      });
      if (matches.length > 1) {
        throw new CodeEngineError("TARGET_AMBIGUOUS", `Path "${pathExpr}" matched ${matches.length} items for [${tok.keyField}=${tok.keyVal}].`);
      }
      if (matches.length === 0) return undefined;
      const hit = matches[0]!;
      rootPath.push(hit.idx);
      if (hit.wrapper) rootPath.push(hit.wrapper);
      cur = hit.map;
    }
  }

  if (!cur || !isMap(cur)) return undefined;
  return {
    selector: pathExpr,
    kind: "map",
    id: tokens[tokens.length - 1]!.keyVal ?? tokens[tokens.length - 1]!.prop,
    mapNode: cur,
    rootPath,
  };
}

// ---------------------------------------------------------------------------
// Public Inspect & Patch Entrypoints for YAML CST
// ---------------------------------------------------------------------------

export function inspectYamlDocument(params: {
  source: string;
  codeSpec: ResourceCodeSpec;
  revPrefix: string;
  view: "outline" | "select";
  select?: string;
  cursor?: string;
  pageSize?: number;
}): { nodes: InspectedNode[]; totalNodes: number; truncated: boolean; nextCursor?: string } {
  const { source, codeSpec, revPrefix, view, select, cursor } = params;
  const pageSize = params.pageSize ?? (view === "outline" ? 60 : 25);
  const doc = parseYamlCst(source);
  const flavors = codeSpec.dynamicExpressions ?? DEFAULT_FLAVORS;
  const allResolved = indexDocumentNodes(doc, codeSpec);

  let matched: ResolvedYamlNode[];
  if (view === "select" && select) {
    matched = [];
    for (const q of select.split(",").map((s) => s.trim()).filter(Boolean)) {
      const hits = matchNodesForQuery(allResolved, q);
      if (hits.length > 0) {
        matched.push(...hits);
      } else {
        const dotted = resolveGenericDottedYamlMap(doc, q);
        if (dotted) matched.push(dotted);
      }
    }
  } else {
    matched = allResolved;
  }

  const unique: ResolvedYamlNode[] = [];
  const seen = new Set<string>();
  for (const m of matched) {
    if (!seen.has(m.selector)) {
      seen.add(m.selector);
      unique.push(m);
    }
  }

  const offset = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
  const slice = unique.slice(offset, offset + pageSize);
  const detailed = view === "select";
  const inspected = slice.map((n) => toInspectedNode(n, revPrefix, flavors, detailed));
  const hasMore = offset + pageSize < unique.length;

  return {
    nodes: inspected,
    totalNodes: unique.length,
    truncated: hasMore,
    ...(hasMore ? { nextCursor: String(offset + pageSize) } : {}),
  };
}

function resolveFieldMapAndKey(params: {
  doc: Document.Parsed;
  targetNode: ResolvedYamlNode;
  field: string;
  editScope: "local" | "template_input" | undefined;
  createMissingContainers: boolean;
}): {
  containerMap: YAMLMap;
  leafKey: string;
  fullPath: (string | number)[];
  sourceKind: "authored" | "template_input";
  owningTemplate?: string;
} {
  const { doc, targetNode, field, editScope, createMissingContainers } = params;
  const cleanField = field.trim().replace(/^\.+/, "");
  if (!cleanField) {
    throw new CodeEngineError("INVALID_PATCH_OPERATION", `field is required for patch on "${targetNode.selector}".`);
  }

  if (targetNode.templateInfo) {
    const { templateRef, templateInputsMap, templateInputsPath } = targetNode.templateInfo;
    const localWrapperFields = new Set(["name", "identifier", "id", "description", "when"]);
    const isWrapperMeta = localWrapperFields.has(cleanField) && editScope !== "template_input";

    if (!isWrapperMeta) {
      const candidateRelPaths = [cleanField, `spec.${cleanField}`];
      let matchedInputRel: string | undefined;
      if (templateInputsMap) {
        for (const rel of candidateRelPaths) {
          if (readNestedYamlValue(templateInputsMap, rel.split(".")) !== undefined) {
            matchedInputRel = rel;
            break;
          }
        }
      }

      if (editScope === "template_input") {
        if (!templateInputsMap || !matchedInputRel || !templateInputsPath) {
          throw new CodeEngineError(
            "FIELD_OWNED_BY_TEMPLATE",
            `Template "${templateRef}" on "${targetNode.selector}" does not expose an editable "${cleanField}" binding in templateInputs.`,
            [
              {
                code: "FIELD_OWNED_BY_TEMPLATE",
                severity: "error",
                selector: targetNode.selector,
                field: cleanField,
                message: `Field "${cleanField}" is fixed inside template "${templateRef}" and not exposed in templateInputs.`,
                remediation: `Update template "${templateRef}" directly, or expose "${cleanField}" as a runtime/template input in that template.`,
              },
            ],
          );
        }
        const parts = matchedInputRel.split(".");
        const nav = navigateMapContainers(templateInputsMap, parts.slice(0, -1), templateInputsPath, createMissingContainers, doc);
        return {
          containerMap: nav.map,
          leafKey: parts[parts.length - 1]!,
          fullPath: [...nav.path, parts[parts.length - 1]!],
          sourceKind: "template_input",
          owningTemplate: templateRef,
        };
      }

      const directExisting = readNestedYamlValue(targetNode.mapNode, cleanField.split("."));
      if (directExisting === undefined) {
        if (matchedInputRel) {
          throw new CodeEngineError(
            "FIELD_OWNED_BY_TEMPLATE",
            `Node "${targetNode.selector}" is backed by template "${templateRef}" which exposes "${matchedInputRel}" as a template input. Pass edit_scope: "template_input" to edit the pipeline-local binding explicitly.`,
            [
              {
                code: "FIELD_OWNED_BY_TEMPLATE",
                severity: "error",
                selector: targetNode.selector,
                field: cleanField,
                message: `Field "${cleanField}" is bound via template "${templateRef}" (${matchedInputRel}).`,
                remediation: `Retry with edit_scope: "template_input" to modify the pipeline-local template binding.`,
              },
            ],
          );
        }
        throw new CodeEngineError(
          "FIELD_OWNED_BY_TEMPLATE",
          `Field "${cleanField}" on "${targetNode.selector}" is owned by template "${templateRef}" and cannot be edited on the referencing pipeline.`,
          [
            {
              code: "FIELD_OWNED_BY_TEMPLATE",
              severity: "error",
              selector: targetNode.selector,
              field: cleanField,
              message: `Step/stage uses template "${templateRef}" without exposing "${cleanField}" in templateInputs.`,
              remediation: `Inspect or update template "${templateRef}" directly using resource_type="template".`,
            },
          ],
        );
      }
    }
  }

  const parts = cleanField.split(".");
  const nav = navigateMapContainers(targetNode.mapNode, parts.slice(0, -1), targetNode.rootPath, createMissingContainers, doc);
  return {
    containerMap: nav.map,
    leafKey: parts[parts.length - 1]!,
    fullPath: [...nav.path, parts[parts.length - 1]!],
    sourceKind: "authored",
  };
}

function readNestedYamlValue(map: YAMLMap, parts: string[]): unknown {
  let cur: YamlAstNode | null | undefined = map;
  for (const p of parts) {
    if (!cur || !isMap(cur)) return undefined;
    cur = getMapChild(cur, p)?.node;
  }
  if (cur === undefined) return undefined;
  if (cur === null) return null;
  return isScalar(cur) ? cur.value : cur.toJSON();
}

function navigateMapContainers(
  startMap: YAMLMap,
  containers: string[],
  startPath: (string | number)[],
  createMissing: boolean,
  doc: Document.Parsed,
): { map: YAMLMap; path: (string | number)[] } {
  let cur = startMap;
  const path = [...startPath];
  for (const seg of containers) {
    const hit = getMapChild(cur, seg);
    if (!hit || hit.node === null) {
      if (!createMissing) {
        throw new CodeEngineError("TARGET_NOT_FOUND", `Container "${seg}" does not exist at "${path.join(".")}".`);
      }
      const nextMap = doc.createNode({}) as YAMLMap;
      cur.set(seg, nextMap);
      cur = nextMap;
      path.push(seg);
      continue;
    }
    if (!isMap(hit.node)) {
      throw new CodeEngineError(
        "INVALID_PATCH_OPERATION",
        `Cannot traverse through non-object field "${seg}" at "${path.join(".")}".`,
      );
    }
    cur = hit.node;
    path.push(seg);
  }
  return { map: cur, path };
}

export function applyYamlPatches(params: {
  source: string;
  codeSpec: ResourceCodeSpec;
  revPrefix: string;
  operations: readonly PatchOperation[];
}): {
  patchedSource: string;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
} {
  const { source, codeSpec, revPrefix, operations } = params;
  if (operations.length === 0) {
    throw new CodeEngineError("INVALID_PATCH_OPERATION", "At least one patch operation is required.");
  }

  const beforeObj = YAML.parse(source) as unknown;
  const doc = parseYamlCst(source);
  const flavors = codeSpec.dynamicExpressions ?? DEFAULT_FLAVORS;
  const changes: FieldChangeSummary[] = [];
  const diagnostics: CodeDiagnostic[] = [];
  const touchedCanonicalPaths = new Map<string, number>();
  const allowedDiffRoots: Array<(string | number)[]> = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    const nodes = indexDocumentNodes(doc, codeSpec);
    const targetNode = resolveWriteTarget(doc, nodes, op.target, revPrefix);

    if (op.op === "set" || op.op === "unset") {
      if (!op.field) {
        throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (${op.op}) requires "field".`);
      }
      const resolved = resolveFieldMapAndKey({
        doc,
        targetNode,
        field: op.field,
        editScope: op.edit_scope,
        createMissingContainers: op.op === "set",
      });

      const canonicalKey = resolved.fullPath.map(String).join(".");
      if (touchedCanonicalPaths.has(canonicalKey)) {
        throw new CodeEngineError(
          "OVERLAPPING_OPERATIONS",
          `Operation #${i + 1} overlaps with operation #${touchedCanonicalPaths.get(canonicalKey)! + 1} on path "${canonicalKey}".`,
          [
            {
              code: "OVERLAPPING_OPERATIONS",
              severity: "error",
              selector: targetNode.selector,
              field: op.field,
              message: `Multiple operations in the same batch target "${canonicalKey}".`,
            },
          ],
        );
      }
      for (const [prevKey, prevIdx] of touchedCanonicalPaths.entries()) {
        if (canonicalKey.startsWith(`${prevKey}.`) || prevKey.startsWith(`${canonicalKey}.`)) {
          throw new CodeEngineError(
            "OVERLAPPING_OPERATIONS",
            `Operation #${i + 1} ("${canonicalKey}") overlaps with ancestor/descendant operation #${prevIdx + 1} ("${prevKey}").`,
          );
        }
      }
      touchedCanonicalPaths.set(canonicalKey, i);

      assertNoSharedAnchorOrAliasOnPath(doc, resolved.fullPath, targetNode.selector);

      const existingPair = getMapChild(resolved.containerMap, resolved.leafKey);
      const rawBefore =
        existingPair === undefined
          ? undefined
          : existingPair.node === null
            ? null
            : isScalar(existingPair.node)
              ? existingPair.node.value
              : existingPair.node.toJSON();

      const beforeDesc = describeValue(rawBefore, flavors, {
        source: resolved.sourceKind === "template_input" ? "template_input" : undefined,
        owningTemplate: resolved.owningTemplate,
      });

      assertDynamicReplacementAllowed({
        before: beforeDesc,
        replaceDynamic: op.replace_dynamic,
        selector: targetNode.selector,
        field: op.field,
      });

      if (op.op === "set") {
        if (op.value === undefined) {
          throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (set) requires "value" (use "unset" to remove a field).`);
        }
        if (JSON.stringify(rawBefore) === JSON.stringify(op.value)) {
          continue;
        }
        if (existingPair && isScalar(existingPair.node) && (op.value === null || typeof op.value !== "object")) {
          existingPair.node.value = op.value;
        } else {
          resolved.containerMap.set(resolved.leafKey, doc.createNode(op.value));
        }
        const afterDesc = describeValue(op.value, flavors, {
          source: resolved.sourceKind === "template_input" ? "template_input" : undefined,
          owningTemplate: resolved.owningTemplate,
        });
        changes.push({
          target: targetNode.selector,
          field: op.field,
          op: "set",
          before: beforeDesc,
          after: afterDesc,
          source: resolved.sourceKind,
        });
        allowedDiffRoots.push(resolved.fullPath);
      } else {
        if (existingPair === undefined) continue;
        resolved.containerMap.delete(resolved.leafKey);
        changes.push({
          target: targetNode.selector,
          field: op.field,
          op: "unset",
          before: beforeDesc,
          after: { kind: "absent" },
          source: resolved.sourceKind,
        });
        allowedDiffRoots.push(resolved.fullPath);
      }
      continue;
    }

    if (op.op === "upsert_item" || op.op === "remove_item") {
      if (!op.key_field || !op.key_value) {
        throw new CodeEngineError(
          "INVALID_PATCH_OPERATION",
          `Operation #${i + 1} (${op.op}) requires both "key_field" and "key_value".`,
        );
      }
      const seqParts = op.field ? op.field.split(".").filter(Boolean) : [];
      if (seqParts.length === 0) {
        throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (${op.op}) requires "field" naming the sequence.`);
      }
      const parentNav = navigateMapContainers(
        targetNode.mapNode,
        seqParts.slice(0, -1),
        targetNode.rootPath,
        op.op === "upsert_item",
        doc,
      );
      const seqKey = seqParts[seqParts.length - 1]!;
      const seqPath = [...parentNav.path, seqKey];
      const itemLockKey = `${seqPath.join(".")}[${op.key_field}=${op.key_value}]`;
      if (touchedCanonicalPaths.has(itemLockKey)) {
        throw new CodeEngineError("OVERLAPPING_OPERATIONS", `Duplicate list operation on "${itemLockKey}".`);
      }
      touchedCanonicalPaths.set(itemLockKey, i);
      assertNoSharedAnchorOrAliasOnPath(doc, seqPath, targetNode.selector);

      let seqHit: YamlAstNode | null | undefined = getMapChild(parentNav.map, seqKey)?.node;
      if (!seqHit) {
        if (op.op === "remove_item") continue;
        const createdSeq = doc.createNode([]) as YAMLSeq;
        parentNav.map.set(seqKey, createdSeq);
        seqHit = createdSeq;
      }
      if (!isSeq(seqHit)) {
        throw new CodeEngineError("INVALID_PATCH_OPERATION", `Field "${op.field}" on "${targetNode.selector}" is not a YAML sequence.`);
      }
      const targetSeq = seqHit as YAMLSeq<YamlAstNode>;

      const matchIndices: number[] = [];
      targetSeq.items.forEach((el, idx) => {
        if (isMap(el) && getScalarStr(el, op.key_field!) === op.key_value) {
          matchIndices.push(idx);
        }
      });
      if (matchIndices.length > 1) {
        throw new CodeEngineError("TARGET_AMBIGUOUS", `Sequence "${op.field}" has ${matchIndices.length} items with ${op.key_field}="${op.key_value}".`);
      }

      if (op.op === "upsert_item") {
        if (!op.value || typeof op.value !== "object" || Array.isArray(op.value)) {
          throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (upsert_item) requires an object "value".`);
        }
        const nextVal = { ...(op.value as Record<string, unknown>), [op.key_field]: op.key_value };
        if (matchIndices.length === 1) {
          const idx = matchIndices[0]!;
          const prevJson = (targetSeq.items[idx] as YAMLMap).toJSON();
          if (JSON.stringify(prevJson) === JSON.stringify(nextVal)) continue;
          targetSeq.items[idx] = doc.createNode(nextVal);
          changes.push({
            target: targetNode.selector,
            field: `${op.field}[${op.key_field}=${op.key_value}]`,
            op: "upsert_item",
            before: describeValue(prevJson, flavors),
            after: describeValue(nextVal, flavors),
            source: "authored",
          });
        } else {
          targetSeq.add(doc.createNode(nextVal));
          changes.push({
            target: targetNode.selector,
            field: `${op.field}[${op.key_field}=${op.key_value}]`,
            op: "upsert_item",
            before: { kind: "absent" },
            after: describeValue(nextVal, flavors),
            source: "authored",
          });
        }
        allowedDiffRoots.push(seqPath);
      } else {
        if (matchIndices.length === 0) continue;
        const idx = matchIndices[0]!;
        const prevJson = (targetSeq.items[idx] as YAMLMap).toJSON();
        targetSeq.items.splice(idx, 1);
        changes.push({
          target: targetNode.selector,
          field: `${op.field}[${op.key_field}=${op.key_value}]`,
          op: "remove_item",
          before: describeValue(prevJson, flavors),
          after: { kind: "absent" },
          source: "authored",
        });
        allowedDiffRoots.push(seqPath);
      }
      continue;
    }

    throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation "${op.op}" is not supported on YAML documents.`);
  }

  if (changes.length === 0) {
    return { patchedSource: source, changes: [], diagnostics };
  }

  const patchedSource = doc.toString({ lineWidth: 0 });
  const afterObj = YAML.parse(patchedSource) as unknown;
  verifyScopedSemanticDiff(beforeObj, afterObj, allowedDiffRoots);

  return { patchedSource, changes, diagnostics };
}

function isDeepValueEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((el, idx) => isDeepValueEqual(el, b[idx]));
  }
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => Object.prototype.hasOwnProperty.call(bRec, k) && isDeepValueEqual(aRec[k], bRec[k]));
}

export function verifyScopedSemanticDiff(
  before: unknown,
  after: unknown,
  allowedPaths: ReadonlyArray<readonly (string | number)[]>,
  currentPath: (string | number)[] = [],
): void {
  if (isDeepValueEqual(before, after)) return;

  const isInsideAllowed = allowedPaths.some(
    (allowed) =>
      currentPath.length >= allowed.length &&
      allowed.every((seg, idx) => String(seg) === String(currentPath[idx])),
  );
  if (isInsideAllowed) return;

  const isAncestorOfAllowed = allowedPaths.some(
    (allowed) =>
      currentPath.length < allowed.length &&
      currentPath.every((seg, idx) => String(seg) === String(allowed[idx])),
  );

  if (
    isAncestorOfAllowed &&
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    if (Array.isArray(before) && Array.isArray(after)) {
      if (before.length !== after.length) {
        throw new CodeEngineError(
          "UNINTENDED_DIFF_DETECTED",
          `Unexpected array length change at "${currentPath.join(".")}" (${before.length} -> ${after.length}).`,
        );
      }
      for (let i = 0; i < before.length; i++) {
        verifyScopedSemanticDiff(before[i], after[i], allowedPaths, [...currentPath, i]);
      }
      return;
    }
    if (!Array.isArray(before) && !Array.isArray(after)) {
      const bRec = before as Record<string, unknown>;
      const aRec = after as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(bRec), ...Object.keys(aRec)]);
      for (const k of allKeys) {
        verifyScopedSemanticDiff(bRec[k], aRec[k], allowedPaths, [...currentPath, k]);
      }
      return;
    }
  }

  throw new CodeEngineError(
    "UNINTENDED_DIFF_DETECTED",
    `Round-trip serialization introduced an unintended change at "${currentPath.join(".") || "<root>"}".`,
  );
}
