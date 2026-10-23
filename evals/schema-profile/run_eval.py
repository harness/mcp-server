#!/usr/bin/env python3
"""Model-in-the-loop eval: does HARNESS_SCHEMA_MODE=compact change how well a model uses the tools?

Starts the built MCP server over stdio against a stub Harness API, gives a model the real tools/list,
and scores the tool calls it makes with harness-evals metrics plus a few deterministic checks.

  ANTHROPIC_API_KEY=... python run_eval.py --mode compact --instructions on --model claude-haiku-5-5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from anthropic import AsyncAnthropic

from harness_evals.core.eval_case import EvalCase
from harness_evals.core.types import ToolCall
from harness_evals.metrics.mcp.tool_selection import ToolSelectionAccuracyMetric

HERE = Path(__file__).parent
REPO = HERE.parent.parent
SCOPED_TOOLS = {"harness_list", "harness_get", "harness_create", "harness_update", "harness_delete", "harness_execute", "harness_diagnose"}
MAX_TURNS = 5
DEFAULT_TOOL_RESULT_CHARS = 120_000
SYSTEM = "You are an assistant that operates a Harness account through the provided tools. Use the tools to complete the task. Be concise."


class _Stub(BaseHTTPRequestHandler):
    """Answers every Harness API call with an empty-but-valid success payload."""

    def _reply(self) -> None:
        body = json.dumps({"status": "SUCCESS", "data": {"content": [], "totalElements": 0, "pageIndex": 0}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = _reply

    def log_message(self, *_: object) -> None:
        pass


def start_stub() -> tuple[HTTPServer, int]:
    srv = HTTPServer(("127.0.0.1", 0), _Stub)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_port


# Mirrors the server's near-miss resolution, so a call the server accepts counts as correct.
ALIASES = {"repo": "repository", "repos": "repository", "pr": "pull_request", "exec": "execution", "env": "environment", "svc": "service"}


def canon(key: str, v: object) -> set[str]:
    """Candidate canonical forms of a value; resource_type mirrors the server's alias resolution."""
    s = str(v).strip().lower().replace("-", "_").replace(" ", "_")
    if key != "resource_type":
        return {s}
    stems = [s]
    if s.endswith("ies"):
        stems.append(s[:-3] + "y")
    if s.endswith("es"):
        stems.append(s[:-2])
    if s.endswith("s"):
        stems.append(s[:-1])
    return {x for t in stems for x in (t, ALIASES.get(t, t))}


def find(obj: object, key: str, value: object) -> bool:
    """True if `key: value` appears anywhere in a nested args structure."""
    if isinstance(obj, dict):
        return any((k == key and canon(k, v) & canon(k, value)) or find(v, key, value) for k, v in obj.items())
    if isinstance(obj, list):
        return any(find(v, key, value) for v in obj)
    return False


def score_case(golden: dict, calls: list[dict]) -> dict:
    exp_tool, exp_args = golden["expected_tool"], dict(golden["expected_args"])
    if exp_tool not in SCOPED_TOOLS:
        exp_args = {k: v for k, v in exp_args.items() if k not in ("org_id", "project_id")}

    def matches(call: dict) -> bool:
        return call["name"] == exp_tool and all(find(call["args"], k, v) for k, v in exp_args.items())

    first = calls[0] if calls else None
    errors = " ".join(c["output"] for c in calls if c["is_error"])
    selection = ToolSelectionAccuracyMetric().measure(
        EvalCase(input=golden["prompt"], output="", tool_calls=[ToolCall(name=c["name"], input=c["args"]) for c in calls], expected_tools=[exp_tool])
    )
    wrong_scope = any(
        c["name"] in SCOPED_TOOLS and exp_args.get(k) is not None and c["args"].get(k) not in (None, exp_args[k])
        for c in calls
        for k in ("org_id", "project_id", "resource_scope")
    )
    describe = [c for c in calls if c["name"] == "harness_describe"]
    expected_operation = golden.get("expected_operation")
    # A direct correct call needs no catalog. Otherwise the describe call should ask for that operation.
    if not expected_operation:
        operation_filter_hit = None
    elif any(c["args"].get("operation") == expected_operation for c in describe):
        operation_filter_hit = True
    elif not describe and any(matches(c) for c in calls):
        operation_filter_hit = True
    else:
        operation_filter_hit = False
    return {
        "id": golden["id"],
        "first_call_correct": bool(first and matches(first)),
        "any_call_correct": any(matches(c) for c in calls),
        "tool_selection": selection.value,
        "calls": len(calls),
        "wasted_calls": sum(1 for c in calls if c["is_error"]),
        "category": golden.get("category", "other"),
        "unknown_type_error": "Unknown resource_type" in errors or ("resource_type" in errors and "Invalid" in errors),
        "wrong_scope": wrong_scope,
        "confirm_on_read_only": golden["read_only"] and any(c["args"].get("confirm") is True for c in calls),
        "write_first_call_confirm": (not golden["read_only"]) and bool(first and first["args"].get("confirm") is True),
        "describe_calls": len(describe),
        "describe_with_operation": sum(1 for c in describe if c["args"].get("operation")),
        "describe_response_bytes": sum(len(c["output"]) for c in describe),
        "expected_operation": expected_operation,
        "operation_filter_hit": operation_filter_hit,
        "tool_calls": calls,
    }


def system_blocks(system: str) -> list[dict]:
    return [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]


async def run_case(client: AsyncAnthropic, session: ClientSession, model: str, tools: list[dict], system: str, golden: dict, tool_result_chars: int) -> tuple[dict, dict]:
    messages: list[dict] = [{"role": "user", "content": golden["prompt"]}]
    calls: list[dict] = []
    usage = {"input": 0, "output": 0}
    for _ in range(MAX_TURNS):
        resp = await client.messages.create(model=model, max_tokens=1024, system=system_blocks(system), messages=messages, tools=tools)
        u = resp.usage
        usage["input"] += u.input_tokens + (u.cache_read_input_tokens or 0) + (u.cache_creation_input_tokens or 0)
        usage["output"] += resp.usage.output_tokens
        messages.append({"role": "assistant", "content": [b.model_dump(exclude_none=True) for b in resp.content]})
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            break
        results = []
        for tu in tool_uses:
            args = tu.input if isinstance(tu.input, dict) else {}
            try:
                result = await session.call_tool(tu.name, args)
                text = "".join(getattr(p, "text", "") for p in result.content)[:tool_result_chars]
                is_error = bool(result.is_error)
            except Exception as exc:  # e.g. client-side outputSchema validation failure
                text, is_error = f"client error: {type(exc).__name__}: {str(exc)[:300]}", True
            calls.append({"name": tu.name, "args": args, "is_error": is_error, "output": text})
            results.append({"type": "tool_result", "tool_use_id": tu.id, "content": text or "(empty)", "is_error": is_error})
        messages.append({"role": "user", "content": results})
    return score_case(golden, calls), usage


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["full", "compact"], required=True)
    ap.add_argument("--instructions", choices=["on", "off"], default="on")
    ap.add_argument("--model", default="claude-haiku-5-5")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--out", default="")
    ap.add_argument("--repeats", type=int, default=1)
    ap.add_argument("--build", default=str(REPO / "build" / "index.js"))
    ap.add_argument("--tag", default="")
    ap.add_argument("--tool-result-chars", type=int, default=DEFAULT_TOOL_RESULT_CHARS, help="Max characters of a tool result returned to the model. High enough to fit a full harness_describe catalog.")
    args = ap.parse_args()

    goldens = [json.loads(line) for line in (HERE / "goldens.jsonl").read_text().splitlines() if line.strip()]
    if args.limit:
        goldens = goldens[: args.limit]
    goldens = [{**g, "id": g["id"] if r == 0 else f"{g['id']}#{r}"} for r in range(args.repeats) for g in goldens]

    _, port = start_stub()
    env = {
        **os.environ,
        "HARNESS_API_KEY": "pat.acct.tok.secret",
        "HARNESS_ACCOUNT_ID": "acct",
        "HARNESS_BASE_URL": f"http://127.0.0.1:{port}",
        "HARNESS_ALLOW_HTTP": "true",
        "HARNESS_SCHEMA_MODE": args.mode,
        "LOG_LEVEL": "error",
    }
    env.pop("HARNESS_ORG", None)
    env.pop("HARNESS_PROJECT", None)
    params = StdioServerParameters(command="node", args=[args.build], env=env)
    client = AsyncAnthropic()

    async with stdio_client(params) as (r, w), ClientSession(r, w) as session:
        init = await session.initialize()
        listed = (await session.list_tools()).tools
        tools = [{"name": t.name, "description": t.description or "", "input_schema": t.input_schema} for t in listed]
        schema_bytes = len(json.dumps([t.model_dump(by_alias=True, exclude_none=True) for t in listed]))
        system = SYSTEM + (("\n\n" + init.instructions) if args.instructions == "on" and init.instructions else "")

        sem = asyncio.Semaphore(args.concurrency)
        started = time.time()

        async def one(g: dict) -> tuple[dict, dict]:
            async with sem:
                return await run_case(client, session, args.model, tools, system, g, args.tool_result_chars)

        results = await asyncio.gather(*(one(g) for g in goldens))

    scored = [s for s, _ in results]
    n = len(scored)
    tin = sum(u["input"] for _, u in results)
    tout = sum(u["output"] for _, u in results)
    summary = {
        "mode": args.mode,
        "instructions": args.instructions,
        "model": args.model,
        "cases": n,
        "tools_list_bytes": schema_bytes,
        "wasted_calls_per_task": statistics.mean(s["wasted_calls"] for s in scored),
        "by_category": {c: round(sum(s["any_call_correct"] for s in scored if s["category"] == c) / sum(1 for s in scored if s["category"] == c), 2) for c in sorted({s["category"] for s in scored})},
        "first_call_correct": sum(s["first_call_correct"] for s in scored) / n,
        "any_call_correct": sum(s["any_call_correct"] for s in scored) / n,
        "tool_selection_mean": statistics.mean(s["tool_selection"] for s in scored),
        "calls_per_task": statistics.mean(s["calls"] for s in scored),
        "unknown_type_error_rate": sum(s["unknown_type_error"] for s in scored) / n,
        "wrong_scope_rate": sum(s["wrong_scope"] for s in scored) / n,
        "confirm_on_read_only": sum(s["confirm_on_read_only"] for s in scored),
        "write_first_call_confirm": sum(s["write_first_call_confirm"] for s in scored),
        "input_tokens": tin,
        "output_tokens": tout,
        "input_tokens_per_task": round(tin / n),
        "describe_calls_per_task": statistics.mean(s["describe_calls"] for s in scored),
        "describe_response_bytes_per_task": round(statistics.mean(s["describe_response_bytes"] for s in scored)),
        "describe_operation_filter_rate": (
            sum(s["describe_with_operation"] for s in scored) / sum(s["describe_calls"] for s in scored)
            if sum(s["describe_calls"] for s in scored)
            else 0
        ),
        "operation_filter_hit_rate": (
            sum(s["operation_filter_hit"] for s in scored if s["expected_operation"]) / sum(1 for s in scored if s["expected_operation"])
            if any(s["expected_operation"] for s in scored)
            else None
        ),
        "tool_result_chars": args.tool_result_chars,
        "elapsed_s": round(time.time() - started, 1),
    }
    print(json.dumps(summary, indent=2))
    out = args.out or str(HERE / "results" / f"{args.model}_{args.mode}{args.tag}_instr-{args.instructions}.json")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps({"summary": summary, "cases": scored}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
