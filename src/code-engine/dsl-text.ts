/**
 * DSL & Grammar block codecs:
 *  - `rego`: OPA Policy-as-Code (`policy` resource `rego` source) — outlines package,
 *    imports, and rules with line spans & hashes; supports rule-scoped selection and
 *    hash-guarded `replace_block` / rule append/remove without sending full Rego bundles.
 *  - `antlr4`: HQL ANTLR4 `.g4` grammar (`kg_grammar`) — outlines parser/lexer rules and
 *    returns targeted grammar rules (+ 1-hop referenced non-terminals) for low-token HQL authoring.
 */

import { createHash } from "node:crypto";
import { decodeNodeRef, makeNodeRef } from "./yaml-cst.js";
import {
  CodeEngineError,
  type CodeDiagnostic,
  type FieldChangeSummary,
  type InspectedNode,
  type PatchOperation,
  type SelectorTarget,
} from "./types.js";

export function shortBlockHash(text: string): string {
  return `bh_${createHash("sha256").update(text.trim(), "utf8").digest("hex").slice(0, 12)}`;
}

// ---------------------------------------------------------------------------
// OPA Rego Parser & Patcher
// ---------------------------------------------------------------------------

interface RegoBlock {
  selector: string;
  kind: "package" | "imports" | "rule";
  id: string;
  ruleType?: string;
  startLine: number; // 1-based inclusive
  endLine: number;   // 1-based inclusive
  startOffset: number;
  endOffset: number;
  source: string;
  hash: string;
}

const REGO_RULE_START_RE =
  /^(?:(default)\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_.]*)\s*(?:\[|\(|\s+contains\b|\s+if\b|\s*:=|\s*=|\s*\{))/;

function parseRegoBlocks(source: string): RegoBlock[] {
  const lines = source.split("\n");
  const lineOffsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    lineOffsets.push(acc);
    acc += line.length + 1;
  }
  const endOfLineOffset = (lineIdx: number): number =>
    Math.min(source.length, (lineOffsets[lineIdx] ?? 0) + (lines[lineIdx]?.length ?? 0));

  const blocks: RegoBlock[] = [];
  const nameCounts = new Map<string, number>();

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i]!.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    if (/^package\s+/.test(trimmed)) {
      const pkgName = trimmed.replace(/^package\s+/, "").trim();
      const text = lines[i]!;
      blocks.push({
        selector: "package",
        kind: "package",
        id: pkgName,
        startLine: i + 1,
        endLine: i + 1,
        startOffset: lineOffsets[i]!,
        endOffset: endOfLineOffset(i),
        source: text,
        hash: shortBlockHash(text),
      });
      i++;
      continue;
    }

    if (/^import\s+/.test(trimmed)) {
      const start = i;
      while (i + 1 < lines.length && /^import\s+/.test(lines[i + 1]!.trim())) {
        i++;
      }
      const startOff = lineOffsets[start]!;
      const endOff = endOfLineOffset(i);
      const text = source.slice(startOff, endOff);
      blocks.push({
        selector: "imports",
        kind: "imports",
        id: "imports",
        startLine: start + 1,
        endLine: i + 1,
        startOffset: startOff,
        endOffset: endOff,
        source: text,
        hash: shortBlockHash(text),
      });
      i++;
      continue;
    }

    const m = REGO_RULE_START_RE.exec(trimmed);
    if (m) {
      const isDefault = Boolean(m[1]);
      const baseName = (m[2] ?? m[3])!;
      const start = i;
      let braceDepth = countBracesOutsideStrings(lines[i]!);
      while (braceDepth > 0 && i + 1 < lines.length) {
        i++;
        braceDepth += countBracesOutsideStrings(lines[i]!);
      }
      const count = (nameCounts.get(baseName) ?? 0) + 1;
      nameCounts.set(baseName, count);

      const startOff = lineOffsets[start]!;
      const endOff = endOfLineOffset(i);
      const text = source.slice(startOff, endOff);
      blocks.push({
        selector: count === 1 ? `rule:${baseName}` : `rule:${baseName}#${count}`,
        kind: "rule",
        id: baseName,
        ruleType: isDefault ? "default" : baseName.startsWith("deny") ? "deny" : baseName.startsWith("warn") ? "warn" : baseName.startsWith("allow") ? "allow" : "rule",
        startLine: start + 1,
        endLine: i + 1,
        startOffset: startOff,
        endOffset: endOff,
        source: text,
        hash: shortBlockHash(text),
      });
      i++;
      continue;
    }

    i++;
  }

  return blocks;
}

function countBracesOutsideStrings(line: string): number {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === "#" && !inStr) break;
    if (ch === '"' && line[i - 1] !== "\\") {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
  }
  return depth;
}

export function validateRegoSyntax(source: string): CodeDiagnostic[] {
  const diagnostics: CodeDiagnostic[] = [];
  if (!/^\s*package\s+[A-Za-z_][A-Za-z0-9_.]*/m.test(source)) {
    diagnostics.push({
      code: "VALIDATION_FAILED",
      severity: "error",
      field: "rego",
      message: "Rego policy must declare a valid `package <name>` header.",
    });
  }
  const lines = source.split("\n");
  let depth = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    depth += countBracesOutsideStrings(lines[idx]!);
    if (depth < 0) {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        field: "rego",
        message: `Unmatched closing delimiter on line ${idx + 1}.`,
      });
      break;
    }
  }
  if (depth > 0) {
    diagnostics.push({
      code: "VALIDATION_FAILED",
      severity: "error",
      field: "rego",
      message: `Unclosed delimiter in Rego source (net unclosed depth: ${depth}).`,
    });
  }
  return diagnostics;
}

export function inspectRegoDocument(params: {
  source: string;
  revPrefix: string;
  view: "outline" | "select";
  select?: string;
}): { nodes: InspectedNode[]; totalNodes: number; truncated: boolean } {
  const { source, revPrefix, view, select } = params;
  const blocks = parseRegoBlocks(source);

  let matched = blocks;
  if (view === "select" && select) {
    const queries = select.split(",").map((s) => s.trim()).filter(Boolean);
    matched = blocks.filter((b) =>
      queries.some(
        (q) =>
          b.selector === q ||
          b.id === q ||
          `rule:${b.id}` === q ||
          b.selector.startsWith(`${q}#`),
      ),
    );
  }

  const includeSource = view === "select";
  const nodes: InspectedNode[] = matched.map((b) => ({
    selector: b.selector,
    node_ref: makeNodeRef(revPrefix, b.selector),
    kind: b.kind,
    id: b.id,
    ...(b.ruleType ? { node_type: b.ruleType } : {}),
    supported_ops: ["replace_block", "unset"],
    fields: {
      lines: { kind: "literal", value: `${b.startLine}-${b.endLine}` },
      hash: { kind: "literal", value: b.hash },
      signature: { kind: "literal", value: b.source.split("\n")[0]!.trim().slice(0, 120) },
    },
    ...(includeSource
      ? {
          block: {
            hash: b.hash,
            lines: [b.startLine, b.endLine],
            source: b.source,
          },
        }
      : {}),
  }));

  return { nodes, totalNodes: matched.length, truncated: false };
}

export function applyRegoPatches(params: {
  source: string;
  revPrefix: string;
  operations: readonly PatchOperation[];
}): {
  patchedSource: string;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
} {
  const { source, revPrefix, operations } = params;
  if (operations.length === 0) {
    throw new CodeEngineError("INVALID_PATCH_OPERATION", "At least one patch operation is required.");
  }

  let current = source;
  const changes: FieldChangeSummary[] = [];
  const touchedSelectors = new Set<string>();

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    const blocks = parseRegoBlocks(current);

    let rawSel = "";
    if (typeof op.target === "string") rawSel = op.target.trim();
    else if (op.target && typeof op.target === "object") {
      if ("node_ref" in op.target) rawSel = op.target.node_ref;
      else if ("selector" in op.target && typeof op.target.selector === "string") rawSel = op.target.selector;
    }
    if (rawSel.startsWith("nr_")) {
      const dec = decodeNodeRef(rawSel);
      if (!dec) throw new CodeEngineError("TARGET_NOT_FOUND", `Invalid node_ref "${rawSel}".`);
      if (dec.revPrefix !== revPrefix) {
        throw new CodeEngineError("REVISION_CONFLICT", `node_ref "${rawSel}" belongs to an older revision.`);
      }
      rawSel = dec.selector;
    }

    if (touchedSelectors.has(rawSel)) {
      throw new CodeEngineError("OVERLAPPING_OPERATIONS", `Duplicate Rego block operation on "${rawSel}".`);
    }
    touchedSelectors.add(rawSel);

    if (op.op === "replace_block" || op.op === "set") {
      if (typeof op.value !== "string" || !op.value.trim()) {
        throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation #${i + 1} (${op.op}) on Rego requires a non-empty string "value".`);
      }
      const nextBlockText = op.value.trimEnd();
      const matches = blocks.filter((b) => b.selector === rawSel || (rawSel === `rule:${b.id}` && !rawSel.includes("#")));
      if (matches.length > 1) {
        throw new CodeEngineError(
          "TARGET_AMBIGUOUS",
          `Rego policy defines ${matches.length} clauses for "${rawSel}". Disambiguate using ${matches.map((m) => m.selector).join(", ")}.`,
          [
            {
              code: "TARGET_AMBIGUOUS",
              severity: "error",
              selector: rawSel,
              message: `Multiple Rego rule clauses share name "${rawSel}".`,
              candidates: matches.map((m) => m.selector),
            },
          ],
        );
      }

      if (matches.length === 1) {
        const blk = matches[0]!;
        if (op.expected_hash && op.expected_hash !== blk.hash) {
          throw new CodeEngineError(
            "REVISION_CONFLICT",
            `Expected block hash "${op.expected_hash}" on "${blk.selector}", found "${blk.hash}".`,
          );
        }
        if (blk.source.trim() === nextBlockText.trim()) continue;
        current = `${current.slice(0, blk.startOffset)}${nextBlockText}${current.slice(blk.endOffset)}`;
        changes.push({
          target: blk.selector,
          field: "rego",
          op: "replace_block",
          before: { kind: "literal", value: `${blk.hash} (lines ${blk.startLine}-${blk.endLine})` },
          after: { kind: "literal", value: shortBlockHash(nextBlockText) },
          source: "dsl_block",
        });
      } else if (rawSel.startsWith("rule:")) {
        // Append new rule block cleanly at EOF
        const sep = current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
        current = `${current}${sep}${nextBlockText}\n`;
        changes.push({
          target: rawSel,
          field: "rego",
          op: "replace_block",
          before: { kind: "absent" },
          after: { kind: "literal", value: shortBlockHash(nextBlockText) },
          source: "dsl_block",
        });
      } else {
        throw new CodeEngineError("TARGET_NOT_FOUND", `Rego block "${rawSel}" not found.`, [
          {
            code: "TARGET_NOT_FOUND",
            severity: "error",
            selector: rawSel,
            message: `No Rego block matched "${rawSel}".`,
            candidates: blocks.map((b) => b.selector),
          },
        ]);
      }
      continue;
    }

    if (op.op === "unset" || op.op === "remove_item") {
      const matches = blocks.filter((b) => b.selector === rawSel);
      if (matches.length === 0) {
        throw new CodeEngineError("TARGET_NOT_FOUND", `Rego block "${rawSel}" not found.`);
      }
      const blk = matches[0]!;
      if (blk.kind === "package") {
        throw new CodeEngineError("VALIDATION_FAILED", "Cannot remove the required `package` declaration from a Rego policy.");
      }
      current = `${current.slice(0, blk.startOffset)}${current.slice(blk.endOffset)}`.replace(/\n{3,}/g, "\n\n");
      changes.push({
        target: blk.selector,
        field: "rego",
        op: "unset",
        before: { kind: "literal", value: `${blk.hash} (lines ${blk.startLine}-${blk.endLine})` },
        after: { kind: "absent" },
        source: "dsl_block",
      });
      continue;
    }

    throw new CodeEngineError("INVALID_PATCH_OPERATION", `Operation "${op.op}" is not supported on Rego policies.`);
  }

  const diagnostics = validateRegoSyntax(current);
  if (diagnostics.some((d) => d.severity === "error")) {
    throw new CodeEngineError("VALIDATION_FAILED", diagnostics[0]!.message, diagnostics);
  }

  return { patchedSource: current, changes, diagnostics };
}

// ---------------------------------------------------------------------------
// ANTLR4 (.g4) Grammar Inspector (for HQL `kg_grammar`)
// ---------------------------------------------------------------------------

interface AntlrRule {
  name: string;
  kind: "parser_rule" | "lexer_rule";
  startLine: number;
  endLine: number;
  source: string;
  referencedRules: string[];
}

function blankPreservingNewlines(chunk: string): string {
  return chunk.replace(/[^\n]/g, " ");
}

function parseAntlr4Grammar(source: string): { grammarName?: string; rules: AntlrRule[] } {
  const headerMatch = /^\s*(?:parser\s+|lexer\s+)?grammar\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/m.exec(source);
  const grammarName = headerMatch?.[1];

  // Mask comments, @header/@members action blocks, and single-quoted literals while preserving
  // exact byte offsets and newlines so `;` inside comments/literals/headers never splits a rule.
  const scanSafe = source
    .replace(/\/\*[\s\S]*?\*\//g, blankPreservingNewlines)
    .replace(/\/\/[^\n]*/g, blankPreservingNewlines)
    .replace(/@[A-Za-z_][A-Za-z0-9_]*\s*\{[\s\S]*?\}/g, blankPreservingNewlines)
    .replace(/'(?:\\.|[^'\\\n])*'/g, blankPreservingNewlines);

  const rules: AntlrRule[] = [];
  const ruleRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]*?)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(scanSafe)) !== null) {
    const name = m[1]!;
    const maskedBody = m[2]!;
    const fullText = source.slice(m.index, m.index + m[0].length);
    const startLine = source.slice(0, m.index).split("\n").length;
    const endLine = startLine + fullText.split("\n").length - 1;
    const isLexer = /^[A-Z]/.test(name);
    const refs = new Set<string>();
    if (!isLexer) {
      for (const tok of maskedBody.matchAll(/\b([a-z][A-Za-z0-9_]*)\b/g)) {
        if (tok[1] && tok[1] !== name) refs.add(tok[1]);
      }
    }
    rules.push({
      name,
      kind: isLexer ? "lexer_rule" : "parser_rule",
      startLine,
      endLine,
      source: fullText,
      referencedRules: [...refs],
    });
  }
  return { grammarName, rules };
}

export function inspectAntlr4Grammar(params: {
  source: string;
  revPrefix: string;
  view: "outline" | "select";
  select?: string;
}): { nodes: InspectedNode[]; totalNodes: number; truncated: boolean } {
  const { source, revPrefix, view, select } = params;
  const { grammarName, rules } = parseAntlr4Grammar(source);
  const parserRules = rules.filter((r) => r.kind === "parser_rule");
  const lexerRules = rules.filter((r) => r.kind === "lexer_rule");
  const ruleByName = new Map(rules.map((r) => [r.name, r]));

  if (view === "outline" && !select) {
    // Keep outline strictly compact (<2 KB even on 100+ rule grammars) instead of emitting
    // per-rule node wrappers that would exceed the raw .g4 size.
    const summaryNode: InspectedNode = {
      selector: "grammar",
      node_ref: makeNodeRef(revPrefix, "grammar"),
      kind: "grammar",
      id: grammarName ?? "HQL",
      supported_ops: [],
      fields: {
        parser_rule_count: { kind: "literal", value: parserRules.length },
        lexer_rule_count: { kind: "literal", value: lexerRules.length },
        parser_rules: {
          kind: "array",
          value: parserRules.map((r) => `rule:${r.name}`),
        },
        select_hint: {
          kind: "literal",
          value: "Pass select='rule:<name>' (comma-separated) to fetch specific grammar productions and referenced sub-rules.",
        },
      },
      children_count: parserRules.length,
    };
    return {
      nodes: [summaryNode],
      totalNodes: parserRules.length,
      truncated: false,
    };
  }

  // `select` mode: match requested rules + 1-hop referenced parser rules so HQL authoring has complete syntax context!
  const queries = (select ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^rule:/i, ""))
    .filter(Boolean);

  const selected = new Map<string, AntlrRule>();
  for (const r of rules) {
    if (
      queries.some(
        (q) => r.name.toLowerCase() === q.toLowerCase() || r.name.toLowerCase().includes(q.toLowerCase()),
      )
    ) {
      selected.set(r.name, r);
      for (const refName of r.referencedRules.slice(0, 10)) {
        const refRule = ruleByName.get(refName);
        if (refRule && refRule.kind === "parser_rule") {
          selected.set(refRule.name, refRule);
        }
      }
    }
  }

  const nodes: InspectedNode[] = [...selected.values()].map((r) => ({
    selector: `rule:${r.name}`,
    node_ref: makeNodeRef(revPrefix, `rule:${r.name}`),
    kind: r.kind,
    id: r.name,
    supported_ops: [],
    block: {
      hash: shortBlockHash(r.source),
      lines: [r.startLine, r.endLine],
      source: r.source,
    },
  }));

  return { nodes, totalNodes: nodes.length, truncated: false };
}
