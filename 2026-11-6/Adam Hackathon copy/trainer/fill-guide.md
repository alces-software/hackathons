# Fill guide — completing the C scaffold (sacct-reporter-classic)

The spec for filling every TODO in the four files so the tarball behaves
exactly as the ledger assumes. Follow it and the trap cascade, the
checksum contract and the era fiction all stay intact.

---

## 0. The cardinal rule: scratch builds only

**The classic dir never gets built "good" in place.** To produce a
reference binary or checksum, copy the tree elsewhere
(`trainer/build-check/` or `/tmp`) and work on the copy. The dir on disk
must stay in its *trapped* state (Makefile with no `-lz`, usage text
anachronistic) right up to the freeze commit — the climber's first
successful `make` happens on *their* machine, on *their* fixed copy. That
is the whole point.

---

## 1. Global contract (every file)

- **Dialect:** C89/gnu89 style throughout — `/* */` comments only, all
  declarations at the top of their block, no `stdbool.h`, no C99 tricks.
  The code must *look* 2009 because it must *act* 2009.
- **Determinism rules (the checksum contract):**
  - No floating point anywhere in output. Hours print with one decimal
    using integer math only:
    `tenths = (seconds + 180) / 360;` then `%5d.%d` of `tenths/10` and
    `tenths%10` (half-up rounding, locale-proof).
  - Sorting is insertion sort over ASCII order (by user name, then
    partition). No qsort, no locale collation.
  - Every report ends in exactly one `\n` after the last row.
  - Never call `setlocale`; integer-only formatting cannot vary.
- **Forbidden (each one pollutes the error surface the oracle promises):**
  - No implicit function declarations (omit no headers).
  - No `strtok` — it merges adjacent delimiters and makes output
    data-dependent. Hand-roll the splitter.
  - No `%f`/`%g` in output, no `getopt` *unless you really want it* —
    hand-rolled arg parsing keeps the usage-echo trap coherent for ~30 lines.
  - Do not "fix" anything the traps depend on: the `usage()` text, the
    empty `LDLIBS`, the `zlib.h` comment.

---

## 2. `report.c` — the dump reader

**`ac_open_dump(path)`** →
`dgz = gzopen(path, "rb"); if (dgz == NULL) return -1;` *(else 0)*.
gzopen/gzgets/gzclose come from `zlib.h` — which is exactly why T3's
missing-header error fires before a single line of logic exists. Leave
the era-comment above the include untouched.

**`ac_parse_line(line, out)`** — the splitter:

- Split on `'|'`, field order per `acsacct.h`:
  `JobID|User|Partition|State|Elapsed|TotalCPU|Submit`.
- Require ≥ 6 fields; strip `\r`/`\n`; ignore the 7th (Submit is stored
  nowhere — parsed and discarded).
- Copy with length truncation (arrays are the struct's sizes, manual
  `'\0'`), `atol` the two numeric fields. Return 1 / -1 bad line.

**`ac_next_row(out)`** → read with `gzgets` into `char buf[AC_LINE]`;
blank lines are skipped (but *count* if you want — no: skip silently);
EOF → 0; else parse.

**Data rule this file depends on:** the dumps have **no header row** —
first line is data. The generator (`trainer/gen-jobs.py`, deterministic —
seed 2009) emits exactly that; if a header ever appears, this file's
parse must fail loudly, not misread it.

---

## 3. `metrics.c` — the aggregator (and T4's home)

**Datastructures** (era-simple, era-small, fixed caps):

```c
#define AC_MAXUSERS 256
#define AC_MAXPARTS 16

static char   u_names[AC_MAXUSERS][32];
static int    u_parts_index[AC_MAXUSERS];          /* partition slot */
static long   p_j[AC_MAXUSERS], p_wall[AC_MAXUSERS],
              p_cpu[AC_MAXUSERS], p_fail[AC_MAXUSERS];
static int    u_n = 0;
static long   t_jobs, t_wall, t_cpu, t_fail;
```

One table row per (user, partition) pair; users are found with a linear
search over `u_n` (overflow → `fprintf(stderr, "too many users in dump\n");`
`exit(1)`).

**`metrics_add`** — semantics fixed exactly:

- `jobs++`, `wall += elapsed`, `cpu += totalcpu` for **every row**;
- `failed++` when `strcmp(state, "COMPLETED") != 0` (so TIMEOUT/CANCELLED/
  FAILED all count; RUNNING would too — the generator never emits it).

**The T4 trap — write the definitions in genuine K&R old style:**

```c
void
metrics_add(j)
     const ac_job_t *j;
{
    ...
}
```

With the prototype in `acsacct.h`, gcc ≥ 14 rejects this ("old-style
parameter declarations in prototyped function definition") — that is the
trap; keep the prototype, keep the definition. The no-parameter functions
(`metrics_reset() { … }`, `metrics_finish()`, `metrics_report()`) also
use empty-paren 2009 definitions — harmless everywhere, authentic
everywhere.

**`metrics_report`** — byte-stable layout:

```c
printf("%-12s %-9s %4s %7s %7s %5s\n",
       "USER", "PARTITION", "JOBS", "WALL-H", "CPU-H", "FAILED");
```

then sorted pair rows (`%-12s %-9s %4d %5d.%d %5d.%d %5d`), skipping
pairs with jobs == 0, then the grand row with `%-12s = "TOTAL"` and the
partition column filled with `"-"`.

---

## 4. `main.c` — the driver

- Hand-rolled scan: every token starting with `-` is a flag; the first
  bare token (and any bare token) is the dump file — require one `.gz`
  else `usage(); return 1;`.
- **Implemented:** `--csv` (write the identical report bytes to the file
  as well; stdout keeps flowing), `--state` (comma list), `--partition`,
  `--start`/`--end`/`--limit-time` accepted-and-ignored with the era
  comment *"wired at 0.9; scanner path pending — RSN"*. Accepted-but-ignored
  is fiction-honest (a 2009 stub), keeps the code inside ~400 lines, and
  never touches determinism.
- Unknown flag → `usage(); return 1;`. Unopenable dump →
  `fprintf(stderr, "acsacct: cannot open %s\n", path); return 1;`.
- Flow: `metrics_reset(); while (ac_next_row(&j) > 0) metrics_add(&j);
  metrics_finish(); metrics_report(); return 0;`
- **Do not touch `usage()`** — its descendant-syntax echo *is* the T6 trap.
  Binary speaks `acsacct`; docs speak `sacct-reporter`.

### `hello.c` — already done. Nothing to fill.
### `Makefile` — leave exactly as scaffolded. The empty `LDLIBS` is the link trap.

---

## 5. Data rules the C assumes (feed the generator with these)

- No header line; exactly the 7 columns in `acsacct.h` order.
- `Elapsed`/`TotalCPU` = plain seconds, non-negative.
- `State` ⊂ {`COMPLETED`, `FAILED`, `TIMEOUT`, `CANCELLED`} — the report's
  failed-count logic reads exactly this set.
- Users ≤ 255 (the implemented cap is `AC_MAXUSERS = 256`; the bench
  deliberately runs at 255 — full but not overflowing), partitions ≤ 16
  (`j.bridges`/`m.okafor`-style names fit the `[32]`/`[16]` arrays comfortably).
- `jobs-small.csv.gz` 1k rows (correctness) · `jobs-bench.csv.gz` 1M rows,
  255 users × 6 partitions (bench). Measured note: a 400k draft gave only
  1.5× for −O0→−O2 with a sub-0.1-s gap — below visibility on a workshop
  box — so the shipped shape is 1M × 255 (~1.7×, ~0.4-s gap). Checksums in
  ledger RL4.

---

## 6. Pre-freeze checklist (author-side, in order)

1. **Scratch good build** (`trainer/build-check/`):
   `gcc -std=gnu89 -O2 -Wall main.c report.c metrics.c -o acsacct $(pkg-config --libs zlib)`
   *(macOS: same, with brew's zlib include path; final truth is always the
   sandbox build.)*
2. Run on `jobs-small` → eyeball the table → paste its checksum into
   ledger **RL4**.
3. Verify the cascade in scratch **with the trapped Makefile** (this is the
   only place the cascade may be reproduced):
   plain `make` → zlib.h error (T3) → after zlib-devel, old-style errors
   (T4) → after gnu89, undefined references (T5) → after -lz, binary (T6).
   Every message seen goes into the ledger's empirical fields.
4. **Refresh the README's EXAMPLE OUTPUT block** from the real report
   (10-minute fix; keeps "byte-stable" honest and stops climbers diffing
   against drift).
5. `trainer/reference/Makefile.good` = the fixed Makefile (CFLAGS adds
   `-std=gnu89`, LDLIBS adds zlib). It is what rung 5's neighbour build
   reproduces from.
6. Restore the trapped dir (git status: only the intended tree), single
   commit dated 2009, tag `classic-1.0.0`.
7. Sandbox capture pass → ledger rows to ☐ fires → oracle v1.
