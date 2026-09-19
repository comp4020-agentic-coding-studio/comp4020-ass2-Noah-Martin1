---
title: Final Design Brief
description:
  Redesign one real queue end to end, and defend it against the best version of
  the alternative you rejected.
week: 12
due: 2027-05-28T17:00:00+10:00
weight: 50
marking:
  mode: holistic
  description:
    The design brief is read as a single argument. The question is whether a
    person responsible for this system could act on it — whether the problem is
    diagnosed with evidence, the design is specific enough to build, the losers
    are named without flinching, and the rejected alternative has been given its
    strongest form rather than its most convenient one.
spec:
  - one real queue, chosen by you, that you can gather evidence about
  - a diagnosis grounded in measurement or documented evidence, not intuition
  - a design specified to the level of an ordering rule and its exceptions
  - a named alternative, argued at its strongest, and then rejected with reasons
  - an explicit statement of what your design optimises, and what it gives up
related:
  - lectures/week-11
  - lectures/week-12
  - sessions/week-12
  - 02-ordering-rule
  - 03-simulation-report
---

## The brief

> Redesign a queue. Then argue against yourself, properly, and win.

This is half the course's marks and it is the piece the whole semester has been
loading for. Weeks 1–4 taught you to see the queue and price the wait. Weeks 5–9
gave you the ordering rules. Weeks 10–12 showed you what happens when the system
answers back. Now pick something real and do the whole job.

## The five things a brief has to do

**Diagnose, with evidence.** Not "the queue is too long" — a statement of what
the system currently does, at the boundary you have drawn, with numbers behind
it. Your week 3 census is the model for this even if the system is a different
one. Where you cannot measure, say so and use documented evidence; where you
have neither, say that too and mark the claim as an assumption.

**Say what it costs and who holds the bill.** Week 4. The arithmetic is one
multiplication and the difficult part is the second half of the sentence. Who is
in that queue at the time of day you are proposing to change? Is your evidence
about them, or about a convenient average?

**Specify the rule.** To the level of an instruction, with its exceptions.
*"When a server becomes free, serve the longest-waiting member of the highest
occupied class, except that no member of any class waits more than forty
minutes."* If your design cannot be written like that, it is a direction rather
than a design.

**Name the losers.** Every reordering is a transfer. A brief that cannot
identify who is worse off has either not understood the rule or has not looked.

**Steelman the alternative.** The requirement that carries the most weight, and
the one most often underestimated. You must name the design you did not choose,
state it in its strongest form — the form its most capable advocate would
recognise as fair — and then say why you rejected it anyway. A brief that
dispatches a straw alternative in two sentences will not reach a high mark no
matter how good the primary design is. This is not a rhetorical exercise. It is
the only reliable protection against a designer's favourite failure, which is
solving the version of the problem they already knew how to solve.

## Three questions from week 11 your design has to survive

A rule that is optimal against a fixed population will be met by a population
that adapts to it. So, in the body of the brief and not in a footnote:

1. **What does somebody gain by misreporting, and how would you know?** Every
   rule in Act II except arrival order sorts on information somebody supplies.
2. **Who can see your queue, and what do they do when they see it?** Publishing a
   wait, a position or a target changes the thing it describes.
3. **Who leaves, and would you find out?** The people who balk are the most
   informative population in your system and the least likely to be in your data.

Most drafts have no answer to the third one. Having an answer is one of the
cheapest ways to separate your brief from the middle of the cohort.

## Two design moves worth stealing

Both are from week 12, and both are available in almost any design.

**Cap the fraction.** You do not have to apply an objective to all of the
supply. The strongest real allocation systems apply their most contested rule to
a bounded share — the best fifth of organs, a reserved lane, two protected slots
an afternoon — which buys most of the efficiency and none of the starvation. If
your design has a rule that starves somebody, ask whether it needs to run on
everything.

**Publish the rule.** It is the intervention, not the decoration. A rule the
queue can read is a rule the queue can object to, and almost none of the systems
in this course have one. If your brief contains a recommendation to write the
rule on a sign, you are in good company.

## Scope

Scope realistically. A semester's worth of work is one queue understood
thoroughly, not a proposal to reform an entire sector. The best submissions this
course has seen were about a single counter, a single intersection, or a single
booking page.

A useful test: could you, in principle, hand this to the person who runs the
system on Monday, and would they be able to tell whether they had done it? If
the answer is no because the proposal is too vague, narrow it. If the answer is
no because the proposal requires an act of parliament, narrow it.

You may build on your week 6 proposal or your week 9 simulation, and most people
do. Say so if you have; there is no penalty, and continuity across the semester
is usually a sign the work is going well.

## What is *not* required

**A simulation.** If one helps, include it; assignment 3 already marked your
experimental craft. A hand-computed example and a clear argument beat an
unvalidated model.

**A novel rule.** Choosing a well-understood rule for well-argued reasons is a
better brief than inventing something to look original. Most of the value in
this field is in the argument for the choice, not the exotic-ness of it.

**Agreement with the lecturers.** The two people marking this disagree with each
other in week 7 and have not resolved it. A brief that argues for pricing a
queue we would not price, and argues it well, will be marked well.

## How this is read

Holistically, as a single argument, against the question at the top of this
page: **could the person responsible for this system act on it?**

In practice that resolves into four things, and none of them is a section of the
document:

- Is the diagnosis grounded in something other than intuition?
- Is the design specific enough to build, including its exceptions?
- Are the losers named without flinching, with a magnitude?
- Has the rejected alternative been given its strongest form?

A brief that is excellent on three and absent on the fourth does not reach the
top band, because the four are not independent — the steelman is what makes the
other three credible.

## What you submit

A design brief of no more than 3000 words, written for the person who would have
to approve it, not for a marker. Include whatever evidence, diagrams or
simulation output the argument needs; those do not count towards the word limit.

The last page must state, in a sentence, what your queue optimises for. If you
cannot finish that sentence, the design is not done — and if you can, you will
have answered the question the course opened with in week 1.
