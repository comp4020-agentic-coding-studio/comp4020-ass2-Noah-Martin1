/**
 * Week 12: the last queue in the course, and the one where the rule is argued
 * about in public.
 *
 * A dialysis unit. Everybody in the chairs is on the kidney waiting list, an
 * organ arrives every few months, and the only decision available is who gets
 * it -- which is the whole of this week: there is no throughput left to find,
 * no server to add, no variability to smooth. Every tool from the preceding
 * eleven weeks reduces to a choice of ordering, and the choice is fatal.
 *
 * So the five rules the course taught are the control, and they are the same
 * five rules that have actually been proposed for organ allocation:
 *
 *   longest on the list   week 5's first-come-first-served
 *   most life-years       week 6's shortest-job-first, relabelled as benefit
 *   sickest first         week 7's triage
 *   highest bidder        week 8's price
 *   points                the weighted composite, which is what gets used
 *
 * Read the readout as the columns of the objective matrix further down the
 * page. Life-years an organ is efficiency. W is the mean. The slowest tenth is
 * the tail. Organs to the over-sixties is one concrete reading of fairness. And
 * the share who leave the list without an organ is the cost no column contains.
 *
 * Measured, five seeds, two hundred years of list each, four organs a year
 * against six point two candidates joining:
 *
 *   rule              life-yrs/organ    W      slowest tenth   to 60+   died
 *   longest wait            9.7       2.7 yr      4.8 yr        43%      35%
 *   most life-years        12.6       2.2 yr      6.0 yr        24%      36%
 *   sickest first           9.0       3.7 yr     12.0 yr        44%      35%
 *   highest bidder          9.7       2.6 yr      7.8 yr        44%      38%
 *   points system          11.1       2.9 yr      5.5 yr        33%      38%
 *
 * Five rules, and not one column has a winner that wins anywhere else.
 *
 * Sorting by benefit produces nearly a third more life-years than arrival
 * order and cuts the share of organs reaching the over-sixties from 43% to 24%
 * -- while the over-sixties go from 42% of the list to 83% of it, because they
 * are the people it never picks and they accumulate. Sickest-first has the most
 * medical consent of any rule here and is the least efficient on offer, with a
 * tail two and a half times arrival order's: week 7's starved bottom category,
 * except that here the bottom category is whoever is coping best. The bidder
 * buys nothing but revenue. And the points system is second at everything,
 * which is why a points system is what actually exists.
 *
 * Then read the last column, which barely moves. Thirty-five to thirty-eight
 * per cent leave without an organ under every rule, because the arithmetic of
 * the list does not care how it is sorted: if more people join than there are
 * organs, the surplus leaves the other way. It is week 8's conservation result
 * arriving one final time with much worse consequences, and the only control in
 * this scene that touches it is the supply. Three organs a year kills half the
 * list; six kills one in nine.
 *
 * NOTE ON THE NUMBERS: this is a stylised model of one small centre, not a
 * reconstruction of any real allocation system. The mortality, the survival
 * benefit by age and the wait are the right order of magnitude and the right
 * shape; they are not published statistics and the lecture does not present
 * them as any. What is being taught is the structure of the trade-off, which
 * survives any reasonable choice of constants -- the sign of every one of those
 * comparisons is a property of the rules, not of this calibration.
 */

import { mulberry32 } from "../../queue-sim";
import { project, type Extent } from "../project";
import {
  Stage,
  box3,
  chair,
  chip,
  counter,
  darken,
  ground,
  isDark,
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
import { pathLength, pointAt, type Path } from "../path";
import type { Frame, SceneDef } from "../types";

/** One week a tick. A transplant list is measured in years. */
const WEEKS_PER_YEAR = 52;

/** The unit, in metres. */
const ROOM: Extent = { x0: 0, x1: 12.8, y0: -0.9, y1: 9.2, z1: 2.8 };
const WALL = 2.6;

/**
 * Dialysis stations: two rows of five, each a recliner with a machine.
 *
 * Four metres between the rows and the front one shifted half a bay sideways,
 * both for the same reason. A drip stand is nearly two metres tall, and in this
 * projection two metres of height is more screen than four metres of depth --
 * so rows placed a comfortable walking distance apart had the front row's poles
 * standing in the back row's laps. Offsetting them puts each back-row patient
 * in the gap between two front-row stations, which is also how a real unit is
 * laid out, for the same sightline reason.
 */
const STATION_X = [0.9, 2.75, 4.6, 6.45, 8.3] as const;
const STATION_ROWS = [7.6, 3.6] as const;
const ROW_SHIFT = [0, 0.92] as const;
const STATIONS = STATION_X.length * STATION_ROWS.length;

/** Where the nth station is. */
function bay(i: number): { x: number; y: number } {
  const row = Math.floor(i / STATION_X.length);
  return { x: STATION_X[i % STATION_X.length] + ROW_SHIFT[row], y: STATION_ROWS[row] };
}
/** Chairs at the front for the shift that has not started yet. */
const BENCH_X = [1.9, 3.3, 4.7, 6.1, 7.5] as const;
const BENCH_Y = 1.1;
const DRAWN = STATIONS + BENCH_X.length;

/** The coordinator's desk, by the door, where an organ is offered. */
const DESK = { x: 10.2, y: 7.2, w: 1.9, d: 0.95, h: 1.0 };
const DOOR_X = 12.1;
/** The offer's path: through the door and down to the desk. */
const ARRIVE: Path = [
  [DOOR_X, ROOM.y1 - 0.2],
  [DOOR_X - 0.5, DESK.y + 1.7],
];
/** And the way out, for whoever the rule picked. */
const LEAVE: Path = [
  [8.9, 2.4],
  [DOOR_X - 0.9, 2.4],
  [DOOR_X - 0.9, ROOM.y1 + 0.3],
];

export type Rule = "waited" | "years" | "sickest" | "price" | "points";

const RULE_LABEL: Record<Rule, string> = {
  waited: "LONGEST WAIT",
  years: "MOST LIFE-YEARS",
  sickest: "SICKEST FIRST",
  price: "HIGHEST BIDDER",
  points: "POINTS SYSTEM",
};

export interface Candidate {
  id: number;
  joinedAt: number;
  /**
   * Age on the day they were listed.
   *
   * People do not stop ageing while they wait, and the first version forgot --
   * which produced a tag reading "aged 32, 32.2 years on the list" under
   * sickest-first, a rule that genuinely can leave somebody on the list for
   * decades. The starvation is the point and stays; the arithmetic was wrong.
   * Ageing also decays the benefit rule's own advantage over time, which is
   * part of why real composites weight waiting.
   */
  age0: number;
  /** How ill, 0 to 1. Drives both the death hazard and the benefit. */
  sick: number;
  /** What they would pay, in nothing in particular. Uncorrelated with need. */
  bid: number;
  /** Organs that have gone to somebody else since they joined. */
  passed: number;
  /** Ticks left on a departure animation. */
  out: number;
  /** Where they were sitting when they left, so the flash lands in the chair. */
  seat: number;
}

export interface WardModel {
  rng: () => number;
  tick: number;
  nextId: number;
  nextJoin: number;
  nextOrgan: number;
  list: Candidate[];
  rule: Rule;
  supply: number;
  stats: WardStats;
  /** An organ in transit: ticks since it came through the door. */
  offer: number;
  /** Transplanted, walking out. */
  going: Candidate[];
  /** Died or came off the list, flashing in their chair. */
  lost: Candidate[];
  /** Since the unit opened. */
  organs: number;
  deaths: number;
  /* Counters the model keeps for its own measurement. */
  gainSum: number;
  /** Weeks on the list, summed over everybody who left it. */
  waitSum: number;
  /** The same, bucketed by quarter, for a percentile rather than a max. */
  waitHist: number[];
  over60: number;
  leftN: number;
}

export interface WardStats {
  /** Mean life-years produced per organ. */
  perOrgan: number;
  /**
   * Mean weeks on the list, over everybody who left it -- transplanted or not.
   *
   * Measuring the wait of the transplanted only was the first version, and it
   * reported that sorting by life-years *shortens* the queue: 1.1 years against
   * 3.4. It does, for the people it picks. The people it never picks sit there
   * until they die and leave the statistic without ever entering it, which is
   * week 9's boundary trick arriving one last time -- so the boundary here is
   * drawn to include them, which is what week 3 said to do.
   */
  wait: number;
  /** Ninetieth percentile weeks on the list, over everybody who left it. */
  worst: number;
  /** Share of organs going to candidates aged sixty or over. */
  over60: number;
  /** Share of candidates who died or came off the list before a transplant. */
  died: number;
  /** Mean size of the list. */
  listed: number;
}

// --- the people ------------------------------------------------------------

/**
 * A new candidate.
 *
 * Age is skewed old because the list is: a median in the mid fifties is about
 * right, and it is exactly what makes the benefit rule bite. Illness is drawn
 * independently, and so is the bid -- which is the point of including a bid at
 * all. Nothing about what somebody would pay carries information about what
 * they need or what an organ would do for them.
 */
function admit(m: WardModel): Candidate {
  return {
    id: m.nextId++,
    joinedAt: m.tick,
    age0: Math.round(24 + 52 * (1 - Math.pow(m.rng(), 1.35))),
    sick: Math.min(1, 0.1 + 0.85 * m.rng()),
    bid: -Math.log(1 - m.rng()),
    passed: 0,
    out: 0,
    seat: 0,
  };
}

/**
 * The weekly chance of leaving the list without a transplant.
 *
 * Reported everywhere as "died waiting", and in practice it is died-or-became-
 * too-sick-to-transplant, which is why the two are one event here. It rises
 * steeply with illness and gently with time, because dialysis is not a holding
 * pattern -- people deteriorate in the queue, which is the mechanism that makes
 * a long wait a clinical outcome rather than an inconvenience.
 */
const HAZARD = 0.00163;
function hazard(m: WardModel, who: Candidate): number {
  const years = (m.tick - who.joinedAt) / WEEKS_PER_YEAR;
  return (
    HAZARD *
    (0.2 + 2.6 * who.sick * who.sick) *
    (0.55 + 0.95 * ((ageOf(m, who) - 24) / 52)) *
    (1 + 0.22 * years)
  );
}

/** How old they are now, not on the day they joined. */
function ageOf(m: WardModel, who: Candidate): number {
  return who.age0 + (m.tick - who.joinedAt) / WEEKS_PER_YEAR;
}

/**
 * Expected extra years of life from a transplant, against staying on dialysis.
 *
 * About twenty-five for somebody in their twenties, about five for somebody in
 * their seventies, less the sicker they are. The gradient is the whole reason a
 * benefit rule is tempting and the whole reason it is contested -- and because
 * it is computed from the current age, it falls while you wait.
 */
function gainOf(m: WardModel, who: Candidate): number {
  return Math.max(0.6, (80 - ageOf(m, who)) * 0.5 * (1 - 0.45 * who.sick));
}

/** What the current rule is sorting on. Bigger goes first. */
function priority(m: WardModel, who: Candidate): number {
  const waited = m.tick - who.joinedAt;
  switch (m.rule) {
    case "waited":
      return waited;
    case "years":
      return gainOf(m, who);
    case "sickest":
      return who.sick;
    case "price":
      return who.bid;
    case "points":
      // The composite, with its weights stated -- which is the one thing the
      // real systems do that none of the pure rules do. Four points of wait
      // against four of benefit against two of urgency: second best at
      // everything, and defensible out loud.
      return (
        0.4 * Math.min(1, waited / (6 * WEEKS_PER_YEAR)) +
        0.4 * Math.min(1, gainOf(m, who) / 26) +
        0.2 * who.sick
      );
  }
}

function pick(m: WardModel): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  for (const who of m.list) {
    const score = priority(m, who);
    // Ties break on the longer wait, which is what every real system does and
    // is the only part of any of these rules nobody argues about.
    if (score > bestScore || (score === bestScore && best && who.joinedAt < best.joinedAt)) {
      best = who;
      bestScore = score;
    }
  }
  return best;
}

function blank(rule: Rule, supply: number, seed: number): WardModel {
  return {
    rng: mulberry32(seed),
    tick: 0,
    nextId: 1,
    nextJoin: 0,
    nextOrgan: 0,
    list: [],
    rule,
    supply,
    stats: { perOrgan: 0, wait: 0, worst: 0, over60: 0, died: 0, listed: 0 },
    offer: 0,
    going: [],
    lost: [],
    organs: 0,
    deaths: 0,
    gainSum: 0,
    waitSum: 0,
    waitHist: [],
    over60: 0,
    leftN: 0,
  };
}

/**
 * Candidates joining a year.
 *
 * More than the organs, always, and that inequality is the premise of the
 * lecture rather than a parameter of it. The surplus leaves the list the only
 * other way there is -- which means the share who die waiting has a floor of
 * (joins - organs) / joins whatever rule is running, and no ordering rule can
 * get under it. At six point two joins against four organs that floor is 35%,
 * and the slider is the only control in this scene that can move it.
 */
const JOIN_PER_YEAR = 6.2;

/** Both ways off the list are a wait that ended. Count both. */
function departed(m: WardModel, who: Candidate): void {
  const waited = m.tick - who.joinedAt;
  m.waitSum += waited;
  const q = Math.min(199, Math.floor(waited / 13));
  m.waitHist[q] = (m.waitHist[q] ?? 0) + 1;
  m.leftN += 1;
}

function advance(m: WardModel): void {
  m.tick += 1;

  if (m.tick >= m.nextJoin) {
    m.nextJoin += Math.max(0.001, -Math.log(1 - m.rng()) * (WEEKS_PER_YEAR / JOIN_PER_YEAR));
    m.list.push(admit(m));
  }

  // Off the list, the way nobody wants.
  for (let i = m.list.length - 1; i >= 0; i--) {
    const who = m.list[i];
    if (m.rng() < hazard(m, who)) {
      who.seat = i;
      m.list.splice(i, 1);
      m.deaths += 1;
      departed(m, who);
      who.out = 12;
      m.lost.push(who);
    }
  }

  // An organ, and the only decision in the building.
  if (m.tick >= m.nextOrgan) {
    m.nextOrgan += Math.max(0.001, -Math.log(1 - m.rng()) * (WEEKS_PER_YEAR / m.supply));
    const taken = pick(m);
    if (taken) {
      m.list.splice(m.list.indexOf(taken), 1);
      m.organs += 1;
      m.gainSum += gainOf(m, taken);
      departed(m, taken);
      if (ageOf(m, taken) >= 60) m.over60 += 1;
      for (const other of m.list) other.passed += 1;
      taken.out = 22;
      m.offer = 1;
      m.going.push(taken);
    }
  }

  if (m.offer > 0) m.offer = m.offer < 14 ? m.offer + 1 : 0;
  for (let i = m.going.length - 1; i >= 0; i--) {
    m.going[i].out -= 1;
    if (m.going[i].out <= 0) m.going.splice(i, 1);
  }
  for (let i = m.lost.length - 1; i >= 0; i--) {
    m.lost[i].out -= 1;
    if (m.lost[i].out <= 0) m.lost.splice(i, 1);
  }
}

// --- measurement -----------------------------------------------------------

const cache = new Map<string, WardStats>();
function measure(rule: Rule, supply: number): WardStats {
  const key = `${rule}:${supply}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const WARM = 40 * WEEKS_PER_YEAR;
  const TICKS = 200 * WEEKS_PER_YEAR;
  const seeds = [7, 11, 23, 42, 99];
  let gain = 0;
  let wait = 0;
  const hist: number[] = [];
  let over60 = 0;
  let organs = 0;
  let deaths = 0;
  let left = 0;
  let listed = 0;

  for (const seed of seeds) {
    const m = blank(rule, supply, seed);
    for (let i = 0; i < WARM; i++) advance(m);
    m.organs = 0;
    m.deaths = 0;
    m.gainSum = 0;
    m.waitSum = 0;
    m.waitHist = [];
    m.over60 = 0;
    m.leftN = 0;
    let sum = 0;
    for (let i = 0; i < TICKS; i++) {
      advance(m);
      sum += m.list.length;
    }
    gain += m.gainSum;
    wait += m.waitSum;
    m.waitHist.forEach((n, q) => (hist[q] = (hist[q] ?? 0) + n));
    over60 += m.over60;
    organs += m.organs;
    deaths += m.deaths;
    left += m.leftN;
    listed += sum / TICKS;
  }

  /*
   * The ninetieth percentile of the wait, off the histogram.
   *
   * The first pass reported the single longest wait, and it moved by sixteen
   * years between neighbouring settings -- one sample from a tail, which is
   * exactly the mistake week 7's readout was rebuilt to avoid. A percentile
   * off two hundred years of list is stable to a quarter.
   */
  let seen = 0;
  let p90 = 0;
  for (let q = 0; q < hist.length; q++) {
    seen += hist[q] ?? 0;
    if (seen >= left * 0.9) {
      p90 = (q + 1) * 13;
      break;
    }
  }

  const out: WardStats = {
    perOrgan: organs ? gain / organs : 0,
    wait: left ? wait / left : 0,
    worst: p90,
    over60: organs ? over60 / organs : 0,
    // Of everybody who left the list, the share who left without an organ.
    died: organs + deaths ? deaths / (organs + deaths) : 0,
    listed: listed / seeds.length,
  };
  cache.set(key, out);
  return out;
}

function build(controls: {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}): WardModel {
  const rule = (controls.str("rule", "waited") as Rule) ?? "waited";
  const supply = Math.round(controls.num("supply", 4));
  const m = blank(rule, supply, 7);
  m.stats = measure(rule, supply);
  return m;
}

// --- the set ---------------------------------------------------------------

/**
 * A dialysis station: recliner, drip stand, machine.
 *
 * The first version used the course's waiting-room chair() with a cabinet and a
 * flat panel beside it, and the screenshot came out as an open-plan office --
 * which is a serious problem when the previous week is a call centre. What
 * makes a room read as clinical at twenty pixels a figure is not the machine,
 * it is the pole: a stand with a bag hanging off it is the most recognisable
 * object in any hospital. So each station gets one, plus a chair with a solid
 * base, armrests and a footrest, which is what a recliner has and a desk chair
 * does not.
 */
function station(f: Frame<WardModel>, x: number, y: number): void {
  const { c, cam, p } = f;
  const t = tints(p);
  /*
   * Desaturated green vinyl, which is what these chairs are upholstered in and
   * which also stops the recliner reading as the same object as the machine
   * beside it -- the first pass had both in the room's stone grey and the eye
   * could not tell which cabinet belonged to which chair.
   *
   * Pulled toward the floor in dark mode. Both ingredients invert there --
   * --q-ink is near-white and the dark green token is a light mint -- so the
   * unmodified mix came out as the brightest object in the room, ten chairs
   * glowing louder than the ten people sitting in them.
   */
  const base = mix(t.cloth, p.green, 0.2);
  const seat = isDark(p) ? mix(base, p.ground, 0.5) : darken(base, 0.04);

  // The recliner. Solid base rather than legs -- these chairs weigh as much as
  // the people in them.
  box3(c, cam, { x: x - 0.21, y: y - 0.28, w: 0.42, d: 0.5, h: 0.34 }, { fill: darken(seat, 0.16), contrast: 0.2 });
  box3(c, cam, { x: x - 0.3, y: y - 0.46, w: 0.6, d: 0.8, h: 0.1, z: 0.34 }, { fill: seat, contrast: 0.22 });
  // Footrest, out in front, which is the giveaway.
  box3(c, cam, { x: x - 0.22, y: y - 0.74, w: 0.44, d: 0.28, h: 0.08, z: 0.26 }, { fill: darken(seat, 0.06), contrast: 0.2 });
  // Armrests.
  [-0.31, 0.23].forEach((dx) => {
    box3(c, cam, { x: x + dx, y: y - 0.4, w: 0.08, d: 0.56, h: 0.09, z: 0.52 }, { fill: darken(seat, 0.12), contrast: 0.18 });
  });
  // Back and headrest.
  box3(c, cam, { x: x - 0.28, y: y + 0.28, w: 0.56, d: 0.13, h: 0.56, z: 0.44 }, { fill: darken(seat, 0.04), contrast: 0.22 });
  box3(c, cam, { x: x - 0.21, y: y + 0.31, w: 0.42, d: 0.11, h: 0.2, z: 1.0 }, { fill: darken(seat, 0.14), contrast: 0.2 });

  // The drip stand: foot, pole, arm, bag.
  const px = x + 0.56;
  box3(c, cam, { x: px - 0.13, y: y - 0.06, w: 0.3, d: 0.24, h: 0.05 }, { fill: darken(t.metal, 0.2) });
  box3(c, cam, { x: px, y: y + 0.03, w: 0.05, d: 0.05, h: 1.62 }, { fill: t.metal, contrast: 0.3 });
  box3(c, cam, { x: px - 0.2, y: y + 0.03, w: 0.26, d: 0.05, h: 0.05, z: 1.6 }, { fill: t.metal, contrast: 0.3 });
  box3(
    c,
    cam,
    { x: px - 0.23, y: y + 0.02, w: 0.16, d: 0.06, h: 0.3, z: 1.26 },
    { fill: mix(p.bg, t.metal, 0.35), edge: withAlpha(p.ink, 0.3), contrast: 0.1 },
  );

  // The machine, behind the stand, with one lit panel.
  const mx = x + 0.95;
  box3(c, cam, { x: mx, y: y - 0.02, w: 0.34, d: 0.3, h: 0.78 }, { fill: mix(t.metal, p.bg, 0.22), contrast: 0.2 });
  box3(
    c,
    cam,
    { x: mx + 0.04, y: y - 0.04, w: 0.26, d: 0.06, h: 0.2, z: 0.5 },
    { fill: t.screen, edge: withAlpha(p.gold, 0.55), contrast: 0.2 },
  );

  // The line from the bag to the arm of the chair. Two pixels of tubing, and
  // the only thing in the drawing that connects the machinery to the person.
  const a = project(cam, px - 0.16, y + 0.02, 1.26);
  const b = project(cam, x + 0.2, y - 0.3, 0.68);
  c.strokeStyle = withAlpha(darken(t.clay, 0.08), 0.8);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.quadraticCurveTo(a.x + 2, b.y - 5, b.x, b.y);
  c.stroke();
}

/** The cool-box an organ travels in, and this scene's green. */
function coolbox(f: Frame<WardModel>, x: number, y: number, z: number): void {
  const { c, cam, p } = f;
  box3(c, cam, { x, y, w: 0.52, d: 0.38, h: 0.34, z }, { fill: p.green, contrast: 0.26 });
  box3(
    c,
    cam,
    { x: x - 0.02, y: y - 0.02, w: 0.56, d: 0.42, h: 0.07, z: z + 0.34 },
    { fill: darken(p.green, 0.22), contrast: 0.2 },
  );
  const h = project(cam, x + 0.26, y, z + 0.52);
  c.strokeStyle = darken(p.green, 0.34);
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(h.x, h.y + 0.05 * cam.s, 0.13 * cam.s, Math.PI, 0);
  c.stroke();
}

function shell(f: Frame<WardModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  st.add(0, ROOM.y1 + 2, () => {
    box3(
      c,
      cam,
      { x: ROOM.x0, y: ROOM.y1, w: ROOM.x1 - ROOM.x0, d: 0.3, h: WALL },
      { fill: darken(t.stone, 0.12), contrast: 0.08 },
    );
    // A window band, because a dialysis unit is a room people sit in for four
    // hours three times a week and every one of them has a view or does not.
    box3(
      c,
      cam,
      { x: 0.5, y: ROOM.y1 - 0.02, w: 6.8, d: 0.06, h: 1.0, z: 1.45 },
      { fill: mix(p.bg, p.green, 0.13), edge: withAlpha(p.ink, 0.2), contrast: 0.04 },
    );
    // Mullions and a sill. A pale rectangle on a wall is a whiteboard; a pale
    // rectangle divided into three with a ledge under it is a window.
    [2.77, 5.03].forEach((mx) =>
      box3(
        c,
        cam,
        { x: mx, y: ROOM.y1 - 0.03, w: 0.08, d: 0.06, h: 1.0, z: 1.45 },
        { fill: darken(t.stone, 0.22), contrast: 0.1 },
      ),
    );
    box3(
      c,
      cam,
      { x: 0.42, y: ROOM.y1 - 0.14, w: 6.96, d: 0.18, h: 0.08, z: 1.4 },
      { fill: mix(t.stone, p.bg, 0.3), contrast: 0.22 },
    );
    // The doorway the organ comes through and the recipient goes out of.
    box3(
      c,
      cam,
      { x: DOOR_X - 0.65, y: ROOM.y1 - 0.02, w: 1.3, d: 0.06, h: 2.05 },
      { fill: darken(t.stone, 0.3), edge: withAlpha(p.ink, 0.25), contrast: 0.06 },
    );
    // The board. It says the rule out loud, which is the thesis of the week:
    // no queue is neutral, and the only honest thing available is to publish
    // which trade you made.
    screen(c, cam, p, {
      x: 7.9,
      y: ROOM.y1,
      w: 3.9,
      h: 1.0,
      z: 1.5,
      lines: [`RULE  ${RULE_LABEL[model.rule]}`, `ON THE LIST  ${model.list.length}`],
      accent: p.gold,
    });
  });

  // The coordinator's desk, and the coordinator, who does not choose.
  st.add(DESK.x, DESK.y, () => {
    softShadow(c, cam, p, DESK.x + DESK.w / 2, DESK.y, 1.1, 0.4);
    counter(c, cam, p, DESK, mix(t.stone, p.ink, 0.08));
    box3(
      c,
      cam,
      { x: DESK.x + 1.2, y: DESK.y + 0.25, w: 0.46, d: 0.12, h: 0.36, z: DESK.h },
      { fill: t.screen, contrast: 0.24 },
    );
    // The box sits on the desk for a moment after it arrives.
    if (model.offer >= 9) coolbox(f, DESK.x + 0.15, DESK.y + 0.15, DESK.h);
  });
  st.add(DESK.x + 0.9, DESK.y + DESK.d + 0.55, () =>
    person(c, cam, p, DESK.x + 0.9, DESK.y + DESK.d + 0.55, {
      coat: mix(p.green, p.bg, 0.12),
      skin: mix(t.skin, p.ink, 0.16),
      hair: darken(t.wood, 0.4),
      h: 1.66,
    }),
  );

  // The stations. Drawn empty as well as full: a unit with chairs in it is a
  // unit, and the empty ones are the only slack in the entire system.
  for (let i = 0; i < STATIONS; i++) {
    const at = bay(i);
    st.add(at.x, at.y, () => station(f, at.x, at.y));
  }

  BENCH_X.forEach((bx) => {
    st.add(bx, BENCH_Y, () => chair(c, cam, p, bx, BENCH_Y, mix(t.cloth, p.ink, 0.1)));
  });

  st.add(11.9, 2.0, () => plant(c, cam, p, 11.9, 2.0, 0.95, 4));
}

// --- the list --------------------------------------------------------------

/** Where the nth person on the list is sitting. */
function seatOf(i: number): { x: number; y: number; seated: boolean } {
  if (i < STATIONS) {
    // A third of a metre forward of the chair, so its back shows behind the
    // shoulders. person() has no seated pose and one drawn at this size would
    // be four pixels of knee.
    const at = bay(i);
    return { x: at.x, y: at.y - 0.34, seated: true };
  }
  if (i < DRAWN) return { x: BENCH_X[i - STATIONS], y: BENCH_Y - 0.34, seated: true };
  // Standing in the near corner, left of the plant: at the low end of the
  // supply slider the list runs to thirty and the crowd was standing in it.
  return { x: 8.5 + ((i - DRAWN) % 3) * 0.78, y: 1.0 - Math.floor((i - DRAWN) / 3) * 0.8, seated: false };
}

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.34),
    t.cloth,
    darken(t.clay, 0.18),
    mix(p.ink, p.bg, 0.56),
    mix(t.wood, p.ink, 0.28),
    mix(p.green, p.ink, 0.36),
  ];
  return coats[id % coats.length];
}

/**
 * The candidate the current rule keeps declining.
 *
 * Every rule has one, and which one it is is the most informative thing about
 * the rule: the benefit rule's is the oldest person in the room, the sickest-
 * first rule's is whoever is coping best, and the bidder's is whoever is poorest.
 * Marked in pink, and named, because "no rule has four filled circles" is an
 * abstraction until it is a person in a chair with a number beside them.
 */
function passedOver(m: WardModel): Candidate | null {
  let worst: Candidate | null = null;
  for (const who of m.list) {
    if (who.passed < 4) continue;
    if (!worst || who.passed > worst.passed) worst = who;
  }
  return worst;
}

function bodies(f: Frame<WardModel>, st: Stage, marked: Candidate | null): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  const draw = (
    who: Candidate,
    at: { x: number; y: number; seated: boolean },
    coat: string,
    edge?: string,
  ) => {
    st.add(at.x, at.y, () => {
      if (!at.seated) softShadow(c, cam, p, at.x, at.y, 0.26);
      person(c, cam, p, at.x, at.y, {
        coat,
        edge,
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.11),
        // Grey hair on the older half of the list. It is the only way the
        // benefit rule's effect is visible without reading a single number:
        // switch to most-life-years and the grey heads stop leaving.
        hair:
          ageOf(model, who) >= 62
            ? mix(p.ink, p.bg, 0.66)
            : who.id % 4 === 1
              ? undefined
              : darken(coatFor(p, who.id + 2), 0.36),
        h: at.seated ? 1.3 : 1.7,
      });
    });
  };

  model.list.forEach((who, i) => {
    if (i >= DRAWN + 9) return;
    const mark = marked !== null && who.id === marked.id;
    draw(
      who,
      seatOf(i),
      mark ? p.pinkEdge : coatFor(p, who.id),
      mark ? darken(p.pinkEdge, 0.32) : undefined,
    );
  });

  // Whoever the rule just picked, walking out with it.
  const len = pathLength(LEAVE);
  model.going.forEach((who) => {
    const at = pointAt(LEAVE, (1 - who.out / 22) * len);
    draw(who, { x: at.x, y: at.y, seated: false }, p.gold);
  });

  // And whoever left the other way, still in their chair.
  model.lost.forEach((who) => {
    if (who.seat >= DRAWN) return;
    const at = seatOf(who.seat);
    st.add(at.x, at.y, () => {
      person(c, cam, p, at.x, at.y, {
        coat: withAlpha(p.pinkEdge, 0.55),
        edge: p.pinkEdge,
        h: 1.3,
      });
    });
  });
}

/** The organ, in transit from the door to the desk. */
function offer(f: Frame<WardModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);
  if (model.offer === 0 || model.offer >= 9) return;
  const len = pathLength(ARRIVE);
  const at = pointAt(ARRIVE, (model.offer / 9) * len);
  st.add(at.x, at.y, () => {
    softShadow(c, cam, p, at.x, at.y, 0.3);
    person(c, cam, p, at.x, at.y, {
      coat: mix(p.ink, p.bg, 0.22),
      skin: mix(t.skin, p.ink, 0.3),
      hair: darken(t.wood, 0.5),
      h: 1.72,
    });
    coolbox(f, at.x + 0.3, at.y - 0.25, 0.62);
  });
}

// --- what the rule costs ---------------------------------------------------

function marks(f: Frame<WardModel>, who: Candidate | null): void {
  const { c, cam, p, model, w } = f;
  if (f.region) return;
  const size = textSize(cam, 11, 9);
  const row = f.h - size * 1.7 - 8;

  /*
   * The passed-over candidate's number goes beside them; the sentence goes on
   * a chip at the foot of the frame.
   *
   * The first version put the whole line in pink ink next to the head, and on
   * screen it was pink text on a pale grey wall -- present, unreadable, and
   * printed across the row behind. Anything longer than a couple of glyphs has
   * to live on a chip, where it has its own ground; the figure itself is the
   * only pink thing in the room, so the two are not hard to connect.
   */
  const i = who ? model.list.findIndex((q) => q.id === who.id) : -1;
  if (who && i >= 0 && i < DRAWN) {
    const at = seatOf(i);
    const head = project(cam, at.x + 0.24, at.y, 1.28);
    chip(c, p, `${who.passed}×`, head.x, head.y - size * 0.9, size * 0.92);
  }

  chip(
    c,
    p,
    `${model.organs} organs · ${model.deaths} left the list without one`,
    10,
    row,
    size,
    w,
  );

  // Stacked above it, not anchored to the opposite corner: the right-hand end
  // of the frame is where the list stands once it outgrows the chairs, and a
  // chip there is printed over the overflow it is describing.
  if (!who) return;
  const years = ((model.tick - who.joinedAt) / WEEKS_PER_YEAR).toFixed(1);
  const tag = `passed over ${who.passed}× · aged ${Math.round(ageOf(model, who))} · ${years} yr on the list`;
  chip(c, p, tag, 10, row - size * 2.1, size, w);
}

// --- the scene -------------------------------------------------------------

export const ward: SceneDef<WardModel> = {
  height: 330,
  minHeight: 150,
  // Forty years of list, so the opening frame is a unit that has been running
  // this rule long enough for it to have done something.
  warm: 40 * WEEKS_PER_YEAR,
  rate: 12,
  controls: [
    {
      kind: "select",
      key: "rule",
      label: "Who gets the organ",
      value: "waited",
      options: [
        { value: "waited", label: "Longest on the list" },
        { value: "years", label: "Most life-years" },
        { value: "sickest", label: "Sickest first" },
        { value: "price", label: "Highest bidder" },
        { value: "points", label: "Points system" },
      ],
    },
    {
      kind: "range",
      key: "supply",
      label: "Organs a year",
      min: 3,
      max: 6,
      step: 1,
      value: 4,
      format: (v) => `${v}`,
    },
  ],
  readout: [
    { key: "gain", term: "life-years", sub: "an organ" },
    { key: "wait", term: "W", sub: "on the list" },
    { key: "worst", term: "slowest tenth", sub: "waited over" },
    { key: "over60", term: "organs", sub: "to the over-60s" },
    { key: "died", term: "died", sub: "on the list" },
  ],
  build,
  step: advance,
  representative: (m) => m.list.length >= STATIONS,
  extent: () => ROOM,
  report: (m) => ({
    gain: m.stats.perOrgan.toFixed(1),
    wait: `${(m.stats.wait / WEEKS_PER_YEAR).toFixed(1)} yr`,
    worst: `${(m.stats.worst / WEEKS_PER_YEAR).toFixed(1)} yr`,
    over60: `${(m.stats.over60 * 100).toFixed(0)}%`,
    died: `${(m.stats.died * 100).toFixed(0)}%`,
  }),
  regions: {
    /** The stations, and whoever the rule is not choosing. */
    chairs: { x0: 0.2, x1: 7.4, y0: 2.6, y1: 8.0, z1: 2.4 },
    /** The door, the desk and the board: where the decision is announced. */
    desk: { x0: 7.4, x1: 12.6, y0: 4.6, y1: 9.2, z1: 2.8 },
  },
  draw(f) {
    const st = new Stage();
    const who = passedOver(f.model);
    shell(f, st);
    bodies(f, st, who);
    offer(f, st);
    st.paint();
    marks(f, who);
  },
};
