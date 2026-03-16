/**
 * Pipeline Architecture Diagram — multi-level hierarchy from pipeline YAML.
 * Shows: Pipeline → Stages → Step Groups → Steps, with deployment strategy,
 * rollback paths, service/infra refs, and failure handling.
 */

import {
  getStatusColor,
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CHART_PALETTE,
  svgDefs,
} from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

// ─── Parsed pipeline types ──────────────────────────────────────────────────

interface ParsedStep {
  name: string;
  type: string;
  timeout?: string;
  status?: string;
}

interface ParsedStepGroup {
  name: string;
  steps: ParsedStep[];
}

interface ParsedStage {
  name: string;
  type: string; // CI, Deployment, Approval, Custom, etc.
  strategy?: string; // Canary, Rolling, BlueGreen
  service?: string;
  environment?: string;
  infrastructure?: string;
  stepGroups: ParsedStepGroup[];
  rollbackSteps: ParsedStep[];
  failureStrategy?: string;
  status?: string;
}

interface ParsedPipeline {
  name: string;
  identifier: string;
  stages: ParsedStage[];
}

// ─── YAML parser ────────────────────────────────────────────────────────────

function extractSteps(stepsArray: unknown[]): { groups: ParsedStepGroup[]; ungrouped: ParsedStep[] } {
  const groups: ParsedStepGroup[] = [];
  const ungrouped: ParsedStep[] = [];

  for (const entry of stepsArray) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    if (e.stepGroup && typeof e.stepGroup === "object") {
      const sg = e.stepGroup as Record<string, unknown>;
      const steps: ParsedStep[] = [];
      if (Array.isArray(sg.steps)) {
        for (const s of sg.steps) {
          if (s && typeof s === "object" && (s as Record<string, unknown>).step) {
            const step = (s as Record<string, unknown>).step as Record<string, unknown>;
            steps.push({
              name: String(step.name ?? step.identifier ?? "Step"),
              type: String(step.type ?? "Unknown"),
              timeout: step.timeout ? String(step.timeout) : undefined,
            });
          }
        }
      }
      groups.push({ name: String(sg.name ?? sg.identifier ?? "Step Group"), steps });
    } else if (e.step && typeof e.step === "object") {
      const step = e.step as Record<string, unknown>;
      ungrouped.push({
        name: String(step.name ?? step.identifier ?? "Step"),
        type: String(step.type ?? "Unknown"),
        timeout: step.timeout ? String(step.timeout) : undefined,
      });
    } else if (e.parallel && Array.isArray(e.parallel)) {
      // Parallel steps — flatten into a single group
      const steps: ParsedStep[] = [];
      for (const p of e.parallel) {
        if (p && typeof p === "object" && (p as Record<string, unknown>).step) {
          const step = (p as Record<string, unknown>).step as Record<string, unknown>;
          steps.push({
            name: String(step.name ?? step.identifier ?? "Step"),
            type: String(step.type ?? "Unknown"),
          });
        }
      }
      if (steps.length > 0) groups.push({ name: "Parallel", steps });
    }
  }
  return { groups, ungrouped };
}

function extractRollback(stepsArray: unknown[]): ParsedStep[] {
  const steps: ParsedStep[] = [];
  for (const entry of stepsArray) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (e.step && typeof e.step === "object") {
      const step = e.step as Record<string, unknown>;
      steps.push({
        name: String(step.name ?? step.identifier ?? "Step"),
        type: String(step.type ?? "Unknown"),
      });
    }
  }
  return steps;
}

function extractFailureStrategy(strategies: unknown[]): string | undefined {
  if (!Array.isArray(strategies) || strategies.length === 0) return undefined;
  const first = strategies[0] as Record<string, unknown>;
  const onFailure = first?.onFailure as Record<string, unknown> | undefined;
  const action = onFailure?.action as Record<string, unknown> | undefined;
  return action?.type ? String(action.type) : undefined;
}

export function parsePipelineYaml(yamlObj: unknown): ParsedPipeline | null {
  if (!yamlObj || typeof yamlObj !== "object") return null;
  const root = yamlObj as Record<string, unknown>;
  const pipeline = (root.pipeline ?? root) as Record<string, unknown>;
  if (!pipeline.stages && !pipeline.name) return null;

  const name = String(pipeline.name ?? pipeline.identifier ?? "Pipeline");
  const identifier = String(pipeline.identifier ?? "");
  const stagesArray = Array.isArray(pipeline.stages) ? pipeline.stages : [];

  const stages: ParsedStage[] = [];

  for (const entry of stagesArray) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const stageObj = (e.stage ?? e) as Record<string, unknown>;
    const spec = (stageObj.spec ?? {}) as Record<string, unknown>;
    const execution = (spec.execution ?? {}) as Record<string, unknown>;

    const stageType = String(stageObj.type ?? "Custom");
    let strategy: string | undefined;
    let service: string | undefined;
    let environment: string | undefined;
    let infrastructure: string | undefined;

    // Deployment metadata
    if (stageType === "Deployment") {
      const strat = execution.strategy as Record<string, unknown> | undefined;
      strategy = strat?.type ? String(strat.type) : undefined;

      const svcConfig = spec.serviceConfig as Record<string, unknown> | undefined;
      const svc = svcConfig?.service as Record<string, unknown> | undefined;
      service = svc?.serviceRef ? String(svc.serviceRef) : (svc?.name ? String(svc.name) : undefined);
      // Also check spec.service directly (newer YAML format)
      if (!service) {
        const svcDirect = spec.service as Record<string, unknown> | undefined;
        service = svcDirect?.serviceRef ? String(svcDirect.serviceRef) : undefined;
      }

      const infra = spec.infrastructure as Record<string, unknown> | undefined;
      environment = infra?.environmentRef ? String(infra.environmentRef) : undefined;
      const infraDef = infra?.infrastructureDefinition as Record<string, unknown> | undefined;
      infrastructure = infraDef?.type ? String(infraDef.type) : undefined;
      if (!environment) {
        const envDirect = spec.environment as Record<string, unknown> | undefined;
        environment = envDirect?.environmentRef ? String(envDirect.environmentRef) : undefined;
        infrastructure = envDirect?.infrastructureDefinitions ? "Infra" : infrastructure;
      }
    }

    const stepsArr = Array.isArray(execution.steps) ? execution.steps : [];
    const { groups, ungrouped } = extractSteps(stepsArr);

    // If ungrouped steps exist, create a default group
    const stepGroups = [...groups];
    if (ungrouped.length > 0) {
      stepGroups.unshift({ name: "Steps", steps: ungrouped });
    }

    const rollbackArr = Array.isArray(execution.rollbackSteps) ? execution.rollbackSteps : [];
    const rollbackSteps = extractRollback(rollbackArr);

    const failureStrategy = extractFailureStrategy(
      Array.isArray(stageObj.failureStrategies) ? stageObj.failureStrategies : [],
    );

    stages.push({
      name: String(stageObj.name ?? stageObj.identifier ?? "Stage"),
      type: stageType,
      strategy,
      service,
      environment,
      infrastructure,
      stepGroups,
      rollbackSteps,
      failureStrategy,
    });
  }

  return { name, identifier, stages };
}

// ─── SVG Renderer ───────────────────────────────────────────────────────────

export interface ArchitectureOptions {
  width?: number;
  maxSteps?: number;
}

const STAGE_COLORS: Record<string, string> = {
  CI: "#6366f1",
  Deployment: "#10b981",
  Approval: "#f59e0b",
  Custom: "#a855f7",
  SecurityTests: "#06b6d4",
  Pipeline: "#ec4899",
};

const STEP_TYPE_ICONS: Record<string, string> = {
  Run: "\u25B6",
  K8sCanaryDeploy: "\u{1F680}",
  K8sRollingDeploy: "\u{1F680}",
  K8sBlueGreenDeploy: "\u{1F680}",
  K8sCanaryDelete: "\u{1F5D1}",
  K8sRollingRollback: "\u21A9",
  HarnessApproval: "\u2714",
  BuildAndPushDockerRegistry: "\u{1F4E6}",
  ShellScript: "\u{1F4BB}",
  Http: "\u{1F310}",
};

function stepIcon(type: string): string {
  return STEP_TYPE_ICONS[type] ?? "\u25AA";
}

export function renderArchitectureSvg(pipeline: ParsedPipeline, options?: ArchitectureOptions): string {
  const W = options?.width ?? 900;
  const maxSteps = options?.maxSteps ?? 15;
  const PAD = 24;
  const HDR_H = 52;
  const STAGE_HDR = 44;
  const GROUP_HDR = 28;
  const STEP_H = 22;
  const STEP_GAP = 4;
  const STAGE_GAP = 16;
  const ROLLBACK_HDR = 24;
  const META_LINE = 16;
  const STAGE_PAD = 12;

  // Pre-calculate height
  let totalH = HDR_H + PAD;

  for (const stage of pipeline.stages) {
    let stageH = STAGE_HDR + STAGE_PAD;
    // Meta lines (service, env, strategy)
    const metaLines: string[] = [];
    if (stage.type === "Deployment") {
      if (stage.strategy) metaLines.push(`Strategy: ${stage.strategy}`);
      if (stage.service) metaLines.push(`Service: ${stage.service}`);
      if (stage.environment) metaLines.push(`Env: ${stage.environment}`);
    }
    stageH += metaLines.length * META_LINE;
    if (metaLines.length > 0) stageH += 4;

    for (const group of stage.stepGroups) {
      stageH += GROUP_HDR;
      const stepCount = Math.min(group.steps.length, maxSteps);
      stageH += stepCount * (STEP_H + STEP_GAP);
      if (group.steps.length > maxSteps) stageH += STEP_H;
      stageH += 8;
    }
    if (stage.rollbackSteps.length > 0) {
      stageH += ROLLBACK_HDR + stage.rollbackSteps.length * (STEP_H + STEP_GAP) + 8;
    }
    if (stage.failureStrategy) stageH += META_LINE + 4;
    totalH += stageH + STAGE_GAP;
  }
  totalH += PAD;

  const STAGE_W = W - PAD * 2;
  const GROUP_W = STAGE_W - STAGE_PAD * 2;

  const elements: string[] = [];
  let y = HDR_H + PAD;

  for (let si = 0; si < pipeline.stages.length; si++) {
    const stage = pipeline.stages[si]!;
    const stageColor = STAGE_COLORS[stage.type] ?? CHART_PALETTE[si % CHART_PALETTE.length]!;
    const stageY = y;

    // Calculate this stage's height
    let stageContentH = STAGE_HDR;
    const metaLines: string[] = [];
    if (stage.type === "Deployment") {
      if (stage.strategy) metaLines.push(`Strategy: ${stage.strategy}`);
      if (stage.service) metaLines.push(`Svc: ${stage.service}`);
      if (stage.environment) metaLines.push(`Env: ${stage.environment}`);
      if (stage.infrastructure) metaLines.push(`Infra: ${stage.infrastructure}`);
    }
    stageContentH += metaLines.length * META_LINE;
    if (metaLines.length > 0) stageContentH += 4;

    for (const group of stage.stepGroups) {
      stageContentH += GROUP_HDR;
      const stepCount = Math.min(group.steps.length, maxSteps);
      stageContentH += stepCount * (STEP_H + STEP_GAP);
      if (group.steps.length > maxSteps) stageContentH += STEP_H;
      stageContentH += 8;
    }
    if (stage.rollbackSteps.length > 0) {
      stageContentH += ROLLBACK_HDR + stage.rollbackSteps.length * (STEP_H + STEP_GAP) + 8;
    }
    if (stage.failureStrategy) stageContentH += META_LINE + 4;
    stageContentH += STAGE_PAD;

    // Stage container
    elements.push(`<rect x="${PAD}" y="${stageY}" width="${STAGE_W}" height="${stageContentH}" rx="10" fill="${SURFACE_COLOR}" stroke="${stageColor}" stroke-width="2" filter="url(#shadow)"/>`);

    // Stage header bar
    elements.push(`<rect x="${PAD}" y="${stageY}" width="${STAGE_W}" height="${STAGE_HDR}" rx="10" fill="${stageColor}" opacity="0.12"/>`);
    elements.push(`<rect x="${PAD}" y="${stageY + STAGE_HDR - 2}" width="${STAGE_W}" height="2" fill="${stageColor}" opacity="0.12"/>`);

    // Stage badge
    elements.push(`<rect x="${PAD + 12}" y="${stageY + 10}" width="${stage.type.length * 7 + 16}" height="22" rx="4" fill="${stageColor}" opacity="0.2" stroke="${stageColor}" stroke-width="1"/>`);
    elements.push(`<text x="${PAD + 20}" y="${stageY + 26}" fill="${stageColor}" font-size="10" font-weight="700" font-family="${FONT_FAMILY}">${escapeXml(stage.type.toUpperCase())}</text>`);

    // Stage name
    const badgeW = stage.type.length * 7 + 32;
    elements.push(`<text x="${PAD + badgeW}" y="${stageY + 26}" fill="${TEXT_PRIMARY}" font-size="13" font-weight="700" font-family="${FONT_FAMILY}">${escapeXml(truncateLabel(stage.name, 40))}</text>`);

    // Status if available
    if (stage.status) {
      const sc = getStatusColor(stage.status);
      elements.push(`<circle cx="${PAD + STAGE_W - 20}" cy="${stageY + 22}" r="6" fill="${sc}"/>`);
    }

    let innerY = stageY + STAGE_HDR + 4;

    // Meta lines
    for (const meta of metaLines) {
      elements.push(`<text x="${PAD + STAGE_PAD + 8}" y="${innerY + 12}" fill="${TEXT_MUTED}" font-size="9" font-weight="500" font-family="${FONT_FAMILY}">${escapeXml(meta)}</text>`);
      innerY += META_LINE;
    }
    if (metaLines.length > 0) innerY += 4;

    // Step groups
    for (let gi = 0; gi < stage.stepGroups.length; gi++) {
      const group = stage.stepGroups[gi]!;
      const groupX = PAD + STAGE_PAD;
      const groupColor = CHART_PALETTE[(si * 3 + gi) % CHART_PALETTE.length]!;

      // Group header
      elements.push(`<rect x="${groupX}" y="${innerY}" width="${GROUP_W}" height="${GROUP_HDR}" rx="6" fill="${groupColor}" opacity="0.08"/>`);
      elements.push(`<rect x="${groupX}" y="${innerY + 2}" width="3" height="${GROUP_HDR - 4}" rx="1" fill="${groupColor}"/>`);
      elements.push(`<text x="${groupX + 12}" y="${innerY + 18}" fill="${TEXT_SECONDARY}" font-size="11" font-weight="600" font-family="${FONT_FAMILY}">${escapeXml(truncateLabel(group.name, 35))}</text>`);
      elements.push(`<text x="${groupX + GROUP_W - 8}" y="${innerY + 18}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">${group.steps.length} step${group.steps.length !== 1 ? "s" : ""}</text>`);
      innerY += GROUP_HDR;

      // Steps
      const displaySteps = group.steps.slice(0, maxSteps);
      for (const step of displaySteps) {
        const icon = stepIcon(step.type);
        const stepColor = step.status ? getStatusColor(step.status) : TEXT_MUTED;
        elements.push(`<text x="${groupX + 16}" y="${innerY + 15}" fill="${stepColor}" font-size="10" font-family="${FONT_FAMILY}">${icon}</text>`);
        elements.push(`<text x="${groupX + 30}" y="${innerY + 15}" fill="${TEXT_PRIMARY}" font-size="10" font-family="${FONT_FAMILY}">${escapeXml(truncateLabel(step.name, 30))}</text>`);
        elements.push(`<text x="${groupX + GROUP_W - 8}" y="${innerY + 15}" fill="${TEXT_MUTED}" font-size="8" font-family="${FONT_FAMILY}" text-anchor="end">${escapeXml(step.type)}${step.timeout ? ` \u00b7 ${step.timeout}` : ""}</text>`);
        innerY += STEP_H + STEP_GAP;
      }
      if (group.steps.length > maxSteps) {
        elements.push(`<text x="${groupX + 30}" y="${innerY + 15}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" font-style="italic">\u2026 +${group.steps.length - maxSteps} more steps</text>`);
        innerY += STEP_H;
      }
      innerY += 8;
    }

    // Rollback section
    if (stage.rollbackSteps.length > 0) {
      const rbX = PAD + STAGE_PAD;
      elements.push(`<rect x="${rbX}" y="${innerY}" width="${GROUP_W}" height="${ROLLBACK_HDR}" rx="6" fill="#f43f5e" opacity="0.08"/>`);
      elements.push(`<rect x="${rbX}" y="${innerY + 2}" width="3" height="${ROLLBACK_HDR - 4}" rx="1" fill="#f43f5e"/>`);
      elements.push(`<text x="${rbX + 12}" y="${innerY + 17}" fill="#f43f5e" font-size="10" font-weight="600" font-family="${FONT_FAMILY}">\u21A9 Rollback</text>`);
      innerY += ROLLBACK_HDR;

      for (const step of stage.rollbackSteps) {
        elements.push(`<text x="${rbX + 16}" y="${innerY + 15}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}">${stepIcon(step.type)}</text>`);
        elements.push(`<text x="${rbX + 30}" y="${innerY + 15}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}">${escapeXml(truncateLabel(step.name, 30))}</text>`);
        elements.push(`<text x="${rbX + GROUP_W - 8}" y="${innerY + 15}" fill="${TEXT_MUTED}" font-size="8" font-family="${FONT_FAMILY}" text-anchor="end">${escapeXml(step.type)}</text>`);
        innerY += STEP_H + STEP_GAP;
      }
      innerY += 8;
    }

    // Failure strategy
    if (stage.failureStrategy) {
      elements.push(`<text x="${PAD + STAGE_PAD + 8}" y="${innerY + 12}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">On failure: ${escapeXml(stage.failureStrategy)}</text>`);
    }

    y += stageContentH + STAGE_GAP;

    // Arrow between stages
    if (si < pipeline.stages.length - 1) {
      const arrowX = W / 2;
      const arrowY1 = y - STAGE_GAP;
      const arrowY2 = y;
      elements.push(`<line x1="${arrowX}" y1="${arrowY1}" x2="${arrowX}" y2="${arrowY2 - 4}" stroke="${BORDER_COLOR}" stroke-width="2" marker-end="url(#varrow)"/>`);
    }
  }

  // Title
  const title = escapeXml(truncateLabel(pipeline.name, 50));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  ${svgDefs(W, totalH)}
  <defs>
    <marker id="varrow" markerWidth="10" markerHeight="8" refX="5" refY="8" orient="auto">
      <polygon points="0 0, 10 0, 5 8" fill="${BORDER_COLOR}"/>
    </marker>
  </defs>
  <rect width="${W}" height="${totalH}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
  <text x="${PAD + 16}" y="${PAD + 20}" fill="${TEXT_PRIMARY}" font-size="15" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  <text x="${W - PAD - 12}" y="${PAD + 20}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}" text-anchor="end">${pipeline.stages.length} stage${pipeline.stages.length !== 1 ? "s" : ""}</text>
  ${elements.join("\n")}
</svg>`;
}
