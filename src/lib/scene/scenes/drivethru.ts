/**
 * Week 2: two drive-throughs, side by side.
 *
 * The week's claim is that a queue is made of variability rather than of load,
 * and the claim is hard to believe because it is stated as a comparison the
 * reader has to take on trust: two systems, same throughput, same staff, same
 * average service time, same utilisation, and one of them has eleven cars in
 * it. So the comparison is the set. Both lanes are here at once, driven by one
 * load slider, and the only thing that differs is how irregular the near one is
 * allowed to be.
 *
 * The lecture's own arithmetic turns out to be exactly right and is used
 * verbatim: a car a minute, fifty-five seconds an order. That is rho = 11/12 =
 * 0.917, and M/M/1 puts L at rho/(1 - rho) = 11.0 -- the eleven cars the page
 * opens with. The load slider moves the gap between cars in five-second steps,
 * which keeps both the gap and the service time whole numbers of ticks, so the
 * two lanes share a utilisation *exactly* rather than approximately. That
 * matters more than it sounds: the whole point is that nothing a manager
 * measures distinguishes these two lanes, and a readout showing 0.92 against
 * 0.90 would have quietly handed the reader an explanation.
 *
 * Measured, five seeds, run length scaled to the load (see stats.ts):
 *
 *   gap 60 s, rho 0.917   clockwork L 0.92   real traffic L 10.5, W 11.0 min
 *   gap 70 s, rho 0.786   clockwork L 0.79   real traffic L  3.5, W  4.3 min
 *   gap 110 s, rho 0.500  clockwork L 0.50   real traffic L  1.0, W  1.9 min
 *
 * and at a fixed rho of 0.917, sliding irregularity from 0 to 1:
 *
 *   0.00  L 0.92    0.50  L 3.07    0.75  L 6.12    1.00  L 10.53
 *
 * That last row is the lecture. Same load, same speed, same staff; the queue is
 * manufactured out of nothing but irregularity.
 */

import { QueueSim } from "../../queue-sim";
import { converge, type Converged } from "../stats";
import { project, type Extent } from "../project";
import {
  Stage,
  box3,
  car,
  chip,
  darken,
  ground,
  label,
  lighten,
  mix,
  person,
  plant,
  softShadow,
  textSize,
  tints,
  tree,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/** Seconds a tick stands for, and the one service time in the week. */
const TICK_SECONDS = 5;
/** Fifty-five seconds at the window, which is the lecture's own figure. */
const SERVICE_TICKS = 11;

const CAR_LEN = 4.4;
/** Nose-to-tail pitch. A car plus the gap a driver leaves at a crawl. */
const CAR_PITCH = 5.5;

/** The forecourt, in metres. */
const LOT: Extent = { x0: -1.2, x1: 21, y0: -3.4, y1: 36, z1: 4.5 };

interface Lane {
  /** Asphalt edges. */
  road: [number, number];
  /** Left edge of a car in this lane; the lane is 3.6 m and a car 1.8 m. */
  carX: number;
  /** Left face of the kiosk, which is where the window is. */
  kioskX: number;
  /** Where the nose of the served car stops. */
  windowY: number;
  name: string;
}

const KIOSK_W = 4.4;
const KIOSK_Y0 = 28;
/**
 * Six and a half metres deep and three high. The first draft made it eleven by
 * four, and the roof -- a five-by-eleven slab, projected -- came out as the
 * largest object in the frame by some margin, looming over both lanes like a
 * multi-storey car park. A drive-through kiosk should be the smallest building
 * that can contain one person and a window.
 */
const KIOSK_D = 6.5;
const KIOSK_H = 3.1;

const LANES: { clock: Lane; real: Lane } = {
  clock: {
    road: [1.2, 4.8],
    carX: 2.1,
    kioskX: 4.9,
    windowY: 32,
    name: "CLOCKWORK",
  },
  real: {
    road: [9.4, 13],
    carX: 10.3,
    kioskX: 13.1,
    windowY: 32,
    name: "REAL TRAFFIC",
  },
};

/** Roadside planting. Every set in this course has something alive in it. */
/**
 * Where a tree can stand without hiding the traffic.
 *
 * This is the one piece of the set that had to be worked out rather than
 * placed. In an oblique projection a metre of depth shifts a point half a metre
 * left, so a tree in the middle verge at y = 7 lands on exactly the same
 * pixels as a car in the right-hand lane at y = 13 -- and the depth sort, quite
 * correctly, paints the nearer tree in front of it. The first pass planted a
 * small wood down the centre of the forecourt and lost most of the queue
 * behind it.
 *
 * The rule that falls out: a tree to the RIGHT of a lane, at a HIGHER y, is
 * always painted behind that lane and is always safe. A tree to the left at a
 * lower y is never safe. So the planting is in the right-hand verge, the far
 * end of the middle verge, and the two ends of the left verge -- which reads as
 * a landscaped forecourt and happens to be the only arrangement that does not
 * occlude anything.
 */
const TREES: Array<[number, number, number, number]> = [
  [0.1, 8, 3.2, 2],
  [-0.1, 34, 3.0, 5],
  [6.6, 33.5, 3.2, 9],
  [19.4, 4, 3.4, 13],
  [19.6, 15, 3.6, 17],
  [19.2, 26, 3.2, 21],
  [19.5, 35, 3.0, 25],
];

export interface DriveModel {
  clock: QueueSim;
  real: QueueSim;
  clockStats: Converged;
  realStats: Converged;
  /** Ticks between arrivals. Whole, so that rho is exact in both lanes. */
  gapTicks: number;
  /** Utilisation, shared by construction. */
  rho: number;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): DriveModel {
  // The slider is seconds between cars, in five-second steps, so the gap is
  // always a whole number of ticks. See the note at the top for why that is
  // not a detail.
  const gapSeconds = Math.round(controls.num("gap", 60) / TICK_SECONDS) * TICK_SECONDS;
  const gapTicks = gapSeconds / TICK_SECONDS;
  const chaos = controls.num("chaos", 1);

  const shared = {
    seed: 7,
    lanes: 1,
    servers: 1,
    mu: 1 / SERVICE_TICKS,
    lambda: 1 / gapTicks,
  };
  const clockConfig = { ...shared, arrivalCv: 0, serviceCv: 0 };
  // Irregularity drives arrivals and service together, because the lecture
  // separates them in beat 5 and the reader should meet them fused first --
  // the point being that it does not matter which one you have.
  const realConfig = { ...shared, arrivalCv: chaos, serviceCv: chaos };

  return {
    clock: new QueueSim(clockConfig),
    real: new QueueSim(realConfig),
    clockStats: converge(clockConfig),
    realStats: converge(realConfig),
    gapTicks,
    rho: SERVICE_TICKS / gapTicks,
  };
}

// --- the set ---------------------------------------------------------------

/** A flat quad on the ground plane. */
function slab(
  f: Frame<DriveModel>,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  fill: string,
): void {
  const { c, cam } = f;
  const pts = [
    project(cam, x0, y0),
    project(cam, x1, y0),
    project(cam, x1, y1),
    project(cam, x0, y1),
  ];
  c.beginPath();
  pts.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

/**
 * Ground, asphalt, kerbs and lane guides. Painted before the depth sort and
 * outside it, for the same reason week 1's walls are: a slab that runs the
 * length of the lot has no single depth, and everything in the set is in front
 * of it.
 */
function surface(f: Frame<DriveModel>): void {
  const { c, cam, p } = f;
  const t = tints(p);

  ground(c, cam, p, LOT);

  const tarmac = mix(t.stone, p.ink, 0.24);
  for (const lane of [LANES.clock, LANES.real]) {
    slab(f, lane.road[0], lane.road[1], LOT.y0, KIOSK_Y0 + KIOSK_D, tarmac);

    // Kerbs, which is most of what makes a grey strip read as a road.
    for (const edge of lane.road) {
      box3(
        c,
        cam,
        { x: edge - 0.09, y: LOT.y0, w: 0.18, d: KIOSK_Y0 + KIOSK_D - LOT.y0, h: 0.13 },
        { fill: mix(t.stone, p.bg, 0.35), contrast: 0.1 },
      );
    }

    // The lane's own path, dashed in gold on the floor. Week 1 drew the queue's
    // route on the cafe's tiles the same way, and the line means the same thing
    // here: this is where the waiting happens.
    c.strokeStyle = withAlpha(p.gold, 0.32);
    c.lineWidth = 1.5;
    c.setLineDash([5, 5]);
    const mid = (lane.road[0] + lane.road[1]) / 2;
    const a = project(cam, mid, LOT.y0, 0.01);
    const b = project(cam, mid, lane.windowY, 0.01);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.setLineDash([]);

    // Stop line at the window.
    slab(f, lane.road[0] + 0.2, lane.road[1] - 0.2, lane.windowY + 0.1, lane.windowY + 0.35,
      withAlpha(mix(p.bg, p.ink, 0.1), 0.85));
  }
}

/** One kiosk: body, roof, sign, window, sill, and the person inside it. */
function kiosk(f: Frame<DriveModel>, st: Stage, lane: Lane, serving: boolean): void {
  const { c, cam, p } = f;
  const t = tints(p);
  const x = lane.kioskX;

  st.add(x + KIOSK_W / 2, KIOSK_Y0, () => {
    box3(
      c,
      cam,
      { x, y: KIOSK_Y0, w: KIOSK_W, d: KIOSK_D, h: KIOSK_H },
      { fill: mix(t.stone, p.bg, 0.1), edge: withAlpha(p.ink, 0.2), contrast: 0.2 },
    );
    // Roof, overhanging on the lane side so the window has something over it.
    box3(
      c,
      cam,
      { x: x - 0.45, y: KIOSK_Y0 - 0.15, w: KIOSK_W + 0.6, d: KIOSK_D + 0.3, h: 0.22, z: KIOSK_H },
      // Darker than the wall, and warmed toward the gold rather than left dead
      // grey: the roof is the largest single surface in the frame, and a
      // neutral slab that size drains the colour out of everything near it.
      //
      // darken(), not mix(.., p.ink, ..): --q-ink is nearly white in dark mode,
      // so mixing toward it made the roofs the brightest thing on the page and
      // the eye went to two grey slabs instead of the traffic. Same mistake the
      // shadows made, in the same direction, for the same reason.
      {
        fill: mix(darken(t.stone, 0.3), p.gold, 0.1),
        edge: withAlpha(p.ink, 0.25),
        contrast: 0.14,
      },
    );

    // A door and a window on the face turned toward the viewer. Without them
    // the kiosk is a four-metre blank panel, which at this scale is the largest
    // featureless area in the frame.
    const panel = (x0: number, x1: number, z0: number, z1: number, fill: string) => {
      const q = [
        project(cam, x0, KIOSK_Y0, z0),
        project(cam, x1, KIOSK_Y0, z0),
        project(cam, x1, KIOSK_Y0, z1),
        project(cam, x0, KIOSK_Y0, z1),
      ];
      c.beginPath();
      q.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      c.strokeStyle = withAlpha(p.ink, 0.28);
      c.lineWidth = 1;
      c.stroke();
    };
    panel(x + 0.55, x + 1.45, 0, 2.05, mix(t.wood, p.ink, 0.25));
    panel(x + 2.1, x + 3.8, 0.95, 2.15, t.screen);

    // The service window: a dark opening in the face the cars pull up to.
    const y0 = lane.windowY - 1.2;
    const y1 = lane.windowY + 0.9;
    const quad = [
      project(cam, x, y0, 1.05),
      project(cam, x, y1, 1.05),
      project(cam, x, y1, 2.3),
      project(cam, x, y0, 2.3),
    ];
    c.beginPath();
    quad.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    c.fillStyle = t.screen;
    c.fill();
    c.strokeStyle = withAlpha(p.soft, 0.5);
    c.lineWidth = 1;
    c.stroke();
    box3(
      c,
      cam,
      { x: x - 0.22, y: y0, w: 0.3, d: y1 - y0, h: 0.1, z: 0.95 },
      { fill: mix(t.metal, p.bg, 0.2), contrast: 0.2 },
    );

    // Whoever is at the window. Gold while there is a car being served, which
    // is the same thing gold means everywhere else in the course.
    person(c, cam, p, x + 0.75, lane.windowY - 0.1, {
      coat: serving ? p.gold : mix(p.gold, p.bg, 0.55),
      skin: mix(t.skin, p.ink, 0.15),
      hair: darken(t.wood, 0.4),
    });

    // A lit sign on the roof, facing the approach.
    box3(
      c,
      cam,
      { x: x + 0.5, y: KIOSK_Y0 - 0.08, w: 3.2, d: 0.16, h: 0.88, z: KIOSK_H + 0.22 },
      { fill: t.screen, contrast: 0.1 },
    );
    const size = textSize(cam, 10, 7);
    if (cam.s > 11) {
      const at = project(cam, x + 2.1, KIOSK_Y0 - 0.1, KIOSK_H + 0.56);
      label(c, "SLOP BURGER", at.x, at.y, p.gold, size, "center", "700");
    }
  });
}

/** The menu board and speaker post a driver passes before the window. */
function orderPoint(f: Frame<DriveModel>, st: Stage, lane: Lane): void {
  const { c, cam, p } = f;
  const t = tints(p);
  const x = lane.road[0] - 1.6;
  const y = 18;

  st.add(x, y, () => {
    softShadow(c, cam, p, x + 0.7, y + 0.1, 0.5, 0.26);
    box3(c, cam, { x: x + 0.62, y, w: 0.16, d: 0.16, h: 1.15 }, { fill: darken(t.metal, 0.35) });
    box3(
      c,
      cam,
      { x, y, w: 1.4, d: 0.14, h: 1.05, z: 1.15 },
      { fill: t.screen, contrast: 0.1 },
    );
    // Three gold rules rather than type: at this camera scale a menu's own
    // words are four pixels tall, and a board that says nothing legible still
    // reads as a board.
    const left = project(cam, x + 0.12, y - 0.01, 2.05);
    const width = 1.16 * cam.s;
    c.save();
    c.fillStyle = p.gold;
    [0, 1, 2].forEach((i) => {
      c.globalAlpha = 0.85 - i * 0.2;
      c.fillRect(left.x, left.y + i * Math.max(3, width * 0.09), width * (0.9 - i * 0.2), 2);
    });
    c.restore();
  });
}

// --- the traffic -----------------------------------------------------------

function paintFor(p: Palette, id: number): string {
  const t = tints(p);
  const paints = [
    mix(p.ink, p.bg, 0.3),
    mix(p.bg, p.ink, 0.12),
    darken(t.clay, 0.1),
    mix(p.green, p.ink, 0.25),
    mix(p.ink, p.bg, 0.55),
    lighten(t.metal, 0.1),
  ];
  return paints[id % paints.length];
}

/**
 * One lane's cars, from the window backwards.
 *
 * Anyone past the end of the lot is counted rather than drawn, the same way
 * week 1 counts the customers out in the rain. It is truer -- at this load the
 * queue really does leave the forecourt -- and it stops a car sliced in half by
 * the frame edge reading as a rendering fault.
 */
function traffic(f: Frame<DriveModel>, st: Stage, lane: Lane, sim: QueueSim): number {
  const { c, cam, p } = f;
  const held = sim.busy[0]?.[0];
  const waiting = sim.queues[0] ?? [];
  let back = 0;

  const put = (slot: number, id: number, serving: boolean) => {
    const y = lane.windowY - CAR_LEN - slot * CAR_PITCH;
    if (y < LOT.y0) {
      back += 1;
      return;
    }
    st.add(lane.carX + 0.9, y, () => {
      softShadow(c, cam, p, lane.carX + 0.9, y + CAR_LEN * 0.45, 1.5, 0.75);
      car(c, cam, p, lane.carX, y, serving ? p.gold : paintFor(p, id), CAR_LEN, "y");
    });
  };

  if (held) put(0, held.id, true);
  waiting.forEach((customer, i) => put(held ? i + 1 : i, customer.id, false));

  return back;
}

// --- annotation ------------------------------------------------------------

/**
 * Lane names, and a count of the cars that are off the bottom of the frame.
 *
 * The names are sized in screen pixels rather than by the camera, unlike every
 * other piece of type in the set. A menu board is scenery and can shrink until
 * it is three gold rules; which lane is which is the entire comparison, and a
 * reader who cannot read it has been shown two pictures of traffic.
 */
function annotate(f: Frame<DriveModel>, backs: { clock: number; real: number }): void {
  const { c, cam, p, w } = f;
  const heading = Math.max(10, Math.min(13, w * 0.017));

  // The names have to fit in the gap between the two lanes, and the gap is
  // measured in pixels while the names are measured in characters -- at a
  // 330px column the lanes are 56px apart and "REAL TRAFFIC" is 80px wide, so
  // the two printed over each other as CLOCKWORREAL TRAFFIC. Short forms if the
  // long ones will not fit; nothing at all if even those will not, because the
  // caption says which lane is which and two overlapping words do not.
  c.font = `700 ${heading}px ui-sans-serif, system-ui, sans-serif`;
  const sep = ((LANES.real.road[0] + LANES.real.road[1]) / 2 -
    (LANES.clock.road[0] + LANES.clock.road[1]) / 2) * cam.s;
  const fits = (a: string, b: string) =>
    (c.measureText(a).width + c.measureText(b).width) / 2 + 8 <= sep;
  const names = fits(LANES.clock.name, LANES.real.name)
    ? { clock: LANES.clock.name, real: LANES.real.name }
    : fits("CLOCK", "REAL")
      ? { clock: "CLOCK", real: "REAL" }
      : null;

  ([
    [LANES.clock, backs.clock, names?.clock],
    [LANES.real, backs.real, names?.real],
  ] as const).forEach(([lane, back, name]) => {
    const mid = (lane.road[0] + lane.road[1]) / 2;
    // On the asphalt at the near end of the lane. Anchored to a ground point
    // just inside the lot rather than to the frame, so it stays on its own road
    // at every width; the first version hung it below LOT.y0 and it fell off
    // the bottom of the canvas, which is a hard thing to notice in source.
    // Four tenths of a metre inside the lot, which is the only strip of
    // asphalt no car ever occupies: the first waiting slot starts at 0.1 and
    // the lot ends at -3.4. Anywhere further up the lane and the name prints
    // over the back of the queue, which is what the previous two positions did.
    const at = project(cam, mid, LOT.y0 + 0.4, 0.02);
    // The name only. The first version printed the lane's full description
    // under it, and the two descriptions -- four hundred pixels each, on lanes
    // a hundred and forty pixels apart -- overprinted into one illegible line.
    // What each lane is doing belongs in the caption, which has room for it.
    if (name) label(c, name, at.x, at.y, p.gold, heading, "center", "700");
    if (back > 0) {
      const tag = project(cam, lane.road[1] + 0.2, LOT.y0 + 5.6, 1.4);
      chip(c, p, `${back} more back down the road`, tag.x, tag.y, textSize(cam, 10, 8), w);
    }
  });
}

// --- the scene -------------------------------------------------------------

const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;

export const drivethru: SceneDef<DriveModel> = {
  height: 340,
  // Not higher. The set is two and a half times wider than it is tall, so at a
  // 330px column the camera runs out of width at 115px of height -- and a
  // minimum taller than that buys empty bands above and below the scene rather
  // than a bigger scene.
  minHeight: 150,
  warm: 900,
  // Slow. A service is eleven ticks, so this is a car leaving every second and
  // a half, which is about what a drive-through feels like from inside it --
  // and fast enough that a queue of six visibly shuffles forward.
  rate: 7,
  controls: [
    {
      kind: "range",
      key: "gap",
      label: "One car every",
      min: 60,
      max: 110,
      step: 5,
      value: 60,
      format: (v) => `${v} s`,
    },
    {
      kind: "range",
      key: "chaos",
      label: "Near lane irregularity",
      min: 0,
      max: 1,
      step: 0.05,
      value: 1,
      format: (v) =>
        v === 0 ? "clockwork" : v === 1 ? "real traffic" : `${Math.round(v * 100)}%`,
    },
  ],
  readout: [
    { key: "rho", term: "ρ" },
    { key: "clockL", term: "L", sub: "clockwork" },
    { key: "clockW", term: "W", sub: "clockwork" },
    { key: "realL", term: "L", sub: "real" },
    { key: "realW", term: "W", sub: "real" },
  ],
  build,
  step: (m) => {
    m.clock.step();
    m.real.step();
  },
  // The busy lane is the one that takes time to look like its own average, and
  // it is the one the reader is being asked to believe a number about.
  representative: (m) =>
    Boolean(m.clock.busy[0]?.[0]) &&
    (m.realStats.over ||
      Math.abs(m.real.inSystem - m.realStats.L) <= Math.max(1, m.realStats.L * 0.25)),
  extent: () => LOT,
  report: (m) => ({
    rho: m.rho.toFixed(2),
    clockL: m.clockStats.L.toFixed(1),
    clockW: mins(m.clockStats.W),
    realL: m.realStats.over ? "grows" : m.realStats.L.toFixed(1),
    realW: m.realStats.over ? "no limit" : mins(m.realStats.W),
  }),
  regions: {
    /** The busy lane's tail, for a week that needs a queue with no visible front. */
    jam: { x0: 8.6, x1: 16.4, y0: -3.4, y1: 20, z1: 2.6 },
    /** The window, and whoever is at it. */
    window: { x0: 10, x1: 20.4, y0: 24, y1: 40, z1: 4.4 },
  },
  draw(f) {
    const st = new Stage();
    surface(f);

    orderPoint(f, st, LANES.clock);
    orderPoint(f, st, LANES.real);

    for (const [x, y, h, seed] of TREES) {
      st.add(x, y, () => {
        softShadow(f.c, f.cam, f.p, x, y, h * 0.2, h * 0.1);
        tree(f.c, f.cam, f.p, x, y, h, seed);
      });
    }
    st.add(19.8, 21, () => {
      softShadow(f.c, f.cam, f.p, 19.8, 21, 0.4);
      plant(f.c, f.cam, f.p, 19.8, 21, 1.6, 7);
    });

    kiosk(f, st, LANES.clock, Boolean(f.model.clock.busy[0]?.[0]));
    kiosk(f, st, LANES.real, Boolean(f.model.real.busy[0]?.[0]));

    const backs = {
      clock: traffic(f, st, LANES.clock, f.model.clock),
      real: traffic(f, st, LANES.real, f.model.real),
    };

    st.paint();
    annotate(f, backs);
  },
};
