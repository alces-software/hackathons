#!/usr/bin/env python3
"""
gen-jobs.py — synthetic sacct dump generator (classic edition).

Deterministic by construction:
  * xorshift32 (Marsaglia 13,17,5), full period 2^32-1; stdlib `random`
    is not used, and draws never touch a power-of-two modulus directly
    (the >>1 keeps low-bit correlations out of the small moduli),
  * fixed roster and fixed distributions,
  * gzip written with mtime=0 -> byte-identical .gz for the same script
    and the same arguments (same Python/zlib minor versions).

The dumps are committed to the classic tree; the rung-3 checksum and
rung-5's neighbour rebuild are contracts against these exact bytes.
Regenerate only to produce identical *content*; the committed files are
the contract. No header line — the first line is data (the reader in
report.c assumes it).

Usage (the two shipped shapes):
    python3 gen-jobs.py --out PATH --rows 1000    --users 18  --parts 4   # jobs-small
    python3 gen-jobs.py --out PATH --rows 1000000 --users 255 --parts 6   # jobs-bench
"""

import argparse
import gzip
import hashlib

ROSTER = (
    'bridges', 'okafor', 'whitmore', 'singh', 'delgado', 'kowalski',
    'tanaka', 'berger', 'ashraf', 'lindqvist', 'moreau', 'castillo',
    'petrov', 'hayden', 'ngata', 'ferrari', 'duval', 'osei', 'kruger',
    'halvorsen', 'marchetti', 'novak', 'ellery', 'quinn', 'bramley',
    'coates', 'dunne', 'eastwood', 'fischer', 'gallo', 'hartley',
    'ibarra',
)

INITIALS = 'abcdefghijklmnopqrstuvwxyz'

PART_NAMES = ('compute', 'fat', 'gpu', 'debug', 'bigmem', 'vis')

STATES = frozenset(('COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED'))


class Rng(object):
    """xorshift32 — full period (2^32-1), no degenerate low bits.

    (An ANSI-C LCG was the first draft: its low 2 bits advance +1 per
    take, and with 8 takes per row the partition draw aliased to a
    single value. xorshift32 kills that class of bug.)
    """

    def __init__(self, seed):
        self.state = (seed | 1) & 0xFFFFFFFF   # xorshift32 must not be 0

    def take(self):
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x
        return x

    def lo_hi(self, lo, hi):
        """uniform-ish draw in [lo, hi)"""
        return lo + ((self.take() >> 1) % (hi - lo))


def make_users(count, rng):
    used = set()
    users = []
    for idx in range(count):
        initial = INITIALS[idx % len(INITIALS)]
        surname = ROSTER[(idx * 7 + idx // 26) % len(ROSTER)]
        name = initial + '.' + surname
        bump = 0
        while name in used:
            bump += 1
            nxt = (ROSTER.index(surname) + bump) % len(ROSTER)
            surname = ROSTER[nxt]
            name = initial + '.' + surname
        used.add(name)
        users.append(name)
    return users


def gen_rows(rows, users, parts, rng):
    buf = []
    for i in range(rows):
        jid = 412730 + i

        user = users[rng.lo_hi(0, len(users))]
        part = parts[rng.lo_hi(0, len(parts))]

        s = rng.lo_hi(0, 100)
        if s < 92:
            state = 'COMPLETED'
        elif s < 95:
            state = 'FAILED'
        elif s < 98:
            state = 'TIMEOUT'
        else:
            state = 'CANCELLED'

        e = rng.lo_hi(0, 100)
        if e < 55:
            elapsed = rng.lo_hi(90, 3601)
        elif e < 85:
            elapsed = rng.lo_hi(3601, 43201)
        else:
            elapsed = rng.lo_hi(43201, 259201)

        c = rng.lo_hi(0, 100)
        if c < 40:
            cores = 1
        elif c < 65:
            cores = 2
        elif c < 85:
            cores = 4
        elif c < 93:
            cores = 8
        elif c < 97:
            cores = 16
        elif c < 99:
            cores = 32
        else:
            cores = 64

        day = i % 45                      # 2009-07-01 .. 2009-08-14
        mon = '07' if day < 31 else '08'
        dd = day + 1 if day < 31 else day - 30
        hh = rng.lo_hi(0, 24)
        mm = rng.lo_hi(0, 60)
        submit = '2009-%s-%02dT%02d:%02d:00' % (mon, dd, hh, mm)

        totalcpu = elapsed * cores
        buf.append('%d|%s|%s|%s|%d|%d|%s\n' %
                   (jid, user, part, state, elapsed, totalcpu, submit))
    return buf


def write_dump(path, lines):
    # filename='' + fileobj: the gzip header must carry NO embedded
    # filename (FNAME flag) — two runs at two paths must give the same
    # bytes. mtime=0 for the same reason.
    with open(path, 'wb') as raw:
        gz = gzip.GzipFile(filename='', mode='wb', compresslevel=9,
                           fileobj=raw, mtime=0)
        chunk = 2000
        for start in range(0, len(lines), chunk):
            gz.write(''.join(lines[start:start + chunk]).encode('ascii'))
        gz.close()


def validate(path, expect_rows):
    """Re-read the dump and assert everything the C reader assumes."""
    users_seen = set()
    parts_seen = set()
    states_seen = {}
    rows = 0

    with gzip.open(path, mode='rt', encoding='ascii', newline='') as fh:
        for lineno, raw in enumerate(fh, 1):
            fields = raw.rstrip('\r\n').split('|')   # no strip() of spaces

            assert len(fields) == 7, \
                'line %d: %d fields (want 7)' % (lineno, len(fields))
            assert len(fields[1]) <= 31, 'line %d: user too long' % lineno
            assert len(fields[2]) <= 15, 'line %d: partition too long' % lineno
            assert fields[3] in STATES, 'line %d: state %r' % (lineno,
                                                               fields[3])
            assert 0 <= int(fields[4]) <= 259200, \
                'line %d: elapsed' % lineno
            assert 0 <= int(fields[5]) <= 259200 * 64, \
                'line %d: totalcpu' % lineno
            assert len(raw) <= 510, 'line %d: longer than AC_LINE' % lineno

            users_seen.add(fields[1])
            parts_seen.add(fields[2])
            states_seen[fields[3]] = states_seen.get(fields[3], 0) + 1
            rows += 1

    assert users_seen | parts_seen, 'empty dump'
    assert len(users_seen) <= 256, 'over AC_MAXUSERS'
    assert len(parts_seen) <= 16, 'over AC_MAXPARTS'
    assert rows == expect_rows, \
        'rows %d != expected %d' % (rows, expect_rows)

    digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()

    print('[ok] %s' % path)
    print('     rows: %d  users: %d  partitions: %d  sha256: %s'
          % (rows, len(users_seen), len(parts_seen), digest))
    tally = ', '.join('%s %d' % (st, states_seen.get(st, 0))
                      for st in sorted(STATES))
    print('     states: %s' % tally)
    return digest


def main():
    ap = argparse.ArgumentParser(
        description='synthetic sacct dump generator (classic edition)')
    ap.add_argument('--out', required=True, help='output path (.csv.gz)')
    ap.add_argument('--rows', required=True, type=int)
    ap.add_argument('--users', type=int, default=24)
    ap.add_argument('--parts', type=int, default=4)
    ap.add_argument('--seed', type=int, default=2009)
    args = ap.parse_args()

    assert 1 <= args.users <= 256 and 1 <= args.parts <= 16, 'caps'
    assert args.parts <= len(PART_NAMES), 'partition roster'

    rng = Rng(args.seed)
    users = make_users(args.users, rng)
    parts = list(PART_NAMES[:args.parts])
    lines = gen_rows(args.rows, users, parts, rng)

    write_dump(args.out, lines)
    validate(args.out, args.rows)


if __name__ == '__main__':
    main()
