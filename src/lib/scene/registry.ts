/**
 * Every scene in the course, by id.
 *
 * Scene.astro reads the declarations out of this at build time to render the
 * markup, and the client script imports the same module to run them. One
 * source for both is what keeps the controls row identical on every week
 * without twelve copies of it.
 */

import type { AnyScene } from "./types";
import { cafe } from "./scenes/cafe";
import { drivethru } from "./scenes/drivethru";
import { security } from "./scenes/security";

export const SCENES = {
  cafe,
  drivethru,
  security,
} satisfies Record<string, AnyScene>;

/** The ids a week may ask for. */
export type SceneId = keyof typeof SCENES;

/**
 * The same table, indexable by an arbitrary string. Scene.astro takes its id
 * as a prop and the host looks one up from a data attribute, so both need this
 * view; SCENES keeps its narrow keys so SceneId stays a real union.
 */
export const scenes: Record<string, AnyScene> = SCENES;
