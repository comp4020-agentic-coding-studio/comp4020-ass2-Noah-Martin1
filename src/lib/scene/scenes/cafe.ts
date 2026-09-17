/**
 * Week 1: the coffee shop downstairs.
 *
 * The week's claim is that the shape of a queue is a decision somebody made,
 * so the three arrangements the lecture describes are a control the reader
 * turns rather than three pictures they look at. Same room, same two staff,
 * same customers; the only thing the selector changes is how the room is
 * organised, and the readout says what that cost.
 *
 * How each arrangement maps onto the engine, since the mapping is the argument:
 *
 *   one line, one till     lanes 1, servers 1, high service variability -- one
 *                          person taking the order and making the drink, each
 *                          task interrupting the other
 *   two lines, two tills   lanes 2, servers 1 each -- twice the capacity, and
 *                          now you can join the wrong one and be stuck
 *   one line, two tills    lanes 1, servers 2, low variability -- the same two
 *                          staff, but a single line cannot leave a till idle
 *                          beside a full lane, and each station's job is
 *                          narrow enough that its length barely varies
 *
 * The third beating the second on the same headcount is the lecture's
 * prediction, and it is two separate real effects: pooling, and the fact that
 * waiting grows with the square of service variability.
 */

import { QueueSim } from "../../queue-sim";
import { converge, type Converged } from "../stats";
import { pathLength, pointAt, type Path } from "../path";
import { project, type Extent } from "../project";
import {
  Stage,
  box3,
  chair,
  chip,
  counter,
  darken,
  ground,
  label,
  mix,
  textSize,
  person,
  plant,
  softShadow,
  tints,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/**
 * Seconds per tick, and the two tasks a cafe actually performs.
 *
 * These are the numbers the whole page rests on, so they are stated once and
 * the lecture is written to match them rather than the other way round. Taking
 * an order and handling payment is ten seconds; making the drink is
 * twenty-five. One person doing both is therefore thirty-five seconds a
 * customer, and two specialists working in parallel are bottlenecked by the
 * slower task at twenty-five.
 *
 * An earlier draft had the lecture claim ninety customers between nine and
 * twenty past, which is four and a half a minute. Two members of staff cannot
 * serve that at any arrangement of the room, so the readout printed nonsense
 * for two of the three layouts. The prose now says thirty, which is what two
 * people can actually do, and at that rate the first arrangement costs about
 * four minutes a customer -- which is the figure the lecture had been quoting
 * all along.
 */
const TICK_SECONDS = 5;
const ORDER_TICKS = 2;
const DRINK_TICKS = 5;
/** One person doing both jobs, each task interrupting the other. */
const BOTH_TICKS = ORDER_TICKS + DRINK_TICKS;

/** The room, in metres. */
const ROOM: Extent = { x0: 0, x1: 8.6, y0: 0, y1: 6.2, z1: 2.3 };

/** Wall height. Low enough to see over, high enough to enclose the room. */
const WALL = 2.2;

type LayoutId = "one" | "two" | "pooled";

interface Till {
  x: number;
  /** Where the person being served stands. */
  queueHead: Path;
  /** Drawn above the till, so the room says what each station does. */
  name: string;
}

interface Layout {
  lanes: number;
  servers: number;
  /** Mean service completions per tick, per server. */
  mu: number;
  serviceCv: number;
  tills: Till[];
  note: string;
  /**
   * The arrangement's discipline, written as the instruction the lecture asks
   * the reader to write: "when a server becomes free, serve...". Long form and
   * a short one, because at a 330 px column the long one is wider than the
   * canvas.
   */
  rule: [long: string, short: string];
}

/** Counter geometry, shared by every arrangement. */
const COUNTER = { x: 1.2, y: 4.4, w: 6.3, d: 0.85, h: 1.05 };

/**
 * Queue paths run from the till outward, so person 0 is at the head. The first
 * arrangement deliberately runs down the window wall and turns along the front
 * of the room, which is how its tail ends up at the door in the rain.
 */
const LAYOUTS: Record<LayoutId, Layout> = {
  one: {
    lanes: 1,
    servers: 1,
    mu: 1 / BOTH_TICKS,
    serviceCv: 1,
    tills: [
      {
        x: 2.3,
        name: "order + make",
        queueHead: [
          [2.3, 3.7],
          [2.3, 1.4],
          [3.0, 0.8],
          [7.7, 0.6],
          [8.55, 0.45],
        ],
      },
    ],
    note: "one till, both jobs",
    rule: [
      "the rule — when the till frees, serve whoever has waited longest",
      "rule: longest waiting",
    ],
  },
  two: {
    lanes: 2,
    servers: 1,
    mu: 1 / BOTH_TICKS,
    serviceCv: 1,
    tills: [
      { x: 2.4, name: "till 1", queueHead: [[2.4, 3.7], [2.4, 0.4]] },
      { x: 6.3, name: "till 2", queueHead: [[6.3, 3.7], [6.3, 0.4]] },
    ],
    note: "two tills, two lines",
    rule: [
      "the rule — when a till frees, serve the front of its own line",
      "rule: front of its own line",
    ],
  },
  pooled: {
    lanes: 1,
    servers: 1,
    mu: 1 / DRINK_TICKS,
    serviceCv: 0.35,
    tills: [
      { x: 2.4, name: "order", queueHead: [[2.4, 3.7], [3.6, 3.2]] },
      { x: 6.3, name: "collect", queueHead: [[6.3, 3.7], [5.2, 3.2]] },
    ],
    note: "two tills, one line",
    rule: [
      "the rule — when the order till frees, take the next in the one line",
      "rule: next in the one line",
    ],
  },
};

/** The single line in the pooled arrangement, feeding whichever till frees up. */
const POOLED_QUEUE: Path = [
  [3.1, 3.1],
  [3.2, 1.5],
  [4.0, 0.8],
  [7.6, 0.62],
];

/**
 * Metres between people in the line.
 *
 * Wider than anyone stands in a real queue, because depth is foreshortened in
 * this projection: a segment running toward the viewer covers about 0.6 of the
 * screen distance the same span covers across it, so a realistic 0.5 m piled
 * the head of the queue into one unreadable clump.
 */
const SPACING = 0.78;

export interface CafeModel {
  sim: QueueSim;
  layout: LayoutId;
  /** Converged statistics, from the replicated headless twin. */
  stats: Converged;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): CafeModel {
  const layout = (controls.str("layout", "one") as LayoutId) ?? "one";
  const shape = LAYOUTS[layout] ?? LAYOUTS.one;
  // The slider is customers a minute, the same stream for every arrangement.
  // Holding rho fixed instead would have hidden the interesting half of the
  // comparison: the three rooms do not have the same capacity, and finding out
  // which one runs out first is the exercise.
  const perMinute = controls.num("rush", 1.5);
  const config = {
    seed: 7,
    lanes: shape.lanes,
    servers: shape.servers,
    serviceCv: shape.serviceCv,
    arrivalCv: 1,
    mu: shape.mu,
    lambda: (perMinute * TICK_SECONDS) / 60,
  };

  return {
    layout,
    sim: new QueueSim(config),
    stats: converge(config),
  };
}

// --- the set ---------------------------------------------------------------

/**
 * The shell: floor, walls, glazing, door. Painted before anything else and
 * outside the depth sort, because a wall that runs the depth of the room has
 * no single depth -- giving it one put the fig behind the window and the
 * tables inside the wall. Nothing in this room is ever behind the shell, so
 * the sort has nothing to decide.
 */
function shell(f: Frame<CafeModel>): void {
  const { c, cam, p } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  // Back wall.
  box3(
    c,
    cam,
    { x: 0, y: ROOM.y1 - 0.18, w: ROOM.x1, d: 0.18, h: WALL },
    { fill: mix(t.stone, p.bg, 0.4), contrast: 0.12 },
  );

  // Left wall, and the glazing that makes it the window the lecture talks
  // about the queue running along.
  box3(
    c,
    cam,
    { x: 0, y: 0, w: 0.16, d: ROOM.y1, h: WALL },
    { fill: mix(t.stone, p.bg, 0.28), contrast: 0.1 },
  );
  const glass = [
    project(cam, 0.16, 0.5, 1.0),
    project(cam, 0.16, ROOM.y1 - 0.5, 1.0),
    project(cam, 0.16, ROOM.y1 - 0.5, WALL - 0.14),
    project(cam, 0.16, 0.5, WALL - 0.14),
  ];
  c.beginPath();
  glass.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  c.closePath();
  c.fillStyle = withAlpha(mix(p.bg, p.green, 0.16), 0.9);
  c.fill();
  c.strokeStyle = withAlpha(p.soft, 0.45);
  c.lineWidth = 1;
  c.stroke();

  // The door, front right: a return in the front wall with a mat inside it.
  box3(
    c,
    cam,
    { x: 7.7, y: 0, w: 0.16, d: 1.3, h: WALL },
    { fill: mix(t.stone, p.bg, 0.28), contrast: 0.1 },
  );
  box3(
    c,
    cam,
    { x: 7.9, y: 0.05, w: 0.85, d: 0.7, h: 0.02 },
    { fill: mix(t.metal, p.ink, 0.3) },
  );
}

/** Everything standing in the room: counter, machine, board, plant, tables. */
function set(f: Frame<CafeModel>, st: Stage): void {
  const { c, cam, p } = f;
  const t = tints(p);

  // A board on the back wall. One prop, and the room stops being a generic
  // service counter.
  st.add(4.6, ROOM.y1 - 0.19, () => {
    box3(
      c,
      cam,
      { x: 5.45, y: ROOM.y1 - 0.24, w: 2.3, d: 0.06, h: 0.58, z: 1.5 },
      { fill: t.screen, contrast: 0.1 },
    );
    // The board's own type cannot scale with the room without becoming
    // illegible, so below a readable size it turns into three gold rules --
    // which still reads as a menu board and does not spill off the panel.
    const left = project(cam, 5.55, ROOM.y1 - 0.24, 2.02);
    const size = textSize(cam, 9, 7);
    const width = 2.1 * cam.s;
    c.save();
    c.fillStyle = p.gold;
    if (width > 118) {
      c.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
      c.textAlign = "left";
      c.textBaseline = "top";
      ["FLAT WHITE   4.50", "LATTE   4.50", "FILTER   3.50"].forEach((line, i) => {
        c.fillText(line, left.x, left.y + i * (size + 3));
      });
    } else {
      [0, 1, 2].forEach((i) => {
        c.globalAlpha = 0.85 - i * 0.18;
        c.fillRect(left.x, left.y + i * 5, width * (0.8 - i * 0.18), 2.5);
      });
    }
    c.restore();
  });

  // The counter, the machine on it, and a stack of cups.
  st.add(COUNTER.x + COUNTER.w / 2, COUNTER.y, () => {
    counter(c, cam, p, COUNTER, t.wood);
    box3(
      c,
      cam,
      { x: 3.9, y: COUNTER.y + 0.12, w: 1.3, d: 0.58, h: 0.6, z: COUNTER.h },
      { fill: t.metal, contrast: 0.26 },
    );
    box3(
      c,
      cam,
      { x: 4.05, y: COUNTER.y + 0.04, w: 0.2, d: 0.1, h: 0.15, z: COUNTER.h + 0.6 },
      { fill: darken(t.metal, 0.3) },
    );
    for (let i = 0; i < 3; i++) {
      box3(
        c,
        cam,
        { x: 6.9 + i * 0.3, y: COUNTER.y + 0.3, w: 0.2, d: 0.2, h: 0.22, z: COUNTER.h },
        { fill: mix(p.bg, p.ink, 0.06) },
      );
    }
  });

  // The fig by the window. Every set gets one living thing.
  st.add(0.5, 3.3, () => {
    softShadow(c, cam, p, 0.5, 3.3, 0.34);
    plant(c, cam, p, 0.5, 3.3, 1.2, 3);
  });

  // Two tables by the window, because a cafe is not only a queue. The
  // pedestals are dark on purpose: at mid grey they disappeared into the wall
  // behind them, which in a projection with no perspective is all the
  // separation there is.
  [[0.95, 2.0], [0.95, 0.85]].forEach(([tx, ty], i) => {
    st.add(tx, ty, () => {
      softShadow(c, cam, p, tx, ty, 0.46, 0.28);
      box3(c, cam, { x: tx - 0.2, y: ty - 0.2, w: 0.4, d: 0.4, h: 0.05 }, { fill: darken(t.metal, 0.5) });
      box3(c, cam, { x: tx - 0.11, y: ty - 0.11, w: 0.22, d: 0.22, h: 0.66, z: 0.05 }, { fill: darken(t.metal, 0.4) });
      box3(
        c,
        cam,
        { x: tx - 0.34, y: ty - 0.34, w: 0.68, d: 0.68, h: 0.09, z: 0.71 },
        { fill: t.wood, contrast: 0.2 },
      );
      if (i === 0) chair(c, cam, p, tx + 0.66, ty - 0.05);
    });
  });
}

// --- the people ------------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.2),
    mix(p.green, p.bg, 0.3),
    t.cloth,
    mix(p.ink, p.bg, 0.45),
    darken(t.clay, 0.15),
  ];
  return coats[id % coats.length];
}

function drawPeople(f: Frame<CafeModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);
  const shape = LAYOUTS[model.layout];
  const sim = model.sim;

  // Baristas: one per till in every arrangement, behind the counter. In the
  // first arrangement there is only one till, so the second member of staff is
  // the same person doing the other job -- which is the whole problem, and the
  // reason that arrangement has one figure standing there and not two.
  shape.tills.forEach((till, i) => {
    const bx = till.x + 0.2;
    const by = COUNTER.y + COUNTER.d + 0.45;
    const serving = sim.busy[Math.min(i, sim.busy.length - 1)]?.some(Boolean);
    st.add(bx, by, () =>
      person(c, cam, p, bx, by, {
        coat: serving ? p.gold : mix(p.gold, p.bg, 0.55),
        skin: mix(t.skin, p.ink, (i % 3) * 0.16),
        hair: darken(t.wood, 0.35 + i * 0.15),
      }),
    );
  });

  // Whoever is at the counter being served. In the split arrangement the one
  // modelled server is the ordering station, so the second figure is somebody
  // picking up a drink that was made while they queued -- which is the
  // arrangement's whole trick, and it should be visible rather than asserted.
  const atTill = (till: Till, held: { id: number } | null | undefined) => {
    if (!held) return;
    const at = pointAt(till.queueHead, 0);
    st.add(at.x, at.y, () => {
      softShadow(c, cam, p, at.x, at.y, 0.26);
      person(c, cam, p, at.x, at.y, {
        coat: p.gold,
        skin: mix(t.skin, p.ink, (held.id % 4) * 0.13),
        hair: darken(coatFor(p, held.id + 2), 0.2),
      });
    });
  };

  if (model.layout === "two") {
    shape.tills.forEach((till, i) => atTill(till, sim.busy[i]?.[0]));
  } else if (model.layout === "pooled") {
    atTill(shape.tills[0], sim.busy[0]?.[0]);
    const collecting = sim.recentlyServed.find((entry) => sim.tick - entry.at < DRINK_TICKS);
    atTill(shape.tills[1], collecting?.customer);
  } else {
    atTill(shape.tills[0], sim.busy[0]?.[0]);
  }

  // And everybody still waiting. A queue longer than the room gets a count
  // rather than a row of figures sliced off at the frame edge -- which is
  // both truer (they really are outside, in the rain, which is the lecture's
  // point about that arrangement) and stops a half-drawn person reading as a
  // rendering bug.
  let outside = 0;
  const place = (queue: { id: number }[], path: Path, from: number) => {
    const room = pathLength(path) + SPACING * 0.5;
    queue.forEach((customer, i) => {
      const d = from + i * SPACING;
      if (d > room) {
        outside += 1;
        return;
      }
      const at = pointAt(path, d);
      // The person at the front of a line is the one the rule has already
      // chosen, so they wear the concept pink. It is the week's whole exercise
      // -- state the rule as an instruction and then watch it pick a human --
      // and in the two-line arrangement it picks two at once, one of them from
      // a line of six and one from a line of one.
      const next = i === 0;
      st.add(at.x, at.y, () => {
        softShadow(c, cam, p, at.x, at.y, 0.24);
        person(c, cam, p, at.x, at.y, {
          coat: next ? p.pinkEdge : coatFor(p, customer.id),
          edge: next ? darken(p.pinkEdge, 0.3) : undefined,
          skin: mix(t.skin, p.ink, (customer.id % 4) * 0.13),
          hair: (customer.id % 3) === 0 ? undefined : darken(coatFor(p, customer.id + 1), 0.3),
        });
      });
    });
  };

  if (model.layout === "two") {
    sim.queues.forEach((queue, lane) => {
      place(queue, shape.tills[lane].queueHead, SPACING);
    });
  } else if (model.layout === "pooled") {
    place(sim.queues[0], POOLED_QUEUE, 0);
  } else {
    place(sim.queues[0], shape.tills[0].queueHead, SPACING);
  }

  if (outside > 0) {
    const at = project(cam, 7.9, 1.5, 0.2);
    st.add(7.9, -1, () =>
      chip(c, p, `${outside} outside`, at.x, at.y, textSize(cam, 10, 8), f.w),
    );
  }
}

// --- annotation ------------------------------------------------------------

function annotate(f: Frame<CafeModel>): void {
  const { c, cam, p, model } = f;
  const shape = LAYOUTS[model.layout];

  // Every queue's own path, as a faint line on the floor. The shape of the
  // line is the thing the week is about, so it gets drawn rather than implied
  // -- and in the two-line arrangement there are two of them, which is the
  // fact the reader is meant to notice.
  const paths: Path[] =
    model.layout === "pooled" ? [POOLED_QUEUE] : shape.tills.map((till) => till.queueHead);
  c.strokeStyle = withAlpha(p.gold, 0.4);
  c.lineWidth = 1.5;
  c.setLineDash([4, 4]);
  for (const path of paths) {
    c.beginPath();
    path.forEach(([x, y], i) => {
      const at = project(cam, x, y, 0.01);
      if (i) c.lineTo(at.x, at.y);
      else c.moveTo(at.x, at.y);
    });
    c.stroke();
  }
  c.setLineDash([]);

  const small = textSize(cam, 10, 7);
  const note = textSize(cam, 11, 8);

  // door and window are orientation, not content: at a width where they would
  // crowd the room they are the first thing to go.
  if (cam.s > 55) {
    const door = project(cam, 8.3, 0.3, 0.75);
    label(c, "door", door.x, door.y, p.soft, small, "center");
    const win = project(cam, 0.25, 3.6, WALL - 0.05);
    label(c, "window", win.x, win.y, p.soft, small, "left");
  }

  const at = project(cam, COUNTER.x + 0.1, COUNTER.y + 1.6, WALL - 0.05);
  label(c, shape.note, at.x, at.y, p.soft, note, "left", "600");

  // The rule, in words, at the foot of the frame.
  //
  // This week's lab exercise is to state a queue's discipline as an
  // instruction, and students find it much harder than it sounds -- so the
  // room states its own, and changes it when the reader changes the rope. Read
  // it against the people in pink: those are the ones this sentence has
  // already chosen, and in the two-line arrangement there are two of them,
  // one at the front of a line of six and one at the front of a line of one.
  const [long, short] = shape.rule;
  const size = textSize(cam, 11, 9);
  c.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  const text = c.measureText(long).width + size * 1.1 <= f.w - 20 ? long : short;
  chip(c, p, text, 10, f.h - size * 1.7 - 8, size, f.w);

  // What each station does, printed on the counter top. The week is about
  // naming the rule, and a room whose stations are unlabelled is exactly the
  // room nobody in the building can describe. Above the counter it collided
  // with the menu board.
  // Below this the names sit on top of the people standing at them, and the
  // arrangement note above already says what the stations are.
  if (cam.s > 50) {
    shape.tills.forEach((till) => {
      const tag = project(cam, till.x, COUNTER.y + 0.2, COUNTER.h + 0.04);
      label(c, till.name, tag.x, tag.y, p.gold, small, "center", "600");
    });
  }
}

// --- the scene -------------------------------------------------------------

export const cafe: SceneDef<CafeModel> = {
  height: 320,
  minHeight: 160,
  warm: 320,
  rate: 12,
  controls: [
    {
      kind: "select",
      key: "layout",
      label: "Arrangement",
      value: "one",
      options: [
        { value: "one", label: "One line, one till" },
        { value: "two", label: "Two lines, two tills" },
        { value: "pooled", label: "One line, two tills" },
      ],
    },
    {
      kind: "range",
      key: "rush",
      label: "Morning rush",
      min: 0.6,
      max: 2.8,
      step: 0.05,
      value: 1.5,
      format: (v) => `${v.toFixed(2)}/min`,
    },
  ],
  readout: [
    { key: "rho", term: "ρ" },
    { key: "L", term: "L" },
    { key: "W", term: "W" },
    { key: "W90", term: "W", sub: "90" },
    { key: "queue", term: "In line now" },
  ],
  build,
  step: (m) => m.sim.step(),
  // Open on a morning that looks like the average one. Over capacity there is
  // no such state and the cap in the host takes over, which is the right
  // answer: that room genuinely never settles.
  representative: (m) =>
    m.stats.over || Math.abs(m.sim.inSystem - m.stats.L) <= Math.max(1, m.stats.L * 0.25),
  extent: () => ROOM,
  report: (m) => {
    const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;
    const over = m.stats.over;
    return {
      rho: m.stats.rho.toFixed(2),
      L: over ? "grows" : m.stats.L.toFixed(1),
      W: over ? "no limit" : mins(m.stats.W),
      W90: over ? "no limit" : mins(m.stats.W90),
      queue: String(m.sim.inSystem),
    };
  },
  regions: {
    /** The tail end, for a later week that needs a queue out of the door. */
    door: { x0: 4.6, x1: 9.4, y0: 0, y1: 2.6, z1: 2.4 },
    /** The counter and whoever is at it. */
    counter: { x0: 1.1, x1: 8.2, y0: 3.1, y1: 6.4, z1: 2.4 },
  },
  draw(f) {
    const st = new Stage();
    shell(f);
    set(f, st);
    drawPeople(f, st);
    st.paint();
    annotate(f);
  },
};
