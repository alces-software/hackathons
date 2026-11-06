/*
 * sacct-reporter 1.0 (classic edition)
 * main.c — the driver: args, loop, print
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "acsacct.h"

/* usage text kept identical to the README examples — don't reword one and not the other */
static void usage(void)
{
    printf("usage: sacct-reporter report [--csv OUT] [--start YYYY-MM-DD] [--end YYYY-MM-DD]\n");
    printf("                            [--state S] [--partition P]\n");
    printf("\n");
    printf("Reads a sacct accounting dump and prints per-user/per-partition metrics.\n");
}

static const char *s_filter = NULL;   /* --state   comma list */
static const char *p_filter = NULL;   /* --partition */

/* token membership in a comma list — no strtok, it merges empty fields */
static int ac_in_list(const char *list, const char *item)
{
    size_t n;
    const char *hit;

    n = strlen(item);

    while (*list != '\0') {
        hit = strstr(list, item);

        if (hit == NULL)
            return 0;

        if ((hit == list || hit[-1] == ',') &&
            (hit[n] == ',' || hit[n] == '\0'))
            return 1;

        list = hit + 1;
    }

    return 0;
}

/* fetch a flag's value: from "--flag=val" (eq) or the following token */
static const char *ac_optvalue(int argc, char **argv, int *i, const char *eq)
{
    if (eq != NULL)
        return eq;

    if (*i + 1 >= argc)
        return NULL;

    (*i)++;
    return argv[*i];
}

int main(int argc, char **argv)
{
    const char *arg;
    const char *dump = NULL;
    const char *csv  = NULL;
    const char *val;
    const char *eq;
    ac_job_t    job;
    long        bad;
    int         i;
    int         rc;
    int         pass;
    size_t      dlen;

    /* NOTE(2009): the 90-day default time limit from the README applies
     * when --start/--end are absent. */

    for (i = 1; i < argc; i++) {
        arg = argv[i];

        if (arg[0] != '-') {
            if (dump != NULL) {
                fprintf(stderr, "acsacct: one dump at a time (%s given)\n", arg);
                usage();
                return 1;
            }
            dump = arg;
            continue;
        }

        if (strcmp(arg, "--help") == 0 || strcmp(arg, "-h") == 0) {
            usage();
            return 0;
        }

        eq = strchr(arg, '=');

        if (strncmp(arg, "--csv", 5) == 0 || strcmp(arg, "-c") == 0) {
            val = ac_optvalue(argc, argv, &i, (eq != NULL) ? eq + 1 : NULL);
            if (val == NULL) {
                fprintf(stderr, "acsacct: missing value for %s\n", arg);
                usage();
                return 1;
            }
            csv = val;
        }
        else if (strncmp(arg, "--state", 7) == 0 || strcmp(arg, "-s") == 0) {
            val = ac_optvalue(argc, argv, &i, (eq != NULL) ? eq + 1 : NULL);
            if (val == NULL) {
                fprintf(stderr, "acsacct: missing value for %s\n", arg);
                usage();
                return 1;
            }
            s_filter = val;
        }
        else if (strncmp(arg, "--partition", 11) == 0 || strcmp(arg, "-p") == 0) {
            val = ac_optvalue(argc, argv, &i, (eq != NULL) ? eq + 1 : NULL);
            if (val == NULL) {
                fprintf(stderr, "acsacct: missing value for %s\n", arg);
                usage();
                return 1;
            }
            p_filter = val;
        }
        else if (strncmp(arg, "--start", 7) == 0 || strcmp(arg, "-S") == 0 ||
                 strncmp(arg, "--end", 5) == 0 || strcmp(arg, "-E") == 0 ||
                 strncmp(arg, "--limit-time", 12) == 0 ||
                 strcmp(arg, "-L") == 0) {
            /* accepted, ignored — wired at 0.9; scanner path pending, RSN */
            (void)ac_optvalue(argc, argv, &i, (eq != NULL) ? eq + 1 : NULL);
        }
        else if (strcmp(arg, "--overall") == 0 || strcmp(arg, "-o") == 0 ||
                 strcmp(arg, "--user") == 0 || strcmp(arg, "-u") == 0 ||
                 strcmp(arg, "--unknown-user") == 0 || strcmp(arg, "-U") == 0) {
            /* accepted, ignored — wired at 0.9; scanner path pending, RSN */
        }
        else {
            fprintf(stderr, "acsacct: unknown flag: %s\n", arg);
            usage();
            return 1;
        }
    }

    if (dump == NULL) {
        usage();
        return 1;
    }

    dlen = strlen(dump);
    if (dlen < 4 || strcmp(dump + dlen - 3, ".gz") != 0) {
        fprintf(stderr, "acsacct: %s: not an accounting dump (*.csv.gz)\n", dump);
        usage();
        return 1;
    }

    if (ac_open_dump(dump) != 0) {
        fprintf(stderr, "acsacct: cannot open %s\n", dump);
        return 1;
    }

    metrics_reset();

    bad = 0;
    while ((rc = ac_next_row(&job)) != 0) {
        if (rc < 0) {
            bad++;
            continue;   /* malformed rows: skipped. Trust the dumps. */
        }
        pass = 1;
        if (s_filter != NULL && !ac_in_list(s_filter, job.state))
            pass = 0;
        if (pass && p_filter != NULL && strcmp(p_filter, job.part) != 0)
            pass = 0;
        if (pass)
            metrics_add(&job);
    }

    metrics_finish();

    if (csv != NULL)
        metrics_wire_csv(csv);

    metrics_report();
    metrics_close_csv();

    if (bad > 0)
        fprintf(stderr, "acsacct: %ld malformed rows skipped\n", bad);

    return 0;
}
