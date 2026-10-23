#!/bin/bash
# Gate matrix for deciding the default schema mode. Exits non-zero if any run fails or any threshold
# in check_gate.py is missed.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
: "${ANTHROPIC_API_KEY:?set ANTHROPIC_API_KEY}"
MODELS=${MODELS:-"claude-haiku-5-5 claude-sonnet-5-5"}
LOGS=results/logs
mkdir -p "$LOGS"

pids=()
names=()
for model in $MODELS; do
  for mode in full compact; do
    for instr in on off; do
      name="${model}_${mode}_instr-${instr}"
      $PY run_eval.py --repeats 2 --tag _gate --model "$model" --mode "$mode" --instructions "$instr" \
        --concurrency 1 > "$LOGS/$name.log" 2>&1 &
      pids+=($!)
      names+=("$name")
    done
  done
done

failed=0
for i in "${!pids[@]}"; do
  if ! wait "${pids[$i]}"; then
    echo "FAILED: ${names[$i]} (see $LOGS/${names[$i]}.log)" >&2
    failed=1
  fi
done
[ "$failed" -eq 0 ] || exit 1

$PY check_gate.py
