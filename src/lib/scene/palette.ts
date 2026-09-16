/**
 * Getting the stylesheet's colours into a canvas.
 *
 * This is harder than it looks and has now been got wrong twice, so both
 * failures are written down.
 *
 * The first: the theme states its tokens as light-dark() pairs, and
 * getPropertyValue hands that back verbatim. Assigning it to strokeStyle fails
 * silently -- canvas ignores an unparseable colour and keeps whatever it had --
 * which is how every rule and label in the first simulation came out gold.
 * Setting `color` on a probe element and reading it back makes the browser
 * resolve light-dark(), var() and the rest.
 *
 * The second, which the probe alone does not fix: what comes back is
 * `oklch(0.2 0.01 72.9532)`, because that is how this theme states its ramp.
 * Canvas draws oklch perfectly well, so single colours looked right -- but the
 * shading in the prop library has to mix and darken them, and a naive "take
 * the first three numbers" parse reads 0.2 as red and 72.95 as blue and turns
 * every surface in the scene navy. That bug is invisible in the code and
 * obvious in a screenshot, which is the argument for taking screenshots.
 *
 * So the colour is rasterised: painted into a 1x1 canvas and read back as
 * bytes. That delegates every colour syntax the browser will ever support to
 * the browser, and it clamps to sRGB, which is what compositing on the page
 * does anyway.
 */

import type { Palette } from "./draw";

/** The tokens a scene draws with, and what each one means. */
const TOKENS: Record<keyof Palette, [string, string]> = {
  ink: ["var(--q-ink)", "rgb(34, 34, 34)"],
  soft: ["var(--q-ink-soft)", "rgb(119, 119, 119)"],
  gold: ["var(--q-gold)", "rgb(185, 125, 28)"],
  rule: ["var(--q-rule)", "rgb(204, 204, 204)"],
  bg: ["var(--at-bg)", "rgb(255, 255, 255)"],
  ground: ["var(--q-ground)", "rgb(246, 243, 238)"],
  pink: ["var(--q-pink)", "rgb(247, 217, 227)"],
  pinkEdge: ["var(--q-pink-edge)", "rgb(233, 168, 191)"],
  green: ["var(--q-green)", "rgb(47, 107, 70)"],
  greenDark: ["var(--q-green-dark)", "rgb(31, 74, 47)"],
};

/**
 * Read the course palette as it currently renders, resolved to rgba() strings.
 *
 * `root` must be in the document: the probe is appended to it so the colours
 * come out of the same cascade the scene is sitting in, which is what makes
 * the light/dark switch work without any scene knowing about themes.
 */
export function readPalette(root: HTMLElement): Palette {
  const probe = document.createElement("span");
  probe.style.display = "none";
  root.appendChild(probe);

  const pad = document.createElement("canvas");
  pad.width = 1;
  pad.height = 1;
  const px = pad.getContext("2d", { willReadFrequently: true });

  const read = (value: string, fallback: string): string => {
    probe.style.color = "";
    probe.style.color = value;
    const resolved = getComputedStyle(probe).color;
    if (!resolved || resolved === "rgba(0, 0, 0, 0)") return fallback;
    if (!px) return resolved;
    px.clearRect(0, 0, 1, 1);
    px.fillStyle = "#000";
    px.fillStyle = resolved;
    px.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data;
    // getImageData un-premultiplies, so a low alpha comes back a little lossy.
    // Nothing here is thinner than 0.5, where the rounding is under a percent.
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  };

  const out = {} as Palette;
  for (const key of Object.keys(TOKENS) as Array<keyof Palette>) {
    const [token, fallback] = TOKENS[key];
    out[key] = read(token, fallback);
  }

  probe.remove();
  return out;
}
