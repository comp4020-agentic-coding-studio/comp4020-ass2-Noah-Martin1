/**
 * Week 10: an aircraft at the gate, and where the interference piles up.
 *
 * The aisle is the course's purest case of the server and the queue occupying
 * the same space: a passenger lifting a bag into a locker is not slow, they are
 * a moving blockage in a corridor nobody can overtake in. So boarding time is
 * not governed by how fast people walk. It is governed by how often those
 * blockages land on top of each other, which is week 2's lesson with luggage.
 *
 * The scene is the aircraft, cut away: fuselage, wings, engines, fin and a jet
 * bridge outside; twelve rows of three-and-three and seventy-two passengers
 * inside. Walkers move one row a tick. Gold means stowing, and a gold
 * passenger stops everybody behind them.
 *
 * The overlay is the distribution. Every tick a row's aisle is blocked, that
 * row's pink bar on the cabin floor grows -- so the reader is not told that
 * back-to-front concentrates the interference, they watch the bars stack up in
 * the last four rows while the front of the aircraft stands empty. Steffen
 * spreads the same total blocking along the whole fuselage, and the aircraft
 * boards in half the time with nobody moving faster.
 *
 * Measured, 40 seeds, 72 passengers, two seconds a tick:
 *
 *   strategy       minutes   vs back-to-front   worst row's share of the waiting
 *   back to front    11.9           --                    11.6 min
 *   random            9.4          -21%                    4.3
 *   outside-in        7.7          -35%                    3.5
 *   Steffen           5.4          -55%                    1.0
 *
 * Back-to-front is last, behind random, which is the result most people refuse
 * on first hearing and which has been in the literature for twenty years.
 * Calling rows 10 to 12 puts every passenger with a bag into the same three
 * metres of aisle at the same moment.
 *
 * The last column is the one the overlay draws, and it moves twelve-fold while
 * the boarding time moves two-fold. Every strategy loads exactly the same bags
 * into exactly the same lockers; what back-to-front arranges is for all of that
 * to happen at the one end of the aircraft where the whole queue is standing.
 */

import { mulberry32 } from "../../queue-sim";
import { project, type Extent } from "../project";
import {
  Stage,
  box3,
  chip,
  darken,
  ground,
  label,
  lighten,
  mix,
  softShadow,
  textSize,
  tints,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/** Two seconds a tick: one row of aisle at the speed people actually shuffle. */
const TICK_SECONDS = 2;
const ROWS = 12;
const SEATS = 6;
const PASSENGERS = ROWS * SEATS;

/** The apron, in metres. The aircraft's long axis runs along x, nose right. */
const ROOM: Extent = { x0: 0, x1: 16.0, y0: -2.4, y1: 8.4, z1: 2.6 };

/**
 * The cabin. Rows march along x, and they march *backwards*: row 0 is the
 * front row, nearest the forward door, and row 11 is at the tail. The first
 * version numbered them the other way and put the jet bridge at the tail,
 * which is a detail nobody would have to think about on a real aircraft and
 * which made the whole picture read wrong.
 */
const ROW_X = (row: number) => 12.5 - row * 0.86;
const NOSE_X = 15.2;
const TAIL_X = ROW_X(ROWS - 1) - 2.5;
const DOOR_X = ROW_X(-0.55);
/**
 * Seat centres across the cabin: A B C, aisle, D E F.
 *
 * Eight hundred millimetres apart, which would be a very comfortable aircraft.
 * The spacing is decided by the projection, not by the seat map: a metre of
 * depth is worth a third of a metre of screen height here, so at a realistic
 * 450 mm the six rows of seats are seven pixels apart and read as one field of
 * grey. Week 5's bank windows are spaced for the same reason and the same way.
 */
const SEAT_Y = [0.5, 1.3, 2.1, 3.7, 4.5, 5.3] as const;
const AISLE_Y = 2.9;
const CABIN = { y0: 0.16, y1: 5.64 };

export type Strategy = "back" | "random" | "outside" | "steffen";

interface Flyer {
  id: number;
  row: number;
  seat: number;
  /** -1 while still on the bridge; otherwise the row index they stand at. */
  at: number;
  state: "waiting" | "walking" | "stowing" | "shuffling" | "seated";
  timer: number;
  /** Ticks of bag-stowing this passenger brought with them. */
  bag: number;
}

export interface CabinModel {
  rng: () => number;
  strategy: Strategy;
  order: Flyer[];
  /** Index of the next passenger to step through the door. */
  next: number;
  /** Which passenger id holds each aisle position, or 0. */
  aisle: number[];
  /** Occupied seats, by row * SEATS + seat. */
  taken: Set<number>;
  tick: number;
  done: number;
  /**
   * Passenger-ticks of waiting caused at each row.
   *
   * Not the time each row's aisle is occupied -- that is almost identical
   * under every strategy, because every row gets exactly its own six
   * passengers' bags however you order them. What differs is how many people
   * are stuck behind those bags, so this counts, for every walker held up on
   * every tick, the row of the blocker holding them up. Back-to-front does not
   * create more stowing. It arranges for the stowing to happen where the queue
   * is.
   */
  blocked: number[];
  stats: Record<Strategy, CabinStats>;
}

export interface CabinStats {
  ticks: number;
  worstRow: number;
}

// --- boarding order --------------------------------------------------------

/** Fisher-Yates on the scene's own generator, so a run is reproducible. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How far a seat is from the aisle: 0 aisle, 1 middle, 2 window. */
const depth = (seat: number) => (seat < 3 ? 2 - seat : seat - 3);
/** Which side of the aisle, so Steffen can alternate. */
const side = (seat: number) => (seat < 3 ? 0 : 1);

function orderFor(strategy: Strategy, rng: () => number): Array<[number, number]> {
  const all: Array<[number, number]> = [];
  for (let row = 0; row < ROWS; row++) for (let s = 0; s < SEATS; s++) all.push([row, s]);

  if (strategy === "random") return shuffle(all, rng);

  if (strategy === "back") {
    // Blocks of three rows, back first, random inside a block -- which is how
    // a gate actually calls it, and the reason the result is so bad.
    const out: Array<[number, number]> = [];
    for (let block = ROWS - 3; block >= 0; block -= 3) {
      out.push(...shuffle(all.filter(([r]) => r >= block && r < block + 3), rng));
    }
    return out;
  }

  if (strategy === "outside") {
    // Windows, then middles, then aisles. Removes the seat shuffle; does
    // nothing about two people stowing next to each other.
    const out: Array<[number, number]> = [];
    for (const d of [2, 1, 0]) out.push(...shuffle(all.filter(([, s]) => depth(s) === d), rng));
    return out;
  }

  // Steffen: windows first, but alternating rows and alternating sides, so
  // consecutive boarders are two rows apart and never in each other's way.
  const out: Array<[number, number]> = [];
  for (const d of [2, 1, 0]) {
    for (const sd of [1, 0]) {
      for (const parity of [0, 1]) {
        for (let row = ROWS - 1; row >= 0; row--) {
          if (row % 2 !== parity) continue;
          for (let s = 0; s < SEATS; s++) {
            if (depth(s) === d && side(s) === sd) out.push([row, s]);
          }
        }
      }
    }
  }
  return out;
}

// --- the model -------------------------------------------------------------

function newModel(strategy: Strategy, seed: number, withStats: boolean): CabinModel {
  const rng = mulberry32(seed);
  const order = orderFor(strategy, rng).map(([row, seat], id) => ({
    id: id + 1,
    row,
    seat,
    at: -1,
    state: "waiting" as const,
    timer: 0,
    // Two to nine ticks: four to eighteen seconds with a bag over your head,
    // which is the single most variable thing that happens on an aircraft.
    bag: 2 + Math.floor(rng() * 8),
  }));
  return {
    rng,
    strategy,
    order,
    next: 0,
    aisle: new Array(ROWS).fill(0),
    taken: new Set(),
    tick: 0,
    done: 0,
    blocked: new Array(ROWS).fill(0),
    stats: withStats ? measureAll() : ({} as Record<Strategy, CabinStats>),
  };
}

function step(m: CabinModel): void {
  if (m.done >= PASSENGERS) {
    // Hold the finished aircraft for a few seconds, then turn it round. A sim
    // that stops dead on its last frame looks broken rather than finished.
    m.tick += 1;
    if (m.tick > m.stats[m.strategy]?.ticks + 40) restart(m);
    return;
  }
  m.tick += 1;

  // Deepest first, so nobody leapfrogs the person in front of them.
  const moving = m.order
    .filter((f) => f.state === "walking" || f.state === "stowing" || f.state === "shuffling")
    .sort((a, b) => b.at - a.at);

  for (const f of moving) {
    if (f.state === "stowing" || f.state === "shuffling") {
      f.timer -= 1;
      if (f.timer > 0) continue;
      if (f.state === "stowing") {
        // The seat shuffle: everybody already sitting between you and the
        // aisle has to get up again.
        let past = 0;
        for (let s = 0; s < SEATS; s++) {
          if (side(s) !== side(f.seat)) continue;
          if (depth(s) < depth(f.seat) && m.taken.has(f.row * SEATS + s)) past += 1;
        }
        if (past > 0) {
          f.state = "shuffling";
          f.timer = past * 3;
          continue;
        }
      }
      f.state = "seated";
      m.aisle[f.at] = 0;
      m.taken.add(f.row * SEATS + f.seat);
      m.done += 1;
      continue;
    }

    if (f.at === f.row) {
      f.state = "stowing";
      f.timer = f.bag;
      continue;
    }
    if (m.aisle[f.at + 1] === 0) {
      m.aisle[f.at] = 0;
      f.at += 1;
      m.aisle[f.at] = f.id;
      continue;
    }
    // Held up. Find who is actually responsible -- the first person ahead who
    // is stowing rather than merely queuing -- and charge the delay to them.
    for (let ahead = f.at + 1; ahead < ROWS; ahead++) {
      const id = m.aisle[ahead];
      if (id === 0) break;
      const blocker = m.order[id - 1];
      if (blocker && (blocker.state === "stowing" || blocker.state === "shuffling")) {
        m.blocked[ahead] += 1;
        break;
      }
    }
  }

  // Somebody steps through the door if the first row of aisle is clear.
  if (m.next < m.order.length && m.aisle[0] === 0) {
    const f = m.order[m.next++];
    f.state = "walking";
    f.at = 0;
    m.aisle[0] = f.id;
  }
}

function restart(m: CabinModel): void {
  const fresh = newModel(m.strategy, 7 + Math.floor(m.rng() * 900), false);
  m.order = fresh.order;
  m.next = 0;
  m.aisle = fresh.aisle;
  m.taken = new Set();
  m.tick = 0;
  m.done = 0;
  m.blocked = new Array(ROWS).fill(0);
}

// --- measurement -----------------------------------------------------------

let measured: Record<Strategy, CabinStats> | null = null;
function measureAll(): Record<Strategy, CabinStats> {
  if (measured) return measured;
  const out = {} as Record<Strategy, CabinStats>;
  for (const strategy of ["back", "random", "outside", "steffen"] as Strategy[]) {
    let ticks = 0;
    let worst = 0;
    const SEEDS = 40;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const m = newModel(strategy, seed * 13 + 1, false);
      let guard = 0;
      while (m.done < PASSENGERS && guard++ < 6000) step(m);
      ticks += m.tick;
      worst += Math.max(...m.blocked);
    }
    out[strategy] = { ticks: ticks / SEEDS, worstRow: worst / SEEDS };
  }
  measured = out;
  return out;
}

// --- the aircraft ----------------------------------------------------------

/** Fuselage, wings, engines, fin, jet bridge: the outside, drawn properly. */
function airframe(f: Frame<CabinModel>, st: Stage): void {
  const { c, cam, p } = f;
  const t = tints(p);
  const skin = mix(p.ground, p.bg, 0.4);
  const nose = NOSE_X;
  const tail = TAIL_X;

  // Wings and engines, under the fuselage so the cabin sits on top of them.
  st.add(0, 7.4, () => {
    const wing = (from: number, to: number) => {
      const root = ROW_X(6.2);
      const tipX = root - 2.3;
      c.beginPath();
      const pts = [
        project(cam, root + 1.5, from, 0.1),
        project(cam, root - 0.2, from, 0.1),
        project(cam, tipX, to, 0.1),
        project(cam, tipX + 1.0, to, 0.1),
      ];
      pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = mix(skin, p.ink, 0.12);
      c.fill();
      c.strokeStyle = withAlpha(p.ink, 0.2);
      c.lineWidth = 1;
      c.stroke();
    };
    wing(CABIN.y1, 8.2);
    wing(CABIN.y0, -2.2);
    // Engines, slung forward of the wing on each side.
    for (const ey of [7.0, -1.0]) {
      const ex = ROW_X(5.4);
      softShadow(c, cam, p, ex + 0.5, ey, 0.8, 0.4);
      box3(
        c,
        cam,
        { x: ex, y: ey - 0.42, w: 1.9, d: 0.84, h: 0.72, z: 0.05 },
        { fill: mix(t.metal, p.ink, 0.1), edge: withAlpha(p.ink, 0.22), contrast: 0.24 },
      );
      box3(
        c,
        cam,
        { x: ex - 0.12, y: ey - 0.46, w: 0.2, d: 0.92, h: 0.8, z: 0.01 },
        { fill: darken(t.metal, 0.4), contrast: 0.2 },
      );
    }
  });

  // The fin and tailplane.
  st.add(tail, 5.0, () => {
    c.beginPath();
    const fin = [
      project(cam, tail + 0.1, AISLE_Y, 0.45),
      project(cam, tail + 2.9, AISLE_Y, 0.45),
      project(cam, tail + 3.0, AISLE_Y, 2.5),
      project(cam, tail + 1.5, AISLE_Y, 2.5),
    ];
    fin.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    // The airline's livery, and this scene's green.
    c.fillStyle = mix(p.green, p.ink, 0.1);
    c.fill();
    c.strokeStyle = withAlpha(p.ink, 0.25);
    c.lineWidth = 1;
    c.stroke();
    // The tailplane, flat either side.
    for (const dir of [1, -1]) {
      c.beginPath();
      const tp = [
        project(cam, tail + 0.4, AISLE_Y, 0.42),
        project(cam, tail + 1.7, AISLE_Y, 0.42),
        project(cam, tail + 1.5, AISLE_Y + dir * 2.6, 0.42),
        project(cam, tail + 0.9, AISLE_Y + dir * 2.6, 0.42),
      ];
      tp.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = mix(skin, p.ink, 0.18);
      c.fill();
      c.stroke();
    }
  });

  // The fuselage floor: one long rounded plate, cut away at the top so the
  // cabin is visible. The far wall is drawn as a low band, the near wall as a
  // sill, which is what makes it read as a section rather than a carpet.
  st.add(tail, CABIN.y1 + 0.3, () => {
    softShadow(c, cam, p, (tail + nose) / 2, AISLE_Y, (nose - tail) / 2.1, 1.9);
    const plate = (inset: number, fill: string, z: number) => {
      c.beginPath();
      const pts = [
        project(cam, tail + 1.4 + inset, CABIN.y0 + inset, z),
        project(cam, nose - 2.4, CABIN.y0 + inset, z),
        project(cam, nose - inset, AISLE_Y, z),
        project(cam, nose - 2.4, CABIN.y1 - inset, z),
        project(cam, tail + 1.4 + inset, CABIN.y1 - inset, z),
        project(cam, tail + 0.3 + inset, AISLE_Y, z),
      ];
      pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    };
    plate(0, mix(skin, p.ink, 0.2), 0);
    c.strokeStyle = withAlpha(p.ink, 0.42);
    c.lineWidth = 2;
    c.stroke();
    plate(0.24, mix(p.ground, p.bg, 0.3), 0.02);
    // The far cabin wall, with windows.
    box3(
      c,
      cam,
      { x: tail + 1.5, y: CABIN.y1 - 0.1, w: nose - tail - 4.0, d: 0.2, h: 0.5 },
      { fill: mix(skin, p.ink, 0.1), contrast: 0.16 },
    );
    for (let i = 0; i < ROWS; i++) {
      box3(
        c,
        cam,
        { x: ROW_X(i) - 0.16, y: CABIN.y1 - 0.12, w: 0.32, d: 0.06, h: 0.2, z: 0.24 },
        { fill: mix(t.screen, p.bg, 0.12), contrast: 0.1 },
      );
    }
    // The near sill.
    box3(
      c,
      cam,
      { x: tail + 1.5, y: CABIN.y0, w: nose - tail - 4.0, d: 0.18, h: 0.2 },
      { fill: mix(skin, p.ink, 0.22), contrast: 0.2 },
    );
  });

  // The jet bridge, coming in to the forward door from off the apron.
  st.add(DOOR_X, CABIN.y0 - 2.0, () => {
    softShadow(c, cam, p, DOOR_X + 0.3, CABIN.y0 - 1.3, 1.0, 0.8);
    box3(
      c,
      cam,
      { x: DOOR_X - 0.45, y: -2.3, w: 1.6, d: 2.4, h: 1.2, z: 0.18 },
      { fill: mix(t.stone, p.ink, 0.14), edge: withAlpha(p.ink, 0.2), contrast: 0.22 },
    );
    box3(
      c,
      cam,
      { x: DOOR_X - 0.3, y: CABIN.y0 - 0.45, w: 1.3, d: 0.5, h: 1.05, z: 0.18 },
      { fill: mix(t.stone, p.ink, 0.26), contrast: 0.2 },
    );
  });
}

/** Seats, drawn whether or not anybody is in them. */
function seats(f: Frame<CabinModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  // The aisle, painted as a strip. Without it the cabin is one field of seats
  // and the corridor the whole week is about has to be inferred.
  st.add(TAIL_X, AISLE_Y + 0.01, () => {
    const strip = [
      project(cam, TAIL_X + 1.6, AISLE_Y - 0.62, 0.03),
      project(cam, NOSE_X - 2.3, AISLE_Y - 0.62, 0.03),
      project(cam, NOSE_X - 2.3, AISLE_Y + 0.62, 0.03),
      project(cam, TAIL_X + 1.6, AISLE_Y + 0.62, 0.03),
    ];
    c.beginPath();
    strip.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    c.fillStyle = mix(p.ground, p.ink, 0.1);
    c.fill();
  });

  for (let row = 0; row < ROWS; row++) {
    for (let s = 0; s < SEATS; s++) {
      const x = ROW_X(row);
      const y = SEAT_Y[s];
      const full = model.taken.has(row * SEATS + s);
      st.add(x, y, () => {
        // A flat pad, not a seat with a back. Seventy-two shaded boxes at
        // thirty pixels each is a texture, and the reader needs to be able to
        // find the aisle in it.
        box3(
          c,
          cam,
          { x: x - 0.29, y: y - 0.25, w: 0.58, d: 0.5, h: 0.07, z: 0.05 },
          { fill: mix(t.cloth, p.bg, full ? 0.1 : 0.34), contrast: 0.14 },
        );
        if (full) {
          // Somebody sitting. Small and muted: the people who matter are the
          // ones still standing up.
          const at = project(cam, x, y - 0.04, 0.34);
          c.beginPath();
          c.ellipse(at.x, at.y, 0.2 * cam.s, 0.12 * cam.s, 0, 0, Math.PI * 2);
          c.fillStyle = mix(coatFor(p, row * SEATS + s), p.bg, 0.3);
          c.fill();
          c.beginPath();
          c.arc(at.x, at.y - 0.03 * cam.s, 0.09 * cam.s, 0, Math.PI * 2);
          c.fillStyle = mix(mix(t.skin, p.ink, ((row + s) % 4) * 0.1), p.bg, 0.25);
          c.fill();
        }
      });
    }
  }
}

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.34),
    t.cloth,
    darken(t.clay, 0.16),
    mix(p.ink, p.bg, 0.56),
    mix(t.wood, p.ink, 0.26),
    mix(p.green, p.ink, 0.32),
  ];
  return coats[id % coats.length];
}

/** Everybody in the aisle, plus the queue still out on the bridge. */
function walkers(f: Frame<CabinModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  const flyer = (x: number, y: number, id: number, busy: boolean) => {
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.24, 0.14);
      const at = project(cam, x, y, 0.62);
      c.beginPath();
      c.ellipse(at.x, at.y, 0.27 * cam.s, 0.16 * cam.s, 0, 0, Math.PI * 2);
      c.fillStyle = busy ? p.gold : coatFor(p, id);
      c.fill();
      c.strokeStyle = withAlpha(p.ink, busy ? 0.45 : 0.35);
      c.lineWidth = 1.4;
      c.stroke();
      c.beginPath();
      c.arc(at.x, at.y - 0.06 * cam.s, 0.125 * cam.s, 0, Math.PI * 2);
      c.fillStyle = mix(t.skin, p.ink, (id % 4) * 0.1);
      c.fill();
      if (busy) {
        // The bag, up at locker height. It is the whole reason for the delay.
        const bag = project(cam, x, y - 0.1, 1.05);
        c.fillStyle = lighten(p.gold, 0.18);
        c.strokeStyle = darken(p.gold, 0.3);
        c.beginPath();
        c.rect(bag.x - 0.2 * cam.s, bag.y - 0.14 * cam.s, 0.4 * cam.s, 0.26 * cam.s);
        c.fill();
        c.stroke();
      }
    });
  };

  for (const who of model.order) {
    if (who.state === "seated" || who.state === "waiting") continue;
    flyer(ROW_X(who.at), AISLE_Y, who.id, who.state !== "walking");
  }

  // The queue on the bridge, waiting to be let on. Capped: the point is that
  // there are more of them, not exactly how many.
  const left = model.order.length - model.next;
  for (let i = 0; i < Math.min(7, left); i++) {
    flyer(DOOR_X - 0.1 - i * 0.62, CABIN.y0 - 1.5 - i * 0.14, 900 + i, false);
  }
}

// --- where the interference lands ------------------------------------------

/**
 * The blocked-time distribution, drawn along the fuselage.
 *
 * Every tick a row's aisle is held by somebody stowing or shuffling, that
 * row's bar grows. The lecture's claim is that back-to-front does not create
 * more blocking, it *concentrates* it -- so the thing to draw is not a total
 * but a shape, and the shape is visibly a heap at the back under one strategy
 * and a flat line under another.
 */
function interference(f: Frame<CabinModel>): void {
  const { c, cam, p, model, w } = f;
  const peak = Math.max(12, ...model.blocked);
  const size = textSize(cam, 11, 9);

  for (let row = 0; row < ROWS; row++) {
    const v = model.blocked[row];
    if (v <= 0) continue;
    const h = (v / peak) * 1.05;
    // Outside the hull, on the apron. Inside, the bars grew up through the
    // seats and the reader could not tell a tall bar from a full row.
    const by = CABIN.y0 - 0.75;
    const a = project(cam, ROW_X(row) - 0.3, by, 0.02);
    const b = project(cam, ROW_X(row) + 0.3, by, 0.02);
    const cTop = project(cam, ROW_X(row) + 0.3, by, 0.02 + h);
    const dTop = project(cam, ROW_X(row) - 0.3, by, 0.02 + h);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.lineTo(cTop.x, cTop.y);
    c.lineTo(dTop.x, dTop.y);
    c.closePath();
    c.fillStyle = withAlpha(p.pink, 0.72);
    c.fill();
    c.strokeStyle = p.pinkEdge;
    c.lineWidth = 1.2;
    c.stroke();
  }

  if (f.region) return;
  const total = model.blocked.reduce((a, b) => a + b, 0);
  const worst = model.blocked.indexOf(Math.max(...model.blocked)) + 1;
  chip(
    c,
    p,
    model.done >= PASSENGERS
      ? `boarded in ${((model.tick * TICK_SECONDS) / 60).toFixed(1)} min — most of the waiting caused at row ${worst}`
      : `${((total * TICK_SECONDS) / 60).toFixed(0)} passenger-minutes lost so far — worst at row ${worst}`,
    10,
    f.h - size * 1.7 - 8,
    size,
    w,
  );
}

// --- the scene -------------------------------------------------------------

const LABELS: Record<Strategy, string> = {
  back: "Back to front",
  random: "Random",
  outside: "Outside-in (WILMA)",
  steffen: "Steffen",
};

export const cabin: SceneDef<CabinModel> = {
  height: 300,
  minHeight: 150,
  warm: 0,
  rate: 16,
  controls: [
    {
      kind: "select",
      key: "strategy",
      label: "The gate calls",
      value: "back",
      options: (["back", "random", "outside", "steffen"] as Strategy[]).map((value) => ({
        value,
        label: LABELS[value],
      })),
    },
  ],
  readout: [
    { key: "now", term: "boarding", sub: "this run" },
    { key: "mean", term: "mean", sub: "over 40 runs" },
    { key: "vs", term: "vs", sub: "back to front" },
    { key: "worst", term: "worst row", sub: "queue held up" },
    { key: "best", term: "Steffen", sub: "mean" },
  ],
  build: (controls) => newModel((controls.str("strategy", "back") as Strategy) ?? "back", 7, true),
  step,
  extent: () => ROOM,
  report: (m) => {
    const mine = m.stats[m.strategy];
    const base = m.stats.back;
    const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;
    return {
      now: mins(m.tick),
      mean: mine ? mins(mine.ticks) : "—",
      vs:
        !mine || !base
          ? "—"
          : m.strategy === "back"
            ? "—"
            : `${Math.round((mine.ticks / base.ticks - 1) * 100)}%`,
      worst: mine ? `${((mine.worstRow * TICK_SECONDS) / 60).toFixed(1)} min` : "—",
      best: m.stats.steffen ? mins(m.stats.steffen.ticks) : "—",
    };
  },
  regions: {
    /** The rear of the cabin, where back-to-front piles everybody up. */
    rear: { x0: 1.0, x1: 8.0, y0: 0.0, y1: 4.2, z1: 1.3 },
    /** The door end, with the bridge. */
    door: { x0: 0.4, x1: 7.0, y0: -2.4, y1: 4.2, z1: 1.3 },
  },
  draw(f) {
    const st = new Stage();
    airframe(f, st);
    seats(f, st);
    walkers(f, st);
    st.paint();
    interference(f);
  },
};
