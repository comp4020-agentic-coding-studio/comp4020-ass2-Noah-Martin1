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
 * Results are cached by configuration, because a range control fires on every
 * pixel of a drag and its steps are discrete: the first visit to a setting
 * pays about thirty milliseconds and every return is free.
 */

import { QueueSim, type SimConfig } from "../queue-sim";

/** Ticks per replication. See the note above for how this was chosen. */
export const STATS_TICKS = 120000;

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

  let L = 0;
  let W = 0;
  let W90 = 0;
  for (const seed of STATS_SEEDS) {
    const sim = new QueueSim({ ...config, seed });
    sim.run(STATS_TICKS);
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
