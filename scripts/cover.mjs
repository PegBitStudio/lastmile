#!/usr/bin/env node
/**
 * Render docs/cover.svg to the PNG the submission form wants.
 *
 *   npm run cover
 *
 * The SVG is the source of truth, so the cover is editable text in git rather
 * than a binary somebody has to own the original of. sharp is already here as a
 * dependency of Next, so this adds nothing to install.
 *
 * 1920 x 1080 because the form asks for 16:9. Check the result at about 300
 * pixels wide before shipping it: that is the size a judge first sees it.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const IN = "docs/cover.svg";
const OUT = "docs/cover.png";

const svg = await readFile(IN);
const info = await sharp(svg, { density: 96 })
  .resize(1920, 1080, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log(`${IN} -> ${OUT}`);
console.log(`${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} kB`);
if (info.width / info.height !== 16 / 9) console.error("Not 16:9. The form will reject it.");
