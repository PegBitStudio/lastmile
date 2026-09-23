#!/usr/bin/env node
/**
 * Render the project's SVGs to the PNGs the submission form and the deck want.
 *
 *   npm run cover
 *
 * The SVGs are the source of truth, so these images are editable text in git
 * rather than binaries somebody has to own the original of. sharp is already
 * here as a dependency of Next, so this adds nothing to install.
 *
 * The cover is 1920x1080 because the form asks for 16:9. Check it at about 300
 * pixels wide before shipping: that is the size a judge first sees it. The chart
 * is rendered at 2x its drawn size so it stays sharp full-screen in the video.
 * Run `python measurement/chart.py` first if the numbers have moved — that
 * script rebuilds the chart SVG from the results files.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const JOBS = [
  { in: "docs/cover.svg", out: "docs/cover.png", w: 1920, h: 1080, ratio: 16 / 9 },
  { in: "docs/chart-regions.svg", out: "docs/chart-regions.png", w: 2920, h: 1520 },
];

for (const job of JOBS) {
  const svg = await readFile(job.in);
  const info = await sharp(svg, { density: 96 })
    .resize(job.w, job.h, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(job.out);

  console.log(
    `${job.in} -> ${job.out}  ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} kB`,
  );
  if (job.ratio && info.width / info.height !== job.ratio) {
    console.error(`  ${job.out} is not 16:9. The form will reject it.`);
  }
}
