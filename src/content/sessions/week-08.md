---
title: "Lab 8 — Open the Fast Lane"
description:
  Add a paid lane to a working simulation and measure precisely who pays for it.
week: 8
date: 2027-04-26
teachers:
  - priya-raghunathan
spec:
  - you have run the same system with and without a priority lane
  - you have measured the effect separately for both groups, not for the population as a whole
  - you have found the uptake level at which the paid lane stops being worth buying
related:
  - lectures/week-08
  - assessments/03-simulation-report
---

## Before the lab

Bring the simulator you built in week 6, or use the course one. You need
something you can add a second queue class to.

## In the lab

**Baseline.** One queue, one discipline, ρ around 0.85. Record the wait
distribution. This is the world before anyone sells anything.

**Add the lane, shared servers.** Ten per cent of arrivals buy priority. Same
servers, same total capacity — the realistic case. Now measure three things and
keep them apart, because collapsing them is the mistake the public debate makes:
the paid group's wait, the unpaid group's wait, and the population mean.

The population mean will barely move. This is why an operator can say, with a
straight face and without lying, that the fast lane did not make things worse.
Look at the unpaid group's 90th percentile instead.

**Sweep the uptake.** Now take priority uptake from 5% to 80% in steps and plot
both groups. Something specific happens and you should find it rather than be
told it: as uptake rises, the paid lane congests with other paying customers, and
its advantage decays toward nothing. Past some point everybody has paid and
nobody is faster — a pure transfer from customers to operator with no change in
service at all.

Find that point for your system. It is the number the operator most wants to know
and least wants published.

**The idle-capacity variant.** If you have time, rerun with the paid lane on a
*spare* server that was previously idle. Everything changes. Nobody is worse off.
The two cases give opposite answers, they are usually argued as though they were
the same case, and telling them apart in the wild is the practical skill.

## Afterwards

Your simulation report is due at the end of next week and this lab is a
legitimate basis for it, provided you extend it. The sweep is the interesting
part; do not stop at the single 10% run.
