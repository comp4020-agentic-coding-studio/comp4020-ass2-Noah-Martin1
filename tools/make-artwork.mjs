/**
 * Generates the site's two images from the same visual grammar the course's
 * diagrams and simulations use: hollow dot = waiting, gold dot = in service,
 * square = server, on the warm cream ground of the Slop palette.
 *
 * The starter artwork is SHA-256 checked by `pnpm check:evidence` and has to
 * go. Rather than source a photograph that would sit oddly beside twelve weeks
 * of two-ink diagrams, the hero IS a diagram: five lanes of unequal length
 * feeding five servers, one of them idle while another lane waits. That is
 * week 5's lesson, drawn as the picture on the front page.
 *
 *   node tools/make-artwork.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const CREAM = "#faf8f3";
const INK = "#1a1a18";
const GOLD = "#b97d1c";

// The hero sits under the theme's dark gradient overlay, which exists so the
// white title stays legible. Drawing the hero on cream put a grey wash over
// warm paper and read as a mistake, so the hero inverts the two inks: ink
// ground, cream dots. The card carries no overlay and stays on paper.

const dot = (x, y, r, filled, line = INK) =>
  filled
    ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${GOLD}"/>`
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${line}" stroke-width="${r * 0.34}"/>`;

const square = (x, y, s, busy, line = INK) =>
  `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="none" stroke="${busy ? GOLD : line}" stroke-width="${busy ? s * 0.13 : s * 0.07}" ${busy ? "" : 'stroke-dasharray="' + s * 0.16 + ' ' + s * 0.16 + '"'}/>`;

/** One lane: n hollow dots queueing right toward a server. */
function lane(y, n, opts) {
  const { right, gap, r, serverSize, busy, line = INK } = opts;
  // The lane is only drawn as far back as its own queue reaches, so a short
  // queue looks short instead of trailing a rule across the whole image (and,
  // on the card, straight through the strapline).
  const mouth = right - serverSize * 1.5 - gap * (n + 1.6);
  const parts = [
    `<line x1="${mouth}" y1="${y}" x2="${right - serverSize}" y2="${y}" stroke="${line}" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="3 9"/>`,
    square(right, y, serverSize, busy, line),
  ];
  if (busy) parts.push(dot(right, y, r, true, line));
  for (let i = 0; i < n; i++) {
    parts.push(dot(right - serverSize * 1.5 - gap * (i + 1), y, r, false, line));
  }
  return parts.join("");
}

/** Five lanes of deliberately unequal length, with one server left idle. */
function lanes({ top, rowGap, right, gap, r, serverSize, counts, line = INK }) {
  return counts
    .map((n, i) => lane(top + i * rowGap, n, { right, gap, r, serverSize, busy: n > 0, line }))
    .join("");
}

const heroSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="${INK}"/>
  ${lanes({
    top: 150, rowGap: 145, right: 1470, gap: 60, r: 19, serverSize: 60,
    counts: [9, 3, 0, 16, 6], line: CREAM,
  })}
  <text x="1470" y="866" text-anchor="end" font-family="Helvetica, Arial, sans-serif"
        font-size="30" fill="${CREAM}" fill-opacity="0.5" letter-spacing="2">
    five servers · one idle · someone still waiting
  </text>
</svg>`;

const cardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  ${lanes({
    top: 392, rowGap: 74, right: 1108, gap: 36, r: 11, serverSize: 36,
    counts: [6, 0, 11],
  })}
  <text x="92" y="150" font-family="Helvetica, Arial, sans-serif" font-size="34"
        fill="${GOLD}" letter-spacing="6">SLOP2710</text>
  <text x="92" y="248" font-family="Georgia, serif" font-size="76" fill="${INK}">The Economics</text>
  <text x="92" y="330" font-family="Georgia, serif" font-size="76" fill="${INK}">of Waiting</text>
  <text x="92" y="404" font-family="Georgia, serif" font-size="38" font-style="italic"
        fill="${INK}" fill-opacity="0.6">There is no neutral queue.</text>
  <rect x="60" y="96" width="5" height="320" fill="${GOLD}"/>
</svg>`;

mkdirSync("src/assets/images", { recursive: true });
await sharp(Buffer.from(heroSvg)).avif({ quality: 72 }).toFile("src/assets/images/hero-home.avif");
await sharp(Buffer.from(cardSvg)).png().toFile("src/assets/images/card.png");
console.log("wrote src/assets/images/hero-home.avif and card.png");
