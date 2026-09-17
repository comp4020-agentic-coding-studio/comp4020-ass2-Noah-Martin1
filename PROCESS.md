# Process

## What I built

**SLOP2710 — The Economics of Waiting**, a twelve-week SlopU course arguing that
every queue is running an ordering rule somebody chose, that the rule decides
whose time is worth less, and that there is therefore no neutral queue.

Twelve lectures in three acts, twelve labs of fieldwork, four assessments — and
twelve live simulations, one a week, each set in a real place you could walk
into. A café you rearrange, an airport line you measure two ways, a passport
office with its own cost ticking underneath it, a bank, a supermarket, an
emergency department, a theme park, a restaurant, an aircraft at a gate, a call
centre, and a dialysis unit where the rule decides who lives.

## The structural decision, and making it checkable

I think a course is one idea explored for twelve weeks, and that the usual way
that fails is twelve topics sharing a subject. My first outline had exactly that
failure: airports, elevators, restaurants, hospitals, traffic — a venue a week. I
threw it out for a mechanism-led arc where each week introduces one new rule for
deciding who goes first and venues become evidence rather than chapters.
Aircraft boarding is teased in week 2 and returns as the week 10 set-piece
carrying weeks 6 and 8 with it.

That is easy to claim and hard to keep true across thirty files, so I made it
checkable before writing any of it. Every lecture declares an `act`, an `idea`, a
headline `system` and the earlier week it `buildsOn`, and
[`6f05794`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/6f05794)
asserts the chain points strictly backwards, terminates at week 1, and never
headlines a system twice. The `/arc/` page renders from those same four fields,
so the diagram and the checks cannot disagree — the page is the checks' input.
Those tests were written and failing before a word of content existed.

## The visual decision: scenes, not diagrams

The first version of this site had four simulations and eight static SVG
diagrams drawn in an austere two-ink grammar of dots and boxes. It was coherent
and it was wrong for the course. A reader should be able to look at a figure and
know what it is *about* before reading a word of context, and a queue of grey
dots tells you nothing except that the author had a queue in mind.

So I rewrote the harness rules first
([`0188125`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/0188125))
and then the visuals: every week gets a simulation, every simulation is a place,
and a phrase worth remembering is marked in pink
([`47a0d8a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/47a0d8a),
which deliberately overrides two comments in my own stylesheet that forbade a
third colour — the commit says so rather than quietly contradicting the file).

Twelve dioramas is where this kind of thing normally collapses into twelve
unrelated drawings, so almost nothing about a scene is per-scene
([`f438a7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/f438a7f)):
one oblique camera, one painter's-order stage, one prop kit — people, counters,
chairs, plants, cars, screens — and one materials palette resolved from the
theme's tokens. A scene file is a room description and a model, and the series
look is structural rather than maintained.

Cross-references became live crops. Where a lecture needs an earlier visual it
replays a named region of that scene inline and links back, rather than writing
"as we saw in figure 3"
([`dc7eaec`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/dc7eaec)).
Week 12 uses four of them, one against each rule it is re-running, and closes on
week 1's counter.

All eight SVGs are gone — the first with week 1, the last seven together once
every week had a scene
([`eb9c0f4`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/eb9c0f4))
— and each was absorbed by the scene that replaced it rather than left beside
it: week 1's three café layouts became a
selector, so the comparison is something you do rather than look at
([`91be64c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/91be64c));
week 3's area argument became a sweeping overlay on a real security queue
([`cdb0ae8`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/cdb0ae8));
week 4's bill became a counter that ticks. The one survivor is the objective
matrix, which stays a real `<table>`: its job is a five-by-four comparison a
screen reader should be able to read, and canvas would take that away.

## What measuring caught

Every single week, measuring the scene against theory caught something the
lecture had asserted. The best ones:

**Week 5 said the wrong thing.** My draft asserted that pooling servers "does
almost nothing to your average wait" and only cuts variance. The simulator said
the mean roughly halves, because a pooled line never leaves a server idle while
someone waits. I had written a confident, wrong thing; the lecture and the lab
were both corrected
([`ff1d0fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/ff1d0fd)).

**A one-line arrival bug cost fifteen per cent of the traffic.** Week 7's
department was scheduling `nextArrival = tick + interval`, which throws away the
fraction the clock overshot by. The lecture claimed a load of 0.93 over an
almost empty waiting room; the real load was 0.78
([`0937bbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/0937bbd)).

**Three overlays measured nothing, and the model said so.** Week 8's first
overlay drew a counterfactual floor on the standby queue's length — which barely
moves, because priority is work-conserving, which is the week's own thesis
([`5f9286e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/5f9286e)).
Week 10 charged each row for its own passengers' stowing time, which is identical
under every boarding strategy; rewritten to charge a stalled walker to the row
responsible, the worst row goes from 349 ticks under back-to-front to 30 under
Steffen
([`3fac975`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/3fac975)).
And week 11 reported *fewer* calls offered when more agents were on shift, which
is impossible: the arrival rate does not know the staffing. I had reconstructed
the counters from outside by diffing the hold queue; instrumenting the tick is
duller and correct
([`c0e79ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/c0e79ba)).

**Averages and maxima are both the wrong instrument, in opposite directions.**
Week 7's readout began as the worst category-1 wait and moved eighty minutes
between neighbouring accuracy settings — one sample from a tail. Week 12's began
as the longest wait and moved sixteen years. Both became rates: a share over the
target, a ninetieth percentile. Week 12 then caught the subtler version of the
same class of error, and it turned into the best paragraph on the page: its wait
was measured over the transplanted only, so it was blind to exactly the people
each rule excludes. Measured over everybody who left the list, the gap between
the two figures turns out to be the amount of sorting the rule did
([`2dc2e04`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/2dc2e04)).

## What only a screenshot caught

My harness rule that visuals must be checked rather than assumed paid for itself
every week, and two classes of bug were invisible to every test I could write.

**The theme's colours are `light-dark()` pairs**, which canvas cannot resolve, so
it silently kept its previous fill and every rule and label rendered gold
([`9225eeb`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/9225eeb)).
The dark-mode inverse of that is a trap I hit repeatedly: `--q-ink` is near-white
in dark mode, so anything physically dark has to be built from the ground colour
instead. Week 12's green vinyl recliners came out as the brightest objects in the
room, ten chairs glowing louder than the ten people sitting in them.

**And in an oblique projection, depth folds into screen height.** A prop two
metres behind somebody occupies the same band of pixels as their chest, so every
sign, roof, tally and caption I placed "above" or "behind" something landed
across it — a lane sign over an operator's chest in week 6, a caption printed
through its own subject twice in week 11, a chip over the crowd it was describing
in week 12. It is one fact with one rule, and no amount of unit testing was ever
going to surface it. Chrome also clamps `--window-size` to about 500px on macOS,
so my early 390px screenshots were a 500px layout cropped; I wrote a CDP tool
with real device emulation before trusting anything I saw
([`6bec983`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/6bec983)).

The build carries an axe gate, so the pink's contrast and every canvas
`aria-label` are enforced rather than intended.

Two pieces of housekeeping are worth admitting. Files deleted in this working
tree keep coming back — ten starter samples with their original September mtimes,
and, within minutes of the commit that removed them, all nine of the static
diagrams. A restored `week-02.md` shadows `week-02.mdx` and serves starter prose
at a real URL, so this is now a `prebuild` step rather than something I remember
([`a1259f1`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/a1259f1)).
And the same mechanism was quietly restoring the scratch measurement harnesses I
use while calibrating a scene, which vitest then collected: my check count had
been drifting between 24 and 29 depending on which scratch files happened to
exist, which is worse than either number. The real suite is 24. The pattern is
now excluded in config rather than deleted by hand.

## What I deliberately did not encode

Prose quality. I considered a check on reading level or repeated phrasing and
decided a green test would license exactly the generic writing it was meant to
prevent. Whether week 7 sounds like a person is a judgement, and I left it as
one.

Visual quality, for the same reason and more strongly. The checks can prove a
scene has a caption, a label, enough contrast and a converged first frame. They
cannot tell me the dialysis unit read as an open-plan office one week after a
call centre, which it did until every station got a drip stand. That was a
screenshot and an opinion, twelve times over.

Full history:
[`ab8a430...eb9c0f4`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/compare/ab8a430...eb9c0f4).
