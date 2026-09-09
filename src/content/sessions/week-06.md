---
title: "Lab 6 — Starving the Long Job"
description:
  Build a scheduler that starves someone, watch it happen, then fix it and
  measure exactly what the fix cost you.
week: 6
date: 2027-03-29
teachers:
  - priya-raghunathan
spec:
  - you have produced a run in which a long job is starved for the full window
  - you have implemented one ageing rule and measured its effect on both mean and tail
  - you can state the exchange rate between mean wait and worst-case wait for your system
related:
  - lectures/week-06
  - assessments/02-ordering-rule
---

## Before the lab

Bring a laptop. Any language. If you would rather do it on paper with cards, that
works and several people prefer it.

## In the lab

**Part one: make it fail.** Implement strict shortest-job-first on a stream where
short jobs keep arriving and one long job is waiting. Run it long enough that the
long job's wait becomes indefensible. Screenshot it. This is the failure mode the
lecture asserted and it is much more vivid when it is your own scheduler doing
it.

**Part two: fix it.** Add ageing — a job's effective priority improves the longer
it has waited. You choose the function. Linear in waiting time is the obvious
starting point; some of you will try something sharper.

**Part three: price the fix.** This is the actual work. Measure, for strict SJF
and for your aged version:

- mean wait
- 95th percentile wait
- the single worst wait in the run

Then tune your ageing parameter and plot mean against worst-case as you sweep it.
The curve you get is the exchange rate between the average and the tail for your
particular system, and it is the single most useful artefact you will produce
this semester. Every scheduling argument you have for the rest of the course is
a question about where on that curve to sit.

There is no correct point on it. There is only a choice, and the curve makes the
choice visible instead of implicit.

## Afterwards

Submit nothing from the lab itself. The ordering-rule assignment is due Friday at
17:00, and if your proposal involves any kind of prioritisation, the curve you
plotted today is the evidence that you understood what you were proposing.
