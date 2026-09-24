import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

import { configured, getTurnAudio, saveReviews } from "@/lib/db";
import { checkReviewRequest, reviewFields } from "@/lib/review";
import { secondOpinion } from "@/lib/second-opinion";
import { fromOwnSite } from "@/lib/same-site";

/**
 * A second opinion on the fields one driver turn set.
 *
 *   POST /api/review   { capture, turn, region, fields: { "recipient.name": "Marcus" } }
 *
 * The turn's WAV is already stored by /api/audio. It is transcribed again by a
 * model that scores every word, each free-text field is checked against those
 * words, and the verdict is kept for the board. Spec §3.3.
 *
 * Called by the driver page in the background, after the turn has uploaded. Never
 * on the conversation's path: the driver is never kept waiting on it.
 *
 * Decisions are in lib/review.ts, which plain Node can test.
 */

export const dynamic = "force-dynamic";
// Upload, transcribe, poll. A few seconds of audio is usually done in under ten.
export const maxDuration = 30;

async function keytermsFor(region: string): Promise<string[]> {
  try {
    const pack = JSON.parse(
      await readFile(process.cwd() + "/regions/" + region + ".json", "utf8"),
    ) as { keyterms?: string[] };
    return pack.keyterms ?? [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  // A review is a paid transcription. Only our own driver page may ask for one.
  if (!fromOwnSite(request.headers, request.url)) {
    return NextResponse.json({ error: "Reviews are only run for this site's own pages." }, { status: 403 });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!configured || !apiKey) {
    return NextResponse.json({
      reviewed: false,
      reason: !configured ? "DATABASE_URL is not set." : "ASSEMBLYAI_API_KEY is not set.",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }

  const check = checkReviewRequest(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { capture, turn, region, fields } = check.value;

  const audio = await getTurnAudio(capture, turn);
  // The driver page only asks once the upload has finished, so this is a real gap
  // rather than a race. Say so plainly and keep no verdict.
  if (!audio) {
    return NextResponse.json({ error: "No audio stored for that turn." }, { status: 404 });
  }

  try {
    const heard = await secondOpinion(audio.wav, apiKey, await keytermsFor(region));
    const reviews = reviewFields(fields, heard.words);

    await saveReviews(
      reviews.map((r) => ({
        capture_id: capture,
        path: r.path,
        turn_index: turn,
        value: r.value,
        confidence: r.confidence,
        found: r.found,
        flagged: r.flagged,
        reason: r.reason,
        heard: heard.text.slice(0, 500),
      })),
    );

    return NextResponse.json({ reviewed: true, heard: heard.text, reviews });
  } catch (err) {
    console.error("[review] failed", err);
    // A failed review is not a flagged field. It is simply unreviewed, and the
    // board shows it as such rather than inventing doubt.
    return NextResponse.json({ error: "Could not review that turn." }, { status: 502 });
  }
}
