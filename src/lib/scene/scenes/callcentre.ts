/**
 * Week 11: a call centre, and the number that stops being true once you say it.
 *
 * Every other scene in this course models people as jobs. This one cannot,
 * because the week is precisely about the three things jobs never do: balking,
 * reneging, and reacting to what the system tells them. So the callers here
 * have patience, and they hear an estimate when they join, and both of those
 * change the queue they are joining.
 *
 * The estimate is the standard one every call centre uses -- callers waiting,
 * divided by how fast the floor is answering -- and announcing it is the whole
 * experiment. Say nothing and people wait until their patience runs out. Say
 * "about twelve minutes" and a third of them hang up immediately, the queue
 * shortens, and the twelve minutes was never going to happen. The number was
 * correct for the world in which it was not read out.
 *
 * Two things are drawn rather than asserted. Callers on hold sit in their own
 * band below the office floor, and anyone who hangs up flashes pink before
 * they go -- so abandonment is an event you watch rather than a percentage you
 * are told. And the wallboard carries the announcement in gold while the chip
 * carries what actually happened, in pink, side by side.
 *
 * Measured, five seeds, 120,000 ticks of ten seconds, ninety-six calls an hour
 * offered, five-minute calls, patience averaging twenty minutes:
 *
 *   agents   message    W answered   hung up   announced   answered an hour
 *      4     nothing     13.3 min      50%        --            48
 *      4     announced    4.7 min      50%       5.9 min        48
 *      5     nothing      9.0 min      38%        --            60
 *      5     announced    3.6 min      38%       4.6 min        59
 *      6     nothing      5.7 min      26%        --            71
 *      6     announced    2.7 min      28%       3.6 min        69
 *      8     nothing      1.8 min       9%        --            87
 *      8     announced    1.2 min      11%       2.2 min        85
 *
 * Read the five-agent pair. Announcing the wait cuts the reported wait by sixty
 * per cent. Nobody was served faster, nobody was hired, and exactly the same
 * share of callers -- 38% -- failed to get help. The only thing that changed is
 * that they gave up at the start instead of in the middle, which moves them out
 * of the statistic that gets reported and into the one that does not.
 *
 * And the announcement is self-refuting: it promises 4.6 minutes to callers who
 * then wait 3.6, because the people who heard it and left are the reason it was
 * wrong.
 */

import { mulberry32 } from "../../queue-sim";
import { project, type Extent } from "../project";
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
  screen,
  softShadow,
  textSize,
  tints,
  withAlpha,
  type Palette,
} from "../draw";
import type { Frame, SceneDef } from "../types";

/** Ten seconds a tick, so a five-minute call is thirty. */
const TICK_SECONDS = 10;
const CALL_TICKS = 30;
/**
 * Mean patience on hold, in ticks -- twenty minutes, exponentially spread.
 *
 * The first pass used seven, and the whole scene came out too calm to teach
 * anything: with abandonment acting as the stabiliser, the steady-state wait is
 * pinned at roughly patience x -ln(share who stay), so short patience means
 * short waits however swamped the floor is. A queue nobody will wait in cannot
 * grow.
 */
const PATIENCE_TICKS = 120;

/** The floor, in metres. */
const ROOM: Extent = { x0: 0, x1: 12.4, y0: -3.6, y1: 9.2, z1: 2.9 };
const WALL = 2.7;
/** Desks: two rows of five, agents behind them. */
const DESK_X = [1.0, 3.2, 5.4, 7.6, 9.8] as const;
const DESK_ROWS = [6.6, 4.2] as const;
/** The hold band: not a place, and drawn as one anyway. */
const HOLD_Y = -1.6;
const HOLD_X0 = 0.9;
const SPACING = 0.92;

export type Tell = "quiet" | "announce";

interface Caller {
  id: number;
  joinedAt: number;
  patience: number;
  /** What they were told when they joined, in minutes. Zero if nothing. */
  told: number;
  /** Ticks left on the pink flash after hanging up. */
  gone: number;
}

export interface CallModel {
  rng: () => number;
  tick: number;
  nextId: number;
  nextCall: number;
  holding: Caller[];
  /** Ticks remaining on each agent's current call, 0 when free. */
  agents: number[];
  tell: Tell;
  staff: number;
  stats: CallStats;
  quiet: CallStats;
  /** Callers who hung up since the shift started. */
  lost: number;
  /** Recently departed, still flashing. */
  leaving: Caller[];
  /** Ticks left of the opening sequence. */
  intro: number;
  /**
   * Counters the model keeps for itself.
   *
   * The first measurement pass tried to reconstruct these from outside by
   * diffing the holding list each tick, and got them wrong in a way that was
   * obvious only because it reported fewer calls offered when more agents were
   * on shift -- the arrival rate does not know how many agents there are.
   * Instrumenting step() is duller and correct.
   */
  offered: number;
  balked: number;
  reneged: number;
  answeredN: number;
  waitSum: number;
  toldSum: number;
  toldN: number;
}

export interface CallStats {
  /** Mean wait of the callers who stayed, in ticks. */
  answered: number;
  /** Share of callers who hung up. */
  abandoned: number;
  /** Mean estimate read out, in ticks. Zero when nothing is announced. */
  announced: number;
  offered: number;
  handled: number;
}

/**
 * The opening sequence.
 *
 * CLAUDE.md asks for a short one-shot intro before this scene starts -- context
 * you see once, on a fresh load, like the first ten seconds of a documentary.
 * It is held in a module-level flag rather than on the model so that changing a
 * control does not replay it: a rebuild makes a new model, and the flag
 * survives. A refresh reloads the module and you get it again.
 */
let introSpent = false;
const INTRO_TICKS = 46;

// --- the model -------------------------------------------------------------

/** The estimate every call centre reads out: those waiting over the answer rate. */
function estimate(m: CallModel): number {
  const rate = m.staff / CALL_TICKS;
  return m.holding.length / Math.max(0.0001, rate);
}

/**
 * How many hang up on hearing it.
 *
 * Nothing under about three minutes, climbing to nearly everybody at half an
 * hour. The shape matters more than the constants: what the week needs is that
 * the reaction is increasing in the number, which is what makes the loop close.
 */
function balkChance(estTicks: number): number {
  const mins = (estTicks * TICK_SECONDS) / 60;
  return Math.max(0, Math.min(0.92, (mins - 1) / 13));
}

function blank(tell: Tell, staff: number, seed: number): CallModel {
  return {
    rng: mulberry32(seed),
    tick: 0,
    nextId: 1,
    nextCall: 0,
    holding: [],
    agents: new Array(staff).fill(0),
    tell,
    staff,
    stats: { answered: 0, abandoned: 0, announced: 0, offered: 0, handled: 0 },
    quiet: { answered: 0, abandoned: 0, announced: 0, offered: 0, handled: 0 },
    lost: 0,
    leaving: [],
    intro: 0,
    offered: 0,
    balked: 0,
    reneged: 0,
    answeredN: 0,
    waitSum: 0,
    toldSum: 0,
    toldN: 0,
  };
}

/** Calls offered an hour. Fixed: the week varies what you say, not demand. */
// Ninety-six an hour against six agents at five minutes is eight erlangs of
// demand into six of capacity: a floor that cannot possibly answer everybody,
// which is the only condition under which what the hold message says matters.
const OFFERED_PER_HOUR = 96;

/**
 * The intro gate.
 *
 * The host warms every scene by stepping it a few hundred times before the
 * first frame, which ate the whole opening sequence on the first attempt: the
 * reader arrived at a busy floor having missed the bit that explains it. So the
 * warm-up happens *inside* the scene instead -- either at build time when the
 * intro has already been spent, or at the moment the intro finishes. The lines
 * open and the queue appears, which is the right beat anyway.
 */
function step(m: CallModel): void {
  if (m.intro > 0) {
    m.intro -= 1;
    if (m.intro === 0) {
      introSpent = true;
      settle(m);
    }
    return;
  }
  advance(m);
}

/** Run the floor up to a steady state, so the first live frame is honest. */
function settle(m: CallModel): void {
  for (let i = 0; i < 600; i++) advance(m);
  for (let i = 0; i < 400 && m.holding.length < 4; i++) advance(m);
}

function advance(m: CallModel): void {
  m.tick += 1;

  // Arrivals.
  if (m.tick >= m.nextCall) {
    const mean = 3600 / TICK_SECONDS / OFFERED_PER_HOUR;
    m.nextCall += Math.max(0.001, -Math.log(1 - m.rng()) * mean);
    const est = estimate(m);
    const told = m.tell === "announce" ? est : 0;
    m.offered += 1;
    if (told > 0) {
      m.toldSum += told;
      m.toldN += 1;
    }
    // The loop, in one line: hearing the number is what makes them leave.
    if (m.tell === "announce" && m.rng() < balkChance(est)) {
      m.lost += 1;
      m.balked += 1;
      m.leaving.push({ id: m.nextId++, joinedAt: m.tick, patience: 0, told, gone: 8 });
    } else {
      m.holding.push({
        id: m.nextId++,
        joinedAt: m.tick,
        patience: Math.max(1, -Math.log(1 - m.rng()) * PATIENCE_TICKS),
        told,
        gone: 0,
      });
    }
  }

  // Reneging: patience runs out while on hold.
  for (let i = m.holding.length - 1; i >= 0; i--) {
    const who = m.holding[i];
    if (m.tick - who.joinedAt >= who.patience) {
      m.holding.splice(i, 1);
      m.lost += 1;
      m.reneged += 1;
      who.gone = 8;
      m.leaving.push(who);
    }
  }

  // Answering.
  for (let a = 0; a < m.agents.length; a++) {
    if (m.agents[a] > 0) m.agents[a] -= 1;
    if (m.agents[a] === 0 && m.holding.length > 0) {
      const taken = m.holding.shift() as Caller;
      m.answeredN += 1;
      m.waitSum += m.tick - taken.joinedAt;
      m.agents[a] = Math.max(1, Math.round(-Math.log(1 - m.rng()) * CALL_TICKS));
    }
  }

  for (let i = m.leaving.length - 1; i >= 0; i--) {
    m.leaving[i].gone -= 1;
    if (m.leaving[i].gone <= 0) m.leaving.splice(i, 1);
  }
}

// --- measurement -----------------------------------------------------------

const cache = new Map<string, CallStats>();
function measure(tell: Tell, staff: number): CallStats {
  const key = `${tell}:${staff}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const WARM = 4000;
  const TICKS = 120000;
  const seeds = [7, 11, 23, 42, 99];
  let waitSum = 0;
  let answered = 0;
  let lost = 0;
  let offered = 0;
  let toldSum = 0;
  let toldN = 0;

  for (const seed of seeds) {
    const m = blank(tell, staff, seed);
    for (let i = 0; i < WARM; i++) advance(m);
    m.offered = 0;
    m.balked = 0;
    m.reneged = 0;
    m.answeredN = 0;
    m.waitSum = 0;
    m.toldSum = 0;
    m.toldN = 0;
    for (let i = 0; i < TICKS; i++) advance(m);
    waitSum += m.waitSum;
    answered += m.answeredN;
    lost += m.balked + m.reneged;
    offered += m.offered;
    toldSum += m.toldSum;
    toldN += m.toldN;
  }

  const hours = (TICKS * seeds.length * TICK_SECONDS) / 3600;
  const out: CallStats = {
    answered: answered ? waitSum / answered : 0,
    abandoned: offered ? lost / offered : 0,
    announced: toldN ? toldSum / toldN : 0,
    offered: offered / hours,
    handled: answered / hours,
  };
  cache.set(key, out);
  return out;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): CallModel {
  const staff = Math.round(controls.num("staff", 5));
  const tell = (controls.str("tell", "quiet") as Tell) ?? "quiet";
  const m = blank(tell, staff, 7);
  m.stats = measure(tell, staff);
  m.quiet = measure("quiet", staff);
  // A reader who has asked for no motion gets no opening sequence -- they see
  // one frame, and it should be the floor under load rather than an empty room
  // two minutes before the shift.
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (introSpent || still) settle(m);
  else m.intro = INTRO_TICKS;
  return m;
}

// --- the set ---------------------------------------------------------------

/** The floor: wall, wallboard, desks, agents, plants. */
function shell(f: Frame<CallModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);
  /** 0 to 1 through the opening sequence. */
  const lit = model.intro > 0 ? 1 - model.intro / INTRO_TICKS : 1;

  ground(c, cam, p, { ...ROOM, y0: 0.2 });

  st.add(0, ROOM.y1 + 2, () => {
    box3(
      c,
      cam,
      { x: ROOM.x0, y: ROOM.y1, w: ROOM.x1 - ROOM.x0, d: 0.3, h: WALL },
      { fill: darken(t.stone, 0.14), contrast: 0.08 },
    );
    // The wallboard. It comes up a line at a time during the intro, which is
    // what the opening sequence is for: the board is the thing the week is
    // about, so it should be the thing that switches on.
    //
    // Two lines, not three. screen() scales its type to the panel, and the
    // ratio it uses only fits two -- a third ran out of the bottom of the board
    // and onto the wall. The count of people who hung up lives on the chip
    // instead, which is where the rest of the week's arithmetic already is.
    const est = (estimate(model) * TICK_SECONDS) / 60;
    const lines = [
      `WAITING  ${model.holding.length}`,
      model.tell === "announce" ? `WE SAY  ${est.toFixed(0)} MIN` : "WE SAY  NOTHING",
    ].slice(0, model.intro > 0 ? Math.floor(lit * 3) : 2);
    screen(c, cam, p, {
      x: 3.6,
      y: ROOM.y1,
      w: 5.0,
      h: 1.15,
      z: 1.2,
      lines,
      // Gold either way. The first pass drew the quiet board in p.soft, which
      // is a muted ink on a near-black panel: the whole board was unreadable at
      // the setting the scene opens on.
      accent: p.gold,
    });
  });

  DESK_ROWS.forEach((dy, row) => {
    DESK_X.forEach((dx, i) => {
      const seat = row * DESK_X.length + i;
      // Agents arrive one at a time during the intro: a shift starting.
      const here =
        model.intro > 0
          ? seat < Math.min(model.staff, Math.floor(lit * (model.staff + 1)))
          : seat < model.staff;
      st.add(dx, dy, () => {
        softShadow(c, cam, p, dx + 0.6, dy, 0.9, 0.42);
        counter(c, cam, p, { x: dx, y: dy - 0.34, w: 1.5, d: 0.75, h: 0.74 }, mix(t.stone, p.ink, 0.1));
        box3(
          c,
          cam,
          { x: dx + 0.45, y: dy + 0.05, w: 0.48, d: 0.1, h: 0.36, z: 0.74 },
          { fill: t.screen, contrast: 0.24 },
        );
      });
      if (!here) return;
      const busy = model.agents[seat] > 0;
      st.add(dx + 0.7, dy + 0.95, () => {
        person(c, cam, p, dx + 0.7, dy + 0.95, {
          coat: busy ? p.gold : mix(p.ink, p.bg, 0.42),
          skin: mix(t.skin, p.ink, (seat % 4) * 0.12),
          hair: seat % 3 === 0 ? undefined : darken(t.wood, 0.34 + (seat % 3) * 0.08),
          h: 1.52,
        });
        // The headset: a small arc over the head, gold on a live call.
        const head = project(cam, dx + 0.7, dy + 0.95, 1.5);
        c.strokeStyle = busy ? p.gold : withAlpha(p.ink, 0.45);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(head.x, head.y + 0.04 * cam.s, 0.17 * cam.s, Math.PI, 0);
        c.stroke();
      });
    });
  });

  st.add(11.6, 2.6, () => plant(c, cam, p, 11.6, 2.6, 1.15, 3));
  st.add(0.5, 2.6, () => plant(c, cam, p, 0.5, 2.6, 1.0, 8));
}

// --- the callers -----------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.32),
    t.cloth,
    darken(t.clay, 0.16),
    mix(p.ink, p.bg, 0.54),
    mix(t.wood, p.ink, 0.26),
    mix(p.green, p.ink, 0.32),
  ];
  return coats[id % coats.length];
}

/**
 * The hold band.
 *
 * Callers are not in the building, and pretending they are standing in the
 * office would be a lie about the one thing that makes a phone queue different:
 * nobody can see it, including the people in it. So they get their own strip
 * below the floor, behind a dashed line, each holding a phone.
 */
function callers(f: Frame<CallModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  const strip = [
    project(cam, ROOM.x0 + 0.3, -0.35, 0),
    project(cam, ROOM.x1 - 0.3, -0.35, 0),
    project(cam, ROOM.x1 - 0.3, ROOM.y0 + 0.4, 0),
    project(cam, ROOM.x0 + 0.3, ROOM.y0 + 0.4, 0),
  ];
  c.beginPath();
  strip.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  c.closePath();
  c.fillStyle = mix(p.ground, p.ink, 0.06);
  c.fill();
  c.setLineDash([6, 5]);
  c.strokeStyle = withAlpha(p.ink, 0.3);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(strip[0].x, strip[0].y);
  c.lineTo(strip[1].x, strip[1].y);
  c.stroke();
  c.setLineDash([]);
  /*
   * Where this caption can go, and it is only one place.
   *
   * Depth folds into screen height in this projection: a caller standing at the
   * front of the band occupies screen rows all the way up past the dashed line
   * behind them, so any label placed *on* the boundary gets printed across its
   * own subject -- which is what the first two attempts did. Above the heads is
   * the office floor. So the caption goes below every foot in the band, at its
   * front-right corner, right-aligned and clear of the chip in the other one.
   */
  if (!f.region) {
    const tag = project(cam, ROOM.x1 - 0.4, ROOM.y0 + 0.1, 0);
    label(
      c,
      "on hold — a queue nobody in the room can see",
      tag.x,
      tag.y,
      withAlpha(p.ink, 0.55),
      textSize(cam, 10, 8),
      "right",
    );
  }

  const draw = (who: Caller, index: number, quitting: boolean) => {
    // Two rows, and the modulo keeps it that way: a third row would stand
    // outside the band and on top of its caption.
    const slot = index % 22;
    const x = HOLD_X0 + (slot % 11) * SPACING;
    const y = HOLD_Y - Math.floor(slot / 11) * 1.15;
    st.add(x, y, () => {
      softShadow(c, cam, p, x, y, 0.26);
      person(c, cam, p, x, y, {
        coat: quitting ? p.pinkEdge : coatFor(p, who.id),
        edge: quitting ? darken(p.pinkEdge, 0.3) : undefined,
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.11),
        hair: who.id % 3 === 1 ? undefined : darken(coatFor(p, who.id + 2), 0.34),
        h: 1.62,
      });
      // The phone, held to the ear.
      const ear = project(cam, x + 0.17, y, 1.28);
      c.fillStyle = quitting ? darken(p.pinkEdge, 0.25) : t.screen;
      c.fillRect(ear.x - 0.05 * cam.s, ear.y - 0.09 * cam.s, 0.1 * cam.s, 0.2 * cam.s);
    });
  };

  model.holding.slice(0, 19).forEach((who, i) => draw(who, i, false));
  model.leaving.forEach((who, i) => draw(who, model.holding.length + i, true));
}

// --- the loop, priced ------------------------------------------------------

function loop(f: Frame<CallModel>): void {
  const { c, p, model, w } = f;
  if (f.region) return;
  const size = textSize(f.cam, 11, 9);
  const mins = (ticks: number) => ((ticks * TICK_SECONDS) / 60).toFixed(1);

  if (model.intro > 0) {
    chip(c, p, "07:58 — the lines open in two minutes", 10, f.h - size * 1.7 - 8, size, w);
    return;
  }

  chip(
    c,
    p,
    model.tell === "announce"
      ? `announced ${mins(model.stats.announced)} min · they waited ${mins(model.stats.answered)} · ${model.lost} hung up`
      : `nothing announced · they waited ${mins(model.stats.answered)} min · ${model.lost} hung up`,
    10,
    f.h - size * 1.7 - 8,
    size,
    w,
  );
}

// --- the scene -------------------------------------------------------------

export const callcentre: SceneDef<CallModel> = {
  height: 340,
  minHeight: 150,
  /** Warmed by the scene itself, either side of the opening sequence. */
  warm: 0,
  rate: 14,
  controls: [
    {
      kind: "select",
      key: "tell",
      label: "The hold message",
      value: "quiet",
      options: [
        { value: "quiet", label: "Says nothing" },
        { value: "announce", label: "Announces the wait" },
      ],
    },
    {
      kind: "range",
      key: "staff",
      label: "Agents on shift",
      // Opens at five, where the comparison is starkest: announcing the wait
      // there changes the headline number by sixty per cent and the number of
      // people who got help by one an hour.
      min: 4,
      max: 8,
      step: 1,
      value: 5,
      format: (v) => `${v}`,
    },
  ],
  readout: [
    { key: "w", term: "W", sub: "answered" },
    { key: "told", term: "announced", sub: "on joining" },
    { key: "abandon", term: "hung up" },
    { key: "handled", term: "answered", sub: "an hour" },
    { key: "wQuiet", term: "W", sub: "if nothing is said" },
  ],
  build,
  step,
  representative: (m) => m.intro > 0 || m.holding.length >= 4,
  extent: () => ROOM,
  report: (m) => {
    const mins = (ticks: number) => `${((ticks * TICK_SECONDS) / 60).toFixed(1)} min`;
    return {
      w: mins(m.stats.answered),
      told: m.tell === "announce" ? mins(m.stats.announced) : "—",
      abandon: `${(m.stats.abandoned * 100).toFixed(0)}%`,
      handled: m.stats.handled.toFixed(0),
      wQuiet: mins(m.quiet.answered),
    };
  },
  regions: {
    /** The floor and the wallboard. */
    floor: { x0: 0.3, x1: 12.1, y0: 3.0, y1: 9.2, z1: 2.9 },
    /** The hold band. */
    hold: { x0: 0.3, x1: 12.1, y0: -3.6, y1: 0.2, z1: 2.0 },
  },
  draw(f) {
    const st = new Stage();
    shell(f, st);
    if (f.model.intro <= 0) callers(f, st);
    st.paint();
    loop(f);
  },
};
