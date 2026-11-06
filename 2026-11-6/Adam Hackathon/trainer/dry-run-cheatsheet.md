# Dry-run cheat sheet — test the whole ladder yourself, end to end

You play every role in order: **venue → climber → debrief → trainer CI**.
Runtime ≈ 15 min (the bench takes ~30 s of it). Run the blocks in order and
read every EXPECTED line before moving on. If anything surprises you, that is
a system bug — log it; the log of this run *is* a dry-run artifact.

Two boxes, one sheet:

- **Local Mac (today):** everything works except sandbox-exact error wording.
  Rung 2 will land in its designed "link stage" branch — clang only *warns* on
  the K&R code, so local `make` sails past metrics.c and dies at the link.
  That branch is correct behaviour; do not "fix" it.
- **Venue sandbox (gcc ≥ 14):** same sheet, but rung 2 stops at metrics.c
  like the ledger says, and you additionally **capture the real error lines**
  into `trainer/wordings.env` (§9).

Golden rules while you run: no script may name a trap, a file:line, or zlib
before rung 2; every FAIL text must be actionable without a human; a command
marked for one box never runs on the other — the two boxes branch off this
one sheet.

Anchor rule: every block starts from `$SBOX`; tree-touching commands are
wrapped in `( cd sacct-reporter-1.0 && … )` so your prompt never wanders. If a
command "cannot find" something, read your *prompt* before suspecting the
ladder — the working directory is suspect #0, and that is rung 1's actual
lesson before it is the cheat sheet's.

---

## 0. Stage the cheat box (exactly like a venue would)

```bash
SRC="/Users/adam/hackathons/The readme that lies"
SBOX=/tmp/cheatbox
rm -rf "$SBOX" && mkdir -p "$SBOX"
cp -R "$SRC/climb" "$SBOX/climb"
cp "$SRC/trainer/dist/sacct-reporter-1.0.tar.gz" "$SBOX/"
cd "$SBOX" && ls
```

**EXP:** `climb sacct-reporter-1.0.tar.gz` — nothing else. No .git, no
trainer/ in reach. From here on, everything runs from `$SBOX`.

---

## 1. Rung 0 — the gate, then break it on purpose

```bash
./climb/env-check.sh
```

**EXP:**
```
  compiler : …
  make     : …
  tarball  : intact (sha256 match)
  No zlib check ran. None will appear before rung 2 — the hunt is yours.
  ENV: OK — rung 1 awaits. …
```

```bash
printf 'x' >> sacct-reporter-1.0.tar.gz    # tamper
./climb/env-check.sh
cp "$SRC/trainer/dist/sacct-reporter-1.0.tar.gz" .   # restore
./climb/env-check.sh                        # green again
```

**EXP:** tampered run ends `ENV: FAIL` with the sha-mismatch line; restore
greens it. If a corrupted tarball still passes, the integrity gate is dead.

---

## 2. Rung 1 — read the liar, hit lie #1, build hello

```bash
tar -xzf sacct-reporter-1.0.tar.gz
less sacct-reporter-1.0/README.md        # six lies live here — spot-check L1
( cd sacct-reporter-1.0 && ./build.sh )
```

**EXP:** `bash: ./build.sh: No such file or directory` — the README's one
command never existed (lie #1). On the sandbox, record this shell line as
`T1_ERROR` material (§9) — exact bash wording, from *this* box.

```bash
./climb/check.sh 1                        # negative path first: no hello yet
```

**EXP:** `=== not yet — no ./hello in the tree. The README's one command
never existed (lie #1) …` — actionable, no file:line.

```bash
( cd sacct-reporter-1.0 && gcc hello.c -o hello && ./hello )
./climb/check.sh 1
```

**EXP:** banner = `sacct-reporter 1.0 (classic edition)`, then
`=== RUNG 1/5 ✓ — you just built a working binary from a lying README.`

---

## 3. Rung 2 — watch the FIRST error (this is the capture step on the sandbox)

```bash
( cd sacct-reporter-1.0 && make 2>&1 | tee /tmp/cheat-make1.log )
```

**EXP — sandbox:** the *first* hard failure names the missing header, e.g. a
line containing `zlib.h: No such file or directory` at `report.c` — the T3
trap, before a single line of logic runs. Save that exact line: wordings.env
`T3_ERROR` (invariant tail only — no /tmp paths).
**EXP — local Mac:** headers are present, clang *warns* through the K&R code
and the build dies at the link on `_gzopen`/etc. That is the designed local
divergence; note it and move on.

Venue sandbox only. **On the local Mac, skip the whole next block — do NOT
run it.** macOS ships zlib headers with clang; that is *why* the local branch
above ends at the link stage. There is no dnf on a Mac — running it here buys
`sudo: dnf: command not found`, asks for a password, and changes nothing.

```bash
# VENUE SANDBOX ONLY — a local Mac must not run this:
sudo dnf install -y zlib-devel    # the vendored cache answers
```

```bash
( cd sacct-reporter-1.0 && make 2>&1 | tee /tmp/cheat-make2.log )
```

**EXP — sandbox:** now the K&R definitions refuse (T4): the first *error*
quotes `metrics_add` / old-style parameter declarations — record the line as
`T4_ERROR`. Nothing links yet.
**EXP — local:** make already showed its one local picture — the link wall.
Proceed straight to `check.sh 2`.

```bash
./climb/check.sh 2
```

**EXP — sandbox:** `=== RUNG 2/5 ✓ — past the header, not yet linked…`
**EXP — local:** `=== not yet — the LINK stage is failing — that wall belongs
to rung 3 …` — the designed branch for a clang box. Both are correct: what
must NEVER happen is a rung-2 pass *and* a linked binary.

---

## 4. Rung 3 — two lines, then the truth test

```bash
./climb/check.sh 3                        # negative path: Makefile still trapped
```

**EXP:** `=== not yet — make fails — read the FIRST error, not the last…`

```bash
# edit exactly two lines in sacct-reporter-1.0/Makefile:
#   CFLAGS  = -O2 -Wall -std=gnu89
#   LDLIBS  = -lz
( cd sacct-reporter-1.0 && make clean > /dev/null && make )
( cd sacct-reporter-1.0 && ./acsacct jobs-small.csv.gz > /tmp/cheat-small.txt 2>/tmp/cheat-err.txt )
head -4 /tmp/cheat-small.txt              # the table top, for your log
shasum -a 256 /tmp/cheat-small.txt        # sandbox: sha256sum
cat /tmp/cheat-err.txt                    # EXP: empty
./climb/check.sh 3
```

**EXP:** stderr **empty**; report checksum
`4342b76b2d292636811712e146e6b66f1bd4d71b705547a02cb701a5ec26bbc1`;
`=== RUNG 3/5 ✓ — the report is byte-exact, and it survives make clean. …`
Anything else means the checksum contract is broken somewhere upstream.

The anachronism, while you're here:

```bash
( cd sacct-reporter-1.0 && ./sacct-reporter report; ./acsacct --help | head -1 )
```

**EXP:** the first command does not exist (shell `No such file…` — sandbox:
record as `T6_ERROR`); `acsacct --help` prints the *descendant's* syntax —
the binary corroborating the README's own lie.

---

## 5. Rung 4 — measure, don't assume

```bash
./climb/check.sh 4                        # negative path: no bench yet
./climb/bench.sh
./climb/check.sh 4
```

**EXP:** gate first says `no bench table yet — run ./climb/bench.sh first`;
then a 4-row table (O0, O2, O3, O2+march=native), one **identical report
sha256 down the whole column** (`5201…1981` — flags moved speed, never
bytes), `BENCH-VERDICT: PASS`, `O0 -> O2 : ~1.7x faster`, and the pointer:
*"O3 and -march=native: read the table yourself. What did the README claim…"*
— locally O3/native will sit on top of O2; that null is L6's honest beat.
**EXP:** second gate prints `=== RUNG 4/5 ✓`.
Tree is left built with the last config — rebuild your way when done.

---

## 6. Rung 5 — the contract, the pristine room, the neighbour

```bash
./climb/check.sh 5                        # negative path first
```

**EXP:** `pins.txt has fewer than four facts…` (the template is blank, count
is 0) — the gate defends the rung, not just the file.

```bash
# heredocs write relative to $SBOX — stay there
cat > climb/pins.txt <<'EOF'
gcc --version from this box, exact string: ______
zlib-devel = the version dnf installed: ______
CFLAGS = -O2 -Wall -std=gnu89 ; LDLIBS = -lz
Kept -O2: -O3/-march measured ~equal, -O0 slower — measured, not believed.
EOF
cat > sacct-reporter-1.0/build.sh <<'EOF'
#!/usr/bin/env bash
# rebuild from pristine: pin the dialect + link line, build, report
set -e
sed 's/^CFLAGS.*/CFLAGS  = -O2 -Wall -std=gnu89/; s/^LDLIBS.*/LDLIBS  = -lz/' Makefile > Makefile.fixed && mv Makefile.fixed Makefile
make
./acsacct jobs-small.csv.gz
EOF
chmod +x sacct-reporter-1.0/build.sh
printf '# BUILD-REPRO\nContract = pins.txt + build.sh. Target: report sha256 4342b76b…26bbc1.\n' > sacct-reporter-1.0/BUILD-REPRO.md
./climb/check.sh 5
```

**EXP:** `=== RUNG 5/5 ✓ — a stranger can climb your ladder…` (the gate just
rebuilt everything in a pristine mktemp room and reproduced the checksum).

```bash
HANDOVER=$(mktemp -d); cp -r sacct-reporter-1.0 "$HANDOVER/t"
( cd "$HANDOVER/t" && make clean > /dev/null && ./build.sh > /dev/null \
  && ./acsacct jobs-small.csv.gz | shasum -a 256 )
```

**EXP:** again `4342b76b…26bbc1` — the neighbour simulation. On the day, this
is literally your neighbour's check.sh 3.

---

## 7. Reset — one command, no exceptions

```bash
./climb/reset-sandbox.sh
ls sacct-reporter-1.0
head -3 climb/climb-log.md climb/pins.txt
./climb/env-check.sh
```

**EXP:** tree gone (`No such file or directory`), log + pins restored blank,
env-check green again. Nothing of the climb survived — that is the point.

---

## 8. Trainer CI — from the project root, not the cheat box

```bash
cd "$SRC" && ./trainer/trap-check.sh
```

**EXP:** sections A–I; **FAIL=0**. TODO=5 locally (the wording slots); every
`ok` line matches a ledger claim: tarball sha, 11 files, no 'trap' wording,
12/12 anchors, RL4 digests, Makefile.good 2-line diff, cascade order, T6
corroboration. Any FAIL = a ledger claim is false — stop and fix.

---

## 9. Capture addendum (venue sandbox only) — the five wordings

After §2–4, fill `trainer/wordings.env` with the **invariant tails** (no /tmp
or path prefixes) from the real lines you captured:

| slot | the line it wants |
|---|---|
| `T1_ERROR` | bash's reply to `./build.sh` |
| `T3_ERROR` | gcc's first line, missing zlib.h |
| `T4_ERROR` | gcc's first line, K&R under default dialect (gcc ≥ 14) |
| `T5_ERROR` | ld's first undefined-reference line |
| `T6_ERROR` | bash's reply to `./sacct-reporter report` |

Rerun `./trainer/trap-check.sh` → `TODO=0`. Wording is now frozen; the
oracle derives from the same file. **Never paste wording from memory — only
from a terminal in the promised environment.**

---

## The system-works checklist (tick all or it didn't happen)

1. env-check green; tampered tarball still FAILs it.
2. Every gate's negative path fired its designed message (1 no-hello, 2
   header/link, 3 first-error, 4 no-bench, 5 pins).
3. Rung 3 + pristine rung 5 + neighbour sim all reproduce `4342b76b…26bbc1`.
4. Bench verdict PASS; one identical sha down the column; O3/native ≈ O2.
5. Reset returns to rung 0; env-check greens with no residue.
6. trap-check: FAIL=0 (TODO=5 local → 0 after capture).
7. Nothing climber-facing named a trap, a file:line, or zlib before rung 2.
