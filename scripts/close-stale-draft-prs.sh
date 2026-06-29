#!/usr/bin/env bash
# Close stale Cursor-agent draft PRs that conflict with main or duplicate merged work.
# Requires: gh CLI authenticated with pull-request write access.
set -euo pipefail

CLOSE_DIRTY_MSG='Closing as stale: merge conflicts with `main` and work superseded by merged PRs (#447, #446, #449, #469, #440, #398, etc.) or duplicate agent-generated attempts. Reopen from a fresh branch if still needed.'

CLOSE_BLOCKED_DUP_MSG='Closing as duplicate: overlaps with merged coding-standards work (#447, #398, #391). Reopen from a fresh branch if additional coverage is still needed.'

# 69 drafts with merge conflicts (DIRTY) — all agent-generated duplicates or superseded work.
DIRTY_PRS=(
  473 470 466 464 461 460 459 458 457 456 455 453 452 443 442 441
  437 436 435 434 433 432 426 419 418 416 415 414 413 412 411 410 409
  404 402 401 400 399 397 394 389 388 387 386 385 384 383 382 381 380
  371 369 367 365 364 357 356 349 343 340 338 332 330 323 319 168 167 125 104
)

# 8 BLOCKED drafts that duplicate already-merged coding-standards PRs (no conflicts, but redundant).
BLOCKED_DUP_PRS=(474 478 462 471 468 408 421 424)

close_prs() {
  local msg="$1"
  shift
  local pr closed=0 failed=0
  for pr in "$@"; do
    if gh pr close "$pr" --comment "$msg"; then
      echo "closed #$pr"
      closed=$((closed + 1))
    else
      echo "FAILED #$pr" >&2
      failed=$((failed + 1))
    fi
  done
  echo "done: closed=$closed failed=$failed"
}

usage() {
  cat <<'EOF'
Usage: close-stale-draft-prs.sh [--dry-run] [--dirty-only] [--blocked-dupes-only]

  --dry-run            Print PR numbers that would be closed (default without flags closes all)
  --dirty-only         Close only DIRTY (conflicting) drafts
  --blocked-dupes-only Close only BLOCKED duplicate coding-standards drafts

Keeps open (review these separately):
  CLEAN:  #463, #465 (target mcp_search branch)
  BLOCKED unique: #366 #376 #423 #427 #438 #467 #475 #477 #479 #480 #483 #484 #485
EOF
}

DRY_RUN=false
MODE=all

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --dirty-only) MODE=dirty; shift ;;
    --blocked-dupes-only) MODE=blocked; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if $DRY_RUN; then
  case "$MODE" in
    dirty) printf '%s\n' "${DIRTY_PRS[@]}" ;;
    blocked) printf '%s\n' "${BLOCKED_DUP_PRS[@]}" ;;
    all)
      printf '%s\n' "${DIRTY_PRS[@]}"
      printf '%s\n' "${BLOCKED_DUP_PRS[@]}"
      ;;
  esac
  exit 0
fi

case "$MODE" in
  dirty) close_prs "$CLOSE_DIRTY_MSG" "${DIRTY_PRS[@]}" ;;
  blocked) close_prs "$CLOSE_BLOCKED_DUP_MSG" "${BLOCKED_DUP_PRS[@]}" ;;
  all)
    close_prs "$CLOSE_DIRTY_MSG" "${DIRTY_PRS[@]}"
    close_prs "$CLOSE_BLOCKED_DUP_MSG" "${BLOCKED_DUP_PRS[@]}"
    ;;
esac
