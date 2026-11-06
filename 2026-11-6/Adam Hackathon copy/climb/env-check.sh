#!/usr/bin/env bash
# env-check.sh — rung 0's gate. The box and the "found" tarball only.
# Deliberately does NOT touch zlib, headers, or any compiler feature beyond
# existence: the dependency hunt is rung 2's, and this script must not spoil it.
set -u
CLIMB="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$CLIMB/.." && pwd)"
TARBALL="$ROOT/sacct-reporter-1.0.tar.gz"

fail() { echo "  ✗ $1"; echo; echo "  ENV: FAIL — fix the line above, rerun."; exit 1; }

echo "== rung 0 — env-check: the box, the tarball, nothing else"
echo

[ -f "$TARBALL" ] || fail "the tarball is missing: $TARBALL (run ./climb/reset-sandbox.sh if it vanished)"

shatool() { sha256sum "$1" 2>/dev/null || shasum -a 256 "$1"; }
GOT=$(shatool "$TARBALL" | awk '{print $1}')
WANT=$(awk '{print $1}' "$CLIMB/TARBALL-SHA256.txt" 2>/dev/null)
[ "$GOT" = "$WANT" ] || fail "the tarball's sha256 does not match the ladder ($GOT vs $WANT). Not the data this ladder was frozen against — reset-sandbox."

GCCV=$(gcc --version 2>/dev/null | head -1)
[ -n "$GCCV" ] || fail "no C compiler found (gcc). Rung 2 is a toolchain hunt — with nothing to hunt with, ask the venue."

MAKEV=$(make --version 2>/dev/null | head -1)
[ -n "$MAKEV" ] || fail "no make found. Ask the venue — make is part of the promised box."

tar -tzf "$TARBALL" > /dev/null 2>&1 || fail "the tarball is unreadable by tar. reset-sandbox."

[ -f "$CLIMB/pins.txt" ]        || cp "$CLIMB/pins.template.txt" "$CLIMB/pins.txt"
[ -f "$CLIMB/climb-log.md" ]    || cp "$CLIMB/climb-log.template.md" "$CLIMB/climb-log.md"

echo "  compiler : $GCCV"
echo "  make     : $MAKEV"
echo "  tarball  : intact (sha256 match)"
echo
echo "  No zlib check ran. None will appear before rung 2 — the hunt is yours."
echo
echo "  ENV: OK — rung 1 awaits. Log the climb in climb/climb-log.md as you go."
exit 0
