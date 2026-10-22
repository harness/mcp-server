# Tool schema budget

`tools/list` is sent to the model by every client that loads tool schemas eagerly (many do; Claude
Code defers them). Its size is a per-request tax, so it is treated as a budgeted resource.

## Modes

`HARNESS_SCHEMA_MODE` controls the payload:

| | `full` | `compact` |
|---|---|---|
| `resource_type` | `z.enum` of every supported type, repeated per tool | plain string, with common examples and a pointer to `harness_describe` |
| Unknown / near-miss type | error with suggestions | near-misses (case, hyphen, plural, `repo`, `pr`, `exec`…) resolve; others error with "did you mean" |
| Long field copy | original wording | short form from `src/tools/field-copy.ts` (safety rules kept) |
| Output schemas | typed, described | one permissive object schema |
| Scope field copy | long | short; full rules are in the server `instructions` |

Full mode is pinned byte-for-byte by a hash test (`tests/tools/schema-profile.test.ts`).

## Results

Measured with `evals/schema-profile`: 51 distinct tasks × 2 repeats (102 runs per row), stubbed
Harness API, real `tools/list` over stdio, Anthropic Messages API. "Instructions" is whether the
server `instructions` string was given to the model.

`tools/list`: full 57,082 B → compact 24,688 B (−57%). That measurement predates attaching the
compact `resource_type` example suffix (about 1.5 KB across the tool descriptions). The budget
test below includes the suffix.

| model | mode | instructions | any call correct | first call correct | calls/task | input tokens/task | wrong scope |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 | full | on | 97% | 94% | 2.26 | 63.0k | 1.0% |
| Haiku 5.5 | compact | on | 98% | 94% | 2.25 | 28.6k | 0% |
| Haiku 5.5 | full | off | 98% | 92% | 2.30 | 61.9k | 1.0% |
| Haiku 5.5 | compact | off | 98% | 93% | 2.86 | 29.5k | 0% |
| Sonnet 5.5 | full | on | 98% | 97% | 1.67 | 53.7k | 0% |
| Sonnet 5.5 | compact | on | 96% | 90% | 1.95 | 25.5k | 0% |
| Sonnet 5.5 | full | off | 98% | 96% | 1.91 | 53.1k | 2.0% |
| Sonnet 5.5 | compact | off | 96% | 93% | 2.10 | 22.8k | 1.0% |

Reading the table:

- Input tokens per task fall 50–57% on both models; task success is within about 2 points.
- Unknown-type errors: 0% everywhere except Haiku/compact/instructions-off (1%). Before near-miss
  resolution, compact mode hit 5.7% (the model guessed `repo` for `repository`).
- Sonnet in compact mode often calls `harness_describe` first on writes and unfamiliar types
  (+~0.3 calls/task). That is a read, and the net token cost is still about half of full mode.
- Haiku with no instructions needs ~0.6 more calls/task in compact mode — the weakest cell.
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
./run_gate.sh                           # full matrix: 2 models × 2 modes × instructions on/off
```

Results are written to `evals/schema-profile/results/` (git-ignored).

## Keeping it from bloating

- **Budget test.** `tests/tools/schema-profile.test.ts` fails if compact-mode tool descriptions +
  input schemas exceed 22,500 B in total (21,458 B today) or any tool exceeds 3,850 B, or if any
  compact enum has more than 20 values. The example suffix on each compact `resource_type` field
  (`resourceTypeHint`) is included in that 21,458 B. If you must raise a budget, do it in the same PR, say why,
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
