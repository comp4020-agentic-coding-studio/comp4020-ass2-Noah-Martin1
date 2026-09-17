/**
 * Week 7: an emergency department, and the patient the classifier sorted down.
 *
 * Every other scene in this course runs on the shared engine in queue-sim.ts.
 * This one does not, and the reason is the week's argument. Triage is not a
 * priority queue -- it is a priority queue *plus a measurement*, and the whole
 * of Priya's half of the lecture is that the measurement is produced in ninety
 * seconds by a tired human and is sometimes wrong. That needs a patient to
 * carry two categories at once: the one they have, and the one they were given.
 * The engine has a single boolean.
 *
 * So: three categories on the Australasian scale, five minutes a tick, two
 * treatment rooms, and a slider that is not a load control but an error rate.
 * Turn it up and nothing in the readout's headline moves much, because 85% of
 * patients are still sorted correctly and an average is exactly the wrong
 * instrument for finding this. What moves is one patient in the room, who goes
 * pink and sits there with a chest pain and a category 3 card.
 *
 * Measured, five seeds, 300 simulated days, 4.0 patients an hour into two bays:
 *
 *   rule / accuracy   W cat 1   W cat 2   W cat 3   cat 1 over 30 min   sorted down
 *   triage, 100%       6.2 min  10.9 min  97.6 min        0.7%            0 /day
 *   triage,  92%       9.3      17.0      90.9            3.0%          2.8 /day
 *   triage,  84%      11.8      22.3      85.6            5.1%          5.6 /day
 *   arrival order     53.8      52.6      53.1           53.1%            --
 *
 * Two readings, and the week needs both.
 *
 * Down the last row: triage is not a marginal improvement. Under arrival order
 * more than half the people having heart attacks wait over half an hour. Under
 * a 92% classifier, three per cent do. That is Adaeze's half of the lecture and
 * the scene does not hedge it.
 *
 * Across the middle rows: taking the classifier from perfect to 92% costs the
 * average category 1 patient three minutes, and category 3 gets *better* --
 * the mis-sorted are now in front of them. The share of category 1 patients
 * waiting more than half an hour quadruples. That is Priya's half. The harm
 * does not spread, it concentrates, and every aggregate stays reassuring while
 * it happens.
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

/** Five minutes a tick. An ED is measured in hours, not seconds. */
const TICK_MINUTES = 5;
const ROOMS = 2;

/** The department, in metres. */
const ROOM: Extent = { x0: 0, x1: 10.6, y0: 0.6, y1: 9.0, z1: 2.6 };
const WALL = 2.4;

/** Triage: the desk you are assessed at, and the nurse behind it. */
const DESK = { x: 0.7, y: 7.5, w: 2.4, d: 1.0, h: 1.05 };
const NURSE = { x: 1.7, y: DESK.y + DESK.d + 0.55 };

/** The two treatment bays, cut into the back wall. */
const BAYS = [6.0, 8.5] as const;
const BAY_Y = ROOM.y1 - 0.15;
/** Where a patient stands while they are being treated. */
const TREAT_Y = BAY_Y - 1.0;

/** The waiting room: three rows of four chairs, filled in arrival order. */
const SEAT_ROWS = [5.4, 3.8, 2.2] as const;
const SEAT_X = [1.5, 2.9, 4.3, 5.7] as const;
const SEATS = SEAT_ROWS.length * SEAT_X.length;
/** How many more the scene will draw standing before it starts counting. */
const STANDING = 8;

/**
 * The three categories this scene uses, off the five-point Australasian scale.
 *
 * Target is the scale's own time to treatment, and it is what makes a wait a
 * failure rather than a wait: a category 2 at twelve minutes is a department
 * having a bad afternoon, and a category 1 at twelve minutes is the thing the
 * whole apparatus exists to prevent.
 */
interface Category {
  /** Share of arrivals. */
  share: number;
  /** Treatment time in ticks. */
  work: number;
  /** Minutes to treatment the scale asks for. */
  target: number;
  complaints: string[];
}
const CATEGORIES: Record<1 | 2 | 3, Category> = {
  1: { share: 0.08, work: 10, target: 2, complaints: ["chest pain", "stroke signs", "heavy bleeding"] },
  2: { share: 0.27, work: 7, target: 10, complaints: ["head injury", "abdominal pain", "short of breath"] },
  3: {
    share: 0.65,
    work: 4,
    target: 30,
    complaints: ["sprained wrist", "sore throat", "cut hand", "back pain", "a rash"],
  },
};

export type Rule = "arrival" | "triage";
type Level = 1 | 2 | 3;

export interface Patient {
  id: number;
  arrivedAt: number;
  /** What is actually wrong. The department never sees this. */
  truth: Level;
  /** What the ninety seconds at the desk decided. The queue sees only this. */
  card: Level;
  complaint: string;
  left: number;
}

interface Bay {
  patient: Patient | null;
  until: number;
}

export interface EdModel {
  rng: () => number;
  tick: number;
  nextId: number;
  nextArrival: number;
  waiting: Patient[];
  bays: Bay[];
  rule: Rule;
  accuracy: number;
  perHour: number;
  /** Long-run numbers for this setting, measured the same way every week is. */
  stats: EdStats;
  /** Patients sorted below their true category since the shift began. */
  sortedDown: number;
}

// --- the model -------------------------------------------------------------

function draw(rng: () => number): Level {
  const r = rng();
  if (r < CATEGORIES[1].share) return 1;
  if (r < CATEGORIES[1].share + CATEGORIES[2].share) return 2;
  return 3;
}

/**
 * The assessment.
 *
 * Under-triage only, which is the documented failure: the prototype in the
 * category description is what an atypical presentation fails to match, and
 * failing to match it sorts you down, never up. A category 1 can slip two --
 * that is the woman having a heart attack who is sent to the waiting room --
 * and it is the case the scene exists to show, so it is not rare in the model
 * either: four in ten of the errors made on a category 1 go all the way to 3.
 */
function assess(truth: Level, accuracy: number, rng: () => number): Level {
  if (truth === 3 || rng() < accuracy) return truth;
  if (truth === 1 && rng() < 0.4) return 3;
  return (truth + 1) as Level;
}

function newModel(perHour: number, accuracy: number, rule: Rule, seed: number): EdModel {
  return {
    rng: mulberry32(seed),
    tick: 0,
    nextId: 1,
    nextArrival: 0,
    waiting: [],
    bays: Array.from({ length: ROOMS }, () => ({ patient: null, until: 0 })),
    rule,
    accuracy,
    perHour,
    stats: measure(perHour, accuracy, rule),
    sortedDown: 0,
  };
}

/** Who the next free bay takes. This is the week, in four lines. */
function pick(m: EdModel): Patient | undefined {
  if (m.waiting.length === 0) return undefined;
  let index = 0;
  if (m.rule === "triage") {
    // Strict priority on the card, arrival order within a category. Note it
    // reads m.waiting[i].card and never .truth: the department cannot sort on
    // information it does not have, which is the entire problem.
    for (let i = 1; i < m.waiting.length; i++) {
      if (m.waiting[i].card < m.waiting[index].card) index = i;
    }
  }
  return m.waiting.splice(index, 1)[0];
}

function step(m: EdModel): void {
  m.tick += 1;

  if (m.tick >= m.nextArrival) {
    // Accumulated, not reset to the current tick. Setting it to
    // `m.tick + interval` throws away the fraction of a tick by which the
    // clock overshot, which on a mean interval of three ticks is a systematic
    // 15% loss of traffic -- it quietly ran this department at rho 0.78 while
    // the arithmetic said 0.93, and the waiting room drew empty.
    const mean = 60 / TICK_MINUTES / m.perHour;
    m.nextArrival += Math.max(0.001, -Math.log(1 - m.rng()) * mean);
    const truth = draw(m.rng);
    const card = assess(truth, m.accuracy, m.rng);
    if (card > truth) m.sortedDown += 1;
    const complaints = CATEGORIES[truth].complaints;
    m.waiting.push({
      id: m.nextId++,
      arrivedAt: m.tick,
      truth,
      card,
      complaint: complaints[m.nextId % complaints.length],
      left: 0,
    });
  }

  for (const bay of m.bays) {
    if (bay.patient && m.tick >= bay.until) bay.patient = null;
    if (!bay.patient) {
      const next = pick(m);
      if (next) {
        bay.patient = next;
        bay.until = m.tick + CATEGORIES[next.truth].work;
      }
    }
  }
}

// --- measurement -----------------------------------------------------------

export interface EdStats {
  /** Mean wait to treatment, in minutes, by true category. */
  w: Record<Level, number>;
  /**
   * Share of category 1 patients who waited more than half an hour.
   *
   * The first version reported the single worst wait, which went from 45
   * minutes to somewhere between three and four and a half hours as soon as
   * the classifier was imperfect -- a real effect reported through a statistic
   * that moved 80 minutes between neighbouring settings because it is one
   * sample from a tail. A rate over the same tail says the same thing and
   * holds still.
   */
  late1: number;
  /** Patients sorted below their true category, per day. */
  downPerDay: number;
}

const statsCache = new Map<string, EdStats>();
function measure(perHour: number, accuracy: number, rule: Rule): EdStats {
  const key = `${perHour}:${accuracy}:${rule}`;
  const hit = statsCache.get(key);
  if (hit) return hit;

  const total: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
  const n: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
  let late = 0;
  let down = 0;
  let ticks = 0;
  const DAYS = 300;
  const RUN = Math.round((DAYS * 24 * 60) / TICK_MINUTES / 5);

  for (const seed of [7, 11, 23, 42, 99]) {
    const m = newBare(perHour, accuracy, rule, seed);
    for (let i = 0; i < 2000; i++) bare(m);
    m.sortedDown = 0;
    const seen = new Set<number>();
    for (let i = 0; i < RUN; i++) {
      bare(m);
      for (const bay of m.bays) {
        const p = bay.patient;
        if (!p || seen.has(p.id)) continue;
        seen.add(p.id);
        const wait = (m.tick - p.arrivedAt) * TICK_MINUTES;
        total[p.truth] += wait;
        n[p.truth] += 1;
        if (p.truth === 1 && wait > 30) late += 1;
      }
    }
    down += m.sortedDown;
    ticks += RUN;
  }

  const perDay = (down / (ticks * TICK_MINUTES)) * 60 * 24;
  const out: EdStats = {
    w: {
      1: n[1] ? total[1] / n[1] : 0,
      2: n[2] ? total[2] / n[2] : 0,
      3: n[3] ? total[3] / n[3] : 0,
    },
    late1: n[1] ? late / n[1] : 0,
    downPerDay: perDay,
  };
  statsCache.set(key, out);
  return out;
}

/** The model without its own statistics, so measure() cannot recurse. */
function newBare(perHour: number, accuracy: number, rule: Rule, seed: number): EdModel {
  return {
    rng: mulberry32(seed),
    tick: 0,
    nextId: 1,
    nextArrival: 0,
    waiting: [],
    bays: Array.from({ length: ROOMS }, () => ({ patient: null, until: 0 })),
    rule,
    accuracy,
    perHour,
    stats: { w: { 1: 0, 2: 0, 3: 0 }, late1: 0, downPerDay: 0 },
    sortedDown: 0,
  };
}
const bare = step;

// --- the set ---------------------------------------------------------------

/** Floor, wall, triage desk, treatment bays, and the department's green. */
function shell(f: Frame<EdModel>, st: Stage): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  ground(c, cam, p, ROOM);

  st.add(0, ROOM.y1 + 2, () => {
    box3(
      c,
      cam,
      { x: ROOM.x0, y: ROOM.y1, w: ROOM.x1 - ROOM.x0, d: 0.3, h: WALL },
      { fill: darken(t.stone, 0.1), contrast: 0.08 },
    );
    // The two bay openings, recessed and lit. A doorway is a hole, so it is
    // drawn as a dark quad on the wall face rather than a box standing on it.
    BAYS.forEach((bx, i) => {
      const quad = [
        project(cam, bx - 0.85, ROOM.y1, 0),
        project(cam, bx + 0.85, ROOM.y1, 0),
        project(cam, bx + 0.85, ROOM.y1, 2.05),
        project(cam, bx - 0.85, ROOM.y1, 2.05),
      ];
      c.beginPath();
      quad.forEach((q, j) => (j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = darken(t.screen, 0.0);
      c.fill();
      c.strokeStyle = withAlpha(p.ink, 0.25);
      c.lineWidth = 1;
      c.stroke();
      // The bay's own sign: lit gold when somebody is in it.
      screen(c, cam, p, {
        x: bx - 0.7,
        y: ROOM.y1,
        w: 1.4,
        h: 0.34,
        z: 2.1,
        lines: [`BAY ${i + 1}`],
        accent: model.bays[i]?.patient ? p.gold : p.soft,
      });
    });
    // The department's green: the illuminated cross by the entrance. It is the
    // one thing on a hospital wall that is allowed to be this colour.
    box3(
      c,
      cam,
      { x: 3.5, y: ROOM.y1, w: 0.62, d: 0.1, h: 0.2, z: 1.72 },
      { fill: p.green, contrast: 0.2 },
    );
    box3(
      c,
      cam,
      { x: 3.71, y: ROOM.y1, w: 0.2, d: 0.1, h: 0.62, z: 1.51 },
      { fill: p.green, contrast: 0.2 },
    );
    // The waiting-room clock, which in an emergency department is furniture
    // with an opinion.
    const at = project(cam, 4.9, ROOM.y1, 1.85);
    const r = 0.23 * cam.s;
    c.beginPath();
    c.arc(at.x, at.y, r, 0, Math.PI * 2);
    c.fillStyle = mix(p.ground, p.bg, 0.4);
    c.fill();
    c.strokeStyle = darken(t.metal, 0.2);
    c.lineWidth = 1.5;
    c.stroke();
    const hand = (angle: number, len: number) => {
      c.beginPath();
      c.moveTo(at.x, at.y);
      c.lineTo(at.x + Math.sin(angle) * r * len, at.y - Math.cos(angle) * r * len);
      c.stroke();
    };
    c.strokeStyle = p.ink;
    hand((model.tick / 12) * Math.PI * 2, 0.78);
    hand((model.tick / 144) * Math.PI * 2, 0.5);
  });

  // Triage: the desk, the nurse in green, and the trolley beside her.
  st.add(DESK.x, DESK.y, () => {
    softShadow(c, cam, p, DESK.x + DESK.w / 2, DESK.y, DESK.w * 0.55, 0.6);
    counter(c, cam, p, DESK, mix(t.stone, p.ink, 0.2));
    box3(
      c,
      cam,
      { x: DESK.x + 1.55, y: DESK.y + 0.25, w: 0.42, d: 0.12, h: 0.34, z: DESK.h },
      { fill: t.screen, contrast: 0.24 },
    );
  });
  st.add(NURSE.x, NURSE.y, () =>
    person(c, cam, p, NURSE.x, NURSE.y, {
      coat: mix(p.green, p.bg, 0.08),
      skin: mix(t.skin, p.ink, 0.2),
      hair: darken(t.wood, 0.42),
      h: 1.68,
    }),
  );
  st.add(DESK.x + DESK.w + 0.35, DESK.y + 0.4, () => {
    const x = DESK.x + DESK.w + 0.35;
    const y = DESK.y + 0.4;
    softShadow(c, cam, p, x + 0.25, y, 0.4, 0.24);
    box3(c, cam, { x, y: y - 0.2, w: 0.5, d: 0.4, h: 0.78 }, { fill: t.metal, contrast: 0.22 });
    box3(
      c,
      cam,
      { x: x + 0.03, y: y - 0.17, w: 0.44, d: 0.34, h: 0.1, z: 0.78 },
      { fill: mix(p.green, p.bg, 0.2), contrast: 0.24 },
    );
  });

  // The chairs. Drawn whether or not anyone is in them: an empty waiting room
  // with no chairs in it is a corridor.
  SEAT_ROWS.forEach((sy) => {
    SEAT_X.forEach((sx) => {
      st.add(sx, sy, () => chair(c, cam, p, sx, sy, mix(t.cloth, p.ink, 0.06)));
    });
  });
}

// --- the people ------------------------------------------------------------

function coatFor(p: Palette, id: number): string {
  const t = tints(p);
  const coats = [
    mix(p.ink, p.bg, 0.32),
    t.cloth,
    darken(t.clay, 0.2),
    mix(p.ink, p.bg, 0.55),
    mix(t.wood, p.ink, 0.3),
  ];
  return coats[id % coats.length];
}

/** How long this patient has been waiting past the target for what they have. */
function overdue(m: EdModel, who: Patient): number {
  return (m.tick - who.arrivedAt) * TICK_MINUTES - CATEGORIES[who.truth].target;
}

/**
 * The patient the classifier has failed: sorted below their true category and
 * now past the target for the category they actually have. Worst first, so the
 * marker does not flicker between two equally wronged people.
 */
function failed(m: EdModel): Patient | null {
  let worst: Patient | null = null;
  for (const who of m.waiting) {
    if (who.card <= who.truth) continue;
    if (overdue(m, who) <= 0) continue;
    if (!worst || overdue(m, who) > overdue(m, worst)) worst = who;
  }
  return worst;
}

function people(f: Frame<EdModel>, st: Stage, hurt: Patient | null): void {
  const { c, cam, p, model } = f;
  const t = tints(p);

  model.bays.forEach((bay, i) => {
    if (!bay.patient) return;
    const x = BAYS[i];
    st.add(x, TREAT_Y, () => {
      softShadow(c, cam, p, x, TREAT_Y, 0.28);
      person(c, cam, p, x, TREAT_Y, {
        coat: p.gold,
        skin: mix(t.skin, p.ink, (bay.patient!.id % 4) * 0.12),
        hair: bay.patient!.id % 3 === 0 ? undefined : darken(t.wood, 0.36),
      });
    });
  });

  // Seated in arrival order, which is the honest picture: triage changes who
  // is called, not where anybody is sitting. Twelve chairs, and anyone beyond
  // them stands at the back -- which is also what a full department looks like.
  model.waiting.forEach((who, i) => {
    // Twelve chairs, then eight standing along the right-hand wall, then the
    // corridor -- which the chip counts rather than draws. At rho 0.88 the
    // queue reaches the high twenties a few times a shift, and thirty figures
    // painted into a room built for twelve reads as a rendering fault rather
    // than as a busy department.
    if (i >= SEATS + STANDING) return;
    const row = Math.floor(i / SEAT_X.length);
    const seated = row < SEAT_ROWS.length;
    const x = seated ? SEAT_X[i % SEAT_X.length] : 7.4 + ((i - SEATS) % 4) * 0.72;
    // A third of a metre in front of the chair, so the chair back shows behind
    // the shoulders. person() has no seated pose and drawing one at this size
    // would be four pixels of knee; standing just forward of the seat, at a
    // child's height, is what reads as sitting.
    const y = seated ? SEAT_ROWS[row] - 0.34 : 4.8 - Math.floor((i - SEATS) / 4) * 0.9;
    const marked = hurt !== null && who.id === hurt.id;
    st.add(x, y, () => {
      if (!seated) softShadow(c, cam, p, x, y, 0.26);
      person(c, cam, p, x, y, {
        coat: marked ? p.pinkEdge : coatFor(p, who.id),
        edge: marked ? darken(p.pinkEdge, 0.32) : undefined,
        skin: mix(t.skin, p.ink, (who.id % 4) * 0.11),
        hair: who.id % 3 === 1 ? undefined : darken(coatFor(p, who.id + 2), 0.35),
        h: seated ? 1.28 : 1.7,
        // The triage card, on their lap. Not a legend -- just the texture of a
        // room in which everybody has been given a number by somebody else.
        carry:
          who.card === 1
            ? darken(t.clay, 0.05)
            : who.card === 2
              ? mix(t.clay, p.bg, 0.3)
              : mix(p.ink, p.bg, 0.62),
      });
    });
  });
}

// --- the failure -----------------------------------------------------------

function marks(f: Frame<EdModel>, hurt: Patient | null): void {
  const { c, cam, p, model, w } = f;
  const size = textSize(cam, 11, 9);

  if (hurt && model.waiting.findIndex((q) => q.id === hurt.id) < SEATS + STANDING) {
    const i = model.waiting.findIndex((q) => q.id === hurt.id);
    const row = Math.floor(i / SEAT_X.length);
    const seated = row < SEAT_ROWS.length;
    const x = seated ? SEAT_X[i % SEAT_X.length] : 7.4 + ((i - SEATS) % 4) * 0.72;
    const y = seated ? SEAT_ROWS[row] - 0.34 : 4.8 - Math.floor((i - SEATS) / 4) * 0.9;
    const head = project(cam, x, y, seated ? 1.35 : 1.95);
    const late = Math.round(overdue(f.model, hurt));
    // Short: the long form ran the width of the department and covered a bay.
    const text = `${hurt.complaint} · card ${hurt.card} · ${late} min late`;
    const cx = head.x + size * 1.1;
    const cy = head.y - size * 1.6;
    c.strokeStyle = withAlpha(p.pinkEdge, 0.9);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(head.x, head.y);
    c.lineTo(cx, cy + size * 0.85);
    c.stroke();
    chip(c, p, text, cx, cy, size, w);
  }

  const spill = model.waiting.length - SEATS - STANDING;
  if (spill > 0) {
    chip(c, p, `${spill} more out in the corridor`, w - 10, 10, size, w);
  }

  if (f.region) return;
  chip(
    c,
    p,
    model.rule === "arrival"
      ? "nobody is being sorted: the card is not being read"
      : `sorted below their category this shift: ${model.sortedDown}`,
    10,
    f.h - size * 1.7 - 8,
    size,
    w,
  );
}

// --- the scene -------------------------------------------------------------

const mins = (m: number) => `${m.toFixed(1)} min`;

export const ed: SceneDef<EdModel> = {
  height: 330,
  minHeight: 140,
  warm: 1400,
  rate: 10,
  controls: [
    {
      kind: "select",
      key: "rule",
      label: "The next bay takes",
      value: "triage",
      options: [
        { value: "triage", label: "The lowest card" },
        { value: "arrival", label: "Whoever came first" },
      ],
    },
    {
      kind: "range",
      key: "accuracy",
      // Not a load slider. Every other week varies how much work arrives; this
      // one varies how good the department is at knowing what arrived.
      label: "Triage accuracy",
      min: 80,
      max: 100,
      step: 4,
      value: 92,
      format: (v) => `${v}%`,
    },
  ],
  readout: [
    { key: "w1", term: "W", sub: "category 1" },
    { key: "w2", term: "W", sub: "category 2" },
    { key: "w3", term: "W", sub: "category 3" },
    { key: "late", term: "category 1", sub: "waiting over 30 min" },
    { key: "down", term: "sorted down", sub: "a day" },
  ],
  build: (controls) =>
    newModel(
      // Fixed, not a slider. Every other week varies the load; the one thing
      // this week varies is how well the department knows what it has, and a
      // second dial would let a reader improve the numbers without engaging
      // with that at all. 4.0 an hour against two bays is rho 0.88, which is a
      // department on a Saturday night rather than one on a Tuesday morning.
      4.0,
      Math.round(controls.num("accuracy", 92)) / 100,
      (controls.str("rule", "triage") as Rule) ?? "triage",
      7,
    ),
  step,
  // Five waiting, not one. The opening frame is the only one a reader with
  // reduced motion ever sees, and at rho 0.88 the queue spends real stretches
  // near zero -- a screenshot caught one, and an empty waiting room under a
  // readout saying category 3 waits an hour and a half is a scene arguing
  // against its own numbers.
  representative: (m) => m.waiting.length >= 5,
  extent: () => ROOM,
  report: (m) => ({
    w1: mins(m.stats.w[1]),
    w2: mins(m.stats.w[2]),
    w3: mins(m.stats.w[3]),
    late: `${(m.stats.late1 * 100).toFixed(1)}%`,
    down: m.rule === "arrival" ? "—" : m.stats.downPerDay.toFixed(1),
  }),
  regions: {
    /** The waiting room, for a later week that needs a room full of people. */
    seats: { x0: 0.9, x1: 6.6, y0: 1.4, y1: 6.2, z1: 1.9 },
    /** The two bays and the triage desk. */
    bays: { x0: 4.6, x1: 9.8, y0: 6.6, y1: 9.0, z1: 2.5 },
  },
  draw(f) {
    const st = new Stage();
    const hurt = failed(f.model);
    shell(f, st);
    people(f, st, hurt);
    st.paint();
    marks(f, hurt);
  },
};
