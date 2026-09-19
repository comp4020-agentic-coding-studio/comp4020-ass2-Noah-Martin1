---
title: Simulation Report
description:
  Run two ordering rules against the same arrival stream, and report what the
  numbers did — including the part you did not expect.
week: 9
due: 2027-05-07T17:00:00+10:00
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

## Three things separate a good report from a mediocre one

**Same stream, stated seed.** If discipline A and discipline B see different
arrivals, you have compared two worlds, not two rules. Say which seed you used
so that Priya can rerun it.

This matters more than it sounds. The difference between two disciplines is
often smaller than the difference between two random mornings, and if you have
not held the stream fixed you cannot tell which you measured. The check is easy:
run the *same* discipline twice on two different seeds and see how far apart the
answers land. If that gap is comparable to the gap between your two rules, you
need more runs, a longer run, or a common random stream — and reporting that you
found this out is worth more than reporting a difference you cannot defend.

**Distributions, not just means.** The mean wait is the least interesting number
your simulation produces and the easiest to improve. A rule that cuts the mean
by 20% while tripling the 95th percentile is not an improvement, it is a
transfer, and a report that only prints means cannot see the transfer happening.
Show the spread. A histogram is fine. The tail is where the argument lives.

Week 8 gives you the sharpest version of why. Any work-conserving reordering
leaves the population mean exactly where it was — so if you are comparing two
priority rules on the same stream and your means differ by more than noise,
either you have found a genuine capacity effect or you have a bug, and you
should say which. **A conservation law is a free unit test.**

**One parameter moved.** A result that holds at ρ = 0.7 and collapses at ρ = 0.95
is a much more useful finding than a result reported at a single load. Move
something and say what happened.

The three parameters worth moving, in order of how often they surprise people:
utilisation, arrival variability, and the share of traffic that is in the
privileged class. Week 8's slider is the last of those and it is the one where
the interesting behaviour is at the far end.

## Getting the model right enough

Nobody expects a faithful reproduction of a real system. They expect a model
whose simplifications you can name.

Three mistakes that are worth avoiding because they invalidate the result rather
than merely limiting it:

**Warm-up.** A simulation started empty spends a while being a different system.
Discard the opening period, and say how much you discarded and how you chose it.
The simplest defensible method is to plot the running mean and cut where it
stops trending.

**Run length.** One run of a random thing is an anecdote. Either run long, or run
many seeds and report the spread across them. For a tail statistic you need far
more data than for a mean — a 95th percentile computed from 200 customers is
mostly noise, and week 7's readout was rebuilt from scratch for exactly this
reason.

**Fractional time.** If you schedule the next arrival as *now plus an interval*
rather than *the last scheduled time plus an interval*, you silently discard the
fraction the clock overshot by and lose several per cent of your offered load.
Two scenes in this course had that bug. The symptom is a system that reports a
high utilisation over a suspiciously empty room, and the check is to compare
your observed arrival count against the rate you asked for.

## What counts as a good finding

You are not marked on whether your proposed rule wins. You are marked on whether
you can read what happened. The most creditable outcomes previous cohorts have
reported:

- a rule that improved everything at low load and collapsed at high load
- a mean that did not move at all, correctly explained as conservation rather
  than as a failed experiment
- an improvement that turned out to be entirely a warm-up artefact
- a tail that got worse while every headline number improved

## How this is marked

**Model fidelity (30%).** Does the model represent the thing you say it
represents? Are the distributions and rates justified by something — your week 3
data, a published figure, or a stated assumption? Is the final section's account
of what it leaves out specific rather than ritual?

**Experimental design (35%).** Common stream, stated seed, warm-up handled, run
length adequate to the statistic you are reporting, and one parameter moved with
purpose. This is the craft slice.

**Reading the result (35%).** Does the report say what the numbers mean, in
terms of the people in the queue? Does it distinguish a transfer from an
improvement? Does it notice the thing it was not looking for?

## What you submit

A report of no more than 1500 words, plus your code or your tally sheets. Charts
are welcome and should be legible in greyscale.

The final section must say what your model leaves out. Every model in this
course is wrong in ways its author can usually name if asked directly; naming
them yourself, before you are asked, is most of what it means to have understood
the thing you built.
