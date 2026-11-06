#!/usr/bin/env bash
# trap-check.sh — the ladder's own CI. Trainer-facing; never ships.
# Walks the ledger's claims against the frozen tag, the tarball, real builds,
# and the wordings.env capture file. Rerun after ANY change to the exemplar,
# the scripts, the ledger, or the environment.
#
#  ok   = verified            FAIL = a ledger claim is false — stop and fix
#  TODO = needs the sandbox (gcc >= 14 capture day) or wordings.env
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/Sacct-reporter-classic-v1.0.0 2009"
TAG="classic-1.0.0"
TB="$ROOT/trainer/dist/sacct-reporter-1.0.tar.gz"
CLIMB="$ROOT/climb"

# RL4 constants (trap-ledger.md, filled 6 Nov 2026)
SMALL_DUMP_SHA="1021e8f2f1aa5417bf41521cfd7dc4150076c5e999208f9be3cb693859481a53"
BENCH_DUMP_SHA="cc596a91be2724222e679228f0691891d9f9a493a2c1252d5be986e647615f67"
SMALL_REP_SHA="4342b76b2d292636811712e146e6b66f1bd4d71b705547a02cb701a5ec26bbc1"
BENCH_REP_SHA="5201155481e6e14a1343b23606b9ad74fe092953aac21b1de641fdbe2c9f1981"

FAIL=0; TODO=0
ok()  { echo " ok   $1"; }
bad() { echo " FAIL $1"; FAIL=1; }
todo(){ echo " TODO $1"; TODO=$((TODO+1)); }

sha_of() { sha256sum "$1" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$1" | awk '{print $1}'; }

if [ -f "$ROOT/trainer/wordings.env" ]; then
    . "$ROOT/trainer/wordings.env"
else
    T1_ERROR=""; T3_ERROR=""; T4_ERROR=""; T5_ERROR=""; T6_ERROR=""
fi
has_wording() { [ -n "$1" ]; }
say_wording() { has_wording "$1" || echo "        (wordings.env unfilled — capture day)"; }

W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
echo "== trap-check @ $(date '+%Y-%m-%d %H:%M') — tag $TAG"

echo "-- A. freeze integrity"
git -C "$SRC" rev-parse -q --verify "$TAG^{commit}" > /dev/null \
  || { bad "tag $TAG missing"; echo "$FAIL FAIL(s), done"; exit 1; }
ok "tag $TAG exists"
[ -z "$(git -C "$SRC" status --porcelain)" ] && ok "classic tree clean (== frozen state)" \
  || bad "classic tree dirty — tarball/ledger line numbers would rot"

echo "-- B. tarball packaging (pipeline step: frozen tag minus trainer/)"
if [ -f "$TB" ] && [ -f "$CLIMB/TARBALL-SHA256.txt" ]; then
    GOT=$(sha_of "$TB"); WANT=$(awk '{print $1}' "$CLIMB/TARBALL-SHA256.txt")
    [ "$GOT" = "$WANT" ] && ok "tarball sha256 == climb/TARBALL-SHA256.txt" \
      || bad "tarball sha mismatch ($GOT vs $WANT) — rerun make-tarball.sh"
    LST=$(tar -tzf "$TB")
    echo "$LST" | grep -q "build\.sh"           && bad "tarball contains build.sh (lie #1 must stay fictional)"
    echo "$LST" | grep -q "trainer"             && bad "tarball leaks trainer/"
    echo "$LST" | grep -qvE 'sacct-reporter-1\.0/' && bad "tarball has entries outside the sacct-reporter-1.0/ prefix"
    N=$(echo "$LST" | grep -cE '\.csv\.gz|\.c$|\.h$|Makefile$|README\.md$|INSTALL$|\.gitignore$')
    [ "$N" -eq 11 ] && ok "tarball carries the 11 frozen files" || bad "tarball file count $N != 11"
else
    bad "no tarball or no TARBALL-SHA256.txt — run trainer/make-tarball.sh"
fi

echo "-- C. unpack + the two fiction guarantees"
mkdir -p "$W/t" && tar -xzf "$TB" -C "$W/t"
CRAP=$(grep -ril "trap" "$W/t" 2>/dev/null | tr '\n' ' ')
[ -z "$CRAP" ] && ok "no 'trap' wording anywhere in shipped files" \
  || bad "the word 'trap' leaked into: $CRAP"
ok "tarball unpacked (fiction: the climber's found source)"

echo "-- D. anchor walk — every ledger grep key, in the shipped tarball"
ANCHORS="metrics.c:old style used before
metrics.c:byte-stable on purpose
report.c:link line picks
main.c:usage: sacct-reporter report
Makefile:LDLIBS
README.md:./build.sh
README.md:gcc 4.1
README.md:sacct-metrics-devel
README.md:nothing to pin down
README.md:[no-]overall
README.md:waste of time
acsacct.h:JobID"
MISS=0
while IFS= read -r kv; do
    f="${kv%%:*}"; k="${kv#*:}"
    grep -qF "$k" "$W/t/sacct-reporter-1.0/$f" 2>/dev/null || { MISS=1; echo "        missing: $f :: $k"; }
done <<EOF
$ANCHORS
EOF
[ "$MISS" -eq 0 ] && ok "12/12 anchor keys present" || bad "anchor keys missing (see list above)"
[ -f "$W/t/sacct-reporter-1.0/README-gem-original.md" ] && bad "gem README must NOT ship in the tarball" \
  || ok "gem's real README stays out (liar README ships instead)"

echo "-- E. dump checksums (RL4)"
H1=$(sha_of "$W/t/sacct-reporter-1.0/jobs-small.csv.gz")
H2=$(sha_of "$W/t/sacct-reporter-1.0/jobs-bench.csv.gz")
[ "$H1" = "$SMALL_DUMP_SHA" ]  && ok "jobs-small  sha matches RL4"  || bad "jobs-small sha drifted: $H1"
[ "$H2" = "$BENCH_DUMP_SHA" ]  && ok "jobs-bench  sha matches RL4"  || bad "jobs-bench sha drifted: $H2"

echo "-- F. fixed reference build — RL4 report digests (scratch, never the classic dir)"
mkdir -p "$W/g" && tar -xzf "$TB" -C "$W/g"
cp "$ROOT/trainer/reference/Makefile.good" "$W/g/sacct-reporter-1.0/Makefile"
if make -C "$W/g/sacct-reporter-1.0" > "$W/g-build.log" 2>&1; then
    R=$(sha_of "$W/g/sacct-reporter-1.0/report-small.tmp" 2>/dev/null)
    "$W/g/sacct-reporter-1.0/acsacct" "$W/g/sacct-reporter-1.0/jobs-small.csv.gz" > "$W/g/sreport.tmp" 2>/dev/null
    [ "$(sha_of "$W/g/sreport.tmp")" = "$SMALL_REP_SHA" ] && ok "small report == RL4 digest" \
      || bad "small report checksum $R != RL4 — data or code drifted; rerun capture checks"
else
    bad "Makefile.good build failed: $(tail -2 "$W/g-build.log" | tr '\n' ' ')"
fi

echo "-- G. Makefile.good diff policy: exactly the two fixed lines"
NF=$(grep -v '^#' "$SRC/Makefile" | grep -v '^[[:space:]]*$')
NG=$(grep -v '^#' "$ROOT/trainer/reference/Makefile.good" | grep -v '^[[:space:]]*$')
D=$(diff <(printf '%s\n' "$NF") <(printf '%s\n' "$NG") | grep -cE '^[<>]')
[ "$D" -le 4 ] && ok "Makefile.good differs from the trapped Makefile by exactly the 2 intended lines" \
  || bad "Makefile.good drift: $D diff lines (want <= 4: CFLAGS + LDLIBS)"

echo "-- H. cascade wording capture (sandbox gcc >= 14 is authoritative)"
INC="$(xcrun --show-sdk-path 2>/dev/null)/usr/include"
if [ -f "$INC/zlib.h" ]; then
    F="$(mktemp -d)/inc"; mkdir -p "$F"
    ln -s "$INC"/*.h "$F/" 2>/dev/null
    for d in "$INC"/*/; do ln -s "${d%/}" "$F/$(basename "${d%/}")" 2>/dev/null; done
    rm -f "$F/zlib.h" "$F/zconf.h"
    cc -nostdinc -isystem "$F" -I"$W/t/sacct-reporter-1.0" -c "$W/t/sacct-reporter-1.0/report.c" > "$W/t3.log" 2>&1
else
    L3=$(mktemp -d); mkdir -p "$L3"; tar -xzf "$TB" -C "$L3"
    cc -c "$L3/sacct-reporter-1.0/report.c" -I"$L3/sacct-reporter-1.0" > "$W/t3.log" 2>&1
    [ $? -eq 0 ] && bad "ENV: zlib.h compiles here — the sandbox must NOT ship zlib headers (rung 2 would be dead)"
fi
T3LINE=$(grep -m1 "error" "$W/t3.log" 2>/dev/null | tr -d '\r' || true)
if [ -n "$T3LINE" ]; then
    if has_wording "$T3_ERROR"; then
        case "$T3LINE" in *"$T3_ERROR"*) ok "T3 fires + wording matches";; *) bad "T3 says something new: '$T3LINE'";; esac
    else todo "T3 fired: '$T3LINE' — paste invariant tail into wordings.env T3_ERROR"
    fi
else todo "T3 did not fire on this box — capture day does it on the sandbox"
    say_wording "$T3_ERROR"
fi

T4RC=0; cc -c "$W/t/sacct-reporter-1.0/metrics.c" -I"$W/t/sacct-reporter-1.0" > "$W/t4.log" 2>&1 || T4RC=$?
T4LINE=$(grep -m1 -E "error" "$W/t4.log" 2>/dev/null | tr -d '\r' || true)
if [ "$T4RC" -ne 0 ]; then
    if has_wording "$T4_ERROR"; then
        case "$T4LINE" in *"$T4_ERROR"*) ok "T4 fires + wording matches";; *) bad "T4 says something new: '$T4LINE'";; esac
    else todo "T4 fired: '$T4LINE' — paste invariant tail into wordings.env T4_ERROR"
    fi
else todo "T4 compiles-only-warns here (clang) — the ERROR form needs sandbox gcc >= 14"
    say_wording "$T4_ERROR"
fi

mkdir -p "$W/c" && tar -xzf "$TB" -C "$W/c"
cd "$W/c/sacct-reporter-1.0" || exit 1
if make CFLAGS="-O2 -Wall -std=gnu89" > "$W/t5.log" 2>&1; then
    todo "T5 skipped — link succeeded with empty LDLIBS?! zlib linked without -lz; ENV wrong"
else
    T5LINE=$(grep -m1 -E "undefined reference|undefined symbol|symbol\(s\) not found" "$W/t5.log" 2>/dev/null | tr -d '\r' || true)
    if [ -n "$T5LINE" ]; then
        if has_wording "$T5_ERROR"; then
            case "$T5LINE" in *"$T5_ERROR"*) ok "T5 fires + wording matches";; *) bad "T5 says something new: '$T5LINE'";; esac
        else todo "T5 fired: '$T5LINE' — paste invariant tail into wordings.env T5_ERROR"
        fi
    else bad "link failed but nothing recognisable was emitted — inspect $W/t5.log"
    fi
fi

if make CFLAGS="-O2 -Wall -std=gnu89" LDLIBS="-lz" > "$W/t6.log" 2>&1 && [ -x ./acsacct ]; then
    ok "T6 stage: dialect+link fix → binary (cascade order holds)"
    [ "$(sha_of <(./acsacct jobs-small.csv.gz))" = "$SMALL_REP_SHA" ] 2>/dev/null \
      && ok "acsacct's report == RL4 (from a cascade-repaired build)" \
      || { ./acsacct jobs-small.csv.gz > "$W/rep.tmp"; [ "$(sha_of "$W/rep.tmp")" = "$SMALL_REP_SHA" ] \
             && ok "acsacct's report == RL4" || bad "cascade-repaired build's report != RL4"; }
    T6LINE=$(bash -c './sacct-reporter report' 2>&1 | head -1 | tr -d '\r')
    if has_wording "$T6_ERROR"; then
        case "$T6LINE" in *"$T6_ERROR"*) ok "T6 shell wording matches";; *) bad "T6 shell says: '$T6LINE'";; esac
    else todo "T6 shell reply: '$T6LINE' — paste into wordings.env T6_ERROR"
    fi
    ./acsacct --help | head -1 | grep -q "usage: sacct-reporter report" \
      && ok "binary corroborates the anachronism (usage echo intact)" \
      || bad "acsacct --help no longer echoes the anachronism usage"
else
    bad "T6 stage failed: $(tail -2 "$W/t6.log" | tr '\n' ' ')"
fi
T1LINE=$(bash -c './build.sh' 2>&1 | head -1 | tr -d '\r')
if has_wording "$T1_ERROR"; then
    case "$T1LINE" in *"$T1_ERROR"*) ok "T1 shell wording matches";; *) bad "T1 shell says: '$T1LINE'";; esac
else todo "T1 shell reply: '$T1LINE' — paste into wordings.env T1_ERROR"
fi

echo "-- I. summary"
echo " FAIL=$FAIL  TODO=$TODO"
[ "$FAIL" -eq 0 ] || echo " → stop: fix FAIL rows before any climber sees the ladder"
[ "$TODO" -eq 0 ] || echo " → capture day: fill trainer/wordings.env from real gcc/ld output"
exit "$FAIL"
