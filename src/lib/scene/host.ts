/**
 * The runtime every scene shares.
 *
 * Sizing, the animation loop, play and pause, the controls, reduced motion,
 * the theme switch and the teardown all live here once. A scene supplies
 * build, step, extent, draw and report; everything else on this page is the
 * same code whether it is week 1 or week 12.
 *
 * Three things the earlier component got wrong, fixed here:
 *
 *  - It sized the canvas from inside draw(), reallocating the backing store
 *    fourteen times a second. Now the canvas is only reallocated when the
 *    measured size actually changed.
 *  - Its theme MutationObserver was never disconnected, so an Astro view
 *    transition left an observer behind per visit, each holding a dead canvas.
 *  - Its resize listener was removed on before-swap but the observer was not,
 *    which is the same leak from the other end.
 */

import { DEPTH_X, DEPTH_Y, HEIGHT_Y, fitCamera, type Camera } from "./project";
import { readPalette } from "./palette";
import type { AnyScene, ControlSpec, Frame, SceneDef } from "./types";

const DEFAULT_RATE = 14;
/** Reduced motion gets a longer warm-up: it sees one frame, so make it count. */
const REDUCED_WARM = 2.5;

function controlValue(el: HTMLInputElement | HTMLSelectElement): string {
  return el.value;
}

function formatFor(spec: ControlSpec | undefined, raw: string): string {
  if (!spec || spec.kind !== "range") return raw;
  const n = Number(raw);
  return spec.format ? spec.format(n) : String(n);
}

function mountOne<M>(root: HTMLElement, def: SceneDef<M>): void {
  if (root.dataset.qsimReady === "1") return;
  root.dataset.qsimReady = "1";

  const canvas = root.querySelector<HTMLCanvasElement>("[data-qsim-canvas]");
  const playBtn = root.querySelector<HTMLButtonElement>("[data-qsim-play]");
  const resetBtn = root.querySelector<HTMLButtonElement>("[data-qsim-reset]");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx || !playBtn) return;

  const specs = new Map(def.controls.map((spec) => [spec.key, spec]));
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-qsim-input]")
    .forEach((el) => inputs.set(el.dataset.qsimInput as string, el));

  const controls = {
    num(key: string, fallback = 0): number {
      const el = inputs.get(key);
      return el ? Number(controlValue(el)) : fallback;
    },
    str(key: string, fallback = ""): string {
      const el = inputs.get(key);
      return el ? controlValue(el) : fallback;
    },
  };

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rate = def.rate ?? DEFAULT_RATE;

  let palette = readPalette(root);
  let model = def.build(controls);
  let tick = 0;
  let playing = false;
  let raf = 0;
  let last = 0;
  let carry = 0;
  let sized = { w: 0, h: 0, dpr: 0 };

  /**
   * How tall the canvas has to be for this set at this width.
   *
   * The scene's declared height is a maximum, not a fixed value. Its extent
   * already says how wide and deep the set is, so the projected footprint's
   * aspect ratio is known -- and at 390px a fixed height left a nine-metre
   * cafe drawn 124 pixels tall in the middle of a 300 pixel canvas, with the
   * empty band above it reading as a mistake. Deriving the height instead
   * means every scene fills its frame at every width, and no scene has to
   * carry a breakpoint.
   */
  function naturalHeight(width: number): number {
    const extent = def.extent(model);
    const footprintW =
      extent.x1 - extent.x0 + Math.abs(DEPTH_X) * (extent.y1 - extent.y0);
    const footprintH = DEPTH_Y * (extent.y1 - extent.y0) + HEIGHT_Y * extent.z1;
    const pad = 20;
    const natural = ((width - pad) * footprintH) / footprintW + pad;
    return Math.round(Math.max(def.minHeight ?? 140, Math.min(def.height, natural)));
  }

  /**
   * Reallocating a canvas clears it and is not cheap, so this only touches the
   * backing store when the measured size has actually changed. Returns the CSS
   * size either way, because draw needs it every frame.
   */
  function size(): { w: number; h: number } {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = root.clientWidth || 600;
    const h = naturalHeight(w);
    if (sized.w !== w || sized.h !== h || sized.dpr !== dpr) {
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.height = `${h}px`;
      sized = { w, h, dpr };
    }
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function report(): void {
    const values = def.report(model);
    for (const [key, value] of Object.entries(values)) {
      const cell = root.querySelector(`[data-r="${key}"]`);
      if (cell) cell.textContent = value;
    }
  }

  function draw(): void {
    const { w, h } = size();
    ctx!.clearRect(0, 0, w, h);
    const cam: Camera = fitCamera(w, h, def.extent(model));
    const frame: Frame<M> = {
      c: ctx!,
      cam,
      p: palette,
      model,
      w,
      h,
      tick,
      reduced: reducedQuery.matches,
    };
    def.draw(frame);
  }

  function rebuild(): void {
    palette = readPalette(root);
    model = def.build(controls);
    tick = 0;
    const warm = Math.round((def.warm ?? 0) * (reducedQuery.matches ? REDUCED_WARM : 1));
    for (let i = 0; i < warm; i++) {
      def.step(model);
      tick++;
    }
    // Then keep going until the state agrees with the statistics, so the frame
    // a reader opens on is not a quiet moment sitting under a readout that
    // says the queue is long. Capped, because a scene can legitimately have no
    // such state -- one over capacity never settles.
    if (def.representative) {
      for (let i = 0; i < 4000 && !def.representative(model); i++) {
        def.step(model);
        tick++;
      }
    }
    report();
    draw();
  }

  function frame(now: number): void {
    if (!playing) return;
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    carry += dt * rate;
    const steps = Math.floor(carry);
    carry -= steps;
    for (let i = 0; i < steps; i++) {
      def.step(model);
      tick++;
    }
    if (steps > 0) report();
    draw();
    raf = requestAnimationFrame(frame);
  }

  function play(): void {
    if (playing) return;
    playing = true;
    playBtn!.textContent = "Pause";
    playBtn!.setAttribute("aria-pressed", "true");
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    playing = false;
    playBtn!.textContent = "Play";
    playBtn!.setAttribute("aria-pressed", "false");
    cancelAnimationFrame(raf);
  }

  playBtn.addEventListener("click", () => (playing ? stop() : play()));
  resetBtn?.addEventListener("click", () => {
    stop();
    rebuild();
  });

  inputs.forEach((el, key) => {
    el.addEventListener("input", () => {
      const out = root.querySelector(`[data-out="${key}"]`);
      if (out) out.textContent = formatFor(specs.get(key), controlValue(el));
      const wasPlaying = playing;
      stop();
      rebuild();
      if (wasPlaying && !reducedQuery.matches) play();
    });
  });

  const themeWatcher = new MutationObserver(() => {
    palette = readPalette(root);
    draw();
  });
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(draw, 120);
  };
  window.addEventListener("resize", onResize);

  document.addEventListener(
    "astro:before-swap",
    () => {
      stop();
      themeWatcher.disconnect();
      window.removeEventListener("resize", onResize);
    },
    { once: true },
  );

  rebuild();
}

/**
 * Mount every scene on the page. Called on load and on every Astro view
 * transition; the data-qsim-ready latch on each figure makes that idempotent.
 */
export function mountScenes(registry: Record<string, AnyScene>): void {
  const attach = () => {
    document.querySelectorAll<HTMLElement>("[data-qsim-scene]").forEach((root) => {
      const id = root.dataset.qsimScene;
      const def = id ? registry[id] : undefined;
      if (def) mountOne(root, def);
    });
  };
  attach();
  document.addEventListener("astro:page-load", attach);
}
