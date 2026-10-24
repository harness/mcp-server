# Tool schema budget

`tools/list` is sent to the model by every client that loads tool schemas eagerly (many do; Claude
Code defers them). Its size is a per-request tax, so it is treated as a budgeted resource.

## Modes

`HARNESS_SCHEMA_MODE` controls the payload. Unset, it is `compact`. Set `full` to inline every resource type.

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
5. Also track: unknown-type errors, wrong scope, `confirm` set on a read-only task,
   `confirm` set on the first call of a write task, whether a `harness_describe` call passed
   `operation`, and the bytes of describe results returned to the model.
6. Tool results are capped at 120,000 characters (`--tool-result-chars`) so a full catalog and a
   filtered catalog both reach the model. The previous 1,500-character cap hid that difference.
7. Report input tokens as uncached-equivalent (input + cache read + cache creation); prompt
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

## Describe by operation

`harness_describe(operation=...)` returns only the resource types that support that consolidated-tool
operation. CRUD entries are `type`, `name`, `toolset`, and aliases. `execute` also includes each
type's action names. `search_term` and `toolset` intersect with the filter. Calling
`harness_describe` with no arguments still returns the full catalog, and
`harness_describe(resource_type=...)` still returns the detailed resource.

Measured JSON size of the default catalog (262 types):

| query | types | bytes | vs full catalog |
|---|---|---|---|
| no arguments | 262 | 35,791 | |
| `operation=list` | 200 | 19,533 | −45% |
| `operation=get` | 176 | 17,444 | −51% |
| `operation=create` | 94 | 8,553 | −76% |
| `operation=update` | 80 | 7,195 | −80% |
| `operation=delete` | 85 | 7,538 | −79% |
| `operation=execute` | 67 | 9,201 | −74% |

The model-in-the-loop comparison below records the describe bytes actually returned during tasks.
`operation_filter_hit_rate` is reported separately from task success: a model can still finish a
task after loading the full catalog, so that rate is not part of the correctness gate.

Same models as the table above, 60 tasks × 2 repeats (120 runs per cell). "Before" is the server without `operation`. "After" is this change. The new-build gate passed. Describe bytes are the average returned to the model per task, including tasks that never called `harness_describe`. No read-only task set `confirm`.

| model | mode | instructions | build | any call | first call | calls/task | input tokens/task | describe bytes/task | describe calls using operation | filter hit |
|---|---|---|---|---|---|---|---|---|---|---|
| Haiku 5.5 | compact | off | before | 98% | 88% | 2.79 | 31.4k | 6,468 | 0% | 17% |
| Haiku 5.5 | compact | off | after | 98% | 93% | 2.80 | 30.8k | 4,171 | 20% | 72% |
| Haiku 5.5 | compact | on | before | 98% | 93% | 2.71 | 34.7k | 6,161 | 0% | 0% |
| Haiku 5.5 | compact | on | after | 98% | 91% | 2.57 | 33.3k | 3,766 | 26% | 72% |
| Haiku 5.5 | full | off | before | 88% | 87% | 2.51 | 64.2k | 1,372 | 0% | 22% |
| Haiku 5.5 | full | off | after | 95% | 92% | 2.57 | 64.9k | 2,170 | 33% | 78% |
| Haiku 5.5 | full | on | before | 89% | 87% | 2.42 | 65.2k | 1,786 | 0% | 28% |
| Haiku 5.5 | full | on | after | 92% | 86% | 2.67 | 68.4k | 1,963 | 24% | 56% |
| Sonnet 5.5 | compact | off | before | 97% | 91% | 2.35 | 26.6k | 4,929 | 0% | 11% |
| Sonnet 5.5 | compact | off | after | 97% | 88% | 2.33 | 26.4k | 2,804 | 33% | 78% |
| Sonnet 5.5 | compact | on | before | 94% | 88% | 1.83 | 28.1k | 5,026 | 0% | 0% |
| Sonnet 5.5 | compact | on | after | 97% | 88% | 1.89 | 27.7k | 2,571 | 35% | 78% |
| Sonnet 5.5 | full | off | before | 90% | 90% | 2.11 | 55.5k | 1,488 | 0% | 33% |
| Sonnet 5.5 | full | off | after | 97% | 97% | 2.03 | 55.3k | 1,723 | 53% | 89% |
| Sonnet 5.5 | full | on | before | 90% | 90% | 1.84 | 56.0k | 1,391 | 0% | 33% |
| Sonnet 5.5 | full | on | after | 97% | 97% | 1.73 | 54.6k | 1,626 | 56% | 89% |

Compact describe payloads fell about 35–49% per task. Input tokens fell only a little, because most
tasks never load the catalog and the tool schemas still dominate. Models used `operation` on
20–56% of describe calls. Task success stayed at or above the before run. A couple of points is
noise at this sample size.

## Not done / ideas

- Required-field hints in error messages so a failed write is self-correcting.
- A `harness_describe` section for diagnose options, which would allow trimming `diagnose.options`
  further.
- Non-Anthropic models; a larger task set; real-API (non-stub) runs.
