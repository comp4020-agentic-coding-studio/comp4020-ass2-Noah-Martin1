import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Two promises this course makes about its own teaching material, both of which
 * the build is happy to violate silently.
 *
 * CLAUDE.md says lecture slides are part of the course website rather than
 * separate documents, and that every deck must contain a simulation. For most
 * of this project's life only week 1 had a deck at all and it had no
 * simulation, which was invisible to every other check: a missing deck is not a
 * broken link unless something links to it, and an unlinked deck is not a
 * missing page.
 *
 * And the course promises a fifteen-to-twenty minute week. Length is a poor
 * proxy for depth and it is the only mechanical one available; a floor catches
 * the failure that actually happened here, which was twelve pages that each
 * read in about seven minutes.
 */

const WEEKS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

const lectures = WEEKS.map((w) => ({
  week: Number(w),
  slug: `week-${w}`,
  html: readFileSync(resolve(`dist/lectures/week-${w}/index.html`), "utf8"),
}));

/** Rendered words in the article body, with the site chrome taken off. */
function words(html: string): number {
  const body = /<article[\s\S]*?<\/article>/.exec(html)?.[0] ?? html;
  const text = body
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

describe("every week has a lecture and the deck that goes with it", () => {
  it("builds a deck page for all twelve weeks", () => {
    const missing = WEEKS.filter((w) => !existsSync(resolve(`dist/decks/week-${w}/index.html`)));
    expect(missing, `no deck built for week(s) ${missing.join(", ")}`).toEqual([]);
  });

  it("links each week's deck from its lecture page", () => {
    // The link is what makes a deck part of the site rather than a file that
    // happens to be deployed. It comes from the lecture's `slides` frontmatter,
    // so this also catches a deck that exists and was never declared.
    for (const lecture of lectures) {
      expect(lecture.html, `week ${lecture.week} does not link its slides`)
        .toContain(`/decks/${lecture.slug}/`);
    }
  });

  it("puts a simulation on every deck", () => {
    for (const w of WEEKS) {
      const html = readFileSync(resolve(`dist/decks/week-${w}/index.html`), "utf8");
      const sims = (html.match(/data-qsim(?![-\w])/g) ?? []).length;
      expect(sims, `week ${w}'s deck carries no simulation`).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every deck enough slides to be a lecture rather than a summary", () => {
    for (const w of WEEKS) {
      const html = readFileSync(resolve(`dist/decks/week-${w}/index.html`), "utf8");
      const slides = (html.match(/<section(?=[\s>])/g) ?? []).length;
      expect(slides, `week ${w}'s deck has only ${slides} slide(s)`).toBeGreaterThanOrEqual(12);
    }
  });

  it("makes every week long enough to be worth twenty minutes", () => {
    // ~1,800 words is roughly nine minutes of reading, and the simulation is
    // meant to carry several more. It is a floor, not a target: week 12 runs to
    // nearly 3,000 and should.
    for (const lecture of lectures) {
      const n = words(lecture.html);
      expect(n, `week ${lecture.week} is ${n} words, which is a reading rather than a lecture`)
        .toBeGreaterThanOrEqual(1800);
    }
  });
});
