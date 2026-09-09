---
title: "Lab 2 — Breaking a Queue on Purpose"
description:
  Run a queue by hand with dice, then add variance and watch it fall over
  without adding a single customer.
week: 2
date: 2027-03-01
teachers:
  - tomas-rehak
spec:
  - you have run a physical queue simulation for at least fifty ticks
  - your two runs differ only in variance, not in average load
  - you can state, from your own data, what happened to the queue at high rho
related:
  - lectures/week-02
---

## Before the lab

Read the week 2 lecture notes, and bring a phone with a stopwatch. We supply the
dice.

## In the lab

This runs as a tabletop simulation, in groups of four, and it is deliberately
low-tech — you will meet the software version soon enough, and it is much easier
to disbelieve a computer than your own tally sheet.

**Run one, sixty ticks.** One person is the clock. One rolls arrivals, one rolls
service, one keeps the queue as a row of counters. Arrivals and service are both
set so that ρ ≈ 0.8, with *no* variance: exactly four arrivals per five ticks,
exactly one service per tick. Record queue length every tick.

**Run two, sixty ticks.** Identical average rates. Now roll for both. Same mean
arrivals, same mean service, same ρ. Record queue length every tick.

The averages are the same. The graphs are not, and every group gets the same
qualitative result, which is the point of doing it collectively rather than
watching one demo.

**Then push it.** Change nothing except the arrival rate, taking ρ from 0.8 to
0.9 to 0.95. Sixty ticks each. Plot maximum queue length against ρ on the
whiteboard, all groups on the same axes. The curve that appears is the one the
lecture asserted, drawn from your own dice.

## Afterwards

Keep your tally sheets. In week 9 you will run the same experiment in software
and compare the two, and having your own hand-rolled data to check the simulator
against is a much better position than trusting it.

Tomáš will be looking at how you recorded, not what you found. The finding is
already known; the recording is the skill.
