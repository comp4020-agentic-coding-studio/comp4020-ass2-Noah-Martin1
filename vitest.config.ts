import { defineConfig } from "vitest/config";

/**
 * One job: keep scratch harnesses out of the suite.
 *
 * `spec/tmp-*.test.ts` is where a measurement run lives while I am calibrating
 * a scene -- five seeds, a couple of hundred thousand ticks, results written to
 * a file because vitest swallows console output here. They are gitignored, and
 * they are also deleted when I am done with them, except that files deleted in
 * this working tree keep coming back (see scripts/purge-starter.ts). One
 * reappeared between two runs and turned a clean "9 files, 28 tests" into "10
 * files, 29 tests" -- a check count that is not a check count, which is worse
 * than either number on its own.
 *
 * Excluding the pattern makes that impossible rather than remembered.
 */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "spec/tmp-*.test.ts"],
  },
});
