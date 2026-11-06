#!/usr/bin/env bash
# bench.sh — rung 4's instrument: measure, don't assume.
# Builds the SAME code under several flag sets (builds untimed), then times
# the PROGRAM on the 1M-row bench, 3 timed runs per config, median reported.
# The report's sha256 is recorded per config: flags change speed, never bytes.
#
# Output: climb/bench-results.txt (+ a BENCH-VERDICT line check.sh 4 reads).
# The tree is left built with the LAST config — rebuild your own way after.
set -u
CLIMB="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$CLIMB/.." && pwd)"
TREE="$ROOT/sacct-reporter-1.0"

[ -x "$TREE/acsacct" ] || [ -f "$TREE/Makefile" ] || {
  echo "bench: no tree at $TREE — climb to rung 3 first (check.sh 3)." >&2; exit 1; }
BENCH="$TREE/jobs-bench.csv.gz"
[ -f "$BENCH" ] || { echo "bench: $BENCH missing" >&2; exit 1; }
ROWS=1000000
OUT="$CLIMB/bench-results.txt"

CONFIGS=( "-O0 -Wall -std=gnu89"
          "-O2 -Wall -std=gnu89"
          "-O3 -Wall -std=gnu89"
          "-O2 -Wall -std=gnu89 -march=native" )
LABELS=(  "O0" "O2" "O3" "O2+march=native" )

shasum() { sha256sum "$1" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$1" | awk '{print $1}'; }
median3() { sort -g | sed -n 2p; }

echo "== rung 4 bench — $ROWS rows, 3 timed runs per config (builds untimed)"
echo "== same source, same dump: only the flags move"
printf '%-18s %10s %12s  %s\n' "CONFIG" "MEDIAN(s)" "rows/s" "report sha256" > "$OUT"

ALLSHA=""
i=0
for CFG in "${CONFIGS[@]}"; do
    LBL="${LABELS[$i]}"
    make -C "$TREE" clean > /dev/null 2>&1
    if ! make -C "$TREE" CFLAGS="$CFG" > /dev/null 2>&1; then
        printf '%-18s %10s %12s  %s\n' "$LBL" "-" "build failed" "-" >> "$OUT"
        i=$((i+1)); continue
    fi
    T1=$( { TIMEFORMAT=%R; time "$TREE/acsacct" "$BENCH" > "$TREE/report-bench.tmp" 2>/dev/null; } 2>&1 )
    T2=$( { TIMEFORMAT=%R; time "$TREE/acsacct" "$BENCH" > /dev/null 2>&1; } 2>&1 )
    T3=$( { TIMEFORMAT=%R; time "$TREE/acsacct" "$BENCH" > /dev/null 2>&1; } 2>&1 )
    MED=$(printf '%s\n%s\n%s\n' "$T1" "$T2" "$T3" | median3)
    # first run's report is the checksum evidence — flags must not move bytes
    SHA=$(shasum "$TREE/report-bench.tmp")
    ALLSHA="$ALLSHA $SHA"
    RPS=$(awk -v n="$ROWS" -v t="$MED" 'BEGIN{printf "%.0f", (t>0)? n/t : 0}')
    printf '%-18s %10.3f %12s  %s\n' "$LBL" "$MED" "$RPS" "$SHA" >> "$OUT"
    i=$((i+1))
done

cat "$OUT"
echo

# verdict: the O0->O2 gap must be real, and every report identical
O0=$(awk '$1=="O0"  {print $2}' "$OUT")
O2=$(awk '$1=="O2"  {print $2}' "$OUT")
UNIQ=$(printf '%s\n' $(printf '%s\n' "$ALLSHA") | sort -u | grep -c .)

if [ -z "$O0" ] || [ -z "$O2" ] || [ "$(awk -v a="$O0" -v b="$O2" 'BEGIN{print (a>=b)?1:0}')" = "0" ]; then
    echo "BENCH-VERDICT: FAIL" >> "$OUT"
    echo "== BENCH-VERDICT: FAIL — O0/O2 timings missing or inverted. Check the table above; then read rung card 4 again before rerunning."
    exit 1
fi

if [ "$(awk -v a="$O0" -v b="$O2" 'BEGIN{print (b>0 && a/b >= 1.5)?1:0}')" = "1" ]; then
    RATIO=$(awk -v a="$O0" -v b="$O2" 'BEGIN{printf "%.2f", a/b}')
    if [ "$UNIQ" = "1" ]; then SHA_NOTE="reports identical across configs (flags moved speed, never bytes)"; else SHA_NOTE="WARNING: report bytes differed between configs — that is a ladder break, stop"; fi
    echo "BENCH-VERDICT: PASS" >> "$OUT"
    echo "== BENCH-VERDICT: PASS"
    echo "   O0 -> O2 : ${RATIO}x faster  ($SHA_NOTE)"
    echo "   O3 and -march=native: read the table yourself. What did the README claim about them?"
else
    echo "BENCH-VERDICT: FAIL" >> "$OUT"
    echo "== BENCH-VERDICT: FAIL — O0 must be at least 1.5x O2 on this bench. On a noisy box, rerun once and take the better reading; if it still will not separate, find a quieter core and say so in the climb log."
    exit 1
fi
