/**
 * Week 4: the passport office, and the bill nobody sends.
 *
 * The week's claim is that waiting is a real cost which is systematically
 * invisible to the organisation generating it, and the old figure made that
 * point with two static bars -- a solid one for the office's budget and a
 * dashed empty one for the queue's. The trouble with two static bars is that
 * they can only be looked at. This scene lets the reader close a window and
 * watch both of them move in opposite directions.
 *
 * The overlay is the bill. Two bars across the foot of the room, drawn at the
 * same scale and filling as the working day runs: gold and solid for what the
 * office spends on counter staff, a dashed empty outline for what the people in
 * the room spend on being there. The dashed one appears in no account, which is
 * why it is drawn as an outline rather than a solid.
 *
 * Measured, five seeds, five windows of which some are open, twelve minutes an
 * application, an eight-hour day, counter staff at $38 an hour loaded and
 * waiting valued at the lecture's $40:
 *
 *   open  apps/hr   W       person-hours   the queue pays   the office pays
 *   5     14        13 min   23             $929             $1,520
 *   4     14        16 min   28             $1,117           $1,216
 *   3     14        48 min   86             $3,420           $912
 *   4     19        39 min   93             $3,728           $1,216
 *   3     17        no limit
 *
 * Read the middle three rows together, because they are the lecture. Closing
 * one window saves the office $304 a day and costs the people in the room
 * $2,303 a day: a transfer of seven and a half pounds of somebody else's time
 * for every pound saved, and not one line of it appears in the office's
 * accounts. Nothing in this scene is a failure of management. It is a correct
 * decision, made on the only figures the manager is shown.
 */

import { QueueSim, type Customer } from "../../queue-sim";
import { converge, type Converged } from "../stats";
import { project, type Extent } from "../project";
import {
  Stage,
  box3,
  chair,
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

/** Twenty seconds a tick, so a twelve-minute interview is thirty-six ticks. */
const TICK_SECONDS = 20;
const SERVICE_TICKS = 36;
/** An eight-hour public counter day. */
const DAY_TICKS = (8 * 3600) / TICK_SECONDS;

/**
 * The two prices, both stated rather than derived, because beat 3 of the
 * lecture is entirely about the fact that choosing them is a moral act.
 *
 * $40 an hour for waiting is the lecture's own figure. $38 an hour is a counter
 * clerk at full loaded cost. Neither is a measurement.
 */
const WAIT_RATE = 40;
const CLERK_RATE = 38;

/** The room, in metres. */
const ROOM: Extent = { x0: 0, x1: 15, y0: 0, y1: 14, z1: 3.0 };
const WALL = 2.9;

/**
 * The counter, and the five windows in it.
 *
 * Set close to the back wall on purpose. A metre of depth shears half a metre
 * left, so a counter standing well out into the room slides off the end of the
 * wall behind it and the last window ends up glazed against nothing. Sitting it
 * a metre and a half off the wall keeps the whole screen backed, and it is
 * where a real public counter is anyway: the staff side of one is a corridor,
 * not an office.
 */
const COUNTER = { y: 12.3, d: 0.9, h: 1.12 };
/** How far the counter stops short of each side wall. */
const COUNTER_INSET = { left: 0.6, right: 1.4 };
const WINDOWS = [2.2, 4.8, 7.4, 10.0, 12.6] as const;

/**
 * Seating.
 *
 * A passport office is not a line. You take a ticket and you sit down, which is
 * worth drawing accurately: it is the reason nobody in the room can see how
 * long the wait is, and a large part of why the wait is so easy for the office
 * not to notice. Eighteen seats, and anyone who does not get one stands.
 */
const SEAT_ROWS = [9.4, 7.4, 5.4] as const;
const SEAT_COLS = [2.2, 3.9, 5.6, 7.3, 9.0, 10.7] as const;

/**
 * The order the seats fill in.
 *
 * Scattered, not row by row. Filling in order put every one of the seven people
 * waiting in the row nearest the counter and left the other twelve seats
 * conspicuously empty, which reads as a room being tidied rather than a room
 * with people in it. Deterministic, because everything else in these scenes is.
 */
const SEATS: Array<[number, number]> = SEAT_ROWS.flatMap((sy) =>
  SEAT_COLS.map((sx) => [sx, sy] as [number, number]),
).sort(
  (a, b) =>
    ((Math.sin(a[0] * 12.9898 + a[1] * 78.233) * 43758.5453) % 1) -
    ((Math.sin(b[0] * 12.9898 + b[1] * 78.233) * 43758.5453) % 1),
);

export interface OfficeModel {
  sim: QueueSim;
  stats: Converged;
  /** Windows with somebody behind them. */
  open: number;
  /** Applications an hour. */
  perHour: number;
  /** Person-ticks accrued since the scene was built, for the live chip. */
  accrued: number;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): OfficeModel {
  const open = Math.round(controls.num("open", 3));
  const perHour = Math.round(controls.num("rate", 14));
  const config = {
    // Seed 99, chosen rather than defaulted.
    //
    // Three windows at fourteen an hour is 93% loaded, and a multi-server
    // queue that heavily loaded spends about a fifth of its life nearly empty:
    // measured over 600 samples, L is 10.7 on average but the room holds three
    // people or fewer 19% of the time and more than twenty-one 28% of the
    // time. That is a true fact about this office and the reason week 2 exists
    // -- but the engine is seeded, so every reader sees the *same* fifth. On
    // seed 7 the minute after the opening frame happened to be one of the
    // quiet ones, and the scene played out as an empty passport office sitting
    // under a readout claiming a forty-eight minute wait.
    //
    // Of 120 seeds, one keeps the room between 6 and 22 people for the whole
    // first minute of play with a mean of 14. The statistics below are
    // averaged over five other seeds entirely, so nothing in the readout moves
    // -- this only decides which true minute a reader is shown.
    seed: 99,
    lanes: 1,
    servers: open,
    mu: 1 / SERVICE_TICKS,
    lambda: perHour / (3600 / TICK_SECONDS),
    arrivalCv: 1,
    serviceCv: 1,
  };
  return {
    sim: new QueueSim(config),
    stats: converge(config),
    open,
    perHour,
    accrued: 0,
  };
}

function step(m: OfficeModel): void {
  m.sim.step();
  m.accrued += m.sim.inSystem;
}

/** What each side of the argument spends in a day, in dollars. */
function dayBill(m: OfficeModel): { office: number; queue: number | null } {
  const office = m.open * 8 * CLERK_RATE;
  const queue = m.stats.over ? null : m.stats.L * 8 * WAIT_RATE;
  return { office, queue };
}

// --- the set ---------------------------------------------------------------

/** Floor, walls, counter, glazing, and the board that calls the numbers. */
function shell(f: Frame<OfficeModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  box3(
    c,
    cam,
    { x: ROOM.x0, y: ROOM.y1 - 0.2, w: ROOM.x1, d: 0.2, h: WALL },
    { fill: mix(t.stone, p.bg, 0.42), contrast: 0.12 },
  );

  // The counter, with a glazed screen above it and a gap at each window. The
  // gap is the whole architecture of a public counter: it is the only part of
  // the building the public is allowed through.
  st.add(ROOM.x1 / 2, COUNTER.y, () => {
    box3(
      c,
      cam,
      {
        x: ROOM.x0 + COUNTER_INSET.left,
        y: COUNTER.y,
        w: ROOM.x1 - COUNTER_INSET.left - COUNTER_INSET.right,
        d: COUNTER.d,
        h: COUNTER.h,
      },
      { fill: t.wood, edge: withAlpha(p.ink, 0.18), contrast: 0.2 },
    );
    box3(
      c,
      cam,
      {
        x: ROOM.x0 + COUNTER_INSET.left - 0.1,
        y: COUNTER.y - 0.06,
        w: ROOM.x1 - COUNTER_INSET.left - COUNTER_INSET.right + 0.2,
        d: COUNTER.d + 0.12,
        h: 0.07,
        z: COUNTER.h,
      },
      { fill: mix(t.stone, p.bg, 0.15), contrast: 0.22 },
    );

    const glassZ = COUNTER.h + 0.34;
    const glassTop = 2.35;
    let at = ROOM.x0 + COUNTER_INSET.left;
    const stops: number[] = [];
    for (const wx of WINDOWS) {
      stops.push(at, wx - 0.68);
      at = wx + 0.68;
    }
    stops.push(at, ROOM.x1 - COUNTER_INSET.right);
    for (let i = 0; i < stops.length; i += 2) {
      const x0 = stops[i];
      const x1 = stops[i + 1];
      if (x1 - x0 < 0.05) continue;
      const quad = [
        project(cam, x0, COUNTER.y, glassZ),
        project(cam, x1, COUNTER.y, glassZ),
        project(cam, x1, COUNTER.y, glassTop),
        project(cam, x0, COUNTER.y, glassTop),
      ];
      c.beginPath();
      quad.forEach((q, j) => (j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = withAlpha(mix(p.bg, p.green, 0.14), 0.5);
      c.fill();
      c.strokeStyle = withAlpha(p.soft, 0.5);
      c.lineWidth = 1;
      c.stroke();
    }

    // A shutter over every closed window, and a number plate over every one.
    WINDOWS.forEach((wx, i) => {
      const isOpen = i < model.open;
      if (!isOpen) {
        box3(
          c,
          cam,
          { x: wx - 0.68, y: COUNTER.y - 0.04, w: 1.36, d: 0.08, h: glassTop - glassZ, z: glassZ },
          // darken(), not a mix toward --q-ink: the ink is nearly white in dark
          // mode, and a shutter is a closed steel roller in both themes. Mixed
          // toward the ink the two closed windows came out as the brightest
          // objects on the page, which is the opposite of what a shutter says.
          { fill: darken(t.metal, 0.35), contrast: 0.16 },
        );
      }
      box3(
        c,
        cam,
        { x: wx - 0.3, y: COUNTER.y - 0.05, w: 0.6, d: 0.06, h: 0.34, z: glassTop + 0.06 },
        { fill: isOpen ? t.screen : darken(t.stone, 0.4), contrast: 0.1 },
      );
      if (cam.s > 18) {
        const plate = project(cam, wx, COUNTER.y - 0.07, glassTop + 0.14);
        label(
          c,
          String(i + 1),
          plate.x,
          plate.y,
          isOpen ? p.gold : withAlpha(p.soft, 0.7),
          textSize(cam, 11, 8),
          "center",
          "700",
        );
      }
    });
  });

  // The board that calls the next number, on the wall above the counter.
  st.add(ROOM.x1 / 2, ROOM.y1 - 0.21, () => {
    const served = model.sim.recentlyServed.at(-1)?.customer.id ?? 0;
    box3(
      c,
      cam,
      { x: 4.6, y: ROOM.y1 - 0.26, w: 4.4, d: 0.06, h: 0.68, z: 2.4 },
      { fill: t.screen, contrast: 0.1 },
    );
    if (cam.s > 20) {
      const at = project(cam, 6.8, ROOM.y1 - 0.28, 2.72);
      label(
        c,
        `NOW SERVING   ${String(200 + (served % 99)).padStart(3, "0")}`,
        at.x,
        at.y,
        p.gold,
        textSize(cam, 11, 8),
        "center",
        "700",
      );
    }
  });
}

/** Seating, the ticket machine, and the one living thing in the building. */
function furniture(f: Frame<OfficeModel>, st: Stage): void {
  const { c, cam, p } = f;
  const t = tints(p);

  for (const sy of SEAT_ROWS) {
    for (const sx of SEAT_COLS) {
      st.add(sx, sy, () => {
        softShadow(c, cam, p, sx, sy, 0.3, 0.16);
        // Facing the viewer, not the counter.
        //
        // A waiting room's seats really do face the counter, and drawn that way
        // the chair back stands between the viewer and the sitter: eighteen
        // dark rectangles with a row of small heads above them, and not one of
        // the "visibly distinct characters" the week is supposed to be about.
        // Turning them round loses a fact about furniture and gains every
        // person in the room.
        chair(c, cam, p, sx, sy, mix(t.cloth, p.bg, 0.3));
      });
    }
  }

  // The ticket machine by the door, and the pot plant nobody has watered. Every
  // set in this course has one living thing in it; this is the only one that
  // looks like it is having a worse time than the people.
  st.add(13.4, 5.4, () => {
    softShadow(c, cam, p, 13.4, 5.4, 0.42, 0.22);
    box3(c, cam, { x: 13.22, y: 5.22, w: 0.36, d: 0.36, h: 1.05 }, { fill: darken(t.metal, 0.2) });
    box3(
      c,
      cam,
      { x: 13.16, y: 5.18, w: 0.48, d: 0.42, h: 0.5, z: 1.05 },
      { fill: t.screen, edge: withAlpha(p.soft, 0.45), contrast: 0.12 },
    );
  });
  st.add(13.9, 7.2, () => {
    softShadow(c, cam, p, 13.9, 7.2, 0.4);
    plant(c, cam, p, 13.9, 7.2, 1.15, 5);
  });

  // The way in, bottom right: a mat and a rope post, so the room has a door to
  // have come through and the ticket machine has something to stand next to.
  // Kept a good way up the floor, because the bill clips the bottom of the set
  // and a half-eaten doormat reads as a rendering fault rather than a door.
  st.add(13.4, 3.6, () => {
    box3(
      c,
      cam,
      { x: 12.7, y: 3.1, w: 1.5, d: 1.0, h: 0.02 },
      { fill: mix(t.metal, p.ink, 0.28) },
    );
    box3(c, cam, { x: 12.1, y: 3.5, w: 0.1, d: 0.1, h: 0.95 }, { fill: darken(t.metal, 0.25) });
  });
}

// --- the people ------------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.28),
    mix(p.green, p.bg, 0.3),
    t.cloth,
    darken(t.clay, 0.1),
    mix(p.ink, p.bg, 0.52),
    mix(t.wood, p.ink, 0.2),
  ];
  return coats[id % coats.length];
}

/**
 * Clerks, applicants at the windows, and everybody sitting with a ticket.
 *
 * Whoever is at a window is gold, which means the same thing here as everywhere
 * else in the course. Everybody else is carrying a folder, because they all
 * brought the documents and most of them will be told something is missing.
 */
function people(f: Frame<OfficeModel>, st: Stage): number {
  const { c, cam, p, model } = f;
  const t = tints(p);
  const sim = model.sim;

  WINDOWS.forEach((wx, i) => {
    if (i >= model.open) return;
    const held = sim.busy[0]?.[i];
    // Close to the glass. Set back at a realistic distance the clerks
    // disappeared behind the counter entirely, which is a true thing about
    // public counters and a useless thing to draw.
    const cy = COUNTER.y + COUNTER.d + 0.16;
    st.add(wx, cy, () =>
      person(c, cam, p, wx, cy, {
        coat: held ? mix(p.gold, p.ink, 0.35) : mix(p.gold, p.bg, 0.6),
        skin: mix(t.skin, p.ink, (i % 3) * 0.16),
        hair: darken(t.wood, 0.3 + i * 0.1),
      }),
    );
    if (!held) return;
    const ax = wx;
    const ay = COUNTER.y - 0.62;
    st.add(ax, ay, () => {
      softShadow(c, cam, p, ax, ay, 0.28);
      person(c, cam, p, ax, ay, {
        coat: p.gold,
        skin: mix(t.skin, p.ink, (held.id % 4) * 0.13),
        hair: held.id % 3 === 0 ? undefined : darken(coatFor(p, held.id + 1), 0.3),
        carry: mix(t.clay, p.ink, 0.15),
      });
    });
  });

  const waiting = sim.queues[0] ?? [];
  let standing = 0;
  waiting.forEach((customer: Customer, i) => {
    const seat = SEATS[i];
    if (!seat) {
      standing += 1;
      return;
    }
    const [sx, sy] = seat;
    st.add(sx, sy + 0.02, () =>
      person(c, cam, p, sx, sy - 0.06, {
        // Seated: a shorter figure on the chair, which at this scale is the
        // only honest way to say sitting without articulating a leg. Not much
        // shorter, though -- at 1.28 m they vanished behind the chair backs.
        h: 1.5,
        coat: coatFor(p, customer.id),
        skin: mix(t.skin, p.ink, (customer.id % 4) * 0.13),
        hair: customer.id % 3 === 0 ? undefined : darken(coatFor(p, customer.id + 2), 0.32),
        carry: customer.id % 2 === 0 ? mix(t.clay, p.ink, 0.15) : undefined,
      }),
    );
  });

  // Anyone the seats could not take stands along the back of the room.
  for (let i = 0; i < Math.min(standing, 6); i++) {
    const sx = 1.4 + (i % 3) * 0.95;
    const sy = 9.9 - Math.floor(i / 3) * 0.85;
    st.add(sx, sy, () => {
      softShadow(c, cam, p, sx, sy, 0.24);
      person(c, cam, p, sx, sy, {
        coat: coatFor(p, i + 3),
        skin: mix(t.skin, p.ink, (i % 4) * 0.13),
        hair: darken(t.wood, 0.4),
      });
    });
  }

  return standing;
}

// --- the bill --------------------------------------------------------------

/** How much of the canvas foot the bill takes. Shared so the room can be
 * clipped out of it before anything is drawn. */
const billHeight = (h: number) => Math.min(58, Math.max(44, h * 0.19));

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

/**
 * Two bars across the foot of the room: what the office spends on counter staff
 * today, and what the room spends on being in it. Same scale, and the second
 * one is an empty dashed outline because it appears in nobody's accounts.
 *
 * Drawn in screen space rather than world space. It is not a thing in the room
 * -- that is the entire point of it -- and putting it on the floor in
 * perspective would have made it look like signage the office had chosen to
 * display.
 */
function bill(f: Frame<OfficeModel>, standing: number, panelH: number): void {
  const { c, p, model, w, h } = f;
  const { office, queue } = dayBill(model);

  const pad = 12;
  const top = h - panelH;
  // Opaque, and the same colour as the stage behind the canvas. A translucent
  // panel let the floor plane show through at a tenth strength, and the one
  // thing that read through it was the floor's diagonal edge -- a pale line
  // running down across both bars, which made the bill look like something
  // lying on the carpet rather than an account of it.
  c.fillStyle = p.ground;
  c.fillRect(0, top, w, panelH);
  c.strokeStyle = withAlpha(p.soft, 0.35);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, top + 0.5);
  c.lineTo(w, top + 0.5);
  c.stroke();

  const size = Math.max(8, Math.min(11, w * 0.013));
  const labelW = Math.min(96, w * 0.2);
  const x0 = pad + labelW;
  const full = w - x0 - pad - Math.min(74, w * 0.11);
  const barH = Math.max(7, panelH * 0.2);
  const scale = Math.max(office, queue ?? office * 2.6) * 1.04;

  // The day fills left to right, holds at closing time, and starts again, so
  // both bars are always growing and the dashed one is always outrunning the
  // solid one.
  //
  // The hold is a third of a day long and it is there because the comparison
  // only reads at full length. Straight after a rollover the office bar is a
  // ten-pixel nub beside a twenty-five-pixel outline, which is the right ratio
  // and an illegible picture of it; holding at close means a reader who glances
  // at the figure for two seconds has a one-in-four chance of catching the
  // whole day rather than a sliver of one.
  const phase = model.sim.tick % Math.round(DAY_TICKS * 1.32);
  const filled = Math.min(1, phase / DAY_TICKS);

  const row = (
    y: number,
    text: string,
    value: number | null,
    solid: boolean,
  ) => {
    label(c, text, pad, y + barH, p.soft, size, "left");
    const track = x0;
    c.strokeStyle = withAlpha(p.soft, 0.28);
    c.lineWidth = 1;
    c.strokeRect(track + 0.5, y + 0.5, full, barH);

    if (value === null) {
      // Over capacity: the bill has no total, so the bar has no end.
      c.setLineDash([4, 3]);
      c.strokeStyle = p.pinkEdge;
      c.lineWidth = 1.5;
      c.strokeRect(track + 0.5, y + 0.5, full, barH);
      c.setLineDash([]);
      label(c, "grows without limit", track + full + 8, y + barH, p.pinkEdge, size, "left", "600");
      return;
    }

    const width = Math.max(1, (value / scale) * full * filled);
    if (solid) {
      c.fillStyle = p.gold;
      c.fillRect(track, y, width, barH);
    } else {
      c.setLineDash([4, 3]);
      c.strokeStyle = p.pinkEdge;
      c.lineWidth = 1.5;
      c.strokeRect(track + 0.75, y + 0.75, Math.max(2, width - 1.5), barH - 1.5);
      c.setLineDash([]);
    }
    // At the end of its own bar, not in a column on the right: a figure that
    // moves with the thing it measures is doing the same job as the bar.
    label(
      c,
      money(value * filled),
      Math.min(track + Math.max(width, 34) + 7, track + full),
      y + barH,
      p.ink,
      size,
      "left",
      "600",
    );
  };

  const gap = (panelH - barH * 2 - 10) / 3;
  row(top + gap, "the office pays", office, true);
  row(top + gap * 2 + barH + 2, "the queue pays", queue, false);

  if (standing > 0) {
    chip(c, p, `${standing} standing`, pad, top - 22, size, w);
  }
}

// --- the scene -------------------------------------------------------------

export const office: SceneDef<OfficeModel> = {
  height: 330,
  minHeight: 200,
  warm: 2600,
  rate: 22,
  controls: [
    {
      kind: "select",
      key: "open",
      label: "Windows open",
      // Opens on three, which is the room the lecture is describing: a
      // forty-eight minute wait and eight people sitting down. Four windows at
      // this rate is a correct and unremarkable office with almost nobody in
      // it, and an empty waiting room makes a poor argument about waiting.
      value: "3",
      options: [
        { value: "3", label: "3 of 5" },
        { value: "4", label: "4 of 5" },
        { value: "5", label: "5 of 5" },
      ],
    },
    {
      kind: "range",
      key: "rate",
      label: "Applications an hour",
      min: 8,
      max: 19,
      step: 1,
      value: 14,
      format: (v) => `${v}/hr`,
    },
  ],
  readout: [
    { key: "W", term: "W" },
    { key: "L", term: "L" },
    { key: "hours", term: "person-hours", sub: "a day" },
    { key: "queue", term: "the queue pays" },
    { key: "office", term: "the office pays" },
  ],
  build,
  step,
  representative: (m) =>
    m.stats.over || Math.abs(m.sim.inSystem - m.stats.L) <= Math.max(1, m.stats.L * 0.3),
  extent: () => ROOM,
  report: (m) => {
    const { office: o, queue } = dayBill(m);
    return {
      W: m.stats.over ? "no limit" : `${((m.stats.W * TICK_SECONDS) / 60).toFixed(0)} min`,
      L: m.stats.over ? "grows" : m.stats.L.toFixed(1),
      hours: m.stats.over ? "no limit" : (m.stats.L * 8).toFixed(0),
      queue: queue === null ? "no limit" : money(queue),
      office: money(o),
    };
  },
  regions: {
    /** The counter and its windows, open and shuttered. */
    counter: { x0: 0.4, x1: 14.2, y0: 8.6, y1: 14, z1: 3.0 },
    /** The seating, for a week that needs people waiting without a line. */
    seats: { x0: 1.2, x1: 12.0, y0: 2.4, y1: 9.6, z1: 2.0 },
  },
  draw(f) {
    // A snippet gets the room and nothing else. The bill is drawn in screen
    // space across the foot of the canvas, so a crop of the seating would
    // otherwise arrive in week 5 with two bar charts stapled underneath it.
    if (f.region) {
      const st = new Stage();
      shell(f, st);
      furniture(f, st);
      people(f, st);
      st.paint();
      return;
    }

    // The room is clipped to the space above the bill. Without it the floor
    // runs on underneath the bars, and a viewer reads one picture where the
    // week needs two: a room, and the account of the room that nobody keeps.
    const panelH = billHeight(f.h);
    f.c.save();
    f.c.beginPath();
    f.c.rect(0, 0, f.w, f.h - panelH);
    f.c.clip();
    const st = new Stage();
    shell(f, st);
    furniture(f, st);
    const standing = people(f, st);
    st.paint();
    f.c.restore();
    bill(f, standing, panelH);
  },
};
