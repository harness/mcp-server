#!/usr/bin/env python3
"""Assert the gate thresholds on results/*_gate_*.json. Non-zero exit on any miss."""

import glob
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
MAX_CORRECTNESS_DROP = 0.05  # compact any_call_correct may trail full by at most this
MIN_CORRECTNESS = 0.90
MAX_TOKEN_RATIO = 0.65  # compact input tokens/task vs full
MAX_UNKNOWN_TYPE_RATE = 0.02

runs = {}
for f in glob.glob(str(HERE / "results" / "*_gate_instr-*.json")):
    s = json.load(open(f))["summary"]
    runs[(s["model"], s["mode"], s["instructions"])] = s

failures = []
if not runs:
    failures.append("no gate results found")
for (model, mode, instr), s in sorted(runs.items()):
    tag = f"{model}/{mode}/instr-{instr}"
    if s["confirm_on_read_only"] != 0:
        failures.append(f"{tag}: confirm set on a read-only task")
    if s["any_call_correct"] < MIN_CORRECTNESS:
        failures.append(f"{tag}: any_call_correct {s['any_call_correct']:.2f} < {MIN_CORRECTNESS}")
    if mode == "compact":
        if s["unknown_type_error_rate"] > MAX_UNKNOWN_TYPE_RATE:
            failures.append(f"{tag}: unknown_type_error_rate {s['unknown_type_error_rate']:.3f}")
        full = runs.get((model, "full", instr))
        if full is None:
            failures.append(f"{tag}: missing matching full run")
            continue
        if full["any_call_correct"] - s["any_call_correct"] > MAX_CORRECTNESS_DROP:
            failures.append(f"{tag}: correctness {s['any_call_correct']:.2f} vs full {full['any_call_correct']:.2f}")
        ratio = s["input_tokens_per_task"] / full["input_tokens_per_task"]
        if ratio > MAX_TOKEN_RATIO:
            failures.append(f"{tag}: input tokens ratio {ratio:.2f} > {MAX_TOKEN_RATIO}")

for f in failures:
    print("GATE FAIL:", f, file=sys.stderr)
print("gate passed" if not failures else f"{len(failures)} gate failure(s)")
sys.exit(1 if failures else 0)
