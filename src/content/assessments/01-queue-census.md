---
title: Queue Census
description:
  Go and stand in a real queue with a stopwatch. Measure it properly, model it
  with Little's Law, and report the gap between the two.
week: 3
due: 2027-03-12T17:00:00+11:00
weight: 15
marking:
  mode: weighted
  criteria:
    - name: Measurement discipline
      weight: 40
    - name: Use of the model
      weight: 30
    - name: What you noticed
      weight: 30
spec:
  - one real queue, observed in person, for at least forty continuous minutes
  - raw counts submitted as data, not only as conclusions
  - an estimate of L, λ and W, and a stated reason for trusting or distrusting each
  - a discrepancy identified, and an explanation offered for it
related:
  - lectures/week-03
  - sessions/week-03
---

## The brief

> Find a queue. Measure it well enough that somebody who was not there could
> argue with your numbers.

This is the smallest assessment in the course and the one most people
underestimate. You are not being asked to analyse anything clever. You are being
asked to produce forty minutes of honest data about a real system, which turns
out to be much harder than it sounds, because a queue in the world does not
announce where it starts, when a person joined it, or whether the person who
just walked away was ever really in it.

The interesting part is not the arithmetic — Little's Law is one multiplication
and you will have met it in week 3. The interesting part is that your measured
average wait and the wait your model predicts will not agree, and the reason
they disagree is a fact about the queue you are looking at. Perhaps people
balked and you did not count them. Perhaps the service rate changed when the
line got long, because the barista started rushing. Perhaps your queue was never
in steady state at all. A strong submission finds the gap and names its cause. A
weak one reports the two numbers, notes that they differ, and moves on.

## Before you start: draw the box

The single most common way this assignment goes wrong is that it is begun
without a boundary, and no amount of careful counting afterwards can repair it.

Write down, before you count anything:

- **Where the queue starts.** The moment somebody joins the line? Enters the
  room? Takes a ticket? Opens the app? These are different systems and they have
  different answers.
- **Where it ends.** When they reach the counter, or when they leave with the
  thing they came for? Service time is inside one box and outside the other.
- **What counts as leaving.** Somebody who walks out is a departure from the
  system and not a departure through the server, and week 3 is explicit about
  why that distinction will bite you.

Then state that boundary in your first paragraph. Everything else in your report
is a claim about that box and nothing else, and a report that does not name its
box is not interpretable — which is the whole argument of the lecture, applied
to you rather than to somebody else's published statistic.

## What a good measurement looks like

**Count L properly.** Not "about fifteen". Take an instantaneous count on a
fixed cadence — every thirty seconds, say — and average the counts. Two people
counting independently for the first five minutes is the cheapest reliability
check available and it is worth doing.

**Count λ at the boundary, not at the door.** λ is the throughput: things
crossing the line you drew. Stand at a fixed point and count crossings over a
stated window.

**Measure W directly for a sample.** Pick individuals and time them end to end.
Twenty is plenty. This is the number you compare against L/λ, and it is the only
one of the three you cannot get by standing still.

**Record the window.** All three quantities over the same window, stated in the
report. Mixing an L from the peak with a λ from the whole session is the second
most common failure and it produces a confident wrong answer.

## What counts as a good gap

You are being marked on what you notice, so here are the discrepancies previous
cohorts have found, none of which is a mistake:

- **Balking.** Arrivals you never counted because they looked at the line and
  kept walking. Count the people who approach and turn away; it is the single
  most valuable extra column in your tally sheet.
- **The service rate is not constant.** Staff speed up under load, up to a point,
  and then make errors and slow down. Your λ is not a property of the system, it
  is a property of the system *at that load*.
- **Batch arrivals.** A lecture ends, eleven people arrive in forty seconds, and
  the queue never recovers within your window. That is week 2 in your data.
- **It was never in steady state.** The hardest one to admit and the most common.
  If the queue was longer at the end than the beginning, work out how much of
  your measured person-minutes are still inside the system.

## Choosing a queue

Pick something with enough traffic to give you data and enough boredom to let
you count carefully. Campus coffee at 9am is fine. A supermarket is fine. A bank
is fine, if any still exist near you. A lift lobby is unexpectedly good, because
the boundary question is genuinely hard and you will have to argue for your
answer.

Avoid anything where you cannot see both ends, anything with fewer than about
forty arrivals in your window, and anything where standing and counting for
forty minutes would be intrusive or unwelcome. If in doubt about the last one,
ask, or choose somewhere else.

## How this is marked

**Measurement discipline (40%).** Did you state your boundary and your window?
Are the raw counts present, legible and plausibly collected? Did you do anything
at all to check your own reliability? This is the largest slice because it is the
thing the course cannot teach you from a page.

**Use of the model (30%).** Is L = λW applied to quantities that actually match
its definitions, with the units cancelling? Do you say which of your three
numbers you trust least, and why?

**What you noticed (30%).** Is there a real discrepancy, identified, with a
cause offered and some evidence for that cause? A plausible cause argued from
your own data beats a correct cause asserted from the lecture.

## What you submit

A short report, no more than 1200 words, plus your raw observations as a CSV or
a photographed tally sheet. The raw data is not an appendix nobody reads — it is
where most of the first criterion lives, and Tomáš will read it.

If your queue turned out to be uncountable, submit the attempt and the reason.
An honest account of why a system resisted measurement is worth full marks. A
tidy table of numbers you did not actually collect is worth none, and is easier
to spot than you would think.

Keep your data. Several of you will want this system back in week 6, and about a
third of the final briefs each year are about the queue the student first
measured in March.
