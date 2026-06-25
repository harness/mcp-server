import YAML from "yaml";

/**
 * Known v0 step types that are invalid in v1 pipelines.
 * Kept as a Set for O(1) lookup.
 */
const V0_STEP_TYPES = new Set([
  "BuildAndPushDockerRegistry",
  "BuildAndPushECR",
  "BuildAndPushGCR",
  "BuildAndPushACR",
  "K8sRollingDeploy",
  "K8sRollingRollback",
  "K8sBlueGreenDeploy",
  "K8sBGSwapServices",
  "K8sCanaryDeploy",
  "K8sCanaryDelete",
  "K8sScale",
  "K8sDelete",
  "K8sApply",
  "HelmDeploy",
  "HelmRollback",
  "TerraformPlan",
  "TerraformApply",
  "TerraformDestroy",
  "TerraformRollback",
  "HarnessApproval",
  "JiraApproval",
  "ServiceNowApproval",
  "ShellScript",
]);

export interface LintResult {
  errors: string[];
  warnings: string[];
}

/**
 * Lint pipeline YAML for known footguns *before* Harness API processes it.
 *
 * - `errors` are blocking — the caller should reject the create/update.
 * - `warnings` are informational — attached to the response for the agent.
 * - Never throws — returns empty arrays on unparseable YAML.
 */
export function lintPipelineYaml(yaml: string, version: "v0" | "v1"): LintResult {
  const result: LintResult = { errors: [], warnings: [] };

  if (version === "v0") {
    lintV0(yaml, result);
  } else {
    lintV1(yaml, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// v0 checks
// ---------------------------------------------------------------------------

function lintV0(yaml: string, result: LintResult): void {
  let doc: Record<string, unknown>;
  try {
    doc = YAML.parse(yaml) as Record<string, unknown>;
  } catch {
    return;
  }

  const pipeline = (doc?.pipeline ?? doc) as Record<string, unknown> | undefined;
  if (!pipeline || typeof pipeline !== "object") return;

  checkTriggerBranch(pipeline, result);
  checkHarFields(pipeline, result);
  checkCodebaseConnector(pipeline, result);
}

/**
 * Warn when codebase branch uses a trigger expression that resolves to null
 * on manual runs. Severity: warning (valid config, just risky).
 */
function checkTriggerBranch(pipeline: Record<string, unknown>, result: LintResult): void {
  const branch = deepGet(pipeline, ["properties", "ci", "codebase", "build", "spec", "branch"]);
  if (typeof branch === "string" && branch.startsWith("<+trigger.")) {
    result.warnings.push(
      `Codebase branch is set to \`${branch}\` which resolves to null on manual runs. ` +
      `Use a static branch like \`main\`, or \`<+input>\` for runtime input. ` +
      `Trigger expressions only work when the pipeline is started by a configured trigger.`,
    );
  }
}

/**
 * Block when BuildAndPushDockerRegistry steps mix connectorRef and registryRef.
 * Warn when connectorRef is used alone (may indicate HAR misconfiguration).
 * Severity: error (mixed fields), warning (connectorRef-only — could be valid third-party).
 */
function checkHarFields(pipeline: Record<string, unknown>, result: LintResult): void {
  const steps = collectSteps(pipeline);
  for (const step of steps) {
    if (step.type !== "BuildAndPushDockerRegistry") continue;
    const spec = step.spec as Record<string, unknown> | undefined;
    if (!spec || typeof spec !== "object") continue;

    const hasConnector = "connectorRef" in spec;
    const hasRegistry = "registryRef" in spec;

    if (hasConnector && hasRegistry) {
      result.errors.push(
        `Step "${step.name ?? step.identifier}" has both \`connectorRef\` and \`registryRef\`. ` +
        `For Harness Artifact Registry use \`registryRef\` only. For third-party registries use \`connectorRef\` only. Never mix both.`,
      );
    } else if (hasConnector && !hasRegistry) {
      result.warnings.push(
        `Step "${step.name ?? step.identifier}" uses \`connectorRef\` for BuildAndPushDockerRegistry. ` +
        `If pushing to Harness Artifact Registry, replace \`connectorRef\` with \`registryRef: <registry_id>\` and remove the connector. ` +
        `Only use \`connectorRef\` for third-party registries (DockerHub, ECR, GCR, ACR).`,
      );
    }
  }
}

/**
 * Block when Harness Code codebase config still includes connectorRef.
 * Third-party Git codebases legitimately use both connectorRef and repoName;
 * Harness Code repos use repoName only.
 * Severity: error.
 */
function checkCodebaseConnector(pipeline: Record<string, unknown>, result: LintResult): void {
  const connectorRef = deepGet(pipeline, ["properties", "ci", "codebase", "connectorRef"]);
  if (typeof connectorRef !== "string") return;

  const repoName = deepGet(pipeline, ["properties", "ci", "codebase", "repoName"]);
  if (typeof repoName === "string" && isHarnessCodeConnectorRef(connectorRef)) {
    result.errors.push(
      `Codebase has both \`connectorRef\` ("${connectorRef}") and \`repoName\` ("${repoName}"). ` +
      `Harness Code repos are native and only need \`repoName\`; remove \`connectorRef\`. ` +
      `Third-party Git repos may keep both \`connectorRef\` and \`repoName\`.`,
    );
  }
}

// ---------------------------------------------------------------------------
// v1 checks
// ---------------------------------------------------------------------------

function lintV1(yaml: string, result: LintResult): void {
  let doc: Record<string, unknown>;
  try {
    doc = YAML.parse(yaml) as Record<string, unknown>;
  } catch {
    return;
  }
  const pipeline = (doc?.pipeline ?? doc) as Record<string, unknown> | undefined;
  if (!pipeline || typeof pipeline !== "object") return;
  checkV0StepTypesInV1(pipeline, result);
}

/**
 * Detect v0 step types used in v1 pipelines by walking the parsed document.
 * Uses a full-document walk rather than `collectSteps` because v1 steps often
 * lack `identifier`/`name` fields that v0 step detection requires.
 * Severity: error (v0 steps will fail in v1).
 */
function checkV0StepTypesInV1(pipeline: Record<string, unknown>, result: LintResult): void {
  const found = new Set<string>();
  findV0TypesInDoc(pipeline, found);
  if (found.size > 0) {
    result.errors.push(
      `v0 step type(s) found in v1 pipeline: ${[...found].join(", ")}. ` +
      `v1 pipelines only support \`run\`, \`action\`, \`template\`, \`background\`, \`approval\`, \`group\`, and \`parallel\` steps. ` +
      `Use \`action: uses: kubernetes-rolling-deploy\` instead of \`type: K8sRollingDeploy\`, etc.`,
    );
  }
}

function findV0TypesInDoc(obj: unknown, found: Set<string>): void {
  if (obj == null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) findV0TypesInDoc(item, found);
    return;
  }
  const rec = obj as Record<string, unknown>;
  if (typeof rec.type === "string" && V0_STEP_TYPES.has(rec.type)) {
    found.add(rec.type);
  }
  for (const val of Object.values(rec)) findV0TypesInDoc(val, found);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely traverse a nested object by key path. */
function deepGet(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function isHarnessCodeConnectorRef(connectorRef: string): boolean {
  return connectorRef.toLowerCase().replace(/[^a-z0-9]/g, "").includes("harnesscode");
}

/** Recursively collect all step objects from a v0 pipeline. */
function collectSteps(obj: unknown, results: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  if (obj == null || typeof obj !== "object") return results;

  if (Array.isArray(obj)) {
    for (const item of obj) collectSteps(item, results);
    return results;
  }

  const rec = obj as Record<string, unknown>;
  const isStep = "type" in rec && "spec" in rec && ("identifier" in rec || "name" in rec);
  if (isStep) {
    results.push(rec);
    // Don't recurse into the step's own spec — it holds configuration, not child steps.
    for (const key of ["steps", "rollbackSteps", "parallel"]) {
      if (key in rec) collectSteps(rec[key], results);
    }
    return results;
  }

  // Container nodes: recurse into known step-container fields including spec
  // (stage.spec.execution.steps is the canonical v0 path to steps).
  for (const key of ["stages", "stage", "steps", "step", "spec", "execution", "rollbackSteps", "parallel"]) {
    if (key in rec) collectSteps(rec[key], results);
  }

  return results;
}

/**
 * Extract the pipeline YAML string from the body argument passed to
 * harness_create / harness_update. Returns undefined if no YAML can be
 * extracted (non-pipeline resource, non-string body, etc.).
 */
export function extractPipelineYaml(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  if (body != null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.yamlPipeline === "string") return obj.yamlPipeline;
    if (typeof obj.pipeline_yaml === "string") return obj.pipeline_yaml;
    if (obj.pipeline !== undefined) return YAML.stringify({ pipeline: obj.pipeline });
  }
  return undefined;
}
