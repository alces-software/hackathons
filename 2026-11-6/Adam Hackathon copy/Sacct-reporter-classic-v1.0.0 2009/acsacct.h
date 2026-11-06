/*
 * sacct-reporter 1.0 (classic edition)
 * acsacct.h — shared definitions
 *
 * One row of a sacct dump, pipe-separated:
 *   JobID|User|Partition|State|Elapsed|TotalCPU|Submit
 *
 * Elapsed and TotalCPU are recorded in plain seconds everywhere;
 * the pretty hh:mm:ss formatting happens only in the report pass.
 */

#ifndef AC_SACCT_H
#define AC_SACCT_H

#define AC_FIELDS 7   /* number of columns we care about in a dump row */

typedef struct {
    char jobid[32];
    char user[32];
    char part[16];
    char state[16];
    long elapsed;     /* seconds */
    long totalcpu;    /* seconds */
} ac_job_t;

/* report.c — the dump reader */
int ac_open_dump(const char *path);        /* 0 ok, -1 fail */
int ac_next_row(ac_job_t *out);            /* 1 row read, 0 eof, -1 bad line */

/* metrics.c — the aggregator (2009-era definitions in here; the header knows the shape) */
void metrics_reset(void);
void metrics_add(const ac_job_t *j);
void metrics_finish(void);                 /* flush/finalise the aggregates */
void metrics_report(void);                 /* print the summary report to stdout */
void metrics_wire_csv(const char *path);   /* --csv: write the report again, same bytes */
void metrics_close_csv(void);              /* finish with the second copy */

#endif /* AC_SACCT_H */
