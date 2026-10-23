#!/usr/bin/env bash
# Run the full/compact x instructions on/off matrix. Needs ANTHROPIC_API_KEY in the environment.
#   ANTHROPIC_API_KEY=... evals/schema-profile/run_matrix.sh [model] [--limit N]
set -euo pipefail
cd "$(dirname "$0")"
: "${ANTHROPIC_API_KEY:?set ANTHROPIC_API_KEY}"
MODEL="${1:-claude-haiku-5-5}"; shift || true
PY="${EVAL_PYTHON:-/tmp/evalvenv/bin/python}"
for mode in full compact; do
  for instr in on off; do
    echo ">>> $MODEL mode=$mode instructions=$instr" >&2
    "$PY" run_eval.py --mode "$mode" --instructions "$instr" --model "$MODEL" "$@" | grep -E '"(first_call|any_call|calls_per|unknown_type|wrong_scope|confirm_on|tools_list|input_tokens_per)' >&2
  done
done
echo "results in $(pwd)/results/" >&2
