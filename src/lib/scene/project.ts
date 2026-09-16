/**
 * The camera every scene in this course looks through.
 *
 * Twelve weeks of animations only read as one series if they agree about where
 * the floor is. So there is exactly one projection, defined here, and no scene
 * is allowed its own: a cafe counter and an aircraft cabin are both boxes
 * standing on the same ground plane, seen from the same corner.
 *
 * It is an oblique 3/4 view, not true perspective. World coordinates are
 * (x, y, z): x runs right along the front edge of the set, y runs backwards
 * into it, z runs up. Depth recedes up and to the left, height goes straight
 * up, and nothing shrinks with distance.
 *
 * Affine rather than perspective is a deliberate trade. A vanishing point
 * would be more photographic, but it makes equal things unequal -- the tenth
 * person in a queue would be drawn smaller than the first, which is exactly
 * the comparison most of these scenes exist to let you make by eye. Depth here
 * is carried by overlap, by shading and by cast shadows instead, which is how
 * architectural drawing has always done it.
 */

/** How far one unit of depth moves a point left, per unit of scale. */
export const DEPTH_X = -0.52;
/** How far one unit of depth moves a point up. */
export const DEPTH_Y = 0.34;
/** How far one unit of height moves a point up. */
export const HEIGHT_Y = 0.8;

export interface Camera {
  /** Screen position of the world origin (0, 0, 0). */
  ox: number;
  oy: number;
  /** Pixels per world unit. */
  s: number;
}

export interface Screen {
  x: number;
  y: number;
}

/** A world-space box on the floor, used to fit the camera to a canvas. */
export interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Tallest thing standing in the set, so the fit leaves room for it. */
  z1: number;
}

/** World (x, y, z) to canvas pixels. The only projection in the course. */
export function project(cam: Camera, x: number, y: number, z = 0): Screen {
  return {
    x: cam.ox + (x + y * DEPTH_X) * cam.s,
    y: cam.oy - (y * DEPTH_Y + z * HEIGHT_Y) * cam.s,
  };
}

/**
 * Choose scale and origin so the whole set fits the canvas with a margin.
 *
 * Scenes describe their set once, in world units they pick for readability --
 * week 1 measures the cafe in metres, week 10 measures the cabin in seat
 * pitches -- and the camera does the arithmetic. Nothing in a scene's draw
 * code knows the canvas size, which is what lets the same renderer serve a
 * full-width figure and a thumbnail-sized snippet.
 */
export function fitCamera(
  width: number,
  height: number,
  extent: Extent,
  pad = 10,
): Camera {
  const corners: Array<[number, number, number]> = [
    [extent.x0, extent.y0, 0],
    [extent.x1, extent.y0, 0],
    [extent.x0, extent.y1, 0],
    [extent.x1, extent.y1, 0],
    [extent.x0, extent.y0, extent.z1],
    [extent.x1, extent.y0, extent.z1],
    [extent.x0, extent.y1, extent.z1],
    [extent.x1, extent.y1, extent.z1],
  ];
  const unit: Camera = { ox: 0, oy: 0, s: 1 };
  const pts = corners.map(([x, y, z]) => project(unit, x, y, z));
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));

  const s = Math.min(
    (width - pad * 2) / Math.max(maxX - minX, 0.001),
    (height - pad * 2) / Math.max(maxY - minY, 0.001),
  );

  // Centre the projected footprint rather than the world box: the two are not
  // the same shape once depth has sheared it, and centring the world box
  // leaves the set visibly off to one side.
  return {
    s,
    ox: (width - (maxX + minX) * s) / 2,
    oy: (height - (maxY + minY) * s) / 2,
  };
}

/**
 * Sort key for painting. Canvas has no depth buffer, so everything is drawn
 * back to front and the only thing that makes a person stand in front of a
 * counter rather than inside it is the order of the calls. Larger comes later.
 */
export function depthKey(x: number, y: number): number {
  return -y * 100 + x * 0.01;
}
