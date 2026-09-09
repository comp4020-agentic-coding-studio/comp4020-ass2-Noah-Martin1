/**
 * The course simulator.
 *
 * One engine, configured differently by each week that needs it. Weeks 2, 5 and
 * 8 all run this; week 10 runs the aisle model below, which is a different
 * physical system but reports through the same interface so the two look and
 * read identically on the page.
 *
 * Two properties are deliberate and load-bearing:
 *
 *  - It is SEEDED. The same config always produces the same run, so a
 *    screenshot is reproducible, a student can be told "use seed 7" and get the
 *    same numbers, and a spec test can assert on the output.
 *  - It is TICK-BASED rather than event-based. Slower, but it animates directly
 *    and a student can follow one tick by eye, which an event queue does not
 *    allow. This is a teaching instrument first.
 */

export type Discipline = "fcfs" | "sjf" | "priority";

export interface SimConfig {
  seed: number;
  /** Servers behind the queue (or behind each lane, when lanes > 1). */
  servers: number;
  /** Independent parallel lanes, each with its own queue. 1 = a single line. */
  lanes: number;
  /** Mean arrivals per tick, across the whole system. */
  lambda: number;
  /** Mean service completions per tick, per server. */
  mu: number;
  /** 0 = every job identical, 1 = exponentially distributed service times. */
  serviceCv: number;
  /** 0 = arrivals like clockwork, 1 = a Poisson process. */
  arrivalCv: number;
  discipline: Discipline;
  /** Fraction of arrivals that buy priority, for the week 8 express lane. */
  priorityShare: number;
}

export interface Customer {
  id: number;
  arrivedAt: number;
  work: number;
  remaining: number;
  lane: number;
  priority: boolean;
  startedAt: number | null;
}

export interface Stats {
  /** Time-average number in system. */
  L: number;
  /** Mean time in system, over completed customers. */
  W: number;
  /** 90th percentile time in system. */
  W90: number;
  /** Worst completed wait seen. */
  Wmax: number;
  served: number;
  /** Mean wait split by class, for the express-lane comparison. */
  Wpriority: number;
  Wstandard: number;
}

/** Small, fast, seeded PRNG. Deterministic across platforms. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULTS: SimConfig = {
  seed: 7,
  servers: 1,
  lanes: 1,
  lambda: 0.16,
  mu: 0.2,
  serviceCv: 1,
  arrivalCv: 1,
  discipline: "fcfs",
  priorityShare: 0,
};

export class QueueSim {
  config: SimConfig;
  tick = 0;
  /** One waiting list per lane. */
  queues: Customer[][] = [];
  /** Servers per lane; null when idle. */
  busy: (Customer | null)[][] = [];
  recentlyServed: { at: number; customer: Customer }[] = [];

  private rng: () => number;
  private nextId = 1;
  private areaUnderL = 0;
  private waits: number[] = [];
  private waitsPriority: number[] = [];
  private waitsStandard: number[] = [];
  private warmup: number;
  private nextArrivalAt = 0;

  constructor(config: Partial<SimConfig> = {}, warmup = 120) {
    this.config = { ...DEFAULTS, ...config };
    this.rng = mulberry32(this.config.seed);
    this.warmup = warmup;
    this.reset();
  }

  reset(): void {
    this.rng = mulberry32(this.config.seed);
    this.tick = 0;
    this.nextId = 1;
    this.areaUnderL = 0;
    this.waits = [];
    this.waitsPriority = [];
    this.waitsStandard = [];
    this.recentlyServed = [];
    this.nextArrivalAt = 0;
    this.queues = Array.from({ length: this.config.lanes }, () => []);
    this.busy = Array.from({ length: this.config.lanes }, () =>
      Array.from({ length: this.config.servers }, () => null),
    );
  }

  /** Offered load. Above 1 the queue grows without bound and W is meaningless. */
  get rho(): number {
    const capacity = this.config.mu * this.config.servers * this.config.lanes;
    return this.config.lambda / capacity;
  }

  get inSystem(): number {
    const waiting = this.queues.reduce((n, q) => n + q.length, 0);
    const serving = this.busy.reduce((n, lane) => n + lane.filter(Boolean).length, 0);
    return waiting + serving;
  }

  /**
   * Service time for one job. cv interpolates between a fixed length and an
   * exponential draw, which is the whole subject of week 2: the mean is held
   * constant and only the spread changes.
   */
  private drawWork(): number {
    const mean = 1 / this.config.mu;
    const exponential = -Math.log(1 - this.rng()) * mean;
    const cv = this.config.serviceCv;
    // Fractional too, for the same reason; `remaining` counts down in floats.
    return Math.max(0.001, mean * (1 - cv) + exponential * cv);
  }

  /**
   * Gap until the next arrival. At arrivalCv 0 people turn up like clockwork,
   * at 1 they turn up whenever they like. Week 2 exists because holding the
   * mean fixed and moving only this produces a completely different queue.
   */
  private drawInterval(): number {
    const mean = 1 / this.config.lambda;
    const exponential = -Math.log(1 - this.rng()) * mean;
    const cv = this.config.arrivalCv;
    // Deliberately NOT rounded. At cv 0 every interval is identical, so
    // rounding would bias the arrival rate systematically instead of averaging
    // out -- which at mu 0.2, lambda 0.19 silently drove rho to exactly 1.
    return Math.max(0.001, mean * (1 - cv) + exponential * cv);
  }

  private admit(customer: Customer): void {
    // With one lane this is a single line; with several, a new arrival picks a
    // lane at random and cannot switch. That is the generous version of
    // parallel queues -- no jockeying -- and it still loses to a single line.
    const lane =
      this.config.lanes === 1
        ? 0
        : Math.floor(this.rng() * this.config.lanes) % this.config.lanes;
    customer.lane = lane;
    this.queues[lane].push(customer);
  }

  /** Choose who the freed server takes next. This is the whole of Act II. */
  private pick(lane: number): Customer | undefined {
    const queue = this.queues[lane];
    if (queue.length === 0) return undefined;

    let index = 0;
    if (this.config.discipline === "sjf") {
      queue.forEach((c, i) => {
        if (c.work < queue[index].work) index = i;
      });
    } else if (this.config.discipline === "priority") {
      const firstPriority = queue.findIndex((c) => c.priority);
      index = firstPriority === -1 ? 0 : firstPriority;
    }
    return queue.splice(index, 1)[0];
  }

  step(): void {
    this.tick += 1;

    // Arrivals, scheduled rather than sampled per tick so that arrivalCv 0
    // really is deterministic rather than merely low-variance.
    if (this.tick >= this.nextArrivalAt) {
      this.nextArrivalAt = this.tick + this.drawInterval();
      const work = this.drawWork();
      this.admit({
        id: this.nextId++,
        arrivedAt: this.tick,
        work,
        remaining: work,
        lane: 0,
        priority: this.rng() < this.config.priorityShare,
        startedAt: null,
      });
    }

    // Service.
    for (let lane = 0; lane < this.config.lanes; lane++) {
      for (let s = 0; s < this.config.servers; s++) {
        const current = this.busy[lane][s];
        if (current) {
          current.remaining -= 1;
          if (current.remaining <= 0) {
            const total = this.tick - current.arrivedAt;
            if (this.tick > this.warmup) {
              this.waits.push(total);
              (current.priority ? this.waitsPriority : this.waitsStandard).push(total);
            }
            this.recentlyServed.push({ at: this.tick, customer: current });
            this.busy[lane][s] = null;
          }
        }
        if (!this.busy[lane][s]) {
          const next = this.pick(lane);
          if (next) {
            next.startedAt = this.tick;
            this.busy[lane][s] = next;
          }
        }
      }
    }

    if (this.tick > this.warmup) this.areaUnderL += this.inSystem;
    this.recentlyServed = this.recentlyServed.filter((r) => this.tick - r.at < 18);
  }

  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  stats(): Stats {
    const counted = Math.max(1, this.tick - this.warmup);
    const mean = (xs: number[]) =>
      xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
    const sorted = [...this.waits].sort((a, b) => a - b);
    return {
      L: this.areaUnderL / counted,
      W: mean(this.waits),
      W90: sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length * 0.9)],
      Wmax: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
      served: this.waits.length,
      Wpriority: mean(this.waitsPriority),
      Wstandard: mean(this.waitsStandard),
    };
  }
}

/**
 * The week 10 aisle model.
 *
 * Boarding is not an ordinary queue: the server and the queue share a space, so
 * a passenger stowing a bag blocks everyone behind them. That single property
 * is what makes back-to-front boarding bad, and no amount of tuning an ordinary
 * queue model will reproduce it -- hence a second model rather than a
 * configuration of the first.
 */
export type BoardingStrategy = "back-to-front" | "random" | "outside-in" | "steffen";

export interface Passenger {
  seatRow: number;
  seatCol: number;
  /** Current aisle row position; -1 while still on the jetway. */
  at: number;
  stowTicks: number;
  seated: boolean;
}

export const BOARDING_LABELS: Record<BoardingStrategy, string> = {
  "back-to-front": "Back to front",
  random: "Random",
  "outside-in": "Outside in (WILMA)",
  steffen: "Steffen",
};

export class BoardingSim {
  rows: number;
  cols: number;
  queue: Passenger[] = [];
  aisle: (Passenger | null)[] = [];
  seated = 0;
  tick = 0;
  done = false;

  private rng: () => number;

  strategy: BoardingStrategy;

  constructor(strategy: BoardingStrategy, rows = 16, cols = 3, seed = 7) {
    this.strategy = strategy;
    this.rows = rows;
    this.cols = cols;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.reset();
  }

  reset(): void {
    this.rng = mulberry32(this.seed);
    this.tick = 0;
    this.seated = 0;
    this.done = false;
    this.aisle = Array.from({ length: this.rows }, () => null);

    const all: Passenger[] = [];
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= this.cols; col++) {
        all.push({
          seatRow: row,
          seatCol: col,
          at: -1,
          // Stow time varies per passenger: this variance is the whole story.
          stowTicks: 2 + Math.floor(this.rng() * 7),
          seated: false,
        });
      }
    }
    this.queue = this.order(all);
  }

  private order(all: Passenger[]): Passenger[] {
    const shuffled = [...all].sort(() => this.rng() - 0.5);
    switch (this.strategy) {
      case "back-to-front":
        return shuffled.sort((a, b) => b.seatRow - a.seatRow);
      case "outside-in":
        return shuffled.sort((a, b) => b.seatCol - a.seatCol);
      case "steffen":
        // Alternating rows, outside-in: consecutive boarders are two rows
        // apart, so nobody is ever stowing directly behind anybody else.
        return shuffled.sort((a, b) => {
          const key = (p: Passenger) =>
            (p.seatCol === 3 ? 0 : p.seatCol === 2 ? 2 : 4) +
            (p.seatRow % 2 === 0 ? 0 : 1);
          const ka = key(a);
          const kb = key(b);
          return ka === kb ? b.seatRow - a.seatRow : ka - kb;
        });
      default:
        return shuffled;
    }
  }

  step(): void {
    if (this.done) return;
    this.tick += 1;

    // Walk from the front of the cabin backwards so a moving passenger frees
    // their slot before the one behind tries to take it.
    for (let row = this.rows - 1; row >= 0; row--) {
      const person = this.aisle[row];
      if (!person) continue;

      if (person.at === person.seatRow - 1) {
        person.stowTicks -= 1;
        if (person.stowTicks <= 0) {
          this.aisle[row] = null;
          person.seated = true;
          this.seated += 1;
        }
        continue;
      }
      if (row + 1 < this.rows && this.aisle[row + 1] === null) {
        this.aisle[row + 1] = person;
        this.aisle[row] = null;
        person.at = row + 1;
      }
    }

    if (this.aisle[0] === null && this.queue.length > 0) {
      const next = this.queue.shift() as Passenger;
      next.at = 0;
      this.aisle[0] = next;
    }

    if (this.queue.length === 0 && this.aisle.every((slot) => slot === null)) {
      this.done = true;
    }
  }

  /** Ticks to seat everybody. Runs to completion; used for the comparison bars. */
  static timeFor(strategy: BoardingStrategy, rows = 16, cols = 3, seed = 7): number {
    const sim = new BoardingSim(strategy, rows, cols, seed);
    let guard = 0;
    while (!sim.done && guard++ < 20000) sim.step();
    return sim.tick;
  }
}
