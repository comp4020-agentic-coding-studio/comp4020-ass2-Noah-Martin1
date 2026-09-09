import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// SLOP2710 promises that a week reads as an explanation rather than a wall of
// prose: a concrete scene, then numbered steps, each carrying a picture, with
// the reader asked to commit to a guess before results they are likely to get
// wrong. That is a claim about shape, which the build cannot see, so it is
// asserted here against the rendered HTML.

const WEEKS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

const pages = WEEKS.map((w) => ({
  week: Number(w),
  html: readFileSync(resolve(`dist/lectures/week-${w}/index.html`), "utf8"),
}));

const beatNumbers = (html: string) =>
  [...html.matchAll(/class="q-beat__n"[^>]*>(\d+)</g)].map((m) => Number(m[1]));

describe("every week reads as an explanation", () => {
  it("breaks each week into at least four numbered steps", () => {
    for (const page of pages) {
      expect(beatNumbers(page.html).length, `week ${page.week} has too few steps to be a sequence`)
        .toBeGreaterThanOrEqual(4);
    }
  });

  it("numbers those steps 1..n with nothing skipped or repeated", () => {
    // Renumbering by hand after inserting a step is the obvious way for this
    // to rot, and it is invisible in review.
    for (const page of pages) {
      const ns = beatNumbers(page.html);
      expect(ns, `week ${page.week} numbers its steps ${ns.join(",")}`)
        .toEqual(Array.from({ length: ns.length }, (_, i) => i + 1));
    }
  });

  it("gives every week a figure that carries an argument", () => {
    // Either a live simulation or a drawn diagram, and both kinds are required
    // by their own components to state what the reader should take from them.
    for (const page of pages) {
      const figures = (page.html.match(/class="q-figure/g) ?? []).length;
      expect(figures, `week ${page.week} has no figure at all`).toBeGreaterThanOrEqual(1);
    }
  });

  it("asks the reader to commit to a guess at least once", () => {
    for (const page of pages) {
      const predicts = (page.html.match(/class="q-predict"/g) ?? []).length;
      expect(predicts, `week ${page.week} never puts a question to the reader`)
        .toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the closing statement rare enough to mean something", () => {
    // A page that punches every paragraph is a page that punches nothing.
    for (const page of pages) {
      const punches = (page.html.match(/class="q-punch"/g) ?? []).length;
      expect(punches, `week ${page.week} overuses the emphasis treatment`).toBeLessThanOrEqual(4);
    }
  });
});
