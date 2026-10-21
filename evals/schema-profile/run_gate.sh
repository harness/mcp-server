#!/bin/bash
# Gate matrix for deciding the default schema mode.
PY=${PY:-/tmp/evalvenv/bin/python}
cd "$(dirname "$0")"
run() { $PY run_eval.py --repeats 2 --tag _gate "$@" > /tmp/gate_$$_$RANDOM.log 2>&1; }
run --model claude-haiku-5-5 --mode full --instructions on &
run --model claude-haiku-5-5 --mode compact --instructions on &
run --model claude-haiku-5-5 --mode full --instructions off &
run --model claude-haiku-5-5 --mode compact --instructions off &
wait
run --model claude-sonnet-5-5 --mode full --instructions on &
run --model claude-sonnet-5-5 --mode compact --instructions on &
run --model claude-sonnet-5-5 --mode full --instructions off &
run --model claude-sonnet-5-5 --mode compact --instructions off &
wait
