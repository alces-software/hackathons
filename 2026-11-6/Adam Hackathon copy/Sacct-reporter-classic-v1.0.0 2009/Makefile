# sacct-reporter 1.0 (classic edition)
# hand-made Makefile — no autoconf nonsense like those fancy 2010 kids have

CC      = gcc
CFLAGS  = -O2 -Wall
LDLIBS  =   # (leave empty — everything is a system library, see README)
OBJS    = main.o report.o metrics.o

all: acsacct

acsacct: $(OBJS)
	$(CC) -o $@ $(OBJS) $(LDLIBS)

main.o: main.c acsacct.h
	$(CC) $(CFLAGS) -c main.c

report.o: report.c acsacct.h
	$(CC) $(CFLAGS) -c report.c

metrics.o: metrics.c acsacct.h
	$(CC) $(CFLAGS) -c metrics.c

clean:
	rm -f acsacct hello *.o

.PHONY: all clean
