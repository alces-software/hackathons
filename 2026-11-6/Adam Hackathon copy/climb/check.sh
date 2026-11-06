#!/usr/bin/env bash
# check.sh N — the rung gate. Verifies a win; never fixes anything for you.
#   0 = env-check (rung 0)   1 = hello builds    2 = dependency hunt done
#   3 = the real report, byte-exact        4 = measured, not assumed (bench)
#   5 = a stranger can climb your ladder   (rung 5 — plus its human half)
set -u
CLIMB="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$CLIMB/.." && pwd)"
TREE="$ROOT/sacct-reporter-1.0"

# ledger RL4 — the checksum contract (jobs-small report, 74 lines)
SMALL_SHA="4342b76b2d292636811712e146e6b66f1bd4d71b705547a02cb701a5ec26bbc1"

LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT

sha256() { sha256sum "$1" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$1" | awk '{print $1}'; }
win()  { echo; echo "  === RUNG $1/5 ✓ — $2"; echo; exit 0; }
fail() { echo; echo "  === not yet — $1"; echo; exit 1; }

[ -n "${1:-}" ] || fail "usage: check.sh <0|1|2|3|4|5>"

case "$1" in
0)  exec "$CLIMB/env-check.sh" ;;

1)  # CH1 — hello exists and announces itself
    [ -d "$TREE" ] || fail "no $TREE — unpack the tarball first (front door, step 2)."
    [ -x "$TREE/hello" ] || fail "no ./hello in the tree. The README's one command never existed (lie #1) — check.sh 1 will not compile it for you. Rung card 1, hint H1, if the blank is loud."
    OUT=$("$TREE/hello" 2>/dev/null | head -1)
    [ "$OUT" = "sacct-reporter 1.0 (classic edition)" ] \
      || fail "./hello ran but did not announce the right thing (got: '$OUT'). Re-read what you compiled."
    win 1 "you just built a working binary from a lying README."
    ;;

2)  # CH2 — past the header, not yet linked
    make -C "$TREE" > "$LOG" 2>&1
    if grep -qi "zlib\.h" "$LOG"; then
      fail "still at the header. The package the README named never existed (lie #3) — hunt by file, not by package name: rung card 2, H2."
    fi
    if [ -x "$TREE/acsacct" ]; then
      fail "./acsacct already runs — that is rung 3's win. Go claim it with check.sh 3."
    fi
    if grep -qEi "undefined reference|undefined symbol|symbol\(s\) not found" "$LOG"; then
      fail "the LINK stage is failing — that wall belongs to rung 3. The rung-2 win is make stalling on metrics.c, before any linking. If your Makefile already has flags, run them back out and claim 2 first: the hunt is its own rung."
    fi
    grep -q "metrics\.c" "$LOG" \
      || fail "make is not stopping on metrics.c — show the rung-2 card the actual failure; something else died first."
    win 2 "past the header, not yet linked. The dependency hunt is done — zlib is installed and the compiler agrees. What stops make now is not a dependency."
    ;;

3)  # CH3c — clean rebuild, byte-exact report (the truth test *is* the check)
    make -C "$TREE" clean > /dev/null 2>&1
    make -C "$TREE" > "$LOG" 2>&1 || fail "make fails — read the FIRST error, not the last (rung card 3)."
    [ -x "$TREE/acsacct" ] || fail "make succeeded but no ./acsacct came out — show the card; that should be impossible."
    "$TREE/acsacct" "$TREE/jobs-small.csv.gz" > "$TREE/report.tmp" 2>/dev/null \
      || fail "./acsacct exited nonzero on the small dump. Read its stderr."
    GOT=$(sha256 "$TREE/report.tmp")
    [ "$GOT" = "$SMALL_SHA" ] || fail "the report is not byte-exact (got $GOT). Same dump must give the same report, byte for byte — see the byte-stable note in the source and hint H3-T6."
    win 3 "the report is byte-exact, and it survives make clean. Lie #4 fell with the link line."
    ;;

4)  # CH4 — the timing table exists and bench verdict is PASS
    [ -f "$CLIMB/bench-results.txt" ] || fail "no bench table yet — run ./climb/bench.sh first. Measure before you answer anything."
    grep -q "^BENCH-VERDICT: PASS" "$CLIMB/bench-results.txt" \
      || fail "bench.sh ran but did not reach PASS (see the verdict at the bottom of climb/bench-results.txt)."
    win 4 "measured, the table filled — and the README's tuning advice was your data now."
    ;;

5)  # CH5 — pins, repro docs, and a pristine-room build.sh proof
    PINLINES=$(grep -cvE '^(#|$)' "$CLIMB/pins.txt" 2>/dev/null || echo 0)
    [ "$PINLINES" -ge 4 ] 2>/dev/null || fail "pins.txt has fewer than four facts (it should carry one per rung: compiler / packages / dialect+link / optimisation). The README promised 'nothing to pin down' — you now know better (lie #4 again)."
    [ -f "$TREE/build.sh" ] || fail "no build.sh in the tree — rung 5 writes the file the README only pretended to have. Rung card 5, H2."
    [ -f "$TREE/BUILD-REPRO.md" ] || fail "no BUILD-REPRO.md in the tree — the neighbour needs the contract in writing, not in chat history."
    CRIMEROOM=$(mktemp -d)
    cp -r "$TREE" "$CRIMEROOM/t"
    ( cd "$CRIMEROOM/t" && make clean > /dev/null 2>&1 && ./build.sh > "$LOG" 2>&1 ) \
      || fail "build.sh fails in a pristine copy. Someone else's box does exactly this — fix it until the copy builds (log: $LOG)."
    ( cd "$CRIMEROOM/t" && ./acsacct jobs-small.csv.gz > "$CRIMEROOM/r.txt" 2>/dev/null ) \
      || fail "build.sh built a binary that does not run."
    GOT=$(sha256 "$CRIMEROOM/r.txt")
    rm -rf "$CRIMEROOM"
    [ "$GOT" = "$SMALL_SHA" ] || fail "build.sh's pristine run does not reproduce the exact report ($GOT). Same contract, same bytes — that is the rung."
    win 5 "a stranger can climb your ladder. Now the human half: hand the tree to your neighbour and watch check.sh 3 run on THEIR box."
    ;;

*)  fail "no rung '$1'. rungs: 0 1 2 3 4 5" ;;
esac
