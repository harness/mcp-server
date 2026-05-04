import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAddMetricPrompt(server: McpServer): void {
  server.registerPrompt(
    "add-metric",
    {
      description:
        "Step-by-step: add a new metric to the open-source harness-evals SDK and optionally register it in the ai-evals control plane",
      argsSchema: {
        metric_name: z.string().describe("Snake_case metric kind name (e.g. my_overlap_score)"),
        category: z
          .string()
          .describe(
            "Category folder under harness_evals/metrics/: deterministic, structural, operational, reliability, llm_judge, rag, safety, agent, conversation, mcp, similarity, composite",
          ),
        description: z.string().describe("What the metric measures and how scoring works"),
      },
    },
    async ({ metric_name, category, description }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Implement a new harness-evals metric.

## Goal
- **Kind / name**: \`${metric_name}\`
- **Category**: \`${category}\`
- **Behavior**: ${description}

## OSS repo: harness-evals

1. **Create** \`src/harness_evals/metrics/${category}/${metric_name}.py\` with a class extending \`BaseMetric\` (or \`ReliabilityMetric\` if multi-run).
   - Set \`name\` in \`super().__init__\` to \`"${metric_name}"\` (or a fixed string matching the kind).
   - Set \`dimension=\` an appropriate \`Dimension\` enum value.
   - Implement \`measure(self, eval_case: EvalCase) -> Score\` returning \`Score(name=..., value=0.0..1.0, threshold=..., reason=...)\`.
   - Handle \`eval_case.expected is None\` if applicable.

2. **Export** from \`src/harness_evals/metrics/${category}/__init__.py\` and \`src/harness_evals/metrics/__init__.py\` (\`__all__\` + imports).

3. **Tests** in \`tests/metrics/test_${metric_name}.py\` with \`@pytest.mark.unit\`, at least one pass and one fail case.

4. **Validate**: \`pytest tests/ -v\` and \`ruff check src/ tests/\`.

## Optional: ai-evals control plane (separate repo: ai-evals)

If this metric should appear in Harness AI Evals API / bootstrap:

5. Add the kind → class mapping in \`service/ai_evals/api/factories/metric_registry.py\` (\`HEURISTIC_METRIC_REGISTRY\` or appropriate registry).
6. Ensure builtin/bootstrap lists include it if it is a seeded builtin (\`bootstrap_service.py\`).

## Reference
- Existing example: \`src/harness_evals/metrics/deterministic/exact_match.py\`
- Types: \`EvalCase\`, \`Score\`, \`BaseMetric\` in \`harness_evals.core\`

Do not change \`Golden\` / \`EvalCase\` / \`Score\` fields without checking PLAN.md and tests.`,
          },
        },
      ],
    }),
  );
}
