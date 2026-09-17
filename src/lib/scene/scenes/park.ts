/**
 * Week 8: a theme park ride, and the line you would have been standing in.
 *
 * Disney ran FastPass free for two decades. Genie+ replaced it in 2021 at $15
 * a day, gained surge pricing in October 2022, and became Lightning Lane Multi
 * Pass in July 2024 at $20-$45 a person a day depending on how busy the park
 * expects to be. The same autumn Disney added Premier Pass -- every Lightning
 * Lane in the park, once each -- at $329 to $449 a person a day at Magic
 * Kingdom, which is several times the gate price. The gate buys you in. That
 * buys you past everybody who only bought in.
 *
 * Surge pricing is the part worth staring at: the pass costs most on the days
 * the standby line is worst, which means the product being sold is the length
 * of somebody else's queue.
 *
 * So this is one ride with two lines into the same two loading positions, and
 * the slider is uptake. The overlay is the counterfactual, drawn on the floor:
 * a pink line across the standby switchback at the point the queue reached
 * when nobody had bought anything. The live queue runs past it, and the chip
 * says by how far. That is the whole transfer, in metres of handrail, on a
 * page where the population mean is visibly refusing to move.
 *
 * Measured, five seeds, 90,000 ticks each, one ride with two loading positions
 * at an observed rho of 0.92:
 *
 *   uptake   W with a pass   W standby   W90 standby   W everyone   standby parties
 *      0%         --           23.3 min    53.7 min      23.3 min       18.8
 *     10%        3.0           25.5        59.7          23.3           18.7
 *     30%        3.3           31.9        75.3          23.3           18.5
 *     50%        3.7           42.9       104.7          23.3           18.1
 *     80%        5.6           92.8       236.0          23.1           16.3
 *
 * The fourth column is not approximately constant. It is constant. Priority is
 * work-conserving -- nobody serves faster and nobody goes home -- so the mean
 * wait across everybody is a conserved quantity, and reordering can only move
 * it between people. An operator who says the fast lane did not raise the
 * average wait is stating a theorem, not presenting evidence.
 *
 * The last column is why this scene does not draw the queue getting longer:
 * it barely does. What changes is how long each of those eighteen parties
 * stands there, and that is what the overlay counts.
 */

import { QueueSim, type Customer } from "../../queue-sim";
import { project, type Extent } from "../project";
import { pathLength, pointAt, type Path } from "../path";
import {
  Stage,
  box3,
  chip,
  darken,
  ground,
  label,
  mix,
  person,
  screen,
  softShadow,
  textSize,
  tints,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/** Twenty seconds a tick, so a two-minute dispatch is six ticks. */
const TICK_SECONDS = 20;
const SERVICE_TICKS = 6;
const GATES = 2;

/** The ride plaza, in metres. */
// z1 is 4.0 rather than 3.2 to give the lift hill somewhere to be. At 3.2 the
// crown of the track came out a fifth of a metre above the station awning and
// read as a wire strung across the roof.
const ROOM: Extent = { x0: 0, x1: 11.4, y0: 0.6, y1: 9.4, z1: 4.0 };

/** The station: a canopy on posts, with two loading positions under it. */
const STATION = { y: 7.7, d: 1.5, deck: 0.45 };
const GATE_X = [3.3, 6.3] as const;
const BOARD_Y = STATION.y - 0.9;

/**
 * One figure is a party, not a person. A theme park queue is ninety people
 * long and this room holds sixteen; drawing parties keeps the waits honest
 * (a two-minute dispatch, a twenty-five minute standby) without pretending a
 * handrail can hold a hundred figures.
 */
const SPACING = 0.72;

/** The paid lane: short, straight, gold rope, arriving at the left gate. */
const FAST: Path = [
  [GATE_X[0], 6.2],
  [GATE_X[0], 2.6],
];
/** Standby: a switchback, which is the shape the argument is about. */
const STANDBY: Path = [
  [GATE_X[1], 6.2],
  [GATE_X[1], 4.7],
  [9.1, 4.7],
  [9.1, 3.2],
  [GATE_X[1], 3.2],
  [GATE_X[1], 1.7],
  [10.4, 1.7],
];

function configFor(share: number) {
  return {
    seed: 7,
    lanes: 1,
    servers: GATES,
    mu: 1 / SERVICE_TICKS,
    // Chosen by measurement, not arithmetic. The engine schedules the next
    // arrival at tick + interval and so discards the fraction of a tick the
    // clock overshot by, which costs about 13% of the offered traffic; 0.352
    // configured lands at an observed rho of 0.92, a popular ride on a
    // Saturday, which is the only condition under which any of this is worth
    // arguing about.
    lambda: 0.352,
    arrivalCv: 1,
    serviceCv: 1,
    discipline: "priority" as const,
    priorityShare: share / 100,
  };
}

export interface ParkStats {
  wPriority: number;
  wStandard: number;
  w90Standard: number;
  wAll: number;
  /** Mean number of standby parties waiting. */
  qStandard: number;
}

const cache = new Map<number, ParkStats>();
function measure(share: number): ParkStats {
  const hit = cache.get(share);
  if (hit) return hit;
  const pri: number[] = [];
  const std: number[] = [];
  let q = 0;
  let ticks = 0;
  for (const seed of [7, 11, 23, 42, 99]) {
    const sim = new QueueSim({ ...configFor(share), seed });
    sim.run(4000);
    for (let i = 0; i < 90000; i++) {
      sim.step();
      q += (sim.queues[0] ?? []).filter((c) => !c.priority).length;
      ticks += 1;
      for (const r of sim.recentlyServed) {
        if (r.at !== sim.tick) continue;
        (r.customer.priority ? pri : std).push(r.at - r.customer.arrivedAt);
      }
    }
  }
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const sorted = [...std].sort((a, b) => a - b);
  const out: ParkStats = {
    wPriority: mean(pri),
    wStandard: mean(std),
    w90Standard: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
    wAll: mean([...pri, ...std]),
    qStandard: q / ticks,
  };
  cache.set(share, out);
  return out;
}

export interface ParkModel {
  sim: QueueSim;
  share: number;
  now: ParkStats;
  /** The same ride with nobody holding a pass, for the readout's last cell. */
  base: ParkStats;
  /**
   * Passes that have boarded ahead of each standby party since it joined.
   *
   * The first attempt drew the counterfactual instead -- a pink line across
   * the switchback at the mean queue length with nobody buying, so a reader
   * could see how much further back the passes had pushed them. It measured
   * nothing. Priority is work-conserving: the *number* of people in the line
   * is almost exactly the same at 80% uptake as at 0% (18.3 parties against
   * 18.8). What changes is how long each of them stands there, and a mark on
   * the floor cannot show that. Counting the skips can.
   */
  cut: Map<number, number>;
  /** Every pass that has boarded ahead of the standby line since opening. */
  skips: number;
  /** Ids on the platform last tick, to spot a new boarding. */
  onDeck: number[];
}

function build(controls: { num(key: string, fallback?: number): number }): ParkModel {
  const share = Math.round(controls.num("share", 30));
  return {
    sim: new QueueSim(configFor(share)),
    share,
    now: measure(share),
    base: measure(0),
    cut: new Map(),
    skips: 0,
    onDeck: [],
  };
}

function step(m: ParkModel): void {
  m.sim.step();
  const deck = m.sim.busy[0] ?? [];
  const now = deck.map((c) => c?.id ?? 0);
  const boarded = deck.filter((c, g) => c && c.id !== m.onDeck[g]);
  m.onDeck = now;
  const standby = queueOf(m, false);
  for (const who of boarded) {
    if (!who?.priority) continue;
    m.skips += 1;
    for (const waiting of standby) {
      m.cut.set(waiting.id, (m.cut.get(waiting.id) ?? 0) + 1);
    }
  }
  const live = new Set(standby.map((c) => c.id));
  for (const id of m.cut.keys()) if (!live.has(id)) m.cut.delete(id);
}

/** The party at the front of standby: still not boarding, and counting. */
function front(m: ParkModel): Customer | null {
  return queueOf(m, false)[0] ?? null;
}

const queueOf = (m: ParkModel, priority: boolean): Customer[] =>
  (m.sim.queues[0] ?? []).filter((c) => c.priority === priority);

// --- the set ---------------------------------------------------------------

/** Track, station, awning, handrails and the planting along them. */
function shell(f: Frame<ParkModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  /**
   * The track, arcing away behind the station.
   *
   * Two rails, ties between them and legs down to the ground. It is the one
   * prop that says "ride" rather than "bus stop", and the first version drew it
   * as a pair of bare curves with diagonal props, which read as overhead
   * cabling strung across the roof.
   */
  st.add(0, ROOM.y1 + 4, () => {
    const on = (u: number) => {
      const x = 0.9 + u * 9.6;
      const lift = 0.7 + Math.sin(u * Math.PI) * 3.2;
      return { x, lift };
    };
    const rail = (drop: number, wide: number) => {
      c.strokeStyle = drop ? darken(t.metal, 0.12) : darken(t.metal, 0.3);
      c.lineWidth = wide;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const { x, lift } = on(i / 40);
        const at = project(cam, x, ROOM.y1 + 0.1, lift - drop);
        if (i) c.lineTo(at.x, at.y);
        else c.moveTo(at.x, at.y);
      }
      c.stroke();
    };
    // Legs first, so the rails sit on top of them.
    c.strokeStyle = withAlpha(darken(t.metal, 0.34), 0.75);
    c.lineWidth = 3;
    for (let i = 2; i <= 38; i += 6) {
      const { x, lift } = on(i / 40);
      const top = project(cam, x, ROOM.y1 + 0.1, lift - 0.24);
      const foot = project(cam, x, ROOM.y1 + 0.1, 0);
      c.beginPath();
      c.moveTo(top.x, top.y);
      c.lineTo(foot.x, foot.y);
      c.stroke();
    }
    // Ties.
    c.strokeStyle = withAlpha(darken(t.metal, 0.2), 0.8);
    c.lineWidth = 2;
    for (let i = 0; i <= 40; i += 2) {
      const { x, lift } = on(i / 40);
      const a = project(cam, x, ROOM.y1 + 0.1, lift);
      const b = project(cam, x, ROOM.y1 + 0.1, lift - 0.24);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    rail(0, 3);
    rail(0.24, 3);
  });

  // The station deck, its posts, and a narrow awning. The first version put a
  // full roof over the platform: 8 m by 1.1 at three metres up, which in this
  // projection is a pale slab across the top third of the frame with the ride
  // hidden behind it. An awning the depth of the deck edge does the same job.
  st.add(1.0, STATION.y, () => {
    softShadow(c, cam, p, 5.2, STATION.y - 0.2, 4.6, 1.1);
    box3(
      c,
      cam,
      { x: 1.0, y: STATION.y - 0.4, w: 8.4, d: STATION.d, h: STATION.deck },
      { fill: mix(t.stone, p.ink, 0.12), contrast: 0.2 },
    );
    [1.25, 4.7, 9.05].forEach((px) => {
      box3(
        c,
        cam,
        { x: px, y: STATION.y + 0.5, w: 0.15, d: 0.15, h: 2.3, z: STATION.deck },
        { fill: darken(t.wood, 0.2) },
      );
    });
    box3(
      c,
      cam,
      { x: 1.0, y: STATION.y + 0.46, w: 8.4, d: 0.22, h: 0.46, z: STATION.deck + 2.3 },
      { fill: darken(t.wood, 0.12), contrast: 0.22 },
    );
    box3(
      c,
      cam,
      { x: 0.86, y: STATION.y + 0.3, w: 8.7, d: 0.5, h: 0.1, z: STATION.deck + 2.76 },
      // Dark. A pale roof plane at this size is the largest shape in the frame
      // and wins every competition for the reader's eye against the ride.
      { fill: darken(t.metal, 0.46), contrast: 0.18 },
    );
    screen(c, cam, p, {
      x: GATE_X[0] - 1.0,
      y: STATION.y + 0.44,
      w: 2.0,
      h: 0.34,
      z: STATION.deck + 2.36,
      lines: ["LIGHTNING LANE"],
      accent: p.gold,
    });
    screen(c, cam, p, {
      x: GATE_X[1] - 0.9,
      y: STATION.y + 0.44,
      w: 2.0,
      h: 0.34,
      z: STATION.deck + 2.36,
      lines: [`STANDBY  ${Math.round((model.now.wStandard * TICK_SECONDS) / 60)} MIN`],
      accent: p.soft,
    });
  });

  // The train, waiting with its restraints up.
  st.add(2.0, STATION.y - 0.45, () => {
    for (let i = 0; i < 3; i++) {
      const x = 1.9 + i * 1.95;
      box3(
        c,
        cam,
        { x, y: STATION.y - 0.34, w: 1.7, d: 0.8, h: 0.44, z: STATION.deck },
        { fill: darken(t.metal, 0.38), edge: withAlpha(p.gold, 0.55), contrast: 0.24 },
      );
      box3(
        c,
        cam,
        { x: x + 0.12, y: STATION.y - 0.28, w: 0.5, d: 0.16, h: 0.42, z: STATION.deck + 0.44 },
        { fill: withAlpha(p.gold, 0.7), contrast: 0.2 },
      );
    }
  });

  // Handrails: a top rail and a post every metre and a half. Two thin grey
  // strokes were not enough -- the switchback read as a floor plan.
  const rail = (path: Path, gold: boolean) => {
    st.add(path[0][0], path[0][1] - 0.02, () => {
      const total = pathLength(path);
      for (const side of [-0.44, 0.44]) {
        c.strokeStyle = gold ? withAlpha(p.gold, 0.75) : withAlpha(darken(t.metal, 0.05), 0.9);
        c.lineWidth = 2;
        c.beginPath();
        path.forEach(([px, py], i) => {
          const at = project(cam, px + side, py, 0.92);
          if (i) c.lineTo(at.x, at.y);
          else c.moveTo(at.x, at.y);
        });
        c.stroke();
        c.lineWidth = 1.5;
        for (let d = 0; d <= total; d += 1.5) {
          const on = pointAt(path, d);
          const top = project(cam, on.x + side, on.y, 0.92);
          const foot = project(cam, on.x + side, on.y, 0);
          c.beginPath();
          c.moveTo(top.x, top.y);
          c.lineTo(foot.x, foot.y);
          c.stroke();
        }
      }
    });
  };
  rail(FAST, true);
  rail(STANDBY, false);

  /**
   * The planting. A theme park queue is landscaped on purpose, and the hedge is
   * doing the same job the switchback is: making a wait look like somewhere.
   *
   * Small. The first version used 1.5 m by 0.7 boxes, which at this camera are
   * green shipping containers parked in the plaza.
   */
  const bush = (x: number, y: number, tall: boolean, seed: number) => {
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.4, 0.24);
      box3(
        c,
        cam,
        { x: x - 0.3, y: y - 0.26, w: 0.6, d: 0.52, h: tall ? 0.72 : 0.44 },
        { fill: mix(p.green, p.ink, 0.14), contrast: 0.32 },
      );
      box3(
        c,
        cam,
        {
          x: x - 0.26,
          y: y - 0.22,
          w: 0.52,
          d: 0.44,
          h: 0.1,
          z: tall ? 0.72 : 0.44,
        },
        { fill: mix(p.green, p.bg, 0.14 + (seed % 3) * 0.05), contrast: 0.28 },
      );
    });
  };
  bush(4.55, 5.5, true, 1);
  bush(4.55, 4.3, false, 2);
  bush(4.55, 3.1, true, 3);
  bush(7.7, 4.0, false, 4);
  bush(7.7, 2.6, true, 5);
  bush(0.9, 5.0, true, 6);
  bush(0.9, 3.4, false, 7);
  bush(10.9, 5.2, true, 8);
}

// --- the guests ------------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.34),
    t.cloth,
    darken(t.clay, 0.14),
    mix(p.ink, p.bg, 0.56),
    mix(t.wood, p.ink, 0.24),
    mix(p.green, p.ink, 0.3),
  ];
  return coats[id % coats.length];
}

function guests(f: Frame<ParkModel>, st: Stage, waiting: Customer | null): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  const party = (x: number, y: number, who: Customer, boarding: boolean) => {
    const marked = !boarding && waiting !== null && who.id === waiting.id;
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.3);
      person(c, cam, p, x, y, {
        coat: boarding ? p.gold : marked ? p.pinkEdge : coatFor(p, who.id),
        edge: marked ? darken(p.pinkEdge, 0.32) : undefined,
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.11),
        hair: who.id % 3 === 0 ? undefined : darken(coatFor(p, who.id + 1), 0.34),
        // A pass, held up. The only thing separating the two lines is a piece
        // of paper, and it is worth drawing it.
        carry: who.priority ? p.gold : undefined,
      });
      // The child in the party, so a figure reads as a family rather than a dot.
      if (who.id % 3 !== 2) {
        person(c, cam, p, x + 0.36, y - 0.16, {
          coat: coatFor(p, who.id + 3),
          skin: mix(t.skin, p.ink, ((who.id + 1) % 4) * 0.11),
          h: 1.1,
        });
      }
    });
  };

  for (let g = 0; g < GATES; g++) {
    const held = model.sim.busy[0]?.[g];
    if (held) party(GATE_X[g], BOARD_Y, held, true);
  }

  const walk = (path: Path, queue: Customer[]) => {
    const room = pathLength(path);
    queue.forEach((who, i) => {
      const d = SPACING * 0.6 + i * SPACING;
      if (d > room) return;
      const at = pointAt(path, d);
      party(at.x, at.y, who, false);
    });
  };
  walk(FAST, queueOf(model, true));
  walk(STANDBY, queueOf(model, false));
}

// --- the transfer ----------------------------------------------------------

/**
 * What a pass actually buys, counted on the person who did not buy one.
 *
 * The party at the front of standby wears pink and carries two numbers: how
 * long they have been in this line, and how many pass-holders have walked past
 * them onto the ride since they joined it. Both climb. The second is the
 * lecture's sentence -- every skip is somebody else's delay -- as an integer
 * you can watch go up.
 */
function transfer(f: Frame<ParkModel>, waiting: Customer | null): void {
  const { c, cam, p, model, w } = f;
  const size = textSize(cam, 11, 9);

  if (waiting) {
    const at = pointAt(STANDBY, SPACING * 0.6);
    const head = project(cam, at.x, at.y, 1.95);
    const mins = Math.round(((model.sim.tick - waiting.arrivedAt) * TICK_SECONDS) / 60);
    const skips = model.cut.get(waiting.id) ?? 0;
    const cx = head.x + size * 1.1;
    const cy = head.y - size * 1.6;
    c.strokeStyle = withAlpha(p.pinkEdge, 0.9);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(head.x, head.y);
    c.lineTo(cx, cy + size * 0.85);
    c.stroke();
    chip(c, p, `${mins} min here · ${skips} passes gone by`, cx, cy, size, w);
  }

  if (f.region) return;
  chip(
    c,
    p,
    model.share === 0
      ? "no passes sold: nobody has gone past this line all day"
      : `passes boarded ahead of this line today: ${model.skips}`,
    10,
    f.h - size * 1.7 - 8,
    size,
    w,
  );
}

// --- the scene -------------------------------------------------------------

const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;

export const park: SceneDef<ParkModel> = {
  height: 340,
  minHeight: 150,
  warm: 2600,
  rate: 14,
  controls: [
    {
      kind: "range",
      key: "share",
      label: "Buying priority",
      min: 0,
      max: 80,
      step: 10,
      value: 30,
      format: (v) => `${v}%`,
    },
  ],
  readout: [
    { key: "wFast", term: "W", sub: "with a pass" },
    { key: "wStd", term: "W", sub: "standby" },
    { key: "w90Std", term: "W₉₀", sub: "standby" },
    { key: "wAll", term: "W", sub: "everyone" },
    { key: "w90Base", term: "W₉₀", sub: "standby, no passes" },
  ],
  build,
  step,
  // Eight standby parties, not the long-run mean of eighteen. That mean is a
  // time average over a heavy tail: the live queue at this load sits around
  // ten and spends hours nowhere near eighteen, so gating the opening frame on
  // it just burned the four thousand catch-up steps and opened wherever it
  // happened to be anyway.
  representative: (m) => queueOf(m, false).length >= 8,
  extent: () => ROOM,
  report: (m) => ({
    wFast: m.share === 0 ? "—" : mins(m.now.wPriority),
    wStd: mins(m.now.wStandard),
    w90Std: mins(m.now.w90Standard),
    wAll: mins(m.now.wAll),
    w90Base: mins(m.base.w90Standard),
  }),
  regions: {
    /** The station and both gates. */
    station: { x0: 1.0, x1: 9.4, y0: 6.0, y1: 9.4, z1: 3.2 },
    /** The standby switchback. */
    standby: { x0: 5.4, x1: 10.8, y0: 1.0, y1: 6.6, z1: 2.1 },
  },
  draw(f) {
    const st = new Stage();
    const waiting = front(f.model);
    shell(f, st);
    guests(f, st, waiting);
    st.paint();
    transfer(f, waiting);
  },
};
