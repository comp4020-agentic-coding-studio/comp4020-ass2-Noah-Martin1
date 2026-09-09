---
title: The Ordering Rule
description:
  Find a system, name the rule it uses to decide who goes first, change it, and
  say plainly who is worse off afterwards.
week: 6
due: 2027-04-02T17:00:00+11:00
weight: 20
marking:
  mode: weighted
  criteria:
    - name: Identification of the current rule
      weight: 25
    - name: The proposed change
      weight: 35
    - name: Honesty about who pays
      weight: 40
spec:
  - a real system, with its current ordering rule stated precisely enough to implement
  - one specific change to that rule, not a wish for more capacity
  - a named group who is worse off after your change, and by roughly how much
  - the objection you find hardest to answer, answered
related:
  - lectures/week-05
  - lectures/week-06
  - sessions/week-06
---

## The brief

> Change who goes first. Then tell us who you just made wait longer.

By week 6 you will have four ordering rules in hand — arrival order, job length,
need, and price — and the beginning of a suspicion that choosing between them is
not a technical decision. This assignment cashes that in.

Two failure modes account for most of the weak submissions, and both are worth
naming now.

The first is proposing more capacity. "The emergency department should hire more
triage nurses" is not an ordering rule, it is a budget request, and it is
outside the brief. You must work with the servers the system already has. The
constraint is deliberate: capacity is the answer everybody reaches for first,
and it is the one answer that requires nobody to think about priority.

The second is the costless improvement. If your change makes everybody better
off and nobody worse off, you have almost certainly modelled it wrongly, and the
40% of the mark attached to who pays is where that shows up. Reordering a queue
does not create throughput out of nothing; shortest-job-first buys its average
by lengthening somebody's tail. Find that somebody. Name them. Estimate what it
costs them. If you genuinely believe you have found a free lunch, argue for it
explicitly — occasionally they exist, and a convincing one will be marked
generously — but argue for it, do not assume it.

The strongest submissions in this assignment are usually the least ambitious
ones: a small, precise change to a system the student actually understands,
costed honestly.

## What you submit

A proposal of no more than 1500 words. State the current rule as an algorithm —
if you cannot write it as a sequence of steps, you have not identified it yet.
Then the change, the beneficiaries, the losers, and the objection you like
least.

No simulation is required here. That is the next assignment, and several of you
will want to bring this system with you into it.
