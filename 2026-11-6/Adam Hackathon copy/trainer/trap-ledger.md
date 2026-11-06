# Trap ledger — sacct-reporter-classic

Trainer-facing. The single source of truth: every climber-facing artifact
(rung-card beats, hint cards at depths 1–3, oracle rows, `check.sh`
assertions) derives from these rows. Nothing else in the tutorial names a
trap, a line, or a file.

**Conventions**

1. Line numbers are captured **from tag `classic-1.0.0` only**, recorded as
   `file:line` plus a function/anchor name and a quoted snippet, so minor
   edits never rot the ledger.
2. Error text is **captured empirically in the shipped sandbox** — paste the
   exact first line from real gcc/ld output. Never author compiler messages
   from memory; they vary by version and that is exactly how oracles rot.
3. Sandbox gcc must be **≥ 14**, so K&R-era code *errors* rather than warns —
   otherwise the rung-3 cascade never fires.
4. The code contains no giveaway comments for climbers: anchors are the
   era-styled comments already planted in the files (stable grep keys).

**Legend:** RC rung-card beat · H1/H2/H3 hint depths · OR oracle row ·
CH〈n〉`check.sh` assertion · TC `trap-check.sh` walk. Status: ☐ planned →
☐ fires (captured) → ☐ frozen (climber text final).

**The six lies, canonically:** L1 `./build.sh` (rung 1) · L2 gcc 4.1 demanded
(rung 2) · L3 `sacct-metrics-devel` (rung 2) · L4 "no third-party
dependencies / nothing to pin" (proved at rung 3, revisited at rung 5) ·
L5 `./sacct-reporter report …` (the anachronism, rung 3) · L6 "beyond -O2 is
a waste of time" (rung 4).

---

## T1 — the missing build script (L1) — rung 1 — ☐ planned
- **Anchor:** `README.md` → BUILDING (`./build.sh`); a README lie, no source line.
- **Climber outcome:** `bash: ./build.sh: No such file or directory` *(empirical — confirm exact shell wording)*
- **RC1:** "The README's one command never existed. Fall back to what it never mentioned: the compiler."
- **H1:** "Run exactly what README said. What did the shell say in reply?"
- **H2:** "No build script ships in the tarball — check with `ls`. The README over-promised; compile it yourself."
- **H3:** `gcc hello.c -o hello && ./hello`
- **CH1:** `./hello` prints `sacct-reporter 1.0 (classic edition)` (exact banner).
- **TC:** grep tarball for `build.sh` → absent; build hello; assert banner.

## T2 — the toolchain demand (L2) — rung 2 — ☐ planned
- **Anchor:** `README.md` → REQUIREMENTS (gcc 4.1).
- **Climber outcome:** no error text; a mismatch (README demands 4.1; sandbox has ≥ 14).
- **H1:** "README asks for a compiler. Which compilers does this box actually have?"
- **H2:** "gcc 4.1 is museum stock. The lesson isn't 'find 4.1' — it's *record what you actually use*, because the version becomes a reproducibility fact later."
- **H3:** `module av compiler` (HPC) / `gcc --version` — write pins line 1.
- **OR-2:** `gcc: command not found` → no toolchain loaded → pick an available compiler.
- **CH2a (env-check):** compiler visible in sandbox; pins line 1 non-empty.

## T3 — the package that never existed (L3) — rung 2 — ☐ planned
- **Anchor:** `README.md` → INSTALLING PREREQUISITES (`yum install sacct-metrics-devel`) + INSTALL §1; also `INSTALL`'s "mirror is stale — see your sysadmin" deflection.
- **Predicted first error:** `fatal error: zlib.h: No such file or directory` *(TODO — capture empirically in sandbox, exact gcc wording)*
- **RC2:** "The README named a package no repository has ever shipped. The dependency is real; the package name is fiction. Hunt by header."
- **H1:** "Ignore the yum line for a moment: what file does make say is *missing*?"
- **H2:** "That header needs a dev package. Modern repos renamed everything; ask the manager to name the package by the file."
- **H3:** `dnf provides '*/zlib.h'` → install `zlib-devel` (served from the vendored local cache).
- **OR-3:** the zlib.h line → dev headers absent → `dnf provides`.
- **CH2b:** `make` now stalls on `metrics.c` — *past the header, not yet linked* (cascade note: old-style-function errors appearing next are rung 3's territory; the CH2 banner says "dependency hunt complete" so climbers stop chasing them here).
- **TC:** fresh container; assert report.o compiles after install; assert metrics.o is the first failure.

## T4 — the K&R definitions (the things the README neglected) — rung 3 — ☐ planned
- **Anchor:** `metrics.c` — the era-comment *"leave the function definitions in the old style used before the rewrite"*; grep key: `old style used before`. Line: TODO from tag.
- **Climber outcome:** gcc 14-style `old-style function definition` / declaration errors *(TODO — capture empirically; wording varies by gcc version, this is why the capture pass exists)*.
- **RC3a:** "The code speaks 2009; the compiler's defaults have moved on twice. One flag makes them speak the same dialect."
- **H1:** "Re-read the *first* error — gcc names the function whose definition offends it."
- **H2:** "Those definitions predate C99. The modern default dialect refuses them; ask gcc to speak the code's dialect instead of rewriting the code."
- **H3:** add `-std=gnu89` to `CFLAGS` in the Makefile.
- **OR-4:** old-style-function errors → pre-C99 definitions → `-std=gnu89`.
- **CH3a:** build reaches the link stage.

## T5 — the undefined references, proving lie L4 — rung 3 — ☐ planned
- **Anchor:** `Makefile` → `LDLIBS` line (grep key `LDLIBS`); cross-ref `report.c` era-comment *"double-check the link line picks this up"* (grep key `link line`).
- **Predicted:** `undefined reference to 'inflate'` / `'deflate'` / `'gzopen'` *(TODO — capture empirically; record every undefined symbol seen)*.
- **RC3b:** "Headers fine, objects fine — the *linker* was never told. Lie #4 falls: zlib was third-party all along."
- **H1:** "All objects compiled. What has the build never had to do before now?"
- **H2:** "Compiling ≠ linking. The library is installed; the builder was never introduced to it. The Makefile's LDLIBS is empty — the README's 'no third-party dependencies' is exactly this line."
- **H3:** `LDLIBS += $(pkg-config --libs zlib)` — or plain `-lz` after the objects.
- **OR-5:** `undefined reference to inflate` → missing `-lz` → `pkg-config --libs zlib`.
- **CH3b:** link succeeds; binary exists.

## T6 — the anachronism usage (L5, the descendant leak) — rung 3 — ☐ planned
- **Anchor:** `README.md` → USAGE (`./sacct-reporter report [options]`) + `main.c` `usage()` which prints the same (grep key `usage: sacct-reporter report`). Reality: make target/binary is `acsacct`, which takes the dump file positionally.
- **Climber outcome:** `./sacct-reporter: No such file or directory` *(confirm exact shell wording)*; or help-text confusion.
- **RC3c:** "The usage docs belong to a tool that hasn't been written yet. The binary on disk is who you talk to — ask *it*: `./acsacct` / `--help`-style."
- **H1:** "You have a binary. What did make actually name it? Try running *that*."
- **H2:** "The README's usage syntax doesn't match anything make produced. Trust the artifact over the documentation — always."
- **H3:** `./acsacct jobs-small.csv.gz [--csv out.csv …]` — the truth table ships in the rung card.
- **OR-6:** `No such file` on `./sacct-reporter` → anachronism docs → run the real binary.
- **CH3c:** report on `jobs-small.csv.gz` matches the expected checksum (record it in RL-4 below once data lands).
- **TC:** after full build, assert `./acsacct` runs and checksum matches.

## T7 — "beyond -O2 is pointless" (L6) — rung 4 — ☐ planned
- **Anchor:** `README.md` → NOTES (the tuning grump); `bench.sh` + `jobs-bench.csv.gz` (1M rows, 255 users).
- **Climber outcome:** no error; a wall-clock claim to falsify.
- **RC4:** "The README stakes a claim about *your* workload. Measure first; the claim is data."
- **H1:** "Run `bench.sh` once as-is. What number do you get at -O2?"
- **H2:** "Fill the table — O0, O2, O3, march=native — before answering anything. `make -j$(nproc)` speeds the *build*; flags speed the *program*: keep the two columns apart."
- **H3:** edit CFLAGS through the table; note `-march=native`'s portability card (heterogeneous nodes); ≥ 1.5× against -O0 wins the banner (reference box: 1.7×) — and reports must stay checksum-identical.
- **OR-7:** slow-looking bench → measure before believing; the README's claim is a hypothesis.
- **CH4:** timing table complete + ≥ 1.5× faster than -O0 in the climber's own numbers, O0-vs-O2 report checksums equal (RL4 bench-report digest).

## T8 — the reproducibility hole (L4 revisited) — rung 5 — ☐ planned
- **Anchor:** `README.md` → BUILDING/NOTES ("nothing to pin … same binary, every time"; "pins are a database thing").
- **Climber outcome:** no error; the README's claim is now *their* claim to keep — and it's empty.
- **RC5:** "The README promised determinism and recorded nothing. You'll ship what it couldn't: the contract."
- **H1:** "What did your pins file already collect? (lines 1–4 exist from rungs 2–4.)"
- **H2:** "Pins + flags + data checksums + build order — that's the whole contract. Write `build.sh` so the box does it, not you."
- **H3:** `build.sh` + `pins.txt` + `BUILD-REPRO.md`; hand to a neighbour → fresh sandbox → checksum must match. Pointer card: `Gemfile.lock` is this same contract when nothing compiles.
- **CH5:** neighbour's fresh-sandbox build produces the identical checksum.

---

## Read-lines (not traps — the lines a climber must *read* to pass)

| | Line | Why a climber reads it | Feeds |
|---|---|---|---|
| RL1 | `acsacct.h` header comment — the `JobID\|User\|Partition\|State\|Elapsed\|TotalCPU\|Submit` order | Interpreting the CLI and data | RC3 |
| RL2 | `Makefile` `LDLIBS` knob | Where the link fix lands | H3-T5 |
| RL3 | `metrics_report()` output contract (grep key: `byte-stable on purpose`) | "Same field names… byte for byte" — the checksum clause | RC3 / CH3c |
| RL4 | Dump data checksums (see the RL4 table) | The correctness + rung-5 target | CH3c / CH5 |

**RL4 — filled at data generation (trainer/gen-jobs.py, seed 2009, 6 Nov 2026):**

| | value |
|---|---|
| `jobs-small.csv.gz` | 1,000 rows · 18 users · 4 partitions · sha256 `1021e8f2f1aa5417bf41521cfd7dc4150076c5e999208f9be3cb693859481a53` |
| expected report on `jobs-small` (CH3c target; 74 lines = header + 72 pair rows + TOTAL) | sha256 `4342b76b2d292636811712e146e6b66f1bd4d71b705547a02cb701a5ec26bbc1` |
| `jobs-bench.csv.gz` | 1,000,000 rows · 255 users · 6 partitions · sha256 `cc596a91be2724222e679228f0691891d9f9a493a2c1252d5be986e647615f67` |
| expected bench report | sha256 `5201155481e6e14a1343b23606b9a…` — full: `5201155481e6e14a1343b23606b9ad74fe092953aac21b1de641fdbe2c9f1981`, and **identical at −O0** (verified; that equality is T7's checksum clause) |
| `trainer/dist/sacct-reporter-1.0.tar.gz` (frozen tag, prefix-copied, gz −9n) | sha256 `fe44ffa62fb156760419378fdd3c51d31e7454314e5ce282284bf0d74b66dd6e` — the climber's "found source"; `climb/TARBALL-SHA256.txt` is env-check's integrity target; regenerate with `trainer/make-tarball.sh` only after a ledger-blessed tag change |

Bench shape was scaled by measurement: a 400k/56-user draft gave −O0 0.20 s vs −O2 0.13 s (~1.5×, sub-0.1-s gap — invisible on a workshop box); the shipped shape gives −O0 ≈ 0.92 s vs −O2 ≈ 0.54 s user time (~1.7×, 0.4-s gap) on the reference Mac. Sandbox re-measures at capture day; −O3/−march ≈ −O2 expected (zlib-I/O-bound) — that null is L6's debrief beat, not a failure.

---

## Capture-day protocol (run once per trap, in the shipped sandbox)

1. Fresh container, gcc ≥ 14 confirmed.
2. Climb path order: attempt `./build.sh` (T1) → compile `hello.c` → `make` → paste report.c's first error line into **T3**.
3. Install `zlib-devel` from the vendored cache → `make` → paste metrics.c's errors into **T4** (record all variant wordings seen).
4. `-std=gnu89` added → `make` → paste every undefined-reference line into **T5**.
5. `LDLIBS` fixed → binary → attempt README's usage (paste shell line into **T6**) → correct invocation → note the checksum placeholder.
6. `bench.sh` → note actual O0/O2/O3 speedup into **T7** (reference-box measurement: ~1.7× O0→O2; −O3/−march ≈ −O2 on the zlib-bound bench — record sandbox reality; the beyond-O2 null is L6's debrief beat).
7. Mark rows ☐ fires; freeze climber-facing wording; oracle v1 falls out of this file.

---

## Local dry-verification — 6 Nov 2026 (post-freeze) — mechanics proven; wording NOT authoritative

Scratch checkout: `git archive classic-1.0.0` (tag `09f5fec`) + a symlink farm (`-nostdinc`, SDK headers minus `zlib.h`/`zconf.h`) to simulate "zlib-devel absent". Local box = macOS clang with zlib present, so the sandbox's stage order (header → K&R → link) had to be probed piecewise:

- **T3 order works.** With headers hidden, the build dies at `report.c` before anything else compiles — farm sample: `fatal error: 'zlib.h' file not found` (clang wording; gcc's `fatal error: zlib.h: No such file or directory` is the predicted sandbox line — capture day fills the row).
- **T5 stage works.** Trapped `LDLIBS` → all objects compile (warnings only under clang), link fails on `_gzopen`/`_gzgets`/… (Apple-ld wording; the oracle wants sandbox gcc's `undefined reference to …`). With `-lz` → binary.
- **T4 needs the sandbox.** clang only *warns* (`-Wdeprecated-non-prototype`) under gnu89; under `-std=c23` it *errors* — local class sample at `metrics.c:147`: `unknown type name 'j'` + `expected ';' after top level declarator`. gcc ≥ 14 errors under its default dialect — capture day fills the row; this strengthens the gcc ≥ 14 env requirement (the cascade is gcc-shaped).
- **T6 confirmed.** `./sacct-reporter report` → shell `no such file or directory` class; `./acsacct --help` prints the anachronism usage from the binary itself — the corroboration beat works.
- **Checksum + truth test.** Fixed build's `jobs-small` report = RL4 digest `4342b76b…26bbc1` exactly (stderr empty); `make clean` + rebuild reproduces it.
- **Anchor walk (trap-check seed): all 12 ledger grep keys present in the frozen tag** — metrics.c ×2, report.c, main.c, Makefile, README ×6, acsacct.h.

Sandbox capture day remains the only authoritative wording source; T3/T4/T5 empirical fields stay TODO until then.
