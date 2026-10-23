# Tool schema budget

`tools/list` is sent to the model by every client that loads tool schemas eagerly (many do; Claude
Code defers them). Its size is a per-request tax, so it is treated as a budgeted resource.

## Modes

`HARNESS_SCHEMA_MODE` controls the payload:

| | `full` | `compact` |
|---|---|---|
| `resource_type` | `z.enum` of every supported type, repeated per tool | plain string; types are discovered via `harness_describe` |
| Unknown / near-miss type | error with suggestions | near-misses (case, hyphen, plural, `repo`, `pr`, `exec`…) resolve; others error with "did you mean" |
| Long field copy | original wording | short form from `src/tools/field-copy.ts` (safety rules kept) |
| Output schemas | typed, described | one permissive object schema |
| Scope field copy | long | short; full rules are in the server `instructions` |

Full mode (descriptions, input and output schemas as advertised) is pinned byte-for-byte by a hash test (`tests/tools/schema-profile.test.ts`).

## Results

Measured with `evals/schema-profile`: 51 distinct tasks × 2 repeats (102 runs per row), stubbed
Harness API, real `tools/list` over stdio, Anthropic Messages API. "Instructions" is whether the
server `instructions` string was given to the model.

`tools/list`: full 57,324 B → compact 24,775 B (−57%).

| model | mode | instructions | any call correct | first call correct | calls/task | input tokens/task | wrong scope |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 | full | on | 98% | 94% | 2.34 | 64.3k | 2% |
| Haiku 5.5 | full | off | 98% | 92% | 2.41 | 62.8k | 2% |
| Haiku 5.5 | compact | on | 98% | 91% | 2.53 | 30.5k | 0% |
| Haiku 5.5 | compact | off | 98% | 92% | 2.56 | 27.6k | 0% |
| Sonnet 5.5 | full | on | 98% | 98% | 1.72 | 54.3k | 1% |
| Sonnet 5.5 | full | off | 98% | 98% | 1.84 | 52.7k | 1% |
| Sonnet 5.5 | compact | on | 98% | 93% | 1.83 | 24.9k | 0% |
| Sonnet 5.5 | compact | off | 98% | 95% | 2.05 | 23.3k | 1% |

Reading the table:

- Input tokens per task fall 52–56% on both models; any-call success is identical (98%) in every cell.
- Unknown-type errors: 0% in all but one cell (Haiku/compact/instructions-on, 1%). Before near-miss
  resolution, compact mode hit 5.7% (the model guessed `repo` for `repository`).
- Sonnet in compact mode often calls `harness_describe` first on writes and unfamiliar types
  (+~0.1–0.2 calls/task). That is a read, and the net token cost is still about half of full mode.
- Haiku in compact mode needs ~0.2 more calls/task than full.
- No `confirm: true` was ever set on a read-only task in any run.

Limits: two models, one vendor, stubbed API (empty lists), 51 tasks. Differences of a couple of
points are within noise. Non-Anthropic models are untested.

## Methodology

1. Build the server (`pnpm build`), start it over stdio with `HARNESS_SCHEMA_MODE` set and
   `HARNESS_BASE_URL` pointing at a local stub that returns empty-but-valid payloads.
2. Give the model the real `tools/list` and (optionally) the real `instructions` string.
3. For each golden task (`goldens.jsonl`: prompt, expected tool, expected args, read-only flag,
   category) run a tool loop of up to 5 turns, executing calls against the server.
4. Score by outcome, not by call order: success is a call to the expected tool whose arguments
   contain the expected values. Reads before the target call are fine; they show up in
   `calls_per_task` and `wasted_calls_per_task`. Argument matching accepts the same
   `resource_type` aliases the server accepts.
5. Also track: unknown-type errors, wrong scope, `confirm` set on a read-only task, and
   `confirm` set on the first call of a write task.
6. Report input tokens as uncached-equivalent (input + cache read + cache creation); prompt
   caching is used only to reduce cost.

Goldens must not depend on the stub having data: a task that says "update service X" against a
stub that lists no services will be refused by a sensible model. Say that the resource exists.

Run it:

```bash
pnpm build
export ANTHROPIC_API_KEY=...            # never commit keys
cd evals/schema-profile
python -m venv .venv && .venv/bin/pip install mcp anthropic && .venv/bin/pip install -e ../../../harness-evals
.venv/bin/python run_eval.py --mode compact --instructions on --model claude-sonnet-5-5 --repeats 2
./run_gate.sh                           # full matrix; exits non-zero on a failed run or missed threshold (check_gate.py)
```

Results are written to `evals/schema-profile/results/` (git-ignored).

## Keeping it from bloating

- **Budget test.** `tests/tools/schema-profile.test.ts` fails if compact-mode tool descriptions +
  input and output schemas exceed 22,500 B in total (21,372 B today) or any tool exceeds 3,800 B, or if any
  compact enum has more than 20 values. If you must raise a budget, do it in the same PR, say why,
  and attach an eval run.
- **Full mode is pinned.** Changing full-mode schemas requires updating the hash on purpose.
- **Put long copy in one place.** Long field descriptions go in `src/tools/field-copy.ts` with a
  `full` and a `compact` form. Do not inline paragraphs in a tool's `inputSchema`.
- **Never inline the type list.** Use `resourceTypeSchema(types, registry.compactSchemas)`. New
  resources are added as toolset data and cost nothing in `tools/list`.
- **New tools / new fields.** Prefer a field on an existing tool over a new tool. Every field
  repeated across tools (scope, `confirm`) multiplies its cost by the number of tools; use the
  shared helpers in `input-schemas.ts`.
- **Put rules once.** Behavior rules belong in the server `instructions` or `harness_describe`,
  not repeated in each field description.
- **Check with data.** After a change that touches schema copy, run the gate matrix and compare
  against the table above. Watch `calls_per_task`: trimming copy can move cost from the schema
  into extra conversation turns, which is usually the worse trade.
- **Safety copy stays.** Compact `confirm` copy must keep "only with user intent" and "never
  overrides a user's decline" (asserted by test).

## Not done / ideas

- Required-field hints in error messages so a failed write is self-correcting.
- A `harness_describe` section for diagnose options, which would allow trimming `diagnose.options`
  further.
- Non-Anthropic models; a larger task set; real-API (non-stub) runs.
