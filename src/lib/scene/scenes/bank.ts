/**
 * Week 5: a bank branch, and the teller nobody can reach.
 *
 * Around 1970 banks replaced one queue per teller with a single queue feeding
 * every teller, and had to put up posters explaining it, because the new line
 * looked worse. It was longer. It was one line of thirty instead of six lines
 * of five, and the thirty were the same thirty.
 *
 * This scene is that branch, and the selector is the re-roping. The same four
 * tellers, the same arrival rate, two arrangements of the same velvet rope:
 *
 *   four lines  one rope per window, no switching. The generous version of
 *               parallel queues -- real customers jockey, and jockeying
 *               recovers part of the gap but never all of it, because you can
 *               only switch after you have already lost the time that told you
 *               to.
 *   one line    a single snake, and whoever is at the front takes the next
 *               free window.
 *
 * The overlay is the mechanism, not the outcome. A teller with nobody in front
 * of them while somebody is waiting two metres away in the next lane is
 * *stranded*: they are being paid, the customer is waiting, and the two cannot
 * meet. Those windows go pink, a dashed line runs from the idle window to the
 * person who should have been at it, and a chip counts the teller-minutes.
 * Flip to one line and the count is not small -- it is structurally zero. If
 * anyone is waiting, no window is free. That is the whole of the gain.
 *
 * Measured, five seeds, four tellers at three minutes a transaction:
 *
 *   /hr   rho    W one    W four   W90 one   W90 four   stranded
 *    52   0.65   3.7 min   8.2     8.1       18.8       1.15 tellers, 69 min/hr
 *    58   0.73   4.1      10.2     8.8       23.4       1.04 tellers, 62 min/hr
 *    64   0.80   4.8      13.1    10.4       29.9       0.85 tellers, 51 min/hr
 *    70   0.88   6.1      18.8    13.2       42.9       0.61 tellers, 37 min/hr
 *    74   0.93   8.0      26.9    17.4       61.6       0.44 tellers, 26 min/hr
 *    76   0.95   9.7      34.0    21.2       77.9       0.35 tellers, 21 min/hr
 *
 * Two things in that table are worth more than the headline. The first is that
 * the headline is wrong in the usual telling: pooling does not cut the wait by
 * a third or a half, it cuts it by two thirds, and the gap widens as the branch
 * gets busier -- which is exactly when a manager is least able to afford it.
 * The second is the last column, which goes the other way. The quiet branch
 * wastes *more* tellers, not fewer: at 52 customers an hour you are paying for
 * four windows and one of them is permanently stranded.
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

/** Five seconds a tick, so a three-minute transaction is thirty-six ticks. */
const TICK_SECONDS = 5;
const SERVICE_TICKS = 36;
/** Four windows. Six would be the historical branch and a twenty-metre room. */
const TELLERS = 4;

/** The banking hall, in metres. */
const ROOM: Extent = { x0: 0, x1: 17, y0: 0.6, y1: 12.6, z1: 3.0 };
const WALL = 2.9;

/**
 * The counter. Set close to the back wall for the reason week 4's is: a metre
 * of depth shears half a metre left, and a counter standing out in the room
 * slides off the end of the wall behind it.
 */
const COUNTER = { y: 11.0, d: 0.95, h: 1.12 };
const GLASS_TOP = 2.45;
/**
 * Where the four windows are, and where the customer at one stands.
 *
 * Nearly four metres apart, which is wider than a real bank builds them and is
 * decided by the projection rather than by architecture. A lane of six people
 * runs five metres toward the viewer and the depth shear slides it three
 * metres left as it comes, so windows any closer together and the fourth lane
 * is standing inside the third. At 3.8 m there is a clear metre between them.
 */
const WINDOWS = [2.2, 6.0, 9.8, 13.6] as const;
const SERVED_Y = COUNTER.y - 0.72;
const TELLER_Y = COUNTER.y + COUNTER.d + 0.2;

/** Metres between people in a line. */
const SPACING = 0.85;

/**
 * One line: a single snake with one switchback, and whoever reaches the front
 * takes the next window that frees.
 *
 * Seven and a half metres of rope, which is short on purpose. The pooled line
 * holds three people at the setting this opens on and eight at the busiest the
 * slider reaches; week 3 learned that barrier nobody is standing in reads as a
 * closed building, so the rope is sized to the queue rather than to the room.
 */
const SNAKE: Path = [
  [7.3, 9.5],
  [7.3, 7.8],
  [11.6, 7.8],
  [11.6, 6.1],
];

/**
 * Four lines: one per window, running toward the viewer.
 *
 * The path is longer than the rope. At the busiest setting a lane holds nine
 * people and the rope holds seven, and the two that do not fit stand behind
 * the end of it -- which is what a branch looks like at lunchtime and is more
 * honest than pretending the room has a wall there.
 */
const laneFor = (i: number): Path => [
  [WINDOWS[i], 9.5],
  [WINDOWS[i], 1.2],
];
const ROPE_END = 6.0;
/** Half the width of a roped lane. */
const LANE_HALF = 0.62;

export type Layout = "four" | "one";

/**
 * Teller-minutes an hour spent idle while somebody is waiting in another lane.
 *
 * Not something converge() can report, because it is a property of the
 * *arrangement* rather than of the queue: it asks how often a server and a
 * customer who could have met did not. Measured the same way everything else
 * in this course is -- several seeds, a long run, cached by setting.
 *
 * Only ever asked about four lines. One line cannot produce the state at all:
 * the engine hands a freed server the next person in the queue on the same
 * tick, so "a window is free and somebody is waiting" has no representation.
 */
const strandedCache = new Map<number, number>();
function strandedPerHour(perHour: number): number {
  const hit = strandedCache.get(perHour);
  if (hit !== undefined) return hit;
  let tellers = 0;
  const seeds = [7, 11, 23];
  const TICKS = 120000;
  for (const seed of seeds) {
    const sim = new QueueSim({ ...configFor(perHour, "four"), seed });
    sim.run(4000);
    let idle = 0;
    for (let i = 0; i < TICKS; i++) {
      sim.step();
      if (sim.queues.reduce((n, q) => n + q.length, 0) === 0) continue;
      for (let lane = 0; lane < TELLERS; lane++) if (!sim.busy[lane][0]) idle++;
    }
    tellers += idle / TICKS;
  }
  const out = (tellers / seeds.length) * 60;
  strandedCache.set(perHour, out);
  return out;
}

export interface BankModel {
  sim: QueueSim;
  /** Both arrangements, always, so the readout can print the comparison. */
  one: Converged;
  four: Converged;
  /** The long-run stranding rate for four lines at this load. */
  rate: number;
  layout: Layout;
  perHour: number;
  /**
   * Teller-ticks stranded since the branch opened, warm-up included.
   *
   * Counted from tick zero rather than from the reader's first frame, and that
   * is the second attempt. Starting the count at the first frame was tidier and
   * useless: a window is stranded on 59% of ticks but the gaps are bunched, and
   * a reader who glances for eight seconds during one busy stretch reads
   * "0 teller-minutes" under a readout saying forty-seven an hour. Counting
   * from the top of the morning opens at a figure consistent with that rate and
   * visibly climbs, which is the number the week is actually about.
   */
  strandedTicks: number;
}

function configFor(perHour: number, layout: Layout) {
  return {
    seed: 7,
    lanes: layout === "one" ? 1 : TELLERS,
    servers: layout === "one" ? TELLERS : 1,
    mu: 1 / SERVICE_TICKS,
    lambda: perHour / (3600 / TICK_SECONDS),
    arrivalCv: 1,
    serviceCv: 1,
  };
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): BankModel {
  const perHour = Math.round(controls.num("rate", 70));
  const layout = (controls.str("layout", "four") as Layout) ?? "four";
  return {
    sim: new QueueSim(configFor(perHour, layout)),
    one: converge(configFor(perHour, "one")),
    four: converge(configFor(perHour, "four")),
    rate: strandedPerHour(perHour),
    layout,
    perHour,
    strandedTicks: 0,
  };
}

/** Lanes whose teller is free while somebody is waiting in another lane. */
function strandedLanes(m: BankModel): number[] {
  if (m.layout === "one") return [];
  const waiting = m.sim.queues.reduce((n, q) => n + q.length, 0);
  if (waiting === 0) return [];
  const out: number[] = [];
  for (let lane = 0; lane < TELLERS; lane++) {
    if (!m.sim.busy[lane]?.[0]) out.push(lane);
  }
  return out;
}

function step(m: BankModel): void {
  m.sim.step();
  m.strandedTicks += strandedLanes(m).length;
}

// --- the set ---------------------------------------------------------------

/** Floor, carpet, back wall, counter, glass, and the name over the door. */
function shell(f: Frame<BankModel>, st: Stage): void {
  const { c, cam, p } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  // The lobby carpet. One flat quad, no shading: it is the cheapest way to say
  // "bank" rather than "office", and it gives the ropes something to sit on.
  const carpet = [
    project(cam, 0.5, 1.0, 0.005),
    project(cam, 15.0, 1.0, 0.005),
    project(cam, 15.0, 10.1, 0.005),
    project(cam, 0.5, 10.1, 0.005),
  ];
  c.beginPath();
  carpet.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
  c.closePath();
  c.fillStyle = mix(p.ground, t.clay, 0.13);
  c.fill();

  box3(
    c,
    cam,
    { x: ROOM.x0, y: ROOM.y1 - 0.2, w: ROOM.x1, d: 0.2, h: WALL },
    { fill: mix(t.stone, p.bg, 0.4), contrast: 0.12 },
  );

  // The name, lit, high on the wall above the counter.
  // Between windows 2 and 3 and nowhere else. The sign sits on the wall and
  // the numbers sit on the glass, 1.3 m nearer the viewer, so the shear slides
  // the sign 0.7 m right of wherever its coordinates say it is -- and the first
  // draft, centred on the room, printed SLOPBANK straight through the 2.
  box3(
    c,
    cam,
    { x: 7.1, y: ROOM.y1 - 0.26, w: 3.0, d: 0.06, h: 0.74, z: 2.04 },
    { fill: t.screen, contrast: 0.1 },
  );
  if (cam.s > 19) {
    const at = project(cam, 8.6, ROOM.y1 - 0.28, 2.36);
    label(c, "SLOPBANK", at.x, at.y, p.gold, textSize(cam, 12, 9), "center", "700");
  }

  // A clock, high on the wall past the end of the counter.
  //
  // It replaces a night safe, which at this angle was a grey rectangle sitting
  // in the same pixels as the last panel of glass. A clock is unmistakable at
  // twenty pixels, it cannot collide with anything because it is above the
  // counter line, and in a course about waiting it is the correct prop.
  if (cam.s > 14) {
    const face = project(cam, 16.0, ROOM.y1 - 0.28, 2.05);
    const r = cam.s * 0.3;
    c.beginPath();
    c.arc(face.x, face.y, r, 0, Math.PI * 2);
    c.fillStyle = mix(p.bg, p.ground, 0.4);
    c.fill();
    c.strokeStyle = withAlpha(p.ink, 0.45);
    c.lineWidth = Math.max(1, r * 0.13);
    c.stroke();
    c.strokeStyle = withAlpha(p.ink, 0.75);
    c.lineWidth = Math.max(1, r * 0.11);
    for (const [ang, len] of [
      [-Math.PI / 3, 0.52],
      [Math.PI / 12, 0.74],
    ] as const) {
      c.beginPath();
      c.moveTo(face.x, face.y);
      c.lineTo(face.x + Math.cos(ang) * r * len, face.y + Math.sin(ang) * r * len);
      c.stroke();
    }
  }

  st.add(ROOM.x1 / 2, COUNTER.y, () => {
    // Timber body, stone top: a bank counter, not the passport office's desk.
    box3(
      c,
      cam,
      { x: 0.9, y: COUNTER.y, w: 14.3, d: COUNTER.d, h: COUNTER.h },
      { fill: t.wood, edge: withAlpha(p.ink, 0.18), contrast: 0.2 },
    );
    box3(
      c,
      cam,
      { x: 0.76, y: COUNTER.y - 0.08, w: 14.58, d: COUNTER.d + 0.16, h: 0.08, z: COUNTER.h },
      { fill: mix(t.stone, p.bg, 0.1), contrast: 0.22 },
    );

    // Full-height glazing with a gap at each window, and a speak-hole in the
    // gap. The gap is the only part of the building the public reaches through.
    const glassZ = COUNTER.h + 0.08;
    let at = 0.9;
    const stops: number[] = [];
    for (const wx of WINDOWS) {
      stops.push(at, wx - 0.62);
      at = wx + 0.62;
    }
    stops.push(at, 15.2);
    for (let i = 0; i < stops.length; i += 2) {
      const x0 = stops[i];
      const x1 = stops[i + 1];
      if (x1 - x0 < 0.05) continue;
      const quad = [
        project(cam, x0, COUNTER.y, glassZ),
        project(cam, x1, COUNTER.y, glassZ),
        project(cam, x1, COUNTER.y, GLASS_TOP),
        project(cam, x0, COUNTER.y, GLASS_TOP),
      ];
      c.beginPath();
      quad.forEach((q, j) => (j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = withAlpha(mix(p.bg, p.green, 0.16), 0.45);
      c.fill();
      c.strokeStyle = withAlpha(p.soft, 0.5);
      c.lineWidth = 1;
      c.stroke();
    }

    WINDOWS.forEach((wx, i) => {
      // The mullion each side of the window gap, and a number over it.
      for (const dx of [-0.66, 0.6]) {
        box3(
          c,
          cam,
          { x: wx + dx, y: COUNTER.y - 0.03, w: 0.06, d: 0.06, h: GLASS_TOP - glassZ, z: glassZ },
          { fill: darken(t.metal, 0.3), contrast: 0.14 },
        );
      }
      if (cam.s > 17) {
        const plate = project(cam, wx, COUNTER.y - 0.06, GLASS_TOP + 0.18);
        label(
          c,
          String(i + 1),
          plate.x,
          plate.y,
          withAlpha(p.soft, 0.85),
          textSize(cam, 10, 8),
          "center",
          "700",
        );
      }
    });
  });
}

/**
 * Velvet rope.
 *
 * The rope sags. It is two extra lines of maths and it is the single detail
 * that stops this reading as week 3's airport with different furniture --
 * retractable tape is taut and belongs to an airport; a slack rope between
 * brass posts belongs to a bank, a cinema and a nightclub, and a reader knows
 * which building they are in before they have read a word.
 */
function ropeRun(f: Frame<BankModel>, st: Stage, path: Path, end: number): void {
  const { c, cam, p } = f;
  const t = tints(p);
  const posts: Array<[number, number]> = [];

  // A runner of carpet inside the ropes.
  //
  // Without it four lanes of six people read as one crowd on a diagonal: the
  // depth shear slides each lane three metres left as it comes forward, so a
  // lane's tail lands beside the next lane's head and only a height difference
  // separates them. A strip of floor under each lane is what tells the eye
  // where one line stops and the next begins, and it costs one quad.
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg < 0.01) continue;
    const ux = (x1 - x0) / seg;
    const uy = (y1 - y0) / seg;
    const take = Math.min(seg, Math.max(0, end - run));
    run += seg;
    if (take < 0.05) continue;
    const px = -uy * LANE_HALF;
    const py = ux * LANE_HALF;
    const quad = [
      project(cam, x0 + px, y0 + py, 0.01),
      project(cam, x0 + ux * take + px, y0 + uy * take + py, 0.01),
      project(cam, x0 + ux * take - px, y0 + uy * take - py, 0.01),
      project(cam, x0 - px, y0 - py, 0.01),
    ];
    c.beginPath();
    quad.forEach((pt, j) => (j ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
    c.closePath();
    c.fillStyle = mix(p.ground, p.ink, 0.08);
    c.fill();
  }

  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg < 0.01) continue;
    const ux = (x1 - x0) / seg;
    const uy = (y1 - y0) / seg;
    const px = -uy * LANE_HALF;
    const py = ux * LANE_HALF;
    const run = Math.min(seg, Math.max(0, end - walked));
    walked += seg;
    if (run < 0.05) continue;

    // A post every two metres down each side, plus one at each corner.
    const n = Math.max(1, Math.round(run / 2.0));
    for (let s = 0; s <= n; s++) {
      const d = (run * s) / n;
      for (const sign of [1, -1]) {
        posts.push([x0 + ux * d + px * sign, y0 + uy * d + py * sign]);
      }
    }
  }

  // Ropes between consecutive posts on the same side. Posts alternate sides in
  // the list, so a stride of two walks one side.
  for (let i = 0; i + 2 < posts.length; i += 1) {
    const a = posts[i];
    const b = posts[i + 2];
    if (!a || !b) continue;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 2.6) continue;
    const from = project(cam, a[0], a[1], 0.94);
    const to = project(cam, b[0], b[1], 0.94);
    const sag = project(cam, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.62);
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.quadraticCurveTo(sag.x, sag.y, to.x, to.y);
    c.strokeStyle = withAlpha(mix(p.gold, p.ink, 0.45), 0.8);
    c.lineWidth = Math.max(1.2, cam.s * 0.028);
    c.stroke();
  }

  for (const [x, y] of posts) {
    st.add(x, y, () => {
      box3(
        c,
        cam,
        { x: x - 0.05, y: y - 0.05, w: 0.1, d: 0.1, h: 0.9 },
        { fill: darken(t.metal, 0.18), contrast: 0.2 },
      );
      // Brass cap. Gold means "in service" on a person; on a post it is brass,
      // and nothing else in the lobby is this small.
      box3(
        c,
        cam,
        { x: x - 0.08, y: y - 0.08, w: 0.16, d: 0.16, h: 0.1, z: 0.9 },
        { fill: mix(p.gold, p.ink, 0.15), contrast: 0.2 },
      );
    });
  }
}

/** The ropes for whichever arrangement is selected, and the sign at the head. */
function lobby(f: Frame<BankModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  if (model.layout === "one") {
    ropeRun(f, st, SNAKE, pathLength(SNAKE));
    // The sign that makes a single queue legible as one, at the tail where
    // people join rather than at the head where they leave.
    //
    // It started at the head, which is where a bank puts the "wait here" mark
    // -- and the head of this snake is half a metre in front of window 2, so
    // the board printed itself across the face of whoever was being served
    // there. The tail is empty floor in both arrangements.
    st.add(12.4, 6.1, () => {
      softShadow(c, cam, p, 12.4, 6.1, 0.22);
      box3(c, cam, { x: 12.35, y: 6.05, w: 0.1, d: 0.1, h: 1.1 }, { fill: darken(t.metal, 0.2) });
      box3(
        c,
        cam,
        { x: 12.0, y: 6.02, w: 0.82, d: 0.06, h: 0.34, z: 1.1 },
        { fill: t.screen, contrast: 0.1 },
      );
      if (cam.s > 21) {
        const at = project(cam, 12.41, 6.0, 1.22);
        label(c, "JOIN HERE", at.x, at.y, p.gold, textSize(cam, 8, 6), "center", "700");
      }
    });
  } else {
    for (let i = 0; i < TELLERS; i++) ropeRun(f, st, laneFor(i), ROPE_END);
  }

  // Two lobby figs, both well right of every queue, where the depth shear
  // guarantees they paint behind rather than over it.
  // One fig at the back of the lobby and a long planter across the front of
  // it, rather than two figs side by side -- at this angle the two stood 0.4 m
  // apart in screen space and read as one bush with two pots.
  //
  // Both are clear of the fourth lane, and clear in the way that matters: a
  // prop further back than a queue can only ever be hidden by it, which is
  // correct, while a prop in front of one hides people, which is not.
  st.add(16.0, 8.8, () => {
    softShadow(c, cam, p, 16.0, 8.8, 0.55);
    plant(c, cam, p, 16.0, 8.8, 1.35, 4);
  });
  st.add(16.3, 4.4, () => {
    softShadow(c, cam, p, 16.3, 4.4, 0.5, 0.28);
    box3(
      c,
      cam,
      { x: 15.9, y: 3.4, w: 0.8, d: 2.0, h: 0.42 },
      // Plain clay, the same terracotta the pots are. Mixed toward the ink it
      // came out brighter than every pot in the room in dark mode, where the
      // ink is nearly white.
      { fill: t.clay, contrast: 0.2 },
    );
    for (const gy of [3.8, 4.6]) {
      plant(c, cam, p, 16.3, gy, 0.52, gy > 4.2 ? 6 : 13);
    }
  });

  // The way in, bottom right: a mat and a post, so the lines have a door to
  // be reaching back toward.
  st.add(15.8, 2.2, () => {
    box3(c, cam, { x: 15.0, y: 1.7, w: 1.6, d: 1.05, h: 0.02 }, { fill: mix(t.metal, p.ink, 0.26) });
    box3(c, cam, { x: 14.5, y: 2.2, w: 0.1, d: 0.1, h: 0.95 }, { fill: darken(t.metal, 0.25) });
  });
}

// --- the people ------------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.26),
    mix(p.green, p.bg, 0.3),
    t.cloth,
    darken(t.clay, 0.12),
    mix(p.ink, p.bg, 0.5),
    mix(t.wood, p.ink, 0.22),
  ];
  return coats[id % coats.length];
}

function people(f: Frame<BankModel>, st: Stage, stranded: number[]): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  const customer = (x: number, y: number, who: Customer, gold: boolean) => {
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.26);
      person(c, cam, p, x, y, {
        coat: gold ? p.gold : coatFor(p, who.id),
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.12),
        hair: who.id % 3 === 0 ? undefined : darken(coatFor(p, who.id + 1), 0.32),
        carry: who.id % 3 === 1 ? mix(t.wood, p.ink, 0.2) : undefined,
      });
    });
  };

  WINDOWS.forEach((wx, i) => {
    const held = model.layout === "one" ? model.sim.busy[0]?.[i] : model.sim.busy[i]?.[0];
    const idle = stranded.includes(i);
    st.add(wx, TELLER_Y, () =>
      person(c, cam, p, wx, TELLER_Y, {
        // A stranded teller wears the concept pink, which is what pink means
        // everywhere in this course: a quantity the scene is reporting. A
        // marker floating over the window was the first attempt and vanished
        // at twelve pixels.
        coat: idle ? p.pinkEdge : mix(p.ink, p.bg, held ? 0.22 : 0.4),
        edge: idle ? darken(p.pinkEdge, 0.3) : undefined,
        skin: mix(t.skin, p.ink, 0.08 + (i % 3) * 0.14),
        hair: darken(t.wood, 0.3 + i * 0.08),
      }),
    );
    if (held) customer(wx, SERVED_Y, held, true);
  });

  if (model.layout === "one") {
    const room = pathLength(SNAKE) + SPACING * 4;
    (model.sim.queues[0] ?? []).forEach((who, i) => {
      const d = SPACING * 0.5 + i * SPACING;
      if (d > room) return;
      const where = pointAt(SNAKE, d);
      customer(where.x, where.y, who, false);
    });
    return;
  }

  for (let lane = 0; lane < TELLERS; lane++) {
    const path = laneFor(lane);
    const room = pathLength(path);
    (model.sim.queues[lane] ?? []).forEach((who, i) => {
      const d = SPACING * 0.5 + i * SPACING;
      if (d > room) return;
      const where = pointAt(path, d);
      customer(where.x, where.y, who, false);
    });
  }
}

// --- the waste -------------------------------------------------------------

/**
 * What pooling actually buys, drawn rather than asserted.
 *
 * For every teller standing free while somebody waits in another lane: a
 * dashed line across the floor from the empty window to the person who should
 * have been at it, and a pink wash filling the window itself. The line is the
 * argument. Nobody is working slowly, nobody has made a mistake, and the two
 * ends of it cannot be joined because of how the rope is arranged.
 *
 * Drawn in two passes around the depth sort, which is not fussiness. The floor
 * line belongs under the people -- painted after them it ran across the crowd
 * at knee height and read as a pointer drawn on the picture rather than a
 * distance across the carpet. The window wash belongs over them, because the
 * counter is itself in the depth sort. A stranded window never has a customer
 * standing at it, so nothing of consequence is painted over.
 */

/** Where the front of a lane's queue is standing, if anybody is. */
function headOf(m: BankModel, lane: number): { x: number; y: number } | null {
  const queue = m.sim.queues[lane];
  if (!queue || queue.length === 0) return null;
  const where = pointAt(laneFor(lane), SPACING * 0.5);
  return { x: where.x, y: where.y };
}

/** The floor lines, under the people. */
function wasteLines(f: Frame<BankModel>, stranded: number[]): void {
  const { c, cam, p, model } = f;
  if (stranded.length === 0) return;

  // The longest other queue is the one an idle window most obviously should
  // have taken. Ties break on the lowest lane, so the line does not flicker.
  let best: { x: number; y: number } | null = null;
  let longest = 0;
  for (let lane = 0; lane < TELLERS; lane++) {
    const n = model.sim.queues[lane]?.length ?? 0;
    if (n > longest) {
      const at = headOf(model, lane);
      if (at) {
        longest = n;
        best = at;
      }
    }
  }
  if (!best) return;

  c.setLineDash([5, 4]);
  c.strokeStyle = withAlpha(p.pinkEdge, 0.95);
  c.lineWidth = 1.8;
  for (const lane of stranded) {
    const from = project(cam, WINDOWS[lane], SERVED_Y, 0.03);
    const to = project(cam, best.x, best.y, 0.03);
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
  }
  c.setLineDash([]);
}

/** The pink windows and the running count, over the people. */
function wasteMarks(f: Frame<BankModel>, stranded: number[]): void {
  const { c, cam, p, model, w } = f;

  for (const lane of stranded) {
    const wx = WINDOWS[lane];
    const quad = [
      project(cam, wx - 0.62, COUNTER.y, COUNTER.h + 0.08),
      project(cam, wx + 0.62, COUNTER.y, COUNTER.h + 0.08),
      project(cam, wx + 0.62, COUNTER.y, GLASS_TOP),
      project(cam, wx - 0.62, COUNTER.y, GLASS_TOP),
    ];
    c.beginPath();
    quad.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    c.fillStyle = withAlpha(p.pink, 0.42);
    c.fill();
    c.strokeStyle = p.pinkEdge;
    c.lineWidth = 1.5;
    c.stroke();
  }

  // Screen space, bottom left. Anchored in the room it landed on the counter,
  // and a chip is a report about the branch rather than a thing standing in it.
  // A snippet gets the pink windows but not the chip: a crop of the lobby has
  // no room for a sentence, and the sentence belongs to the full figure.
  if (f.region) return;
  const spent = (model.strandedTicks * TICK_SECONDS) / 60;
  const size = textSize(cam, 11, 9);
  chip(
    c,
    p,
    model.layout === "one"
      ? "since the doors opened: nothing stranded, and nothing can be"
      : `since the doors opened: ${spent.toFixed(0)} teller-minutes stranded`,
    10,
    f.h - size * 1.7 - 8,
    size,
    w,
  );
}

// --- the scene -------------------------------------------------------------

const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;

export const bank: SceneDef<BankModel> = {
  height: 330,
  minHeight: 140,
  warm: 2400,
  // Thirty-six ticks a transaction, so this is a customer leaving a window
  // about every second and a half: slow enough to watch one line move.
  rate: 24,
  controls: [
    {
      kind: "select",
      key: "layout",
      // Opens on four lines, which is the branch before 1970 and the one the
      // reader has to be shown before the change means anything. The reader's
      // move is the re-roping, and the room visibly empties when they make it.
      label: "The rope",
      value: "four",
      options: [
        // Short enough to survive a 390 px select, which "Four lines, one
        // window each" was not -- it truncated mid-word.
        { value: "four", label: "Four lines" },
        { value: "one", label: "One line" },
      ],
    },
    {
      kind: "range",
      key: "rate",
      label: "Customers an hour",
      min: 52,
      max: 76,
      step: 2,
      // Opens at 66 rather than 70. At seventy the comparison is a shade
      // sharper (3.1x rather than 2.9x) and the room is a shade less readable
      // -- twenty-one people in four lanes, with the fourth spilling past its
      // rope -- but the deciding number is the third one: a window is standing
      // stranded on 59% of ticks here against 50% there, and the overlay only
      // teaches anything on the ticks it can be seen.
      value: 66,
      format: (v) => `${v}/hr`,
    },
  ],
  readout: [
    { key: "wOne", term: "W", sub: "one line" },
    { key: "wFour", term: "W", sub: "four lines" },
    { key: "w90One", term: "W₉₀", sub: "one line" },
    { key: "w90Four", term: "W₉₀", sub: "four lines" },
    { key: "stranded", term: "stranded", sub: "teller-min an hour" },
  ],
  build,
  step,
  representative: (m) => {
    const want = m.layout === "one" ? m.one : m.four;
    return want.over || Math.abs(m.sim.inSystem - want.L) <= Math.max(1.5, want.L * 0.25);
  },
  extent: () => ROOM,
  report: (m) => ({
    wOne: m.one.over ? "no limit" : mins(m.one.W),
    wFour: m.four.over ? "no limit" : mins(m.four.W),
    w90One: m.one.over ? "no limit" : mins(m.one.W90),
    w90Four: m.four.over ? "no limit" : mins(m.four.W90),
    stranded: m.layout === "one" ? "0" : m.rate.toFixed(0),
  }),
  regions: {
    /** The counter and its four windows. */
    counter: { x0: 0.6, x1: 14.4, y0: 8.8, y1: 12.6, z1: 3.0 },
    /** The lobby, for a later week that needs people standing in lines. */
    lobby: { x0: 0.8, x1: 13.6, y0: 1.0, y1: 10.0, z1: 2.1 },
  },
  draw(f) {
    const st = new Stage();
    const stranded = strandedLanes(f.model);
    shell(f, st);
    lobby(f, st);
    wasteLines(f, stranded);
    people(f, st, stranded);
    st.paint();
    wasteMarks(f, stranded);
  },
};
