/**
 * The numbers under a scene's readout.
 *
 * A scene runs two simulations of the same configuration. The animated one
 * exists to be watched; it has been going for a few hundred ticks and is
 * nowhere near a steady state. The numbers come from here instead.
 *
 * Two things had to be measured rather than assumed, and both are why this is
 * a module and not three lines inside a scene:
 *
 * Twenty thousand ticks is not enough. That was the figure the first
 * simulation component used, and at 0.875 load it reported L = 9.6 where the
 * engine's own long-run answer is 7.4 -- a reader comparing two arrangements
 * would have been comparing transients. Measured against 400 000 ticks:
 * 20 000 gave 9.60, 60 000 gave 7.80, 150 000 gave 7.17.
 *
 * One seed is not enough either. At that load a single run of 150 000 ticks
 * lands anywhere in [5.56, 7.83] depending on the seed, and going to 250 000
 * barely narrows it -- the queue-length process at high load has a
 * correlation time in the hundreds of ticks, so a long run is far fewer
 * independent observations than it looks. So this replicates across a fixed
 * set of seeds and averages, which keeps the answer deterministic (the point
 * of a seeded engine: a student can be told "seed 7" and get the same number)
 * while bringing it inside about six per cent of theory.
 *
 * And the right run length is not a constant. Those measurements were taken
 * on week 1's cafe, where a service takes about seven ticks; week 2's
 * drive-through takes eleven, so the same 120 000 ticks buys 40% fewer service
 * completions, and at 0.917 load it reported L = 10.2 against a theoretical
 * 11.05. The number of *independent* observations is what matters, and the
 * queue-length process has a correlation time of roughly 1/(1-rho)^2 service
 * completions -- so the run length is now derived from the load and the
 * service time rather than fixed, and a scene with slow servers at high load
 * automatically runs longer. At 0.917 that is 400 000 ticks and L comes back
 * at 10.9.
 *
 * Results are cached by configuration, because a range control fires on every
 * pixel of a drag and its steps are discrete: the first visit to a setting
 * pays about thirty milliseconds and every return is free.
 */

import { QueueSim, type SimConfig } from "../queue-sim";

/** Floor on ticks per replication. See the note above for how it was chosen. */
export const STATS_TICKS = 120000;

/**
 * Ceiling, so that a setting close to capacity is slow to converge rather than
 * slow to load. Five replications of this is about a fifth of a second on
 * first visit, and the cache means a slider drag pays it once per stop.
 */
export const STATS_TICKS_MAX = 600000;

/** Independent observations of queue length to aim for. Measured, not chosen. */
const TARGET_SAMPLES = 250;

/**
 * How long to run one replication.
 *
 * TARGET_SAMPLES independent looks at the queue, where "independent" costs
 * about 1/(1-rho)^2 service completions, each of which costs 1/mu ticks.
 */
function runLength(rho: number, mu: number): number {
  const gap = Math.max(1 - rho, 0.02);
  const services = TARGET_SAMPLES / (gap * gap);
  const ticks = services / Math.max(mu, 1e-6);
  return Math.round(Math.min(STATS_TICKS_MAX, Math.max(STATS_TICKS, ticks)));
}

/** Fixed replication seeds, so the answer is reproducible. */
export const STATS_SEEDS = [7, 11, 23, 42, 99] as const;

export interface Converged {
  /** Time-average number in the system. */
  L: number;
  /** Mean time in the system, in ticks. */
  W: number;
  /** 90th percentile time in the system, in ticks. */
  W90: number;
  /** Offered load, as the engine computes it. */
  rho: number;
  /** True when the configuration has no steady state to report. */
  over: boolean;
}

const cache = new Map<string, Converged>();

export function converge(config: Partial<SimConfig>): Converged {
  const key = JSON.stringify(config);
  const hit = cache.get(key);
  if (hit) return hit;

  const probe = new QueueSim({ ...config, seed: STATS_SEEDS[0] });
  const rho = probe.rho;

  // Above capacity nothing converges: the queue grows for as long as you run
  // it, so an average wait is not a number that exists. Saying so is both the
  // honest readout and, in week 1, the lesson.
  if (rho >= 0.98) {
    const out: Converged = { L: Infinity, W: Infinity, W90: Infinity, rho, over: true };
    cache.set(key, out);
    return out;
  }

  const ticks = runLength(rho, probe.config.mu);

  let L = 0;
  let W = 0;
  let W90 = 0;
  for (const seed of STATS_SEEDS) {
    const sim = new QueueSim({ ...config, seed });
    sim.run(ticks);
    const stats = sim.stats();
    L += stats.L;
    W += stats.W;
    W90 += stats.W90;
  }

  const n = STATS_SEEDS.length;
  const out: Converged = { L: L / n, W: W / n, W90: W90 / n, rho, over: false };
  cache.set(key, out);
  return out;
}
