/**
 * Week 6: an express lane, and the trolley that never reaches the front.
 *
 * The lecture's opening is five people at one counter with 1, 2, 3, 4 and 10
 * minutes of work, and the claim that reordering them changes total waiting by
 * a factor of three without making anyone faster. That much is a Gantt chart.
 * What a Gantt chart cannot show is what happens when the arrivals keep coming,
 * which is the part of shortest-job-first that matters in a building.
 *
 * So this is a supermarket checkout with one operator, and the selector is the
 * rule the operator serves by. Job length is visible before service starts --
 * it is the stack of shopping in the trolley -- which is exactly the
 * prerequisite beat 5 says SJF needs and FCFS never asks for.
 *
 * The overlay is the person paying. Every time the till takes somebody who
 * arrived later, whoever was skipped is counted, and the most-skipped shopper
 * in the line wears pink with a running tally over their head. Under arrival
 * order that tally is structurally zero. Under shortest-first the big trolley
 * collects passes until it goes off the end of the count, which is starvation
 * happening in front of the reader rather than being asserted at them.
 *
 * Measured, three seeds, a simulated month of trading, one till at two and a
 * half minutes a shopper:
 *
 *   /hr   rho    W arrival   W smallest   80+ items, arrival   80+ items, smallest
 *    18   0.75   10.7 min      6.6 min         18.8 min              34.7 min
 *    20   0.83   17.0          8.5             25.9                  60.3
 *    22   0.92   33.2         12.5             42.0                 141.1
 *
 * And the number that does not belong on a readout because it is not an
 * average: the worst wait anyone suffered in that month. At 20/hr it is an
 * hour and three quarters under arrival order and thirteen hours forty under
 * smallest-first. Nothing broke. That shopper was simply never the smallest
 * basket in the line.
 *
 * Opens at 20: the mean halves, and the full trolleys pay for it with two and
 * a third times the wait. Both columns sit on the readout at once, because the
 * whole lecture is that the first number improving is not the same event as
 * the system improving.
 */

import { QueueSim, type Customer } from "../../queue-sim";
import { converge, type Converged } from "../stats";
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
  screen,
  softShadow,
  textSize,
  tints,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/** Five seconds a tick, so a two-and-a-half-minute shop is thirty ticks. */
const TICK_SECONDS = 5;
const SERVICE_TICKS = 30;

/**
 * The checkout end of the shop, in metres.
 *
 * Small on purpose. The first version gave this scene the bank's room -- 16 m
 * by 12 -- and the camera fits the whole footprint, so a line of four shoppers
 * came out forty pixels tall in the middle of an empty grey hall. The set only
 * has to hold one till and the people waiting at it.
 */
const ROOM: Extent = { x0: 0, x1: 9.6, y0: 0.6, y1: 8.8, z1: 2.4 };
const WALL = 2.2;

/** The open till: belt, screen, bagging shelf, and the operator behind it. */
const TILL_X = 2.9;
const BELT = { y: 5.8, d: 1.8, h: 0.9 };
/**
 * The operator, behind the belt.
 *
 * The bagging shelf sits to the LEFT of the belt rather than beside the till,
 * which is not how a supermarket is laid out and is the only way the operator
 * is visible. With the shelf on the till side, a 1.0 m counter at y 6.75 hides
 * everything below their collar and the one person actually doing the serving
 * is a green sliver.
 */
const OPERATOR = { x: TILL_X + 0.6, y: BELT.y + 1.5 };
const BAGGING_X = TILL_X - 1.9;
/** Where the shopper being served stands: at the near end of their own belt. */
const SERVED = { x: TILL_X, y: BELT.y - 1.5 };
/** The lane beside it, closed, chained off. One server is the whole premise. */
const CLOSED_X = 6.3;

/** The line: toward the viewer, then a turn along the front of the store. */
const LINE: Path = [
  [TILL_X, 3.9],
  [TILL_X, 1.3],
  [7.6, 1.3],
];
const SPACING = 1.15;

export type Rule = "fcfs" | "sjf";

/**
 * A shopper's basket, in items.
 *
 * Work is in ticks and exponentially spread, so this is just a rescaling -- but
 * it is the rescaling that makes the rule legible. Nobody can see that a job is
 * ninety ticks long. Everybody can see a trolley piled to the handle.
 */
const itemsOf = (work: number) => Math.max(1, Math.round(work * 0.8));
/**
 * Above this, the shopper is one of the ones SJF charges.
 *
 * Eighty items is a hundred ticks of work, which is the lecture's ten-minute
 * job arriving in a supermarket. It is one basket in twenty-eight, and that is
 * the point: the group paying is small enough to vanish from an average and
 * large enough to be somebody every day.
 */
const BIG_ITEMS = 80;

function configFor(perHour: number, rule: Rule) {
  return {
    seed: 7,
    lanes: 1,
    servers: 1,
    mu: 1 / SERVICE_TICKS,
    lambda: perHour / (3600 / TICK_SECONDS),
    arrivalCv: 1,
    serviceCv: 1,
    discipline: rule,
  };
}

/**
 * Mean wait of the biggest quarter of baskets, in ticks.
 *
 * converge() reports the mean and the ninetieth percentile of everybody, and
 * neither of those is the sentence this week needs. The claim is not that some
 * unnamed tail suffers; it is that a specific, identifiable, visible group pays
 * -- the ones with the full trolley -- so the measurement has to be conditioned
 * on basket size the same way the eye is.
 */
const bigCache = new Map<string, number>();
function bigBasketWait(perHour: number, rule: Rule): number {
  const key = `${perHour}:${rule}`;
  const hit = bigCache.get(key);
  if (hit !== undefined) return hit;
  const seeds = [7, 11, 23];
  const TICKS = 160000;
  let total = 0;
  let n = 0;
  for (const seed of seeds) {
    const sim = new QueueSim({ ...configFor(perHour, rule), seed });
    sim.run(5000);
    // recentlyServed holds each departure for eighteen ticks, so the same one
    // is seen many times; work survives service untouched (only `remaining`
    // is decremented), so the basket can be read off the departing customer.
    for (let i = 0; i < TICKS; i++) {
      sim.step();
      for (const r of sim.recentlyServed) {
        // Entries linger eighteen ticks, so only the ones stamped with the
        // current tick are new. Filtering on a high-water id instead would be
        // wrong under SJF, which is precisely the discipline that lets a later
        // arrival depart first.
        if (r.at !== sim.tick) continue;
        if (itemsOf(r.customer.work) >= BIG_ITEMS) {
          total += r.at - r.customer.arrivedAt;
          n += 1;
        }
      }
    }
  }
  const out = n === 0 ? 0 : total / n;
  bigCache.set(key, out);
  return out;
}

export interface CheckoutModel {
  sim: QueueSim;
  fcfs: Converged;
  sjf: Converged;
  bigFcfs: number;
  bigSjf: number;
  rule: Rule;
  perHour: number;
  /** Times each waiting shopper has been passed over, by id. */
  passed: Map<number, number>;
  /** Every pass since the shop opened. */
  passes: number;
  /** Who was at the till last tick, so a new service can be detected. */
  lastServed: number;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): CheckoutModel {
  const perHour = Math.round(controls.num("rate", 20));
  const rule = (controls.str("rule", "fcfs") as Rule) ?? "fcfs";
  return {
    sim: new QueueSim(configFor(perHour, rule)),
    fcfs: converge(configFor(perHour, "fcfs")),
    sjf: converge(configFor(perHour, "sjf")),
    bigFcfs: bigBasketWait(perHour, "fcfs"),
    bigSjf: bigBasketWait(perHour, "sjf"),
    rule,
    perHour,
    passed: new Map(),
    passes: 0,
    lastServed: -1,
  };
}

function step(m: CheckoutModel): void {
  m.sim.step();
  const held = m.sim.busy[0]?.[0];
  if (held && held.id !== m.lastServed) {
    m.lastServed = held.id;
    // Everybody still in the line who was already here when this shopper
    // arrived has just been passed. Under FCFS the engine always takes the
    // front of the queue, so this loop finds nobody -- not rarely, never.
    for (const waiting of m.sim.queues[0] ?? []) {
      if (waiting.arrivedAt < held.arrivedAt) {
        m.passed.set(waiting.id, (m.passed.get(waiting.id) ?? 0) + 1);
        m.passes += 1;
      }
    }
    const live = new Set((m.sim.queues[0] ?? []).map((c) => c.id));
    for (const id of m.passed.keys()) if (!live.has(id)) m.passed.delete(id);
  }
}

/** The shopper the rule is charging: most passed, ties to the bigger trolley. */
function victim(m: CheckoutModel): Customer | null {
  let best: Customer | null = null;
  let most = 0;
  for (const c of m.sim.queues[0] ?? []) {
    const n = m.passed.get(c.id) ?? 0;
    if (n > most || (n === most && n > 0 && best && c.work > best.work)) {
      most = n;
      best = c;
    }
  }
  return best;
}

// --- the set ---------------------------------------------------------------

/** Floor, back wall, shelving, and the produce stand that carries the green. */
function shell(f: Frame<CheckoutModel>, st: Stage): void {
  const { c, cam, p } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  // Back wall, darkened rather than mixed toward the ink: --q-ink is near-white
  // in dark mode, so a wall mixed toward it comes out brighter than the floor.
  st.add(0, ROOM.y1 + 2, () => {
    box3(
      c,
      cam,
      { x: ROOM.x0, y: ROOM.y1, w: ROOM.x1 - ROOM.x0, d: 0.3, h: WALL },
      { fill: darken(t.stone, 0.14), contrast: 0.08 },
    );
  });

  /**
   * A run of shelving: a low unit with two tiers of product on it.
   *
   * Waist height, not head height. A full-height gondola is what a supermarket
   * actually has and what the first version drew, and at this camera it is a
   * grey slab that hides the till and reads as a second wall. Cut to 1.1 m the
   * shopping is visible over the top, which is the only part that says "shop".
   */
  const shelving = (x: number, y: number, w: number, seed: number) => {
    st.add(x, y, () => {
      softShadow(c, cam, p, x + w / 2, y, w * 0.52, 0.42);
      box3(c, cam, { x, y, w, d: 0.7, h: 1.05 }, { fill: t.metal, contrast: 0.2 });
      for (let tier = 0; tier < 2; tier++) {
        for (let i = 0; i < Math.floor(w / 0.38); i++) {
          const wobble = Math.abs(Math.sin((seed + i * 3 + tier * 7) * 12.9898) * 43758.5453) % 1;
          const shade = [t.clay, mix(p.gold, p.ink, 0.45), t.cloth, mix(p.green, p.ink, 0.28)][
            Math.floor(wobble * 4)
          ];
          box3(
            c,
            cam,
            {
              x: x + 0.05 + i * 0.38,
              y: y + 0.08 + tier * 0.3,
              w: 0.28,
              d: 0.26,
              h: 0.2 + wobble * 0.16,
              z: 1.05,
            },
            { fill: shade, contrast: 0.22 },
          );
        }
      }
    });
  };
  shelving(0.3, 8.1, 2.8, 3);
  shelving(3.6, 8.1, 2.8, 11);

  // The produce stand: this scene's green, and the one thing in a supermarket
  // allowed to be this colour. Angled crates of leaf on a timber table.
  st.add(7.3, 7.2, () => {
    softShadow(c, cam, p, 8.1, 7.1, 1.1, 0.6);
    box3(c, cam, { x: 7.3, y: 6.6, w: 1.7, d: 1.4, h: 0.68 }, { fill: t.wood, contrast: 0.22 });
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 7.38 + col * 0.54;
        const y = 6.7 + row * 0.64;
        box3(
          c,
          cam,
          { x, y, w: 0.46, d: 0.54, h: 0.14, z: 0.68 },
          { fill: darken(t.clay, 0.12), contrast: 0.2 },
        );
        box3(
          c,
          cam,
          { x: x + 0.04, y: y + 0.05, w: 0.38, d: 0.44, h: 0.18, z: 0.8 },
          { fill: row ? p.green : mix(p.green, p.bg, 0.24), contrast: 0.3 },
        );
      }
    }
  });

  // The closed lane. Every supermarket has one, and it is the cheapest way to
  // say that the number of servers is not what is being varied this week.
  st.add(CLOSED_X, BELT.y, () => {
    softShadow(c, cam, p, CLOSED_X + 0.5, BELT.y, 1.4, 0.9);
    box3(
      c,
      cam,
      { x: CLOSED_X - 0.7, y: BELT.y - 0.9, w: 1.4, d: BELT.d, h: BELT.h },
      { fill: darken(t.metal, 0.12), contrast: 0.2 },
    );
    counter(c, cam, p, { x: CLOSED_X + 0.72, y: BELT.y - 0.5, w: 1.0, d: 1.15, h: 0.95 }, mix(t.stone, p.ink, 0.07));
    box3(
      c,
      cam,
      { x: CLOSED_X + 0.82, y: BELT.y - 0.1, w: 0.7, d: 0.06, h: 0.28, z: 0.95 },
      { fill: tints(p).screen, contrast: 0.2 },
    );
    // The chain across the lane entrance.
    const a = project(cam, CLOSED_X - 0.7, BELT.y - 1.5, 0.95);
    const b = project(cam, CLOSED_X + 1.05, BELT.y - 1.5, 0.95);
    c.strokeStyle = darken(t.metal, 0.3);
    c.lineWidth = 2;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 7, b.x, b.y);
    c.stroke();
    c.setLineDash([]);
  });

  /**
   * The lane sign, mounted on the back wall above the till.
   *
   * Hung from the ceiling over the lane -- which is where a supermarket puts
   * it -- it landed across the operator's chest, and moving it along the lane
   * only moved the collision. This projection folds depth into screen height,
   * so a board at a low y and a person at a high y occupy the same band
   * whatever their real separation; the only reliable clearance is to put the
   * sign further back than everything it must not touch. On the wall it is.
   */
  st.add(TILL_X, ROOM.y1 + 1, () => {
    screen(c, cam, p, {
      x: TILL_X - 0.95,
      y: ROOM.y1,
      w: 1.9,
      h: 0.6,
      z: 1.45,
      lines:
        f.model.rule === "sjf" ? ["EXPRESS", "12 ITEMS OR FEWER"] : ["CHECKOUT 4", "ALL WELCOME"],
      accent: p.gold,
    });
  });
}

/** The checkout unit itself: belt, till, bagging shelf, operator. */
function till(f: Frame<CheckoutModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  st.add(TILL_X, BELT.y, () => {
    softShadow(c, cam, p, TILL_X - 0.35, BELT.y, 2.2, 0.95);
    // The belt, drawn low and dark so the shopping on it reads.
    box3(
      c,
      cam,
      { x: TILL_X - 0.7, y: BELT.y - 0.9, w: 1.4, d: BELT.d, h: BELT.h },
      { fill: t.metal, contrast: 0.22 },
    );
    box3(
      c,
      cam,
      { x: TILL_X - 0.63, y: BELT.y - 0.84, w: 1.26, d: BELT.d - 0.12, h: 0.04, z: BELT.h },
      { fill: darken(t.metal, 0.32), contrast: 0.1 },
    );
    // The till housing and its screen, and the bagging shelf beyond it.
    // The till screen, on a stalk at the operator's end of the belt.
    box3(
      c,
      cam,
      { x: TILL_X + 0.5, y: BELT.y + 0.5, w: 0.1, d: 0.1, h: 0.5, z: BELT.h },
      { fill: darken(t.metal, 0.3) },
    );
    box3(
      c,
      cam,
      { x: TILL_X + 0.34, y: BELT.y + 0.46, w: 0.42, d: 0.12, h: 0.32, z: BELT.h + 0.5 },
      { fill: t.screen, contrast: 0.26 },
    );

    // Bagging, off to the left, with a bag frame on it.
    counter(c, cam, p, {
      x: BAGGING_X,
      y: BELT.y - 0.5,
      w: 1.05,
      d: 1.15,
      h: 0.95,
    }, mix(t.stone, p.ink, 0.17));
    box3(
      c,
      cam,
      { x: BAGGING_X + 0.2, y: BELT.y - 0.15, w: 0.06, d: 0.06, h: 0.46, z: 0.95 },
      { fill: darken(t.metal, 0.3) },
    );
    box3(
      c,
      cam,
      { x: BAGGING_X + 0.68, y: BELT.y - 0.15, w: 0.06, d: 0.06, h: 0.46, z: 0.95 },
      { fill: darken(t.metal, 0.3) },
    );
    box3(
      c,
      cam,
      { x: BAGGING_X + 0.23, y: BELT.y - 0.12, w: 0.48, d: 0.36, h: 0.34, z: 0.95 },
      { fill: mix(p.ground, p.green, 0.18), contrast: 0.2 },
    );

    // The shopping currently being scanned, as blocks on the belt.
    const held = model.sim.busy[0]?.[0];
    if (held) {
      const n = Math.min(7, Math.ceil(itemsOf(held.work) / 8));
      for (let i = 0; i < n; i++) {
        box3(
          c,
          cam,
          {
            x: TILL_X - 0.55 + (i % 2) * 0.58,
            y: BELT.y - 0.72 + Math.floor(i / 2) * 0.46,
            w: 0.4,
            d: 0.34,
            h: 0.2 + (i % 3) * 0.08,
            z: BELT.h + 0.04,
          },
          { fill: [t.clay, p.gold, t.cloth, mix(p.green, p.ink, 0.2)][i % 4], contrast: 0.24 },
        );
      }
    }
  });

  st.add(OPERATOR.x, OPERATOR.y, () => {
    person(c, cam, p, OPERATOR.x, OPERATOR.y, {
      coat: mix(p.green, p.bg, 0.1),
      skin: mix(t.skin, p.ink, 0.16),
      hair: darken(t.wood, 0.4),
      h: 1.66,
    });
  });
}

// --- the shoppers ----------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.3),
    t.cloth,
    darken(t.clay, 0.16),
    mix(p.ink, p.bg, 0.52),
    mix(t.wood, p.ink, 0.28),
  ];
  return coats[id % coats.length];
}

/**
 * A trolley, loaded to the height of the job inside it.
 *
 * The first version was a pale box on four legs, which at this camera is a side
 * table. A trolley reads from three things and none of them is the box: small
 * wheels, a dark wire basket with a lighter rim, and a pile standing proud of
 * that rim. The pile is the job length, and it is the only number in this scene
 * a reader can compare across six people at a glance.
 */
function trolley(
  f: Frame<CheckoutModel>,
  x: number,
  y: number,
  items: number,
  marked: boolean,
): void {
  const { c, cam, p } = f;
  const t = tints(p);
  const load = Math.min(1, items / 80);
  const deep = 0.3 + load * 0.2;
  const wire = marked ? darken(p.pinkEdge, 0.18) : darken(t.metal, 0.3);
  const rim = marked ? p.pinkEdge : t.metal;

  const wheel = (dx: number) =>
    box3(c, cam, { x: x + dx, y: y - 0.16, w: 0.07, d: 0.07, h: 0.15 }, { fill: darken(t.metal, 0.5) });
  wheel(-0.24);
  wheel(0.17);

  box3(
    c,
    cam,
    { x: x - 0.28, y: y - 0.2, w: 0.56, d: 0.44, h: deep, z: 0.15 },
    { fill: wire, edge: rim, contrast: 0.24 },
  );
  // The handle, which is what says "trolley" rather than "crate".
  box3(
    c,
    cam,
    { x: x - 0.28, y: y + 0.2, w: 0.56, d: 0.05, h: 0.14, z: 0.15 + deep },
    { fill: rim, contrast: 0.2 },
  );
  // The shopping, piled above the rim. Everything over twelve items shows.
  if (items > 12) {
    const pile = 0.08 + load * 0.4;
    box3(
      c,
      cam,
      { x: x - 0.24, y: y - 0.16, w: 0.48, d: 0.36, h: pile, z: 0.15 + deep },
      {
        fill: marked ? p.pinkEdge : mix(t.clay, p.gold, 0.35),
        edge: marked ? darken(p.pinkEdge, 0.3) : undefined,
        contrast: 0.26,
      },
    );
    if (items > 44) {
      box3(
        c,
        cam,
        { x: x - 0.15, y: y - 0.1, w: 0.3, d: 0.26, h: pile * 0.5, z: 0.15 + deep + pile },
        { fill: marked ? mix(p.pink, p.ink, 0.12) : mix(t.cloth, p.gold, 0.25), contrast: 0.26 },
      );
    }
  }
}

function shoppers(f: Frame<CheckoutModel>, st: Stage, paying: Customer | null): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  const shopper = (x: number, y: number, who: Customer, gold: boolean) => {
    const marked = !gold && paying !== null && who.id === paying.id;
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.3);
      trolley(f, x + 0.55, y - 0.1, itemsOf(who.work), marked);
      person(c, cam, p, x, y, {
        coat: gold ? p.gold : marked ? p.pinkEdge : coatFor(p, who.id),
        edge: marked ? darken(p.pinkEdge, 0.32) : undefined,
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.11),
        hair: who.id % 3 === 0 ? undefined : darken(coatFor(p, who.id + 2), 0.34),
      });
    });
  };

  const held = model.sim.busy[0]?.[0];
  if (held) shopper(SERVED.x, SERVED.y, held, true);

  const room = pathLength(LINE);
  (model.sim.queues[0] ?? []).forEach((who, i) => {
    const d = SPACING * 0.6 + i * SPACING;
    if (d > room) return;
    const at = pointAt(LINE, d);
    shopper(at.x, at.y, who, false);
  });
}

// --- the bill --------------------------------------------------------------

/**
 * The tally over the head of whoever the rule is charging, and the count since
 * the shop opened.
 *
 * Drawn after the depth sort, in screen space, because a number is a report
 * about the line rather than an object standing in it -- and because at eleven
 * pixels anything drawn into the room gets walked in front of.
 */
function tally(f: Frame<CheckoutModel>, paying: Customer | null): void {
  const { c, cam, p, model, w } = f;
  const size = textSize(cam, 11, 9);

  if (paying) {
    const n = model.passed.get(paying.id) ?? 0;
    const queue = model.sim.queues[0] ?? [];
    const i = queue.findIndex((q) => q.id === paying.id);
    const at = pointAt(LINE, SPACING * 0.6 + Math.max(0, i) * SPACING);
    const head = project(cam, at.x, at.y, 1.95);
    // Beside the shopper, not above them. Above, it collided with the lane
    // sign on the back wall -- the same depth-into-height fold that moved the
    // sign there in the first place. To the right is open floor at every
    // position the line can reach.
    const x = head.x + size * 1.1;
    const y = head.y - size * 1.5;
    c.strokeStyle = withAlpha(p.pinkEdge, 0.9);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(head.x, head.y);
    c.lineTo(x, y + size * 0.85);
    c.stroke();
    chip(c, p, `${itemsOf(paying.work)} items, passed ${n}x`, x, y, size, w);
  }

  if (f.region) return;
  chip(
    c,
    p,
    model.rule === "fcfs"
      ? "since the shop opened: nobody has been passed, and nobody can be"
      : `since the shop opened: ${model.passes} shoppers passed over`,
    10,
    f.h - size * 1.7 - 8,
    size,
    w,
  );
}

// --- the scene -------------------------------------------------------------

const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;

export const checkout: SceneDef<CheckoutModel> = {
  height: 330,
  minHeight: 140,
  warm: 2000,
  rate: 22,
  controls: [
    {
      kind: "select",
      key: "rule",
      // Opens on arrival order: the reader has to watch the rule they already
      // believe in before the replacement means anything, exactly as week 5
      // opens on four ropes.
      label: "The till serves",
      value: "fcfs",
      options: [
        { value: "fcfs", label: "In arrival order" },
        { value: "sjf", label: "Smallest basket first" },
      ],
    },
    {
      kind: "range",
      key: "rate",
      label: "Shoppers an hour",
      min: 16,
      max: 22,
      step: 1,
      value: 20,
      format: (v) => `${v}/hr`,
    },
  ],
  readout: [
    { key: "wFcfs", term: "W", sub: "arrival order" },
    { key: "wSjf", term: "W", sub: "smallest first" },
    { key: "bigFcfs", term: "W", sub: "80+ items, arrival" },
    { key: "bigSjf", term: "W", sub: "80+ items, smallest" },
    { key: "passes", term: "passed", sub: "since opening" },
  ],
  build,
  step,
  representative: (m) => {
    const want = m.rule === "sjf" ? m.sjf : m.fcfs;
    return want.over || Math.abs(m.sim.inSystem - want.L) <= Math.max(1.5, want.L * 0.3);
  },
  extent: () => ROOM,
  report: (m) => ({
    wFcfs: m.fcfs.over ? "no limit" : mins(m.fcfs.W),
    wSjf: m.sjf.over ? "no limit" : mins(m.sjf.W),
    bigFcfs: mins(m.bigFcfs),
    bigSjf: mins(m.bigSjf),
    passes: String(m.passes),
  }),
  regions: {
    /** The till and the shopper at it. */
    till: { x0: 2.4, x1: 8.4, y0: 6.0, y1: 11.0, z1: 2.6 },
    /** The line, for a later week that needs somebody being overtaken. */
    line: { x0: 2.6, x1: 11.0, y0: 1.4, y1: 7.2, z1: 2.2 },
  },
  draw(f) {
    const st = new Stage();
    const paying = victim(f.model);
    shell(f, st);
    till(f, st);
    shoppers(f, st, paying);
    st.paint();
    tally(f, paying);
  },
};
