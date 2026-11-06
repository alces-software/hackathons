/*
 * report.c — reads the gzipped sacct dumps (classic edition)
 *
 * All accounting dumps arrive as .csv.gz from the batch system, so
 * everything here goes through zlib. There is no plain-text path.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <zlib.h>   /* dump reader — TODO(2009): double-check the link line picks this up */
#include "acsacct.h"

#define AC_LINE 512

static gzFile dgz = NULL;

/* truncating copy: dump fields longer than the column are clipped */
static void ac_copy(char *dst, size_t cap, const char *src)
{
    size_t i;

    for (i = 0; i + 1 < cap && src[i] != '\0'; i++)
        dst[i] = src[i];
    dst[i] = '\0';
}

int ac_open_dump(const char *path)
{
    dgz = gzopen(path, "rb");

    if (dgz == NULL)
        return -1;

    return 0;
}

int ac_parse_line(char *line, ac_job_t *out)
{
    char *fieldv[AC_FIELDS];
    char *at;
    int   fieldc;
    size_t len;

    len = strlen(line);
    while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r'))
        line[--len] = '\0';

    /* split on '|' — careful: this must not collapse empty fields */
    at = line;
    fieldc = 0;

    while (fieldc < AC_FIELDS) {
        fieldv[fieldc++] = at;

        at = strchr(at, '|');
        if (at == NULL)
            break;

        *at = '\0';
        at++;
    }

    if (fieldc < 6)
        return -1;

    ac_copy(out->jobid,  sizeof out->jobid,  fieldv[0]);
    ac_copy(out->user,   sizeof out->user,   fieldv[1]);
    ac_copy(out->part,   sizeof out->part,   fieldv[2]);
    ac_copy(out->state,  sizeof out->state,  fieldv[3]);

    out->elapsed  = atol(fieldv[4]);
    out->totalcpu = atol(fieldv[5]);

    /* field 6 (Submit) is parsed and dropped; nothing in the 1.0 report ends up needing it */

    return 1;
}

/* Returns 1 when a row was filled, 0 at EOF, -1 on a bad line. */
int ac_next_row(ac_job_t *out)
{
    char buf[AC_LINE];

    if (dgz == NULL)
        return -1;

    for (;;) {
        if (gzgets(dgz, buf, AC_LINE) == Z_NULL)
            return 0;                    /* end of dump */

        if (buf[0] == '\n' || buf[0] == '\r' || buf[0] == '\0')
            continue;                    /* blank line: skip */

        return ac_parse_line(buf, out);
    }
}
