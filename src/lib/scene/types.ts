/**
 * What a scene is.
 *
 * A scene declares its set, its controls, its readout and four functions, and
 * knows nothing about canvases, themes, resizing, animation loops or the DOM.
 * The host in host.ts supplies all of that, and Scene.astro renders the markup
 * from the same declaration -- which is the point: twelve weeks cannot each
 * hand-write a controls row and still end up with one interface.
 *
 * The earlier component did hand-write them. Four variants meant four blocks of
 * Astro markup, a four-way branch in draw(), and every helper trapped in one
 * closure. It could not have carried twelve.
 */

import type { Camera, Extent } from "./project";
import type { Palette } from "./draw";

export interface RangeControl {
  kind: "range";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Renders the live value beside the label. Client-side only. */
  format?: (value: number) => string;
}

export interface SelectControl {
  kind: "select";
  key: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}

export type ControlSpec = RangeControl | SelectControl;

export interface ReadoutSpec {
  key: string;
  term: string;
  /** Subscript, for W90 and friends. */
  sub?: string;
}

/** Current control values, as the scene's build step sees them. */
export interface Controls {
  num(key: string, fallback?: number): number;
  str(key: string, fallback?: string): string;
}

export interface Frame<M> {
  c: CanvasRenderingContext2D;
  cam: Camera;
  p: Palette;
  model: M;
  /** Canvas size in CSS pixels. */
  w: number;
  h: number;
  /** Ticks elapsed since the last rebuild. */
  tick: number;
  /** True when the reader has asked for no animation. */
  reduced: boolean;
  /**
   * Crop being drawn, when a snippet is replaying part of this scene. Scenes
   * can use it to skip annotation that would not fit, and otherwise ignore it.
   */
  region?: string;
}

export interface SceneDef<M = unknown> {
  /**
   * Largest canvas height in CSS pixels. The host derives the actual height
   * from the set's projected footprint so the scene fills its frame at any
   * width, and clamps it to this.
   */
  height: number;
  /** Smallest canvas height, for narrow viewports. Defaults to 140. */
  minHeight?: number;
  controls: ControlSpec[];
  readout: ReadoutSpec[];
  /** Simulation ticks per real second. */
  rate?: number;
  /**
   * Ticks to run before the first frame. A queue scene opened at tick zero is
   * an empty room, which tells the reader nothing and looks broken; every
   * scene that converges should warm up to somewhere representative.
   */
  warm?: number;
  /** A fresh model from the current control values. Must be deterministic. */
  build(controls: Controls): M;
  /**
   * Whether the model is in a state worth opening on.
   *
   * The first frame is the only one some readers will ever see -- anyone with
   * reduced motion on, and anyone who does not press Play. Warming a fixed
   * number of ticks lands wherever the sample path happens to be, which at
   * 0.88 load opened a cafe with two people in it above a readout saying the
   * average is 6.6. So after warming, the host keeps stepping until this says
   * the state matches what the numbers claim.
   */
  representative?(model: M): boolean;
  /** One tick. */
  step(model: M): void;
  /** The set, in world units. May depend on the model. */
  extent(model: M): Extent;
  draw(frame: Frame<M>): void;
  /** Values for the readout row, keyed by ReadoutSpec.key. */
  report(model: M): Record<string, string>;
  /**
   * Named crops of the set that a Snip can replay inline -- the cafe's door
   * end, the drive-through's jam. A recall is a live piece of the real scene
   * rather than a sentence pointing at a figure number.
   */
  regions?: Record<string, Extent>;
}

/**
 * Erases the model type so one registry can hold scenes of different shapes.
 *
 * This works because build/step/draw/report are declared as methods rather than
 * function-typed properties, and TypeScript checks method parameters
 * bivariantly -- so a SceneDef<CafeModel> is assignable here. The host only
 * ever passes a model straight back to the scene that produced it, so nothing
 * is actually unsound; without it every scene would have to be cast at the
 * registry.
 */
export type AnyScene = SceneDef<unknown>;
