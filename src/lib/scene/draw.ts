/**
 * The prop library.
 *
 * Twelve weeks of scenes are built from this handful of objects, which is the
 * whole point: a reader should recognise the counter in week 4 as the same kind
 * of object as the counter in week 1 without being told. Anything a single week
 * needs and no other week could use belongs in that week's scene, not here.
 *
 * Everything takes a Camera and world coordinates, so a prop can be placed
 * once and drawn correctly at any canvas size. Nothing here touches the DOM
 * beyond the 2D context it is handed.
 *
 * Two things are drawn in screen space rather than world space, and both are
 * correct rather than convenient: the projection is affine and z only ever
 * moves a point vertically, so a figure whose axis is vertical -- a person, a
 * post, a frond -- can be laid out upward from its projected foot with no
 * distortion at all. Text is screen space because rotated canvas text at 11px
 * is unreadable.
 */

import { project, type Camera, type Extent } from "./project";

/**
 * The resolved colours a scene draws with. Assembled by the host from the
 * stylesheet, never written literally in a scene: the tokens are light-dark()
 * pairs and canvas cannot parse those, so they arrive here already resolved to
 * rgb() triples.
 */
export interface Palette {
  ink: string;
  soft: string;
  gold: string;
  rule: string;
  bg: string;
  ground: string;
  pink: string;
  pinkEdge: string;
  green: string;
  greenDark: string;
}

// --- colour arithmetic -----------------------------------------------------

type Rgba = [number, number, number, number];

/**
 * Canvas colours arrive as rgb()/rgba() strings and the shading here needs
 * numbers. Anything unparseable falls back to mid grey rather than throwing:
 * a scene that draws in the wrong grey is debuggable, one that throws inside
 * requestAnimationFrame takes the page down.
 */
function parse(colour: string): Rgba {
  const nums = colour.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return [128, 128, 128, 1];
  return [
    Number(nums[0]),
    Number(nums[1]),
    Number(nums[2]),
    nums.length > 3 ? Number(nums[3]) : 1,
  ];
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab, aa] = parse(a);
  const [br, bg, bb, ba] = parse(b);
  const f = (x: number, y: number) => clamp255(x + (y - x) * t);
  const alpha = aa + (ba - aa) * t;
  return `rgba(${f(ar, br)}, ${f(ag, bg)}, ${f(ab, bb)}, ${alpha.toFixed(3)})`;
}

export function lighten(colour: string, t: number): string {
  return mix(colour, "rgb(255, 255, 255)", t);
}

export function darken(colour: string, t: number): string {
  return mix(colour, "rgb(0, 0, 0)", t);
}

export function withAlpha(colour: string, a: number): string {
  const [r, g, b] = parse(colour);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Whether the scene is currently sitting on a dark ground.
 *
 * Scenes should almost never branch on this -- the materials handle both
 * themes -- but two things are physical facts rather than themed surfaces and
 * do need it: a shadow is always darker than the floor, and a departures board
 * is always darker than the room. Deriving those from --q-ink gives a glowing
 * halo and a white screen in dark mode, which is what this replaces.
 */
export function isDark(p: Palette): boolean {
  const [r, g, b] = parse(p.ground);
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255 < 0.5;
}

// --- materials -------------------------------------------------------------

/**
 * The materials every set is built from.
 *
 * Scenes are not allowed to invent colours. A cafe counter, a passport-office
 * desk and an airport bench are all `stone`, so twelve weeks of sets look like
 * twelve rooms in one building rather than twelve illustrations. Each material
 * is mixed from the tokens, so both themes and any rebrand follow.
 *
 * The two meanings that are never materials: gold is a server in service and
 * pink is a number the scene is reporting. Nothing is painted in either just
 * because it would look nice there.
 */
export interface Tints {
  /** Counters, desks, kerbs, walls: the built surfaces of a room. */
  stone: string;
  /** Timber: tables, benches, window frames. Warmer than stone. */
  wood: string;
  /** Machines, rollers, barriers, scanner housings. Cooler than stone. */
  metal: string;
  /** Screens and boards: near-black in both themes so text reads. */
  screen: string;
  /** Terracotta, for pots. */
  clay: string;
  /** Upholstery, and clothing on someone who is waiting. */
  cloth: string;
  /** Warm mid tone for skin, softened toward the page in dark mode. */
  skin: string;
}

export function tints(p: Palette): Tints {
  return {
    stone: mix(p.ground, p.ink, 0.12),
    wood: mix(mix(p.ground, p.gold, 0.3), p.ink, 0.16),
    metal: mix(p.ground, p.ink, 0.26),
    screen: isDark(p) ? "rgb(14, 13, 12)" : mix(p.ink, p.bg, 0.06),
    clay: mix(p.gold, p.ink, 0.34),
    cloth: mix(p.ink, p.bg, 0.42),
    skin: mix(p.gold, p.bg, 0.52),
  };
}

// --- painter's ordering ----------------------------------------------------

/**
 * Canvas has no depth buffer. The only reason a person stands in front of a
 * counter rather than inside it is that the person was drawn second, and
 * getting that order right by hand across a set with thirty props is how
 * scenes rot.
 *
 * So scenes push their props with a depth and paint once. Props further back
 * (larger y) paint first; ties break left to right, which is the order things
 * overlap in this projection.
 */
export class Stage {
  private ops: Array<{ y: number; x: number; paint: () => void }> = [];

  add(x: number, y: number, paint: () => void): void {
    this.ops.push({ x, y, paint });
  }

  paint(): void {
    this.ops.sort((a, b) => b.y - a.y || a.x - b.x);
    for (const op of this.ops) op.paint();
    this.ops = [];
  }
}

// --- the floor -------------------------------------------------------------

/**
 * The ground plane, with the faint green wash that separates a scene from the
 * page it sits on. Every scene starts with this, so the animations read as one
 * surface you look into rather than twelve rectangles of canvas.
 */
export function ground(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  extent: Extent,
  grid = 0,
): void {
  const corners = [
    project(cam, extent.x0, extent.y0),
    project(cam, extent.x1, extent.y0),
    project(cam, extent.x1, extent.y1),
    project(cam, extent.x0, extent.y1),
  ];
  c.beginPath();
  corners.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
  c.closePath();
  c.fillStyle = mix(p.ground, p.green, 0.07);
  c.fill();

  if (grid > 0) {
    c.strokeStyle = withAlpha(p.green, 0.14);
    c.lineWidth = 1;
    for (let x = extent.x0; x <= extent.x1 + 0.001; x += grid) {
      const a = project(cam, x, extent.y0);
      const b = project(cam, x, extent.y1);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    for (let y = extent.y0; y <= extent.y1 + 0.001; y += grid) {
      const a = project(cam, extent.x0, y);
      const b = project(cam, extent.x1, y);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
  }

  c.strokeStyle = withAlpha(p.green, 0.35);
  c.lineWidth = 1.5;
  c.beginPath();
  corners.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
  c.closePath();
  c.stroke();
}

/**
 * A soft contact shadow. Cheap, and it is most of what makes an affine
 * projection look like a diorama instead of a flat plan: without it every prop
 * appears to float at an unknown height.
 */
export function softShadow(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  x: number,
  y: number,
  rx: number,
  ry = rx * 0.55,
): void {
  const at = project(cam, x, y);
  const sx = rx * cam.s;
  const sy = ry * cam.s;
  if (sx < 0.4 || sy < 0.4) return;
  // Black, not --q-ink: in dark mode the ink is nearly white and the shadow
  // came out as a glow under every prop, as if the set were lit from below.
  const grad = c.createRadialGradient(at.x, at.y, 0, at.x, at.y, sx);
  const depth = isDark(p) ? 0.5 : 0.26;
  grad.addColorStop(0, `rgba(0, 0, 0, ${depth})`);
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.save();
  c.translate(at.x, at.y);
  c.scale(1, sy / sx);
  c.beginPath();
  c.arc(0, 0, sx, 0, Math.PI * 2);
  c.translate(-at.x, -at.y);
  c.fillStyle = grad;
  c.fill();
  c.restore();
}

// --- the workhorse ---------------------------------------------------------

export interface Box {
  x: number;
  y: number;
  /** Extent along x, y and z. */
  w: number;
  d: number;
  h: number;
  /** Floor height the box stands on, for stacking. */
  z?: number;
}

export interface BoxStyle {
  fill: string;
  /** Outline; omit for a soft prop with no drawn edge. */
  edge?: string;
  /** How much lighter the top face is, and darker the right. */
  contrast?: number;
  alpha?: number;
}

/**
 * A cuboid, shaded on its three visible faces. Counters, kerbs, seats, screens,
 * scanner housings, suitcases and car bodies are all this function -- which is
 * why the whole series looks built out of one kit.
 *
 * Light is fixed high and to the front: top lightest, front mid, right side
 * darkest. Fixed rather than configurable, because a set lit from two
 * directions stops reading as a single space.
 */
export function box3(
  c: CanvasRenderingContext2D,
  cam: Camera,
  box: Box,
  style: BoxStyle,
): void {
  const { x, y, w, d, h } = box;
  const zb = box.z ?? 0;
  const zt = zb + h;
  const k = style.contrast ?? 0.18;
  const pt = (px: number, py: number, pz: number) => project(cam, px, py, pz);

  const face = (pts: Array<{ x: number; y: number }>, fill: string) => {
    c.beginPath();
    pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (style.edge) {
      c.strokeStyle = style.edge;
      c.lineWidth = 1;
      c.stroke();
    }
  };

  c.save();
  if (style.alpha !== undefined) c.globalAlpha = style.alpha;

  // Right side and front are both visible in this projection; the top closes
  // the solid. They tile without overlapping, so the order is free.
  face(
    [
      pt(x + w, y, zb),
      pt(x + w, y + d, zb),
      pt(x + w, y + d, zt),
      pt(x + w, y, zt),
    ],
    darken(style.fill, k),
  );
  face(
    [pt(x, y, zb), pt(x + w, y, zb), pt(x + w, y, zt), pt(x, y, zt)],
    style.fill,
  );
  face(
    [
      pt(x, y, zt),
      pt(x + w, y, zt),
      pt(x + w, y + d, zt),
      pt(x, y + d, zt),
    ],
    lighten(style.fill, k * 1.4),
  );

  c.restore();
}

// --- people ----------------------------------------------------------------

export interface PersonStyle {
  /** Clothing colour. Gold reads as "being served" everywhere in the course. */
  coat: string;
  /** Head colour. Defaults to the warm neutral in Tints. */
  skin?: string;
  /** Hair, drawn as a cap over the top of the head. Omit for none. */
  hair?: string;
  /** Standing height in world units. */
  h?: number;
  /** Outline, for the hollow-dot reading of someone still waiting. */
  edge?: string;
  /** A held object -- a tray, a bag, a passport -- as a small block. */
  carry?: string;
}

/**
 * A person, about twenty pixels tall at the size these scenes run.
 *
 * Deliberately a peg rather than an articulated figure. At this size limbs turn
 * into noise, and the thing a reader has to be able to do is count them and see
 * which one is at the counter -- so the silhouette is simple and the colour
 * does the work. This replaces the hollow dot the earlier diagrams used, and it
 * is the single biggest reason the scenes read as a place.
 */
export function person(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  x: number,
  y: number,
  style: PersonStyle,
): void {
  const h = (style.h ?? 1.7) * 0.8 * cam.s;
  const foot = project(cam, x, y, 0);
  if (h < 4) {
    c.fillStyle = style.coat;
    c.beginPath();
    c.arc(foot.x, foot.y - h * 0.5, Math.max(1.2, h * 0.22), 0, Math.PI * 2);
    c.fill();
    return;
  }

  const bodyW = h * 0.3;
  const hipY = foot.y - h * 0.34;
  const shoulderY = foot.y - h * 0.74;
  const headR = h * 0.13;

  // legs
  c.fillStyle = darken(style.coat, 0.3);
  c.fillRect(foot.x - bodyW * 0.36, hipY, bodyW * 0.26, foot.y - hipY);
  c.fillRect(foot.x + bodyW * 0.1, hipY, bodyW * 0.26, foot.y - hipY);

  // torso, with the lit edge on the left to match the box shading
  c.beginPath();
  const r = bodyW * 0.42;
  c.moveTo(foot.x - bodyW / 2, hipY);
  c.lineTo(foot.x - bodyW / 2, shoulderY + r);
  c.quadraticCurveTo(foot.x - bodyW / 2, shoulderY, foot.x - bodyW / 2 + r, shoulderY);
  c.lineTo(foot.x + bodyW / 2 - r, shoulderY);
  c.quadraticCurveTo(foot.x + bodyW / 2, shoulderY, foot.x + bodyW / 2, shoulderY + r);
  c.lineTo(foot.x + bodyW / 2, hipY);
  c.closePath();
  c.fillStyle = style.coat;
  c.fill();
  c.beginPath();
  c.rect(foot.x + bodyW * 0.18, shoulderY + r * 0.6, bodyW * 0.32, hipY - shoulderY - r * 0.6);
  c.fillStyle = withAlpha(darken(style.coat, 0.22), 0.55);
  c.fill();

  // head
  const headY = shoulderY - headR * 0.82;
  c.beginPath();
  c.arc(foot.x, headY, headR, 0, Math.PI * 2);
  c.fillStyle = style.skin ?? mix(p.gold, p.bg, 0.52);
  c.fill();
  if (style.edge) {
    c.strokeStyle = style.edge;
    c.lineWidth = 1.1;
    c.stroke();
  }

  if (style.hair && headR > 2.5) {
    c.beginPath();
    c.arc(foot.x, headY, headR, Math.PI * 1.08, Math.PI * 2.02);
    c.closePath();
    c.fillStyle = style.hair;
    c.fill();
  }

  if (style.carry) {
    c.fillStyle = style.carry;
    c.fillRect(foot.x + bodyW * 0.5, hipY - h * 0.1, bodyW * 0.42, h * 0.14);
  }
}

// --- the green accent ------------------------------------------------------

/**
 * A potted plant, in the one green this course uses. Every set gets one piece
 * of planting appropriate to the place -- a fig on a cafe windowsill, a
 * concourse planter, a neglected pot by a ticket machine -- so there is a
 * living thing in shot and a colour that is neither the gold of service nor the
 * ink of waiting.
 *
 * `seed` varies the fronds so two plants in the same scene are not twins, and
 * varies them the same way on every frame so the plant does not flicker.
 */
export function plant(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  x: number,
  y: number,
  scale = 1,
  seed = 1,
): void {
  const foot = project(cam, x, y, 0);
  const u = scale * cam.s;
  const potH = 0.26 * u;
  const potW = 0.34 * u;

  const rand = (n: number) => {
    const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  // Leaves first, so the pot rim overlaps their stems. Broad ovals rather
  // than blades: at this size a spray of thin strokes reads as pampas grass,
  // and what these sets need is a houseplant somebody has to remember to
  // water.
  const leaves = 7;
  const stemW = Math.max(1, u * 0.035);
  for (let i = 0; i < leaves; i++) {
    const t = i / (leaves - 1);
    const back = i % 2 === 0;
    const spread = (t - 0.5) * 2;
    const reach = potW * (0.95 + rand(i) * 0.45);
    const rise = u * (0.34 + rand(i + 9) * 0.34);
    const baseX = foot.x;
    const baseY = foot.y - potH * 0.75;
    const tipX = baseX + spread * reach;
    const tipY = baseY - rise;
    const green = back ? p.greenDark : p.green;

    c.beginPath();
    c.moveTo(baseX, baseY);
    c.quadraticCurveTo(baseX + spread * reach * 0.35, tipY + u * 0.1, tipX, tipY);
    c.strokeStyle = green;
    c.lineWidth = stemW;
    c.lineCap = "round";
    c.stroke();

    const leafR = u * (0.13 + rand(i + 3) * 0.05);
    c.save();
    c.translate(tipX, tipY);
    c.rotate(spread * 0.9);
    c.beginPath();
    c.ellipse(0, -leafR * 0.5, leafR * 0.62, leafR, 0, 0, Math.PI * 2);
    c.fillStyle = green;
    c.fill();
    c.restore();
  }

  box3(
    c,
    cam,
    { x: x - scale * 0.17, y: y - scale * 0.12, w: scale * 0.34, d: scale * 0.24, h: scale * 0.26 },
    { fill: tints(p).clay, contrast: 0.2 },
  );
}

// --- furniture -------------------------------------------------------------

/**
 * A counter: a cabinet with a top that overhangs it. Two boxes, but every scene
 * with a service point needs one and writing it twice is how the overhang ends
 * up different in week 4 than in week 1.
 */
export function counter(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  box: Box,
  fill?: string,
): void {
  const base = fill ?? tints(p).stone;
  box3(c, cam, { ...box, h: box.h * 0.92 }, { fill: base, contrast: 0.2 });
  box3(
    c,
    cam,
    {
      x: box.x - 0.06,
      y: box.y - 0.06,
      w: box.w + 0.12,
      d: box.d + 0.12,
      h: box.h * 0.08,
      z: (box.z ?? 0) + box.h * 0.92,
    },
    { fill: mix(base, tints(p).wood, 0.55), contrast: 0.26 },
  );
}

/** A waiting-room chair: seat, back, and the two legs you can actually see. */
export function chair(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  x: number,
  y: number,
  fill?: string,
): void {
  const t = tints(p);
  const base = fill ?? t.cloth;
  const legs = darken(t.metal, 0.35);
  const seatZ = 0.44;
  // Only the front pair of legs is drawn: the back pair is behind the seat in
  // this projection and adding it just thickens the shadow.
  box3(c, cam, { x: x - 0.2, y: y - 0.18, w: 0.08, d: 0.08, h: seatZ }, { fill: legs });
  box3(c, cam, { x: x + 0.12, y: y - 0.18, w: 0.08, d: 0.08, h: seatZ }, { fill: legs });
  box3(
    c,
    cam,
    { x: x - 0.24, y: y - 0.22, w: 0.48, d: 0.44, h: 0.1, z: seatZ },
    { fill: base, contrast: 0.22 },
  );
  box3(
    c,
    cam,
    { x: x - 0.24, y: y + 0.14, w: 0.48, d: 0.09, h: 0.52, z: seatZ + 0.1 },
    { fill: darken(base, 0.08), contrast: 0.22 },
  );
}

/**
 * A screen on a post: menu board, ticket display, departures board. Takes its
 * lines of text already formatted, and draws them on the panel face.
 */
export function screen(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
    lines?: string[];
    accent?: string;
  },
): void {
  const { x, y, w, h, z } = opts;
  const t = tints(p);
  box3(c, cam, { x: x + w / 2 - 0.05, y, w: 0.1, d: 0.1, h: z }, { fill: t.metal });
  box3(
    c,
    cam,
    { x, y, w, d: 0.08, h, z },
    { fill: t.screen, edge: withAlpha(p.soft, 0.5), contrast: 0.12 },
  );

  const lines = opts.lines ?? [];
  if (!lines.length) return;
  const topLeft = project(cam, x, y, z + h);
  const size = Math.max(7, Math.min(13, h * 0.8 * cam.s * 0.3));
  c.save();
  c.fillStyle = opts.accent ?? p.gold;
  c.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  c.textAlign = "left";
  c.textBaseline = "top";
  lines.forEach((text, i) => {
    c.fillText(text, topLeft.x + size * 0.5, topLeft.y + size * (0.5 + i * 1.25));
  });
  c.restore();
}

// --- traffic ---------------------------------------------------------------

/**
 * A car, either side-on or seen from behind.
 *
 * `facing: "x"` gives the side view: nose to the right, side windows and the
 * two near wheels. `facing: "y"` points the car away from the viewer and up
 * the road, so what you see is its back -- rear window, two tail lights, and
 * the wheels down its right-hand side.
 *
 * Both views matter, and the second one more than I expected. A drive-through
 * queue drawn side-on costs a metre of screen width per metre of road, so six
 * cars need thirty-odd metres of frame and the whole set ends up five times
 * wider than it is tall -- which at a readable figure height makes every car
 * about sixty pixels long. The same queue running away from the viewer costs
 * only 0.62 of that per metre, because depth is foreshortened in this
 * projection, so the set is squarer, the camera scale is higher, and the cars
 * are bigger. It is also simply what a drive-through queue looks like: you see
 * it from the back of it.
 *
 * The body is built in (along, across) coordinates -- distance from the rear
 * bumper, and offset across the car -- and mapped onto world x/y once, at the
 * bottom. Writing it twice was the alternative and the two copies would have
 * drifted.
 */
export function car(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  x: number,
  y: number,
  fill: string,
  len = 4.4,
  facing: "x" | "y" = "x",
): void {
  const t = tints(p);
  /** Width across the direction of travel. */
  const across = len * 0.41;
  const sill = len * 0.075;
  const bodyH = len * 0.17;
  /**
   * Taller than a real car's glasshouse. Seen from behind at this camera scale
   * a car is about seventy pixels wide and forty tall, of which a realistic
   * cabin is seven -- and seven pixels of slightly lighter fill on top of a
   * box does not read as a roofline, it reads as a plank. The proportions are
   * wrong on purpose, for the same reason the people are pegs.
   */
  const cabH = len * 0.19;
  /** Faint outline. At this size an unlined box loses its edges to its own fill. */
  const edge = withAlpha(p.ink, 0.28);

  /** (along, across) -> world box. */
  const part = (
    a: number,
    aSpan: number,
    cOff: number,
    cSpan: number,
    z: number,
    h: number,
  ): Box =>
    facing === "x"
      ? { x: x + a, y: y + cOff, w: aSpan, d: cSpan, h, z }
      : { x: x + cOff, y: y + a, w: cSpan, d: aSpan, h, z };

  /**
   * A quad on the face turned toward the viewer, in (along, across) terms.
   * Which face that is depends on the heading: side-on it is the car's flank,
   * from behind it is the tailgate.
   */
  const faceQuad = (
    a0: number,
    a1: number,
    c0: number,
    c1: number,
    z0: number,
    z1: number,
  ): Array<{ x: number; y: number }> => {
    const corners: Array<[number, number, number]> =
      facing === "x"
        ? [
            [x + a0, y + c0, z0],
            [x + a1, y + c0, z0],
            [x + a1, y + c0, z1],
            [x + a0, y + c0, z1],
          ]
        : [
            [x + c0, y + a0, z0],
            [x + c1, y + a0, z0],
            [x + c1, y + a0, z1],
            [x + c0, y + a0, z1],
          ];
    return corners.map(([px, py, pz]) => project(cam, px, py, pz));
  };

  // Wheels first, and only on the side that is visible: the far pair is hidden
  // by the body in this projection, and drawing it anyway put two dark smudges
  // above the roofline. Side-on that is the near flank; from behind it is the
  // right-hand side.
  const wheelC = facing === "x" ? across * 0.02 : across * 0.86;
  [0.12, 0.71].forEach((a) =>
    box3(c, cam, part(len * a, len * 0.17, wheelC, across * 0.12, 0, sill * 1.25), {
      fill: darken(t.metal, 0.55),
      contrast: 0.1,
    }),
  );

  box3(c, cam, part(0, len, 0, across, sill, bodyH), { fill, edge, contrast: 0.22 });
  const cabZ = sill + bodyH;
  box3(
    c,
    cam,
    part(len * 0.24, len * 0.44, across * 0.12, across * 0.76, cabZ, cabH),
    { fill: lighten(fill, 0.05), edge, contrast: 0.24 },
  );

  // Glass: the upper part of the cabin's visible face. Side windows side-on,
  // rear window from behind.
  const glass = withAlpha(mix(p.bg, p.ink, 0.62), 0.85);
  const quad = faceQuad(
    len * 0.27,
    len * 0.65,
    across * 0.12,
    across * 0.88,
    cabZ + cabH * 0.28,
    cabZ + cabH * 0.95,
  );
  c.beginPath();
  quad.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  c.closePath();
  c.fillStyle = glass;
  c.fill();

  // Tail lights, and they matter more than they sound: seen from behind, two
  // red lamps are most of what makes a small coloured box read as a car rather
  // than a crate. Drawn as panels on the rear face, not dots -- at this camera
  // scale a dot of the right physical radius came out at a single pixel.
  const lampColour = mix(p.gold, "rgb(198, 46, 38)", 0.72);
  const lampZ = sill + bodyH * 0.42;
  const lampH = bodyH * 0.34;
  const lampW = across * 0.2;
  (facing === "x" ? [0.14] : [0.12, 0.68]).forEach((cf) => {
    const quad = faceQuad(
      len * 0.015,
      len * 0.015,
      across * cf,
      across * cf + lampW,
      lampZ,
      lampZ + lampH,
    );
    c.beginPath();
    quad.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    c.fillStyle = lampColour;
    c.fill();
  });
}

/**
 * A street tree. Trunk and two overlapping crowns, offset so the light reads
 * from the same direction as everything else in the kit.
 *
 * Distinct from plant(): a pot plant is an indoor prop at person scale, and a
 * tree is four metres of roadside. Both exist so that every set in the course
 * has one living green thing in it, which is the series' one non-negotiable
 * piece of colour.
 */
export function tree(
  c: CanvasRenderingContext2D,
  cam: Camera,
  p: Palette,
  x: number,
  y: number,
  height = 4,
  seed = 1,
): void {
  const t = tints(p);
  const jitter = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const trunkH = height * 0.42;
  const crownR = height * 0.3 * (0.86 + jitter * 0.28);

  box3(
    c,
    cam,
    { x: x - height * 0.045, y: y - height * 0.045, w: height * 0.09, d: height * 0.09, h: trunkH },
    { fill: darken(t.wood, 0.3), contrast: 0.14 },
  );

  const top = project(cam, x, y, trunkH + crownR * 0.7);
  const r = crownR * cam.s;
  if (r < 1.5) return;
  const crown = (dx: number, dy: number, scale: number, tint: number) => {
    c.beginPath();
    c.ellipse(top.x + dx * r, top.y + dy * r, r * scale, r * scale * 0.82, 0, 0, Math.PI * 2);
    c.fillStyle = mix(p.green, p.bg, tint);
    c.fill();
  };
  crown(0.24, 0.16, 0.82, 0.02);
  crown(-0.2, -0.06, 0.9, 0.16);
  crown(0.04, -0.34, 0.6, 0.3);
}

// --- annotation ------------------------------------------------------------

/**
 * Label size for the current camera.
 *
 * Text is the one thing in a scene that cannot scale with the set: at 390px
 * the camera drops to about a third of its desktop scale, and 11px labels that
 * read as annotation on a wide canvas start to dominate the room and overrun
 * the props they name. So type shrinks with the camera, within bounds, and
 * anything that would land under `min` should be dropped rather than drawn.
 */
export function textSize(cam: Camera, max = 11, min = 7): number {
  return Math.max(min, Math.min(max, cam.s * 0.11));
}

/** Screen-space text. Rotated 11px canvas text is unreadable; this is not. */
export function label(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour: string,
  size = 11,
  align: CanvasTextAlign = "left",
  weight = "500",
): void {
  c.fillStyle = colour;
  c.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.fillText(text, x, y);
}

/**
 * A number the scene is reporting, on a pink chip -- the same pink that marks a
 * concept in the prose, so a live figure on the canvas and a highlighted phrase
 * in the text are visibly the same kind of claim.
 */
export function chip(
  c: CanvasRenderingContext2D,
  p: Palette,
  text: string,
  x: number,
  y: number,
  size = 11,
  /** Canvas width, to keep the chip inside the frame. */
  limit?: number,
): void {
  c.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  const w = c.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  const r = h / 2;
  if (limit !== undefined) x = Math.max(4, Math.min(x, limit - w - 4));
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x + r, y + h);
  c.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  c.closePath();
  c.fillStyle = p.pink;
  c.fill();
  c.strokeStyle = p.pinkEdge;
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = p.ink;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText(text, x + size * 0.55, y + h / 2 + 0.5);
  c.textBaseline = "alphabetic";
}
