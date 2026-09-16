/**
 * Where the nth person in a line is standing.
 *
 * Every queue in these scenes is a polyline through the room -- down the
 * window, round the barriers, along the kerb -- and the only question a
 * renderer ever asks is "how far back is this person". So layouts are stated
 * as a path and people are placed by arc length along it.
 *
 * Which means a layout change is a different list of corners rather than a
 * different drawing routine, and that is what makes week 1's three cafe
 * arrangements a selector the reader drives instead of three static pictures.
 */

export type Corner = readonly [number, number];
export type Path = readonly Corner[];

export interface Along {
  x: number;
  y: number;
  /** Unit direction of travel at that point, for facing a prop. */
  dx: number;
  dy: number;
}

export function pathLength(path: Path): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  return total;
}

/**
 * The point `d` along the path from its head (index 0). Past the end it keeps
 * going in the last direction rather than piling everybody on the final corner,
 * because a queue that has outgrown the room is exactly the thing several of
 * these scenes are trying to show -- week 1's tail goes out of the door.
 */
export function pointAt(path: Path, d: number): Along {
  if (path.length === 0) return { x: 0, y: 0, dx: 1, dy: 0 };
  if (path.length === 1) {
    return { x: path[0][0], y: path[0][1], dx: 1, dy: 0 };
  }

  let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg <= 0.0001) continue;
    const ux = (x1 - x0) / seg;
    const uy = (y1 - y0) / seg;
    if (left <= seg || i === path.length - 1) {
      return { x: x0 + ux * left, y: y0 + uy * left, dx: ux, dy: uy };
    }
    left -= seg;
  }

  const [ax, ay] = path[path.length - 2];
  const [bx, by] = path[path.length - 1];
  const seg = Math.hypot(bx - ax, by - ay) || 1;
  return { x: bx, y: by, dx: (bx - ax) / seg, dy: (by - ay) / seg };
}
