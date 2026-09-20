---
title: The Ordering Rule
description:
  Find a system, name the rule it uses to decide who goes first, change it, and
  say plainly who is worse off afterwards.
week: 6
due: 2027-04-02T17:00:00+11:00
weight: 15
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

## Step one, and it is not the easy step

**State the current rule as an instruction somebody could follow on their first
shift.** Begin it with *"when a server becomes free, serve…"* and finish the
sentence without using the words "fairly", "appropriately" or "as normal".

This is week 1's habit and week 5's lecture, and it is worth a quarter of the
mark on its own because almost nobody gets it right first time. Three things go
wrong:

**You will write "first come, first served" and be wrong.** Look for the second
rule running underneath. An app order that skips the line. A regular served out
of turn. A member of staff who serves whoever is physically nearest. A till that
only takes cards, which is a priority rule wearing a payments disguise. Most
systems run two or three rules at once and have never noticed.

**You will describe the intention rather than the behaviour.** What the manager
believes the rule to be is useful evidence and is not the rule. If they differ,
say so — that gap is frequently the most interesting finding in the submission.

**You will find nobody in the building knows.** Normal, and worth reporting as a
result rather than as an obstacle. A rule nobody has stated has never been
defended, and therefore has never been compared with the alternative. That is
the course's thesis, found in the wild by you.

## Two failure modes that account for most weak submissions

**Proposing more capacity.** "The emergency department should hire more triage
nurses" is not an ordering rule, it is a budget request, and it is outside the
brief. You must work with the servers the system already has. The constraint is
deliberate: capacity is the answer everybody reaches for first, and it is the
one answer that requires nobody to think about priority.

There is one legitimate exception and you should know where the line is.
Week 5's pooling result is not a capacity change — merging four queues into one
adds no servers and is a change to the rule, because the rule is *a discipline
plus a geometry*. If your proposal is "take the rope down", that is inside the
brief, and it is a strong choice.

**The costless improvement.** If your change makes everybody better off and
nobody worse off, you have almost certainly modelled it wrongly, and the 40% of
the mark attached to who pays is where that shows up. Reordering a queue does
not create throughput out of nothing; shortest-job-first buys its average by
lengthening somebody's tail. Find that somebody. Name them. Estimate what it
costs them.

If you genuinely believe you have found a free lunch, argue for it explicitly —
occasionally they exist, and a convincing one will be marked generously. The
honest free lunches available to you are pooling, variance reduction, and
information. Everything else is a transfer.

## Estimating the cost without a simulation

You are not required to simulate. You are required to be quantitative, and there
is a lot you can do with week 2 and week 3 alone:

- **Little's Law, twice.** Once for the current system and once for the proposed
  one, at the boundary you care about.
- **The VUT shape.** If your change moves variability rather than load, say which
  term you are moving and roughly by how much. "This splits one station into two
  and roughly halves the service-time spread each one sees" is a quantitative
  claim.
- **A worked example on five jobs.** Week 6's opening is exactly this, and a
  hand-computed before-and-after on a realistic handful of customers is worth
  more than an unvalidated simulator.
- **A bound.** "Under the new rule, the longest-basket customer is passed by
  every arrival with fewer than N items, which at the observed arrival rate is
  about M an hour" tells a reader everything they need.

## What good scope looks like

The strongest submissions are usually the least ambitious: a small, precise
change to a system the student actually understands, costed honestly. Previous
examples that worked well —

- a print room adopting a page-count threshold, and what it did to the thesis
- a campus café's mobile orders, which turned out to be a priority queue nobody
  had agreed to
- a GP surgery's "urgent on the day" slots, and who was reliably calling at 8am
- a help desk moving from arrival order to severity, and what happened to the
  tickets that were never severe

And one that did not: *"universities should abolish exam scheduling"*.

## How this is marked

**Identification of the current rule (25%).** Is it stated as an executable
instruction? Did you look hard enough to find the second rule? Is there evidence
behind the claim — observation, a staff conversation, documentation?

**The proposed change (35%).** Is it specific enough to implement? Is it a rule
change rather than a resource request? Is the expected effect quantified, at
whatever level of rigour your evidence supports?

**Honesty about who pays (40%).** Is there a named group, with a magnitude and a
reason? Is the objection you find hardest actually the hardest one, or a soft
one you chose because you had an answer? This is the largest slice and it is
where the difference between a good and an excellent submission almost always
lies.

## What you submit

A proposal of no more than 1500 words. State the current rule as an algorithm —
if you cannot write it as a sequence of steps, you have not identified it yet.
Then the change, the beneficiaries, the losers, and the objection you like
least.

No simulation is required here. That is the next assignment, and several of you
will want to bring this system with you into it.
