/*
 * hello.c — smoke test for the 2009 tarball
 *
 * Prints the banner. Nothing clever lives here; this file exists so a
 * climber can prove their compiler works before touching the real build.
 */

#include <stdio.h>

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;

    printf("sacct-reporter 1.0 (classic edition)\n");
    printf("SLURM accounting reports, the 2009 way\n");

    return 0;
}
