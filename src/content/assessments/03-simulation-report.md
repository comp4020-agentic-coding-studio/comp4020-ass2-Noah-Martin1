---
title: Simulation Report
description:
  Run two ordering rules against the same arrival stream, and report what the
  numbers did — including the part you did not expect.
week: 9
due: 2027-04-30T17:00:00+10:00
weight: 15
marking:
  mode: weighted
  criteria:
    - name: Model fidelity
      weight: 30
    - name: Experimental design
      weight: 35
    - name: Reading the result
      weight: 35
spec:
  - two disciplines compared on the same arrival stream, with the seed stated
  - at least one distributional result, not only a comparison of means
  - a sensitivity check — one parameter moved, and the effect reported
  - a statement of what the model leaves out and why that matters
related:
  - lectures/week-08
  - lectures/week-09
  - sessions/week-09
---

## The brief

> Two rules, one arrival stream, one honest comparison.

You may use the course simulator, write your own in whatever language you like,
or run the thing physically with volunteers and a stopwatch if you can recruit
enough people. The tool is not marked. The experiment is.

Three things separate a good report from a mediocre one.

**Same stream, stated seed.** If discipline A and discipline B see different
arrivals, you have compared two worlds, not two rules. Say which seed you used
so that Priya can rerun it.

**Distributions, not just means.** The mean wait is the least interesting number
your simulation produces and the easiest to improve. A rule that cuts the mean
by 20% while tripling the 95th percentile is not an improvement, it is a
transfer, and a report that only prints means cannot see the transfer happening.
Show the spread. A histogram is fine. The tail is where the argument lives.

**One parameter moved.** A result that holds at ρ = 0.7 and collapses at ρ = 0.95
is a much more useful finding than a result reported at a single load. Move
something and say what happened.

## What you submit

A report of no more than 1500 words, plus your code or your tally sheets. Charts
are welcome and should be legible in greyscale.

The final section must say what your model leaves out. Every model in this
course is wrong in ways its author can usually name if asked directly; naming
them yourself, before you are asked, is most of what it means to have understood
the thing you built.
