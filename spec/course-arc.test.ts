import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// SLOP2710 promises a semester that compounds: twelve weeks, each introducing
// one new ordering idea and naming the earlier week it stands on. The build can
// tell whether a page renders. It cannot tell whether the argument holds
// together, and "holds together" is the whole claim of this course -- so it is
// asserted here instead.

interface ApiNode {
  id: string;
  type: string;
  meta?: Record<string, unknown>;
}

interface CourseApi {
  nodes: ApiNode[];
}

const api = JSON.parse(readFileSync(resolve("dist/api/index.json"), "utf8")) as CourseApi;
const nodesOf = (type: string) => api.nodes.filter((node) => node.type === type);
const weekOf = (node: ApiNode) => Number(node.meta?.week);
const dateOnly = (value: unknown): string => String(value).slice(0, 10);

// Semester 1, 2027: six teaching weeks, a two-week break, six more. Every
// teaching week falls on a Monday. Weeks 7-12 are shifted by the break, which
// is the single most common way a hand-maintained schedule drifts.
const MONDAYS = [
  "2027-02-22", // 1
  "2027-03-01", // 2
  "2027-03-08", // 3
  "2027-03-15", // 4
  "2027-03-22", // 5
  "2027-03-29", // 6
  // break: 2027-04-05, 2027-04-12
  "2027-04-19", // 7
  "2027-04-26", // 8
  "2027-05-03", // 9
  "2027-05-10", // 10
  "2027-05-17", // 11
  "2027-05-24", // 12
];

describe("the semester is twelve dated weeks", () => {
  for (const type of ["lectures", "sessions"] as const) {
    it(`has exactly one ${type.slice(0, -1)} per week, 1 to 12`, () => {
      const byWeek = nodesOf(type).map(weekOf).sort((a, b) => a - b);
      expect(byWeek).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it(`dates every ${type.slice(0, -1)} on its week's Monday`, () => {
      for (const node of nodesOf(type)) {
        const expected = MONDAYS[weekOf(node) - 1];
        expect(dateOnly(node.meta?.date), `${node.id} is not on the week ${weekOf(node)} Monday`)
          .toBe(expected);
      }
    });
  }

  it("pairs each lecture with the lab of the same week", () => {
    const lectureWeeks = nodesOf("lectures").map(weekOf).sort((a, b) => a - b);
    const labWeeks = nodesOf("sessions").map(weekOf).sort((a, b) => a - b);
    expect(labWeeks).toEqual(lectureWeeks);
  });
});

describe("the arc compounds", () => {
  it("gives every week an act, an idea and a primary system", () => {
    for (const node of nodesOf("lectures")) {
      expect(node.meta?.act, `${node.id} declares no act`).toMatch(/^(I|II|III)$/);
      expect(String(node.meta?.idea ?? "").length, `${node.id} declares no idea`)
        .toBeGreaterThan(20);
      expect(String(node.meta?.system ?? "").length, `${node.id} declares no primary system`)
        .toBeGreaterThan(3);
    }
  });

  it("builds each week on a strictly earlier one, and starts week 1 from nothing", () => {
    for (const node of nodesOf("lectures")) {
      const week = weekOf(node);
      const buildsOn = node.meta?.buildsOn;

      if (week === 1) {
        expect(buildsOn, "week 1 must not build on anything").toBeUndefined();
        continue;
      }

      const earlier = Number(buildsOn);
      expect(Number.isInteger(earlier), `${node.id} declares no buildsOn`).toBe(true);
      expect(earlier, `${node.id} builds on week ${earlier}, which is not earlier`)
        .toBeLessThan(week);
      expect(earlier, `${node.id} builds on week ${earlier}, which is not a real week`)
        .toBeGreaterThanOrEqual(1);
    }
  });

  it("leaves no week unreachable from week 1", () => {
    // Following buildsOn from any week must terminate at week 1. A cycle is
    // impossible given the strictly-earlier rule above, so this is really a
    // check that no week points into a gap.
    const parent = new Map<number, number>();
    for (const node of nodesOf("lectures")) {
      const week = weekOf(node);
      if (week !== 1) parent.set(week, Number(node.meta?.buildsOn));
    }
    for (let week = 2; week <= 12; week++) {
      const seen: number[] = [week];
      let cursor = week;
      while (cursor !== 1) {
        const next = parent.get(cursor);
        expect(next, `week ${cursor} has no route back to week 1 (via ${seen.join(" -> ")})`)
          .toBeDefined();
        cursor = next as number;
        seen.push(cursor);
      }
    }
  });

  it("never runs the same primary system as the headline twice", () => {
    // The brief this course was built against warns that repetitive weeks read
    // as one template refilled. Reusing a system is allowed and encouraged as a
    // callback -- week 10 is deliberately the week 2 aircraft again -- but only
    // one week may claim it as its headline example.
    const systems = nodesOf("lectures").map((node) => String(node.meta?.system).toLowerCase());
    const duplicates = systems.filter((system, index) => systems.indexOf(system) !== index);
    expect(duplicates, `these systems headline more than one week: ${duplicates.join(", ")}`)
      .toEqual([]);
  });
});

describe("assessment adds up", () => {
  it("totals exactly 100% across the course", () => {
    // The content schema caps each assessment at 100 and checks that a weighted
    // marking block's criteria sum to 100. Nothing checks the course total.
    const total = nodesOf("assessments").reduce(
      (sum, node) => sum + Number(node.meta?.weight ?? 0),
      0,
    );
    expect(total).toBe(100);
  });

  it("falls due in a week the material has already been taught in", () => {
    for (const node of nodesOf("assessments")) {
      const week = weekOf(node);
      expect(week, `${node.id} is due before teaching starts`).toBeGreaterThanOrEqual(1);
      const due = dateOnly(node.meta?.due);
      expect(due >= MONDAYS[week - 1], `${node.id} is due before its own week begins`).toBe(true);
    }
  });
});
