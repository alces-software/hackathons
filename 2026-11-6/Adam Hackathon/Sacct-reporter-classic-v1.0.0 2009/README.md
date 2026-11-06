sacct-reporter — 1.0 (classic edition)
======================================

Turns the batch system's gzipped accounting dumps into the numbers
everyone on the floor keeps asking for. Written and tested on the
cluster frontend in August 2009 — and it has needed no touching since.
(c) 2009 A. Jacobs. No warranty; the code is short, come and read it.

WHAT IT DOES
------------
Reads a sacct accounting dump — one line per job, pipe-separated,
gzipped — and prints a metrics report: wall-clock and CPU time per
user and per partition, failure counts, and grand totals. `--csv`
writes the same numbers to a file for the spreadsheet-dependent.

A dump arrives from the batch system as jobs-YYYY-MM.csv.gz. Columns
run in the order the reader cares about (the definitive list lives in
acsacct.h — trust that over anything written here).

REQUIREMENTS
------------
 * gcc 4.1. Yes: 4.1. Newer compilers are fine on paper; in practice
   they emit spurious complaints about perfectly reasonable code. The
   frontend has what you need; use it.
 * make
 * your batch system's dumps (jobs-*.csv.gz)

INSTALLING PREREQUISITES
------------------------
Everything is already on the frontend except one package, and the
usual command sorts it out:

    yum install sacct-metrics-devel

sacct-reporter has no third-party dependencies — nothing to track
down, nothing to pin down, nothing special at all. The build is
self-contained: same box, same tools, same binary, every time.

BUILDING
--------
One command, top to bottom:

    ./build.sh

That is the entire build. Nothing to configure, nothing to edit, and
it comes out the same first time and every time. If it fails, you are
almost certainly not on the frontend.

USAGE
-----

Run it exactly like this:

    ./sacct-reporter report [options]

    --csv=VALUE, -c VALUE             Output CSV filename
    --end=VALUE, -E VALUE             Endtime in ISO format
    --limit-time=VALUE, -L VALUE      Limit time of search in days, default: 90
    --[no-]overall, -o                Show overall
    --partition=VALUE, -p VALUE       Filter by partition
    --start=VALUE, -S VALUE           Starttime in ISO format
    --state=VALUE, -s VALUE           States as comma separated list
    --[no-]user, -u                   Filter by user (defaults to current user)
    --[no-]unknown-user, -U           Filter strictly for jobs with no user ID
    --help, -h                        Print this help

EXAMPLE OUTPUT
--------------

    USER         PARTITION JOBS  WALL-H   CPU-H FAILED
    a.bridges    compute     15    72.5   151.5     0
    a.bridges    debug       14   152.6  1703.7     2
    ...
    r.quinn      gpu         15    25.6    46.8     0
    TOTAL        -         1000  7460.1 35242.1    75

The report layout is byte-stable: same dump, same report, always. If
the report and a dump ever disagree with each other, the dump is right.

NOTES
-----
 Q: Does it need tuning?
 A: No. -O2 is already in the Makefile, and any optimisation beyond
    -O2 is a waste of time on this code — reading a dump is not a
    benchmark.

 Q: gcc 4.2 and newer?
 A: See REQUIREMENTS.

 Q: Is the build portable?
 A: It builds wherever the packages above exist. Pins are a database
    thing; this is a calculator.

CHANGES
-------
 1.0   2009-08   first public release: dump reader, metrics report, --csv
 0.9   internal  lost to the tape drive

BUGS
----
None known. This build has run on exactly one machine: the frontend,
with gcc 4.1, in August 2009. Other compilers exist. I can't speak
for them, and I didn't.
