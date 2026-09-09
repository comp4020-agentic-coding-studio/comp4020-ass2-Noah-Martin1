import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The submitted site must be this course and nothing else. That sounds like it
// needs no checking, until a deleted starter file reappears on disk -- which is
// exactly what happened while this course was being built. Astro's content
// loader globs the filesystem, so a stray src/content/*.md renders a real page,
// generates a real API node, and passes every build gate silently.
//
// check:evidence greps TRACKED files for STARTER_CONTENT, so an untracked
// resurrection slips past it too. This asserts against the built output
// instead, where nothing can hide.

interface ApiNode {
  id: string;
  type: string;
  meta?: Record<string, unknown>;
}

const api = JSON.parse(
  readFileSync(resolve("dist/api/index.json"), "utf8"),
) as { nodes: ApiNode[] };

const idsOf = (type: string) =>
  api.nodes.filter((node) => node.type === type).map((node) => node.id).sort();

describe("the built site is this course and nothing else", () => {
  it("publishes exactly the twelve lectures and twelve labs it declares", () => {
    const expected = Array.from({ length: 12 }, (_, i) =>
      `week-${String(i + 1).padStart(2, "0")}`,
    );
    expect(idsOf("lectures")).toEqual(expected.map((w) => `lectures/${w}`));
    expect(idsOf("sessions")).toEqual(expected.map((w) => `sessions/${w}`));
  });

  it("publishes exactly the four assessments", () => {
    expect(idsOf("assessments")).toEqual([
      "assessments/01-queue-census",
      "assessments/02-ordering-rule",
      "assessments/03-simulation-report",
      "assessments/04-design-brief",
    ]);
  });

  it("publishes exactly the three staff, with roles the person page can render", () => {
    // src/pages/people/[slug].astro maps role through a hardcoded lookup, so a
    // role outside this set renders no role row at all -- silently.
    const people = api.nodes.filter((node) => node.type === "people");
    expect(people.map((p) => p.id).sort()).toEqual([
      "people/adaeze-nkemelu",
      "people/priya-raghunathan",
      "people/tomas-rehak",
    ]);
    for (const person of people) {
      expect(["convenor", "tutor", "guest"], `${person.id} has an unrenderable role`)
        .toContain(String(person.meta?.role));
    }
  });

  it("leaves no starter marker anywhere in the generated API", () => {
    const raw = readFileSync(resolve("dist/api/index.json"), "utf8");
    expect(raw).not.toContain("STARTER_CONTENT");
    expect(raw).not.toContain("Course Title Goes Here");
  });
});
