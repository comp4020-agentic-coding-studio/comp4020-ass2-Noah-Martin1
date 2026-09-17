/**
 * Week 3: airport security, and Little's Law demonstrated rather than asserted.
 *
 * L = lambda W is a fact about rectangles, and the lecture proves it by
 * measuring one area two ways: cut the shaded region into vertical strips and
 * you are asking how many people are here right now, which averages to L; cut
 * it into horizontal strips and you are asking how long this person stayed,
 * which averages to W. The old figure drew those two cuts on an abstract chart
 * of bars. This scene puts them on the queue itself.
 *
 *   count   a sweep runs the length of the line and tallies heads. That is the
 *           vertical cut, and it is also literally what beat 1 tells the reader
 *           to do while standing there: count one switchback and multiply.
 *   follow  one traveller turns pink and carries a running clock from the
 *           moment they join to the moment they clear the arch. That is the
 *           horizontal cut.
 *
 * And the readout is the proof. It prints L, the observed throughput, L divided
 * by that throughput, and the separately measured mean time in the system. The
 * third and fourth columns agree to two decimal places at every load the slider
 * can reach, which is a claim the reader can check rather than accept.
 *
 * Measured, five seeds, two lanes at forty-five seconds a traveller:
 *
 *   travellers/min   rho    L     L/lambda   W        W90
 *   1.60             0.60   1.9   1.21 min   1.21     2.69
 *   2.14             0.80   4.1   1.97 min   1.97     4.31
 *   2.40             0.90   8.5   3.63 min   3.63     8.30
 *   2.53             0.95  15.1   6.10 min   6.09    14.25
 *
 * That last row is the lecture's own worked example -- a six-minute wait -- and
 * it arrived by picking a plausible airport rather than by fitting to the
 * answer. Two lanes and forty-five seconds is a regional airport at a busy
 * hour, not Heathrow; the law does not care, which is the point of the week.
 */

import { QueueSim, type Customer } from "../../queue-sim";
import { converge, type Converged } from "../stats";
import { pathLength, pointAt, type Path } from "../path";
import { project, type Extent } from "../project";
import {
  Stage,
  box3,
  chip,
  darken,
  ground,
  label,
  mix,
  person,
  plant,
  softShadow,
  textSize,
  tints,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/** One tick is one second, so a forty-five second screening is forty-five ticks. */
const TICK_SECONDS = 1;
const SERVICE_TICKS = 45;
/** Two arches. A regional airport, deliberately: it fits on a page. */
const SERVERS = 2;

/**
 * The hall, in metres.
 *
 * Tight around the checkpoint on purpose. The first pass gave it twenty metres
 * square with the back wall well behind the arches, and the result was a scene
 * crammed into the right-hand third of the frame with an empty floor and a
 * three-metre wall wedge filling the rest. Nothing in an extent is free: every
 * metre of unused hall is camera scale taken off the people.
 */
const HALL: Extent = { x0: 6.2, x1: 19.6, y0: 3.0, y1: 16, z1: 3.2 };
const WALL = 3.0;

/**
 * Metres between people.
 *
 * Wider than anyone stands in a real queue, and wider again than week 1's cafe
 * uses, because a dozen people at a realistic spacing in a switchback came out
 * as one crowd rather than a line with corners in it -- and the corners are the
 * thing that says airport.
 */
const SPACING = 1.05;

/** Where each arch stands, and where the traveller in it is. */
const ARCHES = [11.4, 15.4] as const;
const ARCH_Y = 13.6;

/**
 * The snake, head first. Sixteen metres of barrier, two switchbacks.
 *
 * Sized to the queue rather than to a real hall. Three rows of six metres --
 * the first attempt -- hold forty people, and at the busiest setting this
 * slider reaches there are thirteen, so two thirds of the barriers stood empty
 * and the scene read as a closed airport. Two five-metre rows are nearly full
 * at that setting and turn two corners at the setting the week is about, which
 * is what makes a row of pegs read as a queue rather than a crowd.
 */
const SNAKE: Path = [
  [13.2, 11.2],
  [13.2, 9.2],
  [8.2, 9.2],
  [8.2, 7.0],
  [13.2, 7.0],
  [13.2, 4.6],
];

/** Half the width of the barriered lane. */
const LANE_HALF = 0.62;

export interface SecurityModel {
  sim: QueueSim;
  stats: Converged;
  /** Travellers a minute, for the readout. */
  perMinute: number;
  mode: "count" | "follow";
  /** The traveller the follow overlay is timing, and their finished total. */
  followId: number;
  finished: { total: number; at: number } | null;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): SecurityModel {
  const perMinute = controls.num("rush", 2.5);
  const mode = (controls.str("mode", "count") as "count" | "follow") ?? "count";
  const config = {
    seed: 7,
    lanes: 1,
    servers: SERVERS,
    mu: 1 / SERVICE_TICKS,
    lambda: (perMinute * TICK_SECONDS) / 60,
    arrivalCv: 1,
    serviceCv: 1,
  };
  return {
    sim: new QueueSim(config),
    stats: converge(config),
    perMinute,
    mode,
    followId: 0,
    finished: null,
  };
}

/** Everyone currently inside the system, waiting or at an arch. */
function inside(m: SecurityModel): Customer[] {
  const held = (m.sim.busy[0] ?? []).filter((c): c is Customer => Boolean(c));
  return [...held, ...(m.sim.queues[0] ?? [])];
}

function step(m: SecurityModel): void {
  const before = inside(m).find((c) => c.id === m.followId);
  m.sim.step();
  const after = inside(m).find((c) => c.id === m.followId);

  if (before && !after) {
    // They cleared the arch. Hold the total on screen before picking another,
    // because the number is the whole reason the overlay exists.
    m.finished = { total: m.sim.tick - before.arrivedAt, at: m.sim.tick };
  }
  if (!after && (!m.finished || m.sim.tick - m.finished.at > 90)) {
    const queue = m.sim.queues[0] ?? [];
    const fresh = queue[queue.length - 1];
    if (fresh) {
      m.followId = fresh.id;
      m.finished = null;
    }
  }
}

// --- the set ---------------------------------------------------------------

/** Floor, walls, and the sign that says where you are. */
function shell(f: Frame<SecurityModel>): void {
  const { c, cam, p } = f;
  const t = tints(p);

  ground(c, cam, p, HALL);

  box3(
    c,
    cam,
    { x: HALL.x0, y: HALL.y1 - 0.2, w: HALL.x1 - HALL.x0, d: 0.2, h: WALL },
    { fill: mix(t.stone, p.bg, 0.42), contrast: 0.12 },
  );
  // No side wall. A security hall opens onto the concourse, and the one this
  // scene had was a three-metre parallelogram occupying a third of the frame
  // to say nothing.

  // A board on the back wall. One prop, and the hall stops being a generic box.
  box3(
    c,
    cam,
    { x: 7.4, y: HALL.y1 - 0.26, w: 3.2, d: 0.06, h: 0.8, z: 1.75 },
    { fill: t.screen, contrast: 0.1 },
  );
  if (cam.s > 14) {
    // Left of both arches in screen space. Centred on the wall it sat directly
    // behind the near portal, which reads as a sign hanging off a scanner.
    const at = project(cam, 9.0, HALL.y1 - 0.28, 2.1);
    label(c, "SECURITY", at.x, at.y, p.gold, textSize(cam, 11, 8), "center", "700");
  }
}

/**
 * The barriered lane: a floor strip, a retractable tape down each side, and a
 * post at every corner. This is what makes a line of pegs read as an airport
 * rather than a crowd -- the snake is the recognisable object, not the people.
 */
function barriers(f: Frame<SecurityModel>, st: Stage): void {
  const { c, cam, p } = f;
  const t = tints(p);

  for (let i = 1; i < SNAKE.length; i++) {
    const [x0, y0] = SNAKE[i - 1];
    const [x1, y1] = SNAKE[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.01) continue;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    // Perpendicular, for the two sides of the lane.
    const px = -uy * LANE_HALF;
    const py = ux * LANE_HALF;

    const floor = [
      project(cam, x0 + px, y0 + py, 0.01),
      project(cam, x1 + px, y1 + py, 0.01),
      project(cam, x1 - px, y1 - py, 0.01),
      project(cam, x0 - px, y0 - py, 0.01),
    ];
    c.beginPath();
    floor.forEach((pt, j) => (j ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
    c.closePath();
    c.fillStyle = mix(p.ground, p.ink, 0.07);
    c.fill();

    // The tape, at hip height on both sides.
    c.strokeStyle = withAlpha(p.gold, 0.55);
    c.lineWidth = 1.5;
    for (const sign of [1, -1]) {
      const a = project(cam, x0 + px * sign, y0 + py * sign, 0.92);
      const b = project(cam, x1 + px * sign, y1 + py * sign, 0.92);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
  }

  // Posts at the corners, in the depth sort so the queue passes in front of
  // the near ones and behind the far ones.
  for (const [cx, cy] of SNAKE) {
    for (const sign of [1, -1]) {
      for (const [ox, oy] of [
        [LANE_HALF * sign, 0],
        [0, LANE_HALF * sign],
      ]) {
        const x = cx + ox;
        const y = cy + oy;
        st.add(x, y, () =>
          box3(
            c,
            cam,
            { x: x - 0.06, y: y - 0.06, w: 0.12, d: 0.12, h: 0.95 },
            { fill: darken(t.metal, 0.2), contrast: 0.18 },
          ),
        );
      }
    }
  }
}

/** Two arches, their belt tables, and the officers beside them. */
function checkpoint(f: Frame<SecurityModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  ARCHES.forEach((ax, i) => {
    const serving = Boolean(model.sim.busy[0]?.[i]);

    st.add(ax, ARCH_Y + 1.2, () => {
      // The portal: two posts and a lintel.
      for (const dx of [-0.95, 0.83]) {
        box3(
          c,
          cam,
          { x: ax + dx, y: ARCH_Y, w: 0.22, d: 0.5, h: 2.25 },
          { fill: mix(t.stone, p.bg, 0.12), edge: withAlpha(p.ink, 0.22), contrast: 0.2 },
        );
      }
      box3(
        c,
        cam,
        { x: ax - 0.95, y: ARCH_Y, w: 2.0, d: 0.5, h: 0.4, z: 2.25 },
        { fill: mix(t.stone, p.bg, 0.05), edge: withAlpha(p.ink, 0.22), contrast: 0.2 },
      );
      // A lamp on the lintel: green while the arch is clear.
      const lamp = project(cam, ax + 0.52, ARCH_Y - 0.01, 2.45);
      c.beginPath();
      c.arc(lamp.x, lamp.y, Math.max(1.5, cam.s * 0.05), 0, Math.PI * 2);
      c.fillStyle = serving ? p.gold : p.green;
      c.fill();
    });

    // The belt table in front of the arch, with trays on it.
    st.add(ax, ARCH_Y - 1.2, () => {
      softShadow(c, cam, p, ax, ARCH_Y - 1.2, 1.0, 0.45);
      box3(
        c,
        cam,
        { x: ax - 0.85, y: ARCH_Y - 1.7, w: 1.7, d: 1.0, h: 0.82 },
        { fill: darken(t.metal, 0.15), contrast: 0.22 },
      );
      for (let j = 0; j < 3; j++) {
        box3(
          c,
          cam,
          {
            x: ax - 0.72 + j * 0.52,
            y: ARCH_Y - 1.58,
            w: 0.44,
            d: 0.7,
            h: 0.1,
            z: 0.82,
          },
          { fill: mix(t.metal, p.bg, 0.25), contrast: 0.2 },
        );
      }
    });

    // An officer beside each arch, in a dark uniform. Not gold: gold means
    // "in service" everywhere in this course, and the officer never is.
    const ox = ax + 1.55;
    st.add(ox, ARCH_Y + 0.4, () =>
      person(c, cam, p, ox, ARCH_Y + 0.4, {
        coat: mix(p.ink, p.bg, 0.24),
        skin: mix(t.skin, p.ink, 0.1 + i * 0.16),
        hair: darken(t.wood, 0.5),
      }),
    );
  });
}

// --- the travellers --------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.25),
    mix(p.green, p.bg, 0.28),
    t.cloth,
    mix(p.ink, p.bg, 0.5),
    darken(t.clay, 0.12),
    mix(p.bg, p.ink, 0.22),
  ];
  return coats[id % coats.length];
}

/**
 * Everyone in the hall, and where they are.
 *
 * Returns the distance along the snake at which each waiting traveller stands,
 * so the count overlay can decide who the sweep has already passed without
 * recomputing the layout.
 */
function travellers(
  f: Frame<SecurityModel>,
  st: Stage,
  marked: (customer: Customer, d: number) => boolean,
): Map<number, number> {
  const { c, cam, p, model } = f;
  const t = tints(p);
  const at = new Map<number, number>();

  const draw = (x: number, y: number, customer: Customer, pink: boolean, gold: boolean) => {
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.26);
      person(c, cam, p, x, y, {
        // A marked traveller wears the concept pink -- the same pink that
        // highlights a phrase in the prose and carries a number on a chip. A
        // dot floating over their head was the first attempt and it was
        // invisible at twelve pixels; recolouring the person is not.
        coat: pink ? p.pinkEdge : gold ? p.gold : coatFor(p, customer.id),
        edge: pink ? darken(p.pinkEdge, 0.3) : undefined,
        skin: mix(t.skin, p.ink, (customer.id % 4) * 0.12),
        hair: customer.id % 3 === 0 ? undefined : darken(coatFor(p, customer.id + 1), 0.32),
        carry: customer.id % 4 === 0 ? mix(t.wood, p.ink, 0.2) : undefined,
      });
    });
  };

  // At the arches.
  ARCHES.forEach((ax, i) => {
    const held = model.sim.busy[0]?.[i];
    if (!held) return;
    at.set(held.id, -1);
    draw(ax - 0.05, ARCH_Y + 0.1, held, marked(held, -1), true);
  });

  void model;
  // Waiting, from the head of the snake backwards.
  const room = pathLength(SNAKE) + SPACING;
  (model.sim.queues[0] ?? []).forEach((customer, i) => {
    const d = SPACING * 0.4 + i * SPACING;
    if (d > room) return;
    at.set(customer.id, d);
    const where = pointAt(SNAKE, d);
    draw(where.x, where.y, customer, marked(customer, d), false);
  });

  return at;
}

// --- the two cuts ----------------------------------------------------------

/** Ticks for one pass of the counting sweep, plus the pause on the total. */
const SWEEP_TICKS = 150;
const SWEEP_HOLD = 45;

/** Where a waiting traveller stands, by their place in the queue. */
const standAt = (i: number) => SPACING * 0.4 + i * SPACING;

interface Sweep {
  /** Distance along the snake the cut has reached, or null while holding. */
  cut: number | null;
  /** How many the sweep has passed, including everyone at an arch. */
  counted: number;
  total: number;
}

/**
 * The state of the counting sweep for this frame.
 *
 * Computed before anything is drawn, because who has been counted decides what
 * colour they are, and the people are painted inside the depth sort long
 * before any annotation gets a look in.
 */
function sweep(m: SecurityModel, tick: number): Sweep {
  const waiting = m.sim.queues[0] ?? [];
  const held = (m.sim.busy[0] ?? []).filter(Boolean).length;
  const back = waiting.length > 0 ? standAt(waiting.length - 1) : 0;
  const phase = tick % (SWEEP_TICKS + SWEEP_HOLD);
  if (phase >= SWEEP_TICKS) {
    return { cut: null, counted: waiting.length + held, total: waiting.length + held };
  }
  const cut = (back + SPACING) * (1 - phase / SWEEP_TICKS);
  return {
    cut,
    counted: waiting.filter((_, i) => standAt(i) >= cut).length + held,
    total: waiting.length + held,
  };
}

/**
 * The vertical cut: a plane sweeps from the back of the line to the front,
 * turning everyone it passes pink and tallying as it goes, then holds the
 * total before starting again.
 *
 * This is the measurement beat 1 asks the reader to make while standing in the
 * queue, and doing it on the queue is the whole reason the picture is a hall
 * rather than a chart of bars.
 */
function countCut(f: Frame<SecurityModel>, sw: Sweep): void {
  const { c, cam, p, w } = f;

  if (sw.cut !== null) {
    const where = pointAt(SNAKE, sw.cut);
    const px = -where.dy * (LANE_HALF + 0.4);
    const py = where.dx * (LANE_HALF + 0.4);
    const a = project(cam, where.x + px, where.y + py, 0.02);
    const b = project(cam, where.x - px, where.y - py, 0.02);
    const aTop = project(cam, where.x + px, where.y + py, 2.1);
    const bTop = project(cam, where.x - px, where.y - py, 2.1);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.lineTo(bTop.x, bTop.y);
    c.lineTo(aTop.x, aTop.y);
    c.closePath();
    c.fillStyle = withAlpha(p.pink, 0.3);
    c.fill();
    c.strokeStyle = p.pinkEdge;
    c.lineWidth = 2;
    c.stroke();
  }

  const tag = project(cam, HALL.x0 + 0.2, HALL.y1 - 3.4, 1.7);
  chip(
    c,
    p,
    sw.cut === null ? `${sw.counted} in the hall — that is L` : `counting… ${sw.counted}`,
    tag.x,
    tag.y,
    textSize(cam, 11, 9),
    w,
  );
}

/**
 * The horizontal cut: one traveller, timed from the moment they join to the
 * moment they clear the arch, with the stretch of queue they have already
 * walked marked behind them.
 */
function followCut(f: Frame<SecurityModel>, at: Map<number, number>): void {
  const { c, cam, p, model, w } = f;
  const clock = (ticks: number) => {
    const s = Math.round(ticks * TICK_SECONDS);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  if (model.finished) {
    const tag = project(cam, HALL.x0 + 0.2, HALL.y1 - 3.4, 1.7);
    chip(
      c,
      p,
      `cleared in ${clock(model.finished.total)} — that is one W`,
      tag.x,
      tag.y,
      textSize(cam, 11, 9),
      w,
    );
    return;
  }

  const target = inside(model).find((customer) => customer.id === model.followId);
  if (!target) return;
  const d = at.get(target.id);
  if (d === undefined) return;

  // The distance they have already covered, drawn along the lane behind them.
  if (d >= 0) {
    const back = Math.max(...[...at.values()].filter((v) => v >= 0), d);
    c.strokeStyle = withAlpha(p.pinkEdge, 0.85);
    c.lineWidth = 3;
    c.beginPath();
    for (let s = d; s <= back + 0.01; s += 0.3) {
      const pt = pointAt(SNAKE, s);
      const at2 = project(cam, pt.x, pt.y, 0.03);
      if (s === d) c.moveTo(at2.x, at2.y);
      else c.lineTo(at2.x, at2.y);
    }
    c.stroke();
  }

  const spot = d >= 0 ? pointAt(SNAKE, d) : { x: ARCHES[0], y: ARCH_Y };
  const head = project(cam, spot.x, spot.y, 2.35);
  chip(
    c,
    p,
    d >= 0
      ? `${clock(model.sim.tick - target.arrivedAt)} in the line`
      : `${clock(model.sim.tick - target.arrivedAt)}, at the arch`,
    head.x - 20,
    head.y,
    textSize(cam, 10, 8),
    w,
  );
}

// --- the scene -------------------------------------------------------------

const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(2)} min`;

export const security: SceneDef<SecurityModel> = {
  height: 330,
  minHeight: 175,
  warm: 3000,
  // Forty-five ticks a screening, so this is a traveller clearing the arch
  // about every two seconds -- slow enough to watch one person move.
  rate: 26,
  controls: [
    {
      kind: "range",
      key: "rush",
      label: "Travellers a minute",
      min: 1.6,
      max: 2.5,
      step: 0.05,
      value: 2.5,
      format: (v) => `${v.toFixed(2)}/min`,
    },
    {
      kind: "select",
      key: "mode",
      label: "Measure",
      value: "count",
      options: [
        { value: "count", label: "Count the line (L)" },
        { value: "follow", label: "Time one traveller (W)" },
      ],
    },
  ],
  readout: [
    { key: "L", term: "L" },
    { key: "lambda", term: "λ" },
    { key: "LoverLambda", term: "L", sub: "÷ λ" },
    { key: "W", term: "W" },
    { key: "W90", term: "W", sub: "90" },
  ],
  build,
  step,
  representative: (m) =>
    m.stats.over || Math.abs(m.sim.inSystem - m.stats.L) <= Math.max(1, m.stats.L * 0.25),
  extent: () => HALL,
  report: (m) => {
    if (m.stats.over) {
      return { L: "grows", lambda: "—", LoverLambda: "no limit", W: "no limit", W90: "no limit" };
    }
    return {
      L: m.stats.L.toFixed(1),
      lambda: `${((m.stats.lambda * 60) / TICK_SECONDS).toFixed(2)}/min`,
      LoverLambda: mins(m.stats.L / m.stats.lambda),
      W: mins(m.stats.W),
      W90: mins(m.stats.W90),
    };
  },
  regions: {
    /** The snake, for a later week that needs a wait it can put a price on. */
    snake: { x0: 7.3, x1: 14.2, y0: 3.8, y1: 10.6, z1: 2.4 },
    /** The arches. */
    arch: { x0: 9.4, x1: 18.0, y0: 10.8, y1: 15.8, z1: 3.0 },
  },
  draw(f) {
    const st = new Stage();
    shell(f);
    barriers(f, st);

    // Both clear of the queue's sight lines: one to the right of it at a lower
    // depth, one well to the left of its leftmost barrier.
    // Both to the right of the snake, where the depth shear guarantees they
    // are painted behind it rather than over it.
    for (const [x, y, scale, seed] of [
      [18.4, 5.0, 1.1, 3],
      [18.8, 12.0, 1.0, 11],
    ] as const) {
      st.add(x, y, () => {
        softShadow(f.c, f.cam, f.p, x, y, 0.45);
        plant(f.c, f.cam, f.p, x, y, scale, seed);
      });
    }

    checkpoint(f, st);

    if (f.model.mode === "count") {
      const sw = sweep(f.model, f.tick);
      travellers(f, st, (_, d) => sw.cut !== null && d >= sw.cut);
      st.paint();
      countCut(f, sw);
    } else {
      const at = travellers(f, st, (customer) => customer.id === f.model.followId);
      st.paint();
      followCut(f, at);
    }
  },
};
