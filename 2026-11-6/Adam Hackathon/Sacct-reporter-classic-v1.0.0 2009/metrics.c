/*
 * metrics.c — aggregate the interesting numbers (classic edition)
 *
 * Keeps per-user/per-partition pair totals plus the grand total. Nothing
 * clever — 2009 code, small arrays, fixed limits. The pair tables and the
 * old definition style are both kept as written before the 0.9 tidy-up:
 * leave the function definitions in the old style used before the
 * rewrite — gcc accepts it fine on the batch frontend (verify on the
 * newer compilers if ever needed).
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "acsacct.h"

#define AC_MAXUSERS 256
#define AC_MAXPARTS 16

struct ac_pair {
    long jobs;
    long wall;
    long cpu;
    long fail;
};

struct ac_row {
    const char *user;
    const char *part;
    long jobs;
    long wall;
    long cpu;
    long fail;
};

static char           u_names[AC_MAXUSERS][32];
static int            u_n;
static char           p_names[AC_MAXPARTS][16];
static int            p_n;
static struct ac_pair p_slots[AC_MAXUSERS * AC_MAXPARTS];
static long           t_jobs, t_wall, t_cpu, t_fail;

static struct ac_row ac_rows[AC_MAXUSERS * AC_MAXPARTS];

static FILE *ac_csv;   /* --csv: the report again, same bytes */
static char  ac_line[256];

static int ac_user_slot(const char *name)
{
    int i;

    for (i = 0; i < u_n; i++)
        if (strcmp(u_names[i], name) == 0)
            return i;

    if (u_n == AC_MAXUSERS) {
        fprintf(stderr, "acsacct: too many users in dump\n");
        exit(1);
    }

    strncpy(u_names[u_n], name, sizeof u_names[u_n] - 1);
    u_names[u_n][sizeof u_names[u_n] - 1] = '\0';

    return u_n++;
}

static int ac_part_slot(const char *name)
{
    int i;

    for (i = 0; i < p_n; i++)
        if (strcmp(p_names[i], name) == 0)
            return i;

    if (p_n == AC_MAXPARTS) {
        fprintf(stderr, "acsacct: too many partitions in dump\n");
        exit(1);
    }

    strncpy(p_names[p_n], name, sizeof p_names[p_n] - 1);
    p_names[p_n][sizeof p_names[p_n] - 1] = '\0';

    return p_n++;
}

static void ac_emit(const char *s)
{
    fputs(s, stdout);

    if (ac_csv != NULL)
        fputs(s, ac_csv);
}

static int ac_row_less(const struct ac_row *a, const struct ac_row *b)
{
    int c;

    c = strcmp(a->user, b->user);
    if (c != 0)
        return c < 0;

    c = strcmp(a->part, b->part);
    return c < 0;
}

static void ac_sort(struct ac_row *rows, int n)
{
    int           i, j;
    struct ac_row key;

    for (i = 1; i < n; i++) {
        key = rows[i];

        for (j = i - 1; j >= 0 && ac_row_less(&key, &rows[j]); j--)
            rows[j + 1] = rows[j];

        rows[j + 1] = key;
    }
}

void metrics_wire_csv(const char *path)
{
    ac_csv = fopen(path, "w");

    if (ac_csv == NULL)
        fprintf(stderr, "acsacct: cannot write %s\n", path);
}

void metrics_close_csv(void)
{
    if (ac_csv != NULL) {
        fclose(ac_csv);
        ac_csv = NULL;
    }
}

void
metrics_reset()
{
    u_n = 0;
    p_n = 0;
    t_jobs = t_wall = t_cpu = t_fail = 0;
    memset(p_slots, 0, sizeof p_slots);
}

void
metrics_add(j)
     const ac_job_t *j;
{
    int uid;
    int pid;
    int at;

    uid = ac_user_slot(j->user);
    pid = ac_part_slot(j->part);
    at  = uid * AC_MAXPARTS + pid;

    p_slots[at].jobs++;
    p_slots[at].wall += j->elapsed;
    p_slots[at].cpu  += j->totalcpu;
    if (strcmp(j->state, "COMPLETED") != 0)
        p_slots[at].fail++;

    t_jobs++;
    t_wall += j->elapsed;
    t_cpu  += j->totalcpu;
    if (strcmp(j->state, "COMPLETED") != 0)
        t_fail++;
}

void
metrics_finish()
{
    /* kept so the 0.9 report ordering stays: the 1.0 scanner needs
       nothing here yet */
}

void
metrics_report()
{
    int             uid;
    int             pid;
    int             i;
    int             n;
    struct ac_pair *pr;
    long            hour;
    long            tenth;

    n = 0;
    for (uid = 0; uid < u_n; uid++) {
        for (pid = 0; pid < p_n; pid++) {
            pr = &p_slots[uid * AC_MAXPARTS + pid];

            if (pr->jobs > 0) {
                ac_rows[n].user = u_names[uid];
                ac_rows[n].part = p_names[pid];
                ac_rows[n].jobs = pr->jobs;
                ac_rows[n].wall = pr->wall;
                ac_rows[n].cpu  = pr->cpu;
                ac_rows[n].fail = pr->fail;
                n++;
            }
        }
    }

    ac_sort(ac_rows, n);

    /* the report layout is byte-stable on purpose: same dump, same report,
       always. widths here are the contract — do not reformat */
    sprintf(ac_line, "%-12s %-9s %4s %7s %7s %5s\n",
            "USER", "PARTITION", "JOBS", "WALL-H", "CPU-H", "FAILED");
    ac_emit(ac_line);

    for (i = 0; i < n; i++) {
        hour  = (ac_rows[i].wall + 180) / 360;
        tenth = (ac_rows[i].cpu  + 180) / 360;

        sprintf(ac_line, "%-12s %-9s %4ld %5ld.%ld %5ld.%ld %5ld\n",
                ac_rows[i].user, ac_rows[i].part, ac_rows[i].jobs,
                hour / 10, hour % 10, tenth / 10, tenth % 10,
                ac_rows[i].fail);
        ac_emit(ac_line);
    }

    hour  = (t_wall + 180) / 360;
    tenth = (t_cpu  + 180) / 360;

    sprintf(ac_line, "%-12s %-9s %4ld %5ld.%ld %5ld.%ld %5ld\n",
            "TOTAL", "-", t_jobs, hour / 10, hour % 10,
            tenth / 10, tenth % 10, t_fail);
    ac_emit(ac_line);
}
