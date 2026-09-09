---
title: "Lab 9 — Where Did the Wait Go?"
description:
  Audit a real appointment system's published waiting time and find the boundary
  it drew to get that number.
week: 9
date: 2027-05-03
teachers:
  - priya-raghunathan
spec:
  - you have found a published waiting-time statistic from a real organisation
  - you can state the exact boundary its clock starts and stops at
  - you have estimated the wait a user experiences under a boundary you chose instead
related:
  - lectures/week-09
  - assessments/03-simulation-report
---

## Before the lab

Find one published waiting-time figure from a real organisation — a health
service, a licensing authority, a utility, a university. It must be a number they
publish about themselves. Bring the source.

## In the lab

**Find the boundary.** In groups, take each statistic apart. Where does the clock
start? Referral, or first contact, or arrival at the building, or being called
from the waiting room? Where does it stop? Being seen, being treated, being
discharged, the case being closed?

Almost every published figure starts its clock later than a user would, and the
gap is usually where the actual waiting lives. This is not generally fraud. It is
the accumulation of small, individually defensible definitional choices, each of
which happened to shorten the number.

**Redraw it.** Choose the boundary a user would recognise — the moment they first
tried to get the thing — and estimate the wait under that definition. Use
Little's Law where you can get a throughput; use published volumes where you
cannot; state your uncertainty either way. You will often be off by a factor of
several from the official figure, and being able to say *why*, mechanically, is
the deliverable.

**The honest column.** Then the harder half, and Priya will push on this: for
each system, was moving the wait actually bad for the user? An hour at home
genuinely beats an hour in a corridor. Separate the two complaints — "you moved
my wait" and "you moved my wait and then reported it as though it had
vanished" — because only the second is clearly a failure, and conflating them
makes the criticism easy to dismiss.

## Afterwards

Simulation report due Friday 17:00.

Act II closes here. You have five ordering rules and a habit of asking where the
clock starts. Act III puts them into systems that are connected to other systems
and full of people who have worked out what you are doing.
