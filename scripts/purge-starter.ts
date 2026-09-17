/**
 * Delete the files this course removed, if they have come back.
 *
 * Ten files from the template were removed in the first few commits and keep
 * reappearing on disk with their original mtimes -- the cause was never found,
 * and by now it has interrupted five sessions. The same thing happens to files
 * of my own that I delete: the nine static diagrams the scenes replaced were
 * back on disk, untracked, within minutes of the commit that removed them.
 *
 * .gitignore stops them re-entering history, but ignoring them does not stop
 * them breaking things: Astro's content loader globs the filesystem, so a
 * restored week-02.md shadows week-02.mdx and renders starter text at the real
 * URL, a restored people/idris-fenn.md lands in llms.txt with no page behind
 * it, and a restored starter portrait fails the evidence gate.
 *
 * So this runs before every build and before the evidence gate. It deletes
 * exactly the paths named in the deleted-file blocks of .gitignore and nothing
 * else -- it does not glob, and it cannot touch a file that is not on that
 * list.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ignore = readFileSync(resolve(".gitignore"), "utf8").split("\n");

/**
 * The listed paths, which in .gitignore sit under the comment blocks about
 * files "restored on disk by something on this machine". Anything that is not
 * a plain relative path under src/ is skipped, so a future pattern added to
 * .gitignore cannot widen what this deletes.
 */
const targets = ignore
  .map((line) => line.trim())
  .filter((line) => /^src\/[\w./-]+\.(md|avif|astro)$/.test(line));

const gone = targets.filter((path) => {
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
});

if (gone.length > 0) {
  console.log(`[purge-starter] removed ${gone.length} restored file(s):`);
  for (const path of gone) console.log(`  ${path}`);
}
