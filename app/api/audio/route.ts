import { NextResponse } from "next/server";

import { configured, getTurnAudio, saveTurnAudio } from "@/lib/db";
import { checkTurnRef, checkWav, cleanHeard } from "@/lib/audio";

/**
 * One turn of the driver's voice.
 *
 *   POST /api/audio?capture=<uuid>&turn=<n>&heard=<text>   body: the WAV
 *   GET  /api/audio?capture=<uuid>&turn=<n>                returns the WAV
 *
 * The driver page uploads a turn only when a field in the record cites it. The
 * board plays it back when a dispatcher clicks that field. Spec §3.4.
 *
 * Decisions are in lib/audio.ts, which plain Node can test.
 *
 * Not authenticated, like the rest of this demo. What it will store is narrow on
 * purpose: one short WAV of our exact format, keyed to a capture, and nothing else.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!configured) {
    return NextResponse.json(
      { saved: false, reason: "DATABASE_URL is not set on this deployment." },
      { status: 200 },
    );
  }

  const params = new URL(request.url).searchParams;
  const ref = checkTurnRef(params);
  if (!ref.ok) return NextResponse.json({ error: ref.error }, { status: ref.status });

  const bytes = new Uint8Array(await request.arrayBuffer());
  const wav = checkWav(bytes);
  if (!wav.ok) return NextResponse.json({ error: wav.error }, { status: wav.status });

  try {
    await saveTurnAudio({
      capture_id: ref.value.capture,
      turn_index: ref.value.turn,
      wav: bytes,
      heard: cleanHeard(params.get("heard")),
      seconds: wav.value.seconds,
    });
    return NextResponse.json({ saved: true, seconds: wav.value.seconds });
  } catch (err) {
    console.error("[audio] write failed", err);
    return NextResponse.json({ error: "Could not keep that turn." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!configured) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 404 });
  }

  const ref = checkTurnRef(new URL(request.url).searchParams);
  if (!ref.ok) return NextResponse.json({ error: ref.error }, { status: ref.status });

  try {
    const turn = await getTurnAudio(ref.value.capture, ref.value.turn);
    if (!turn) return NextResponse.json({ error: "No audio for that turn." }, { status: 404 });

    return new NextResponse(Buffer.from(turn.wav), {
      headers: {
        "content-type": "audio/wav",
        "content-length": String(turn.wav.byteLength),
        // A turn never changes once kept, so the board can cache it for good.
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[audio] read failed", err);
    return NextResponse.json({ error: "Could not read that turn." }, { status: 500 });
  }
}
