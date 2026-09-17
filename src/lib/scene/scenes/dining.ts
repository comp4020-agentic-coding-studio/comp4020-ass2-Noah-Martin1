/**
 * Week 9: a restaurant, and the wait that moved into the calendar.
 *
 * The lecture's claim is that a reservation book does not remove waiting, it
 * relocates it -- out of the doorway, into the four days before you arrive,
 * and onto people who wanted a table and never got one and therefore appear in
 * no statistic the restaurant keeps.
 *
 * So the scene is one room under two policies. Walk-in puts a line on the
 * pavement in front of the window, which is the wait everybody can see and the
 * restaurant can measure. Booked empties the pavement completely -- and draws
 * the same wait at the foot of the frame as a dashed outline, at the same scale
 * as the reported one, because that is week 4's bill panel and this is the same
 * trick in a different building.
 *
 * Two models, because the week is about the boundary between them:
 *
 *   the evening   a tick-level service, ten tables, ninety-minute meals, so the
 *                 room fills and empties and the pavement queue is real.
 *   the book      six hundred nights of demand that varies by day of week,
 *                 parties phoning on one day and eating on another, booked to
 *                 the first night with a seat inside ten.
 *
 * Measured, five seeds, 400 nights, eight tables turning 32 parties on a full
 * one:
 *
 *   demand/night   policy    at the door   really waited   turned away   seats
 *        20        walk-in     12 min          12 min        2.2 /night   74%
 *        20        booked       2 min           4.4 hours    0.0 /night   83%
 *        24        walk-in     17 min          17 min        4.2 /night   83%
 *        24        booked       2 min           1.9 nights   0.0 /night   99%
 *        30        walk-in     23 min          23 min        8.1 /night   91%
 *        30        booked       2 min           9.2 nights   5.5 /night  100%
 *
 * Read the first two columns at 24: the published wait falls by a factor of
 * eight and the real one rises by a factor of a hundred and sixty. Both are
 * correct. They start the clock at different moments and only one of those
 * moments happens inside the restaurant.
 *
 * Then read the last two, because the book is not a swindle. It fills 99% of
 * the seats against 83% and turns nobody away at all, by moving a Saturday's
 * overflow onto a Tuesday. Past about 26 a night that stops working -- average
 * demand approaches what the kitchen can turn, the book saturates out to its
 * ten-night horizon, and it is back to turning people away, only now by phone.
 */

import { QueueSim, mulberry32, type Customer } from "../../queue-sim";
import { project, type Extent } from "../project";
import { pathLength, pointAt, type Path } from "../path";
import {
  Stage,
  box3,
  chip,
  counter,
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

/** Five minutes a tick; a ninety-minute dinner is eighteen. */
const TICK_MINUTES = 5;
const MEAL_TICKS = 18;
const TABLES = 8;
/** A service: four and a half hours of arrivals, in ticks. */
const SERVICE_TICKS = 54;
/** How long a party will stand on the pavement before giving up, in parties. */
const PATIENCE = 14;
/** How far ahead the book is open. */
const BOOK_NIGHTS = 10;

/** The dining room, in metres. */
/**
 * The dining room, in metres.
 *
 * y0 is three metres in front of the pavement, and that margin is not scenery.
 * The two-bar panel is painted across the foot of the canvas and the room is
 * clipped out from under it, exactly as week 4's bill is -- but week 4's front
 * edge is empty floor, and this scene's front edge is the queue. Without the
 * margin the panel ate the pavement and the only thing the walk-in policy has
 * to show for itself.
 */
const ROOM: Extent = { x0: 0, x1: 11.0, y0: -3.2, y1: 8.8, z1: 2.8 };
const WALL = 2.6;
/** The window line. Everything below it is pavement. */
const GLASS_Y = 2.2;
const PASS = { x: 1.0, y: 7.4, w: 5.2, d: 0.9, h: 1.1 };

/** Where the tables are. Two rows of five, left to right. */
const TABLES_AT: ReadonlyArray<readonly [number, number]> = [
  [1.7, 6.1],
  [4.0, 6.1],
  [6.3, 6.1],
  [8.6, 6.1],
  [1.7, 4.1],
  [4.0, 4.1],
  [6.3, 4.1],
  [8.6, 4.1],
];

/** The pavement, outside the glass, running past the window. */
const PAVEMENT: Path = [
  [2.0, 0.9],
  [10.4, 0.9],
];
const SPACING = 0.9;

/** The host stand, just inside the door. */
const HOST = { x: 9.9, y: 2.9 };

export type Policy = "walkin" | "booked";

// --- the book --------------------------------------------------------------

export interface BookStats {
  /** Minutes waited at the door. */
  atDoor: number;
  /** Minutes between wanting a table and sitting at one. */
  really: number;
  /** Parties turned away a night. */
  turned: number;
  /** Share of the night's capacity actually used. */
  seats: number;
  /** Nights between phoning and eating, for the booked policy. */
  lead: number;
}

/** Saturday is not Tuesday, and the whole case for a book rests on that. */
const WEEK = [0.62, 0.68, 0.8, 1.05, 1.42, 1.62, 0.81];

interface Evening {
  waitSum: number;
  seated: number;
  balked: number;
}

/**
 * One service, at tick resolution.
 *
 * A closed-form delay was the first attempt and it was wrong in a way worth
 * recording: Erlang-C evaluated at a Saturday's load diverges, because a
 * Saturday is over capacity and a steady-state formula has no way to say
 * "and then the kitchen closed". It reported walk-in waits of four to eight
 * hours. An evening is finite, and that is the property the whole week turns
 * on -- demand above capacity does not produce a longer wait, it produces
 * people who never got a table.
 *
 * `spread` is the difference between the two policies and it is week 2's
 * difference: walk-ins arrive when they like, a booked room receives its
 * guests on a schedule the kitchen wrote.
 */
function evening(showing: number, spread: boolean, rng: () => number): Evening {
  const frees = new Array(TABLES).fill(0);
  const queue: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < showing; i++) {
    times.push(spread ? rng() * SERVICE_TICKS : (i + 0.5) * (SERVICE_TICKS / Math.max(1, showing)));
  }
  times.sort((a, b) => a - b);

  let waitSum = 0;
  let seated = 0;
  let balked = 0;
  let next = 0;
  for (let t = 0; t <= SERVICE_TICKS; t++) {
    while (next < times.length && times[next] <= t) {
      if (queue.length >= PATIENCE) balked += 1;
      else queue.push(times[next]);
      next += 1;
    }
    for (let i = 0; i < TABLES && queue.length > 0; i++) {
      if (frees[i] > t) continue;
      const arrived = queue.shift() as number;
      frees[i] = t + MEAL_TICKS;
      waitSum += t - arrived;
      seated += 1;
    }
  }
  // Last orders. Anyone still outside when the kitchen stops goes home.
  balked += queue.length + (times.length - next);
  return { waitSum, seated, balked };
}

/**
 * Parties a night the kitchen can actually turn, measured rather than asserted
 * -- offer the room far more demand than it can take and count what sits down.
 * The book's per-night cap has to be this number or the two halves of the model
 * disagree about what a full restaurant is.
 */
const CAPACITY = evening(400, false, mulberry32(1)).seated;

const bookCache = new Map<string, BookStats>();
function runBook(perNight: number, policy: Policy): BookStats {
  const key = `${perNight}:${policy}`;
  const hit = bookCache.get(key);
  if (hit) return hit;

  const NIGHTS = 400;
  let seated = 0;
  let turned = 0;
  let leadTotal = 0;
  let waitTotal = 0;
  const seeds = [7, 11, 23, 42, 99];

  for (const seed of seeds) {
    const rng = mulberry32(seed);
    const want: number[] = [];
    for (let night = 0; night < NIGHTS + BOOK_NIGHTS + 2; night++) {
      want.push(Math.round(perNight * WEEK[night % 7] * (0.75 + rng() * 0.5)));
    }

    if (policy === "walkin") {
      // Everybody turns up on the night they wanted. The evening decides who
      // sits down and who stands on the pavement until they give up.
      for (let night = 0; night < NIGHTS; night++) {
        const e = evening(want[night], true, rng);
        seated += e.seated;
        turned += e.balked;
        waitTotal += e.waitSum;
      }
    } else {
      // The book: phone on the night you wanted, eat on the first night inside
      // the horizon that still has a seat. Then the evening runs to schedule.
      const booked = new Array(NIGHTS + BOOK_NIGHTS + 2).fill(0);
      const lead = new Array(NIGHTS + BOOK_NIGHTS + 2).fill(0);
      for (let night = 0; night < NIGHTS; night++) {
        for (let i = 0; i < want[night]; i++) {
          let taken = -1;
          for (let d = 0; d <= BOOK_NIGHTS; d++) {
            if (booked[night + d] < CAPACITY) {
              taken = d;
              break;
            }
          }
          if (taken < 0) {
            turned += 1;
            continue;
          }
          booked[night + taken] += 1;
          lead[night + taken] += taken;
        }
      }
      for (let night = 0; night < NIGHTS; night++) {
        const e = evening(booked[night], false, rng);
        seated += e.seated;
        turned += e.balked;
        waitTotal += e.waitSum;
        leadTotal += lead[night];
      }
    }
  }

  const nights = NIGHTS * seeds.length;
  const door = (waitTotal / Math.max(1, seated)) * TICK_MINUTES;
  const leadNights = leadTotal / Math.max(1, seated);
  const out: BookStats = {
    atDoor: door,
    really: policy === "walkin" ? door : door + leadNights * 24 * 60,
    turned: turned / nights,
    seats: seated / (nights * CAPACITY),
    lead: leadNights,
  };
  bookCache.set(key, out);
  return out;
}

// --- the evening -----------------------------------------------------------

export interface DiningModel {
  sim: QueueSim;
  policy: Policy;
  perNight: number;
  now: BookStats;
  walkin: BookStats;
  /** Which table each seated party is at, so nobody teleports between courses. */
  seat: Map<number, number>;
  free: number[];
}

function configFor(perNight: number, policy: Policy) {
  return {
    seed: 7,
    lanes: 1,
    servers: TABLES,
    mu: 1 / MEAL_TICKS,
    // Demand spread over a five-hour service, on the busiest night of the week.
    lambda: (perNight * WEEK[5]) / SERVICE_TICKS,
    // The book's real mechanism, and week 2's: it does not create capacity, it
    // removes arrival variability. Walk-ins turn up when they like; a booked
    // room receives its guests on a schedule the kitchen chose.
    arrivalCv: policy === "walkin" ? 1 : 0.15,
    serviceCv: 0.7,
    discipline: "fcfs" as const,
  };
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): DiningModel {
  const perNight = Math.round(controls.num("demand", 24));
  const policy = (controls.str("policy", "walkin") as Policy) ?? "walkin";
  return {
    sim: new QueueSim(configFor(perNight, policy)),
    policy,
    perNight,
    now: runBook(perNight, policy),
    walkin: runBook(perNight, "walkin"),
    seat: new Map(),
    free: TABLES_AT.map((_, i) => i),
  };
}

function step(m: DiningModel): void {
  m.sim.step();
  const busy = (m.sim.busy[0] ?? []).filter(Boolean) as Customer[];
  const live = new Set(busy.map((c) => c.id));
  for (const [id, table] of m.seat) {
    if (!live.has(id)) {
      m.seat.delete(id);
      m.free.push(table);
    }
  }
  for (const who of busy) {
    if (m.seat.has(who.id)) continue;
    const table = m.free.shift();
    if (table !== undefined) m.seat.set(who.id, table);
  }
}

// --- the set ---------------------------------------------------------------

function shell(f: Frame<DiningModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  st.add(0, ROOM.y1 + 2, () => {
    box3(
      c,
      cam,
      { x: ROOM.x0, y: ROOM.y1, w: ROOM.x1 - ROOM.x0, d: 0.3, h: WALL },
      { fill: darken(t.stone, 0.16), contrast: 0.08 },
    );
    // Bottle shelves over the pass. Two rows of small blocks is enough.
    for (let row = 0; row < 2; row++) {
      box3(
        c,
        cam,
        { x: 1.0, y: ROOM.y1 - 0.02, w: 5.0, d: 0.22, h: 0.06, z: 1.5 + row * 0.5 },
        { fill: darken(t.wood, 0.2), contrast: 0.2 },
      );
      for (let i = 0; i < 14; i++) {
        const h = 0.2 + ((i * 7 + row * 3) % 5) * 0.04;
        box3(
          c,
          cam,
          { x: 1.1 + i * 0.35, y: ROOM.y1, w: 0.14, d: 0.14, h, z: 1.56 + row * 0.5 },
          {
            fill: [mix(p.green, p.ink, 0.3), darken(t.clay, 0.2), mix(t.wood, p.ink, 0.3)][i % 3],
            contrast: 0.24,
          },
        );
      }
    }
  });

  // The pass, and whoever is behind it.
  st.add(PASS.x, PASS.y, () => {
    softShadow(c, cam, p, PASS.x + PASS.w / 2, PASS.y, PASS.w * 0.55, 0.5);
    counter(c, cam, p, PASS, mix(t.stone, p.ink, 0.18));
    // Heat lamps: the one warm light in the room.
    for (const lx of [2.0, 3.4, 4.8]) {
      box3(
        c,
        cam,
        { x: lx, y: PASS.y + 0.3, w: 0.36, d: 0.12, h: 0.1, z: 1.75 },
        { fill: withAlpha(p.gold, 0.8), contrast: 0.2 },
      );
    }
  });
  st.add(3.0, PASS.y + 1.0, () =>
    person(c, cam, p, 3.0, PASS.y + 1.0, {
      coat: mix(p.ground, p.bg, 0.3),
      skin: mix(t.skin, p.ink, 0.22),
      hair: darken(t.wood, 0.45),
      h: 1.66,
    }),
  );

  /**
   * The window, as a sill and nothing else.
   *
   * The first version had mullions and a head rail, which is what a shopfront
   * has and which in this projection is a row of vertical bars painted across
   * every diner in the room -- a post at y 2 and z 2.3 covers everything
   * behind it, however far behind it that is. The sill alone separates
   * pavement from room, and the room is the thing worth seeing.
   */
  st.add(0, GLASS_Y, () => {
    box3(
      c,
      cam,
      { x: 0.3, y: GLASS_Y, w: 10.4, d: 0.24, h: 0.5 },
      { fill: darken(t.wood, 0.22), contrast: 0.22 },
    );
    box3(
      c,
      cam,
      { x: 0.3, y: GLASS_Y - 0.03, w: 10.4, d: 0.3, h: 0.07, z: 0.5 },
      { fill: mix(t.wood, p.bg, 0.1), contrast: 0.24 },
    );
  });

  // The host stand and the book on it. Gold, because it is the object the
  // whole week is about.
  st.add(HOST.x, HOST.y, () => {
    softShadow(c, cam, p, HOST.x, HOST.y, 0.42, 0.26);
    box3(
      c,
      cam,
      { x: HOST.x - 0.35, y: HOST.y - 0.25, w: 0.7, d: 0.5, h: 1.06 },
      { fill: darken(t.wood, 0.1), contrast: 0.24 },
    );
    box3(
      c,
      cam,
      { x: HOST.x - 0.3, y: HOST.y - 0.2, w: 0.6, d: 0.4, h: 0.06, z: 1.06 },
      { fill: model.policy === "booked" ? p.gold : mix(p.ground, p.ink, 0.2), contrast: 0.2 },
    );
  });
  st.add(HOST.x - 0.1, HOST.y + 0.75, () =>
    person(c, cam, p, HOST.x - 0.1, HOST.y + 0.75, {
      coat: mix(p.ink, p.bg, 0.22),
      skin: mix(t.skin, p.ink, 0.1),
      hair: darken(t.wood, 0.5),
      h: 1.68,
    }),
  );

  // The room's green: two olive trees in the window and a run of planting along
  // the left wall. A restaurant that keeps plants is saying it expects you to
  // sit for a while.
  st.add(0.7, 3.0, () => plant(c, cam, p, 0.7, 3.0, 1.15, 4));
  st.add(10.5, 6.6, () => plant(c, cam, p, 10.5, 6.6, 1.0, 9));
  st.add(0.6, 5.6, () => {
    softShadow(c, cam, p, 0.6, 5.6, 0.5, 0.9);
    box3(
      c,
      cam,
      { x: 0.3, y: 4.8, w: 0.6, d: 1.7, h: 0.42 },
      { fill: darken(t.clay, 0.1), contrast: 0.22 },
    );
    box3(
      c,
      cam,
      { x: 0.35, y: 4.86, w: 0.5, d: 1.58, h: 0.3, z: 0.42 },
      { fill: mix(p.green, p.ink, 0.14), contrast: 0.3 },
    );
  });

  // Tables. Drawn whether or not anyone is at them: an empty restaurant with
  // no tables in it is a warehouse.
  TABLES_AT.forEach(([tx, ty], i) => {
    st.add(tx, ty, () => {
      softShadow(c, cam, p, tx, ty, 0.52, 0.3);
      box3(c, cam, { x: tx - 0.08, y: ty - 0.08, w: 0.16, d: 0.16, h: 0.66 }, { fill: darken(t.metal, 0.3) });
      box3(
        c,
        cam,
        { x: tx - 0.46, y: ty - 0.4, w: 0.92, d: 0.8, h: 0.07, z: 0.66 },
        { fill: mix(t.wood, p.bg, 0.12), contrast: 0.22 },
      );
      // A candle, lit when somebody is sitting there.
      const taken = [...f.model.seat.values()].includes(i);
      box3(
        c,
        cam,
        { x: tx - 0.05, y: ty - 0.05, w: 0.1, d: 0.1, h: 0.16, z: 0.73 },
        { fill: taken ? withAlpha(p.gold, 0.9) : mix(p.ground, p.ink, 0.18) },
      );
    });
  });
}

// --- the people ------------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.3),
    t.cloth,
    darken(t.clay, 0.18),
    mix(p.ink, p.bg, 0.55),
    mix(t.wood, p.ink, 0.26),
    mix(p.green, p.ink, 0.34),
  ];
  return coats[id % coats.length];
}

function people(f: Frame<DiningModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  for (const [id, table] of model.seat) {
    const [tx, ty] = TABLES_AT[table];
    // Two diners, one either side, seated: short, and offset from the table so
    // the table edge reads between them.
    // One either side of the table, near and far, so the tabletop reads
    // between them. Both on the same side and they were a crowd with furniture
    // somewhere behind it.
    for (const near of [true, false]) {
      const dx = near ? -0.3 : 0.3;
      const dy = near ? -0.62 : 0.66;
      st.add(tx + dx, ty + dy, () =>
        person(c, cam, p, tx + dx, ty + dy, {
          coat: coatFor(p, id + (near ? 0 : 3)),
          skin: mix(t.skin, p.ink, ((id + (near ? 0 : 1)) % 4) * 0.11),
          hair: (id + (near ? 0 : 2)) % 3 === 0 ? undefined : darken(t.wood, 0.4),
          h: 1.1,
        }),
      );
    }
  }

  const waiting = model.sim.queues[0] ?? [];
  const room = pathLength(PAVEMENT);
  waiting.forEach((who, i) => {
    const d = SPACING * 0.5 + i * SPACING;
    if (d > room) return;
    const at = pointAt(PAVEMENT, d);
    st.add(at.x, at.y, () => {
      softShadow(c, cam, p, at.x, at.y, 0.28);
      person(c, cam, p, at.x, at.y, {
        coat: coatFor(p, who.id),
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.11),
        hair: who.id % 3 === 0 ? undefined : darken(coatFor(p, who.id + 1), 0.32),
      });
    });
  });
}

// --- the two waits ---------------------------------------------------------

/**
 * The wait the restaurant reports, and the wait people did.
 *
 * Two bars at one scale across the foot of the frame, which is week 4's bill
 * panel deliberately reused: solid for the figure that appears in the
 * management account, a dashed empty outline for the one that does not. In
 * week 4 the invisible bar was twice the visible one. Here it is two thousand
 * times, and the solid bar is a sliver you have to be told is there.
 */
const panelHeight = (h: number) => Math.min(56, Math.max(42, h * 0.18));

function waits(f: Frame<DiningModel>, panelH: number): void {
  const { c, p, model, w, h } = f;
  const t = tints(p);
  const top = h - panelH;
  const size = Math.max(9, Math.min(11, w * 0.011));

  c.fillStyle = p.ground;
  c.fillRect(0, top, w, panelH);
  c.strokeStyle = withAlpha(p.rule, 0.8);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, top + 0.5);
  c.lineTo(w, top + 0.5);
  c.stroke();

  const pad = 12;
  const span = w - pad * 2;
  const big = Math.max(model.now.really, 1);
  const barH = Math.max(7, (panelH - size * 3.4) / 2);

  const bar = (value: number, row: number, solid: boolean, text: string) => {
    const y = top + size * 1.5 + row * (barH + 6);
    const width = Math.max(solid ? 3 : 6, (value / big) * span);
    if (solid) {
      c.fillStyle = mix(t.stone, p.ink, 0.35);
      c.fillRect(pad, y, width, barH);
    } else {
      c.setLineDash([5, 4]);
      c.strokeStyle = p.pinkEdge;
      c.lineWidth = 1.6;
      c.strokeRect(pad + 0.5, y + 0.5, width - 1, barH - 1);
      c.setLineDash([]);
    }
    // Inside the bar once it is wide enough to hold the words, outside while
    // it is a sliver. Right-aligning at the frame edge put both labels on top
    // of each other's bars whenever the two waits were equal.
    const inside = width > span * 0.55;
    label(
      c,
      text,
      inside ? pad + 8 : pad + width + 8,
      y + barH - Math.max(1, (barH - size) / 2),
      inside ? (solid ? p.bg : p.ink) : solid ? p.soft : p.ink,
      size,
      "left",
      solid ? "500" : "600",
    );
  };

  const mins = (n: number) =>
    n < 90 ? `${n.toFixed(0)} min` : n < 60 * 24 ? `${(n / 60).toFixed(1)} hours` : `${(n / 1440).toFixed(1)} nights`;

  bar(model.now.atDoor, 0, true, `at the door — what gets published: ${mins(model.now.atDoor)}`);
  bar(
    model.now.really,
    1,
    false,
    model.policy === "walkin"
      ? "the same wait, because there is nowhere else for it to be"
      : `from wanting a table: ${mins(model.now.really)}`,
  );
}

// --- the scene -------------------------------------------------------------

export const dining: SceneDef<DiningModel> = {
  height: 340,
  minHeight: 150,
  warm: 900,
  rate: 12,
  controls: [
    {
      kind: "select",
      key: "policy",
      label: "The room takes",
      value: "walkin",
      options: [
        { value: "walkin", label: "Walk-ins" },
        { value: "booked", label: "Bookings" },
      ],
    },
    {
      kind: "range",
      key: "demand",
      label: "Parties wanting a table",
      // Below thirty the book has somewhere to put a Saturday's overflow;
      // above it, average demand exceeds what the kitchen can turn and the
      // book simply saturates out to its ten-night horizon. Both halves of
      // that are worth reaching, and the default sits on the useful side.
      min: 18,
      max: 30,
      step: 1,
      value: 24,
      format: (v) => `${v}/night`,
    },
  ],
  readout: [
    { key: "door", term: "W", sub: "at the door" },
    { key: "real", term: "W", sub: "from wanting a table" },
    { key: "turned", term: "turned away", sub: "a night" },
    { key: "seats", term: "seats filled" },
    { key: "doorWalk", term: "W", sub: "at the door, walk-in" },
  ],
  build,
  step,
  representative: (m) => m.seat.size >= TABLES - 3,
  extent: () => ROOM,
  report: (m) => ({
    door: m.now.atDoor < 90 ? `${m.now.atDoor.toFixed(0)} min` : `${(m.now.atDoor / 60).toFixed(1)} hr`,
    real:
      m.policy === "walkin"
        ? m.now.really < 90
          ? `${m.now.really.toFixed(0)} min`
          : `${(m.now.really / 60).toFixed(1)} hr`
        : `${m.now.lead.toFixed(1)} nights`,
    turned: m.now.turned.toFixed(1),
    seats: `${(m.now.seats * 100).toFixed(0)}%`,
    doorWalk: `${m.walkin.atDoor.toFixed(0)} min`,
  }),
  regions: {
    /** The dining room without the pavement. */
    room: { x0: 0.4, x1: 10.8, y0: 2.4, y1: 8.8, z1: 2.6 },
    /** The pavement outside the window. */
    pavement: { x0: 1.6, x1: 10.8, y0: 0.4, y1: 2.6, z1: 2.1 },
  },
  draw(f) {
    // A snippet gets the room and no panel, for the same reason week 4's does:
    // a crop arriving in a later week with a bar chart stapled under it is not
    // a recall of anything.
    if (f.region) {
      const st = new Stage();
      shell(f, st);
      people(f, st);
      st.paint();
      return;
    }
    const panelH = panelHeight(f.h);
    f.c.save();
    f.c.beginPath();
    f.c.rect(0, 0, f.w, f.h - panelH);
    f.c.clip();
    const st = new Stage();
    shell(f, st);
    people(f, st);
    st.paint();
    f.c.restore();
    waits(f, panelH);
  },
};
