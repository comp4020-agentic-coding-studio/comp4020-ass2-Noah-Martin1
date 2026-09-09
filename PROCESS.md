# Process

## What I built

**SLOP2710 — The Economics of Waiting**, a twelve-week SlopU course arguing that
every queue is running an ordering rule somebody chose, that the rule decides
whose time is worth less, and that there is therefore no neutral queue. Twelve
lectures in three acts, twelve labs of fieldwork, four assessments, and four
simulations a reader can drive.

## How I got here

I think a course is one idea explored for twelve weeks, and that the usual way
that fails is twelve topics sharing a subject. My first outline had exactly that
failure: it ran airports, elevators, restaurants, hospitals, traffic — a venue a
week. I threw it out for a mechanism-led arc where each week introduces one new
rule for deciding who goes first and venues become evidence rather than
chapters. Aircraft boarding is teased in week 2 and returns as the week 10
set-piece carrying weeks 6 and 8 with it.

That is easy to claim and hard to keep true across twenty-eight files, so I made
it checkable before writing any of it. Every lecture declares an `act`, an
`idea`, a headline `system` and the earlier week it `buildsOn`, and
[`6f05794`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/6f05794) asserts that the chain points strictly backwards
and terminates at week 1, and that no system headlines twice. The `/arc/` page
renders from those same four fields, so the diagram and the checks cannot
disagree — the page is the checks' input. Those tests were written and failing
before a word of content existed.

The checks earned it. The due-date assertion caught the simulation report dated
30 April, which is week 8's Friday, not week 9's
[`39b09e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/39b09e7). The bigger catch was not a test but a
measurement: my week 5 lecture asserted that pooling servers "does almost
nothing to your average wait" and only cuts variance. The simulator said the
mean roughly halves, because a pooled line never leaves a server idle while
someone waits. I had written a confident, wrong thing; the lecture and the lab
were both corrected [`ff1d0fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/ff1d0fd). Validating that engine
against M/M/1 also exposed a rounding bias that drove ρ to exactly 1.0 in the
deterministic case, which had made the low-variance run look *worse* than the
random one.

My CLAUDE.md rule that visuals must be checked rather than assumed paid for
itself twice. The theme defines its colour tokens as `light-dark()` pairs, so
canvas silently kept its previous fill and every rule and label rendered gold —
invisible to every test, obvious in a screenshot
[`9225eeb`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/9225eeb). And Chrome clamps `--window-size` to about
500px on macOS, so my 390px screenshots were a 500px layout cropped; I wrote a
CDP tool with real device emulation before trusting anything I saw
[`6bec983`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/6bec983).

What I deliberately did not encode: prose quality. I considered a check on
reading level or repeated phrasing and decided a green test would license
exactly the generic writing it was meant to prevent. Whether week 7 sounds like
a person is a judgement, and I left it as one.

Full history: [`ab8a430...af25fd3`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/compare/ab8a430...af25fd3).
