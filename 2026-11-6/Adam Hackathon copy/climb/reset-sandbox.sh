#!/usr/bin/env bash
# reset-sandbox — one command back to rung 0. Wipes the climb; that is the point.
# The tarball is re-unpacked fresh, working copies of the climb log and pins are
# restored blank. Nothing of your run reaches the next climber — and nothing of
# theirs reaches you.
set -u
CLIMB="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$CLIMB/.." && pwd)"

rm -rf "$ROOT/sacct-reporter-1.0" "$CLIMB/pins.txt" "$CLIMB/climb-log.md" "$CLIMB/bench-results.txt"
cp "$CLIMB/pins.template.txt"     "$CLIMB/pins.txt"
cp "$CLIMB/climb-log.template.md" "$CLIMB/climb-log.md"

echo "  === SANDBOX RESET — back to rung 0."
echo "      tree: gone, re-unpacked fresh on your next 'tar -xzf'."
echo "      climb log + pins: restored blank."
echo "      Run ./climb/env-check.sh to go again."
