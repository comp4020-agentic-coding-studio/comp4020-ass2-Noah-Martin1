---
title: "Lab 5 — One Line or Six"
description:
  Run the bank experiment with real humans, and find out why the fairer system
  is the one people complain about on sight.
week: 5
date: 2027-03-22
teachers:
  - tomas-rehak
spec:
  - you have run both configurations with the same arrival script
  - you have recorded individual waits, not just the average
  - you can state which configuration your own body preferred, and why that differed from the data
related:
  - lectures/week-05
---

## Before the lab

Read the week 5 notes. Wear something you can stand up in for an hour, because
you are the customers.

## In the lab

We run the 1970 bank experiment on ourselves. Twenty-four students, six
"tellers", one arrival script read off a stopwatch so both runs see identical
arrivals.

**Run one: six lines.** Pick a teller when you arrive. You may not switch — no
jockeying, which makes this the generous version of parallel queues, not the
realistic one. Each customer records their own wait.

**Run two: one line.** Same arrivals, same service times, single queue feeding
all six.

**Then the numbers.** Put every individual wait on the board as a dot plot, both
runs side by side. Two things fall out, reliably, every year:

The means are close. Often within a few seconds. Students who expected the
single line to be dramatically faster are surprised, and this is worth sitting
with, because it is the result most likely to be misremembered afterwards.

The spreads are not close at all. Run one has someone who waited four times the
median. Run two does not have that person. What the single line sold was not
speed; it was the elimination of the bad draw.

**The subjective round.** Finally, before you see the data, everyone writes down
which run *felt* worse. A reliable minority say the single line, because thirty
people look like a longer wait than five do, and because in six lines you get
the pleasure of believing you chose well. The gap between the felt ranking and
the measured one is the practical problem with deploying good queue design, and
it is not solved by being right.

## Afterwards

Your ordering-rule assignment is due at the end of next week. If you are stuck
for a system, the dot plots on that board are twenty-four separate arguments for
looking harder at somewhere you already go.
