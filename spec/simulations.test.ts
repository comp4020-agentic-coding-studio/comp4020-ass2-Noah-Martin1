import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

// CLAUDE.md for this course says animations must demonstrate an idea rather
// than decorate a page. That is a promise about intent, which no build step can
// evaluate -- so it is turned into something mechanical here: every simulation
// on the site must carry a caption saying what to look at, and simulations must
// appear only on the weeks that claim one.

const DIST = resolve("dist");

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const pages = htmlFiles(DIST).map((path) => ({
  path: path.slice(DIST.length),
  html: readFileSync(path, "utf8"),
}));

const withSim = pages.filter((page) => page.html.includes("data-qsim"));

/**
 * Weeks that carry an interactive scene today.
 *
 * The destination is all twelve -- CLAUDE.md asks for a simulation on every
 * week -- and this list is being walked up one week at a time as each set is
 * built. It is an exact list rather than a lower bound so that a scene cannot
 * quietly appear on a week nobody designed one for, and so that forgetting to
 * extend it is a failing test rather than an unnoticed gap.
 */
const WEEKS_WITH_A_SCENE = [1, 2, 3, 4, 5, 6, 8, 10];

describe("every simulation demonstrates something", () => {
  it("renders a simulation on each week that claims one, and nowhere unexpected", () => {
    const lecturePages = withSim
      .map((page) => page.path)
      .filter((path) => path.startsWith("/lectures/"))
      .sort();
    expect(lecturePages).toEqual(
      WEEKS_WITH_A_SCENE.map((week) => `/lectures/week-${String(week).padStart(2, "0")}/index.html`),
    );
  });

  it("gives every simulation a 'what to watch' caption with real content", () => {
    expect(withSim.length).toBeGreaterThan(0);
    for (const page of withSim) {
      const captions = [...page.html.matchAll(/What to watch:<\/b>([\s\S]*?)<\/figcaption>/g)]
        .map((match) => match[1].replace(/<[^>]*>/g, "").trim());
      const sims = (page.html.match(/data-qsim(?![-\w])/g) ?? []).length;

      expect(captions.length, `${page.path} has ${sims} simulation(s) but ${captions.length} caption(s)`)
        .toBe(sims);
      for (const caption of captions) {
        expect(caption.length, `${page.path} has a caption too short to be telling anyone anything`)
          .toBeGreaterThan(80);
      }
    }
  });

  it("gives every simulation canvas a text alternative", () => {
    for (const page of withSim) {
      const canvases = [...page.html.matchAll(/<canvas[^>]*>/g)].map((m) => m[0]);
      expect(canvases.length).toBeGreaterThan(0);
      for (const canvas of canvases) {
        expect(canvas, `${page.path} has a canvas with no role="img"`).toContain('role="img"');
        const alt = /aria-label="([^"]*)"/.exec(canvas)?.[1] ?? "";
        expect(alt.length, `${page.path} has a canvas with a thin or missing aria-label`)
          .toBeGreaterThan(60);
      }
    }
  });
});
