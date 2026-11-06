#!/usr/bin/env bash
# trainer/make-tarball.sh — the climber-facing tarball, cut from the frozen tag.
#
# = tag classic-1.0.0 exactly: 11 files under sacct-reporter-1.0/. No trainer/,
# no build.sh, no .git. gzipped deterministically (-9n); the sha256 is written
# to climb/TARBALL-SHA256.txt — env-check.sh's integrity target.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/Sacct-reporter-classic-v1.0.0 2009"
TAG="classic-1.0.0"
DIST="$ROOT/trainer/dist"

[ -d "$SRC/.git" ] || { echo "make-tarball: no frozen repo at $SRC" >&2; exit 1; }
[ -z "$(git -C "$SRC" status --porcelain)" ] || {
  echo "make-tarball: classic tree is dirty — the tarball must equal the tag state" >&2; exit 1; }

mkdir -p "$DIST" "$ROOT/climb"
TB="$DIST/sacct-reporter-1.0.tar.gz"
git -C "$SRC" archive --prefix=sacct-reporter-1.0/ "$TAG" | gzip -9n > "$TB"

SHA=$(sha256sum "$TB" 2>/dev/null | awk '{print $1}' \
      || shasum -a 256 "$TB" | awk '{print $1}')
printf '%s\n' "$SHA" > "$ROOT/climb/TARBALL-SHA256.txt"

echo "tarball: $TB"
echo "sha256:  $SHA   (-> climb/TARBALL-SHA256.txt)"
echo "contents:"
tar -tzf "$TB"
