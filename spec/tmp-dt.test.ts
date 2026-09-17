import { it } from "vitest";
import { converge } from "../src/lib/scene/stats";

it("measures", () => {
  const MU = 1 / 11;
  const rows: string[] = ["gap_s ticks  rho  | clock L | real L  W(min) W90(min) | theory L"];
  for (let secs = 60; secs <= 110; secs += 5) {
    const n = secs / 5;
    const rho = 11 / n;
    const base = { seed: 7, lanes: 1, servers: 1, mu: MU, lambda: 1 / n };
    const clock = converge({ ...base, arrivalCv: 0, serviceCv: 0 });
    const real = converge({ ...base, arrivalCv: 1, serviceCv: 1 });
    rows.push(
      [
        String(secs).padStart(3), String(n).padStart(3), rho.toFixed(3),
        clock.L.toFixed(2),
        `${real.L.toFixed(2)} ${(real.W * 5 / 60).toFixed(1)} ${(real.W90 * 5 / 60).toFixed(1)}`,
        (rho / (1 - rho)).toFixed(2),
      ].join(" | "),
    );
  }
  // chaos sweep at the default gap
  rows.push("--- chaos sweep at gap 60 s (rho 0.917) ---");
  for (const cv of [0, 0.25, 0.5, 0.75, 1]) {
    const r = converge({ seed: 7, lanes: 1, servers: 1, mu: MU, lambda: 1 / 12, arrivalCv: cv, serviceCv: cv });
    rows.push(`cv ${cv.toFixed(2)} | L ${r.L.toFixed(2)} | W ${(r.W * 5 / 60).toFixed(1)} min`);
  }
  console.log(rows.join("\n"));
});
