/**
 * Transcribe one short clip with AssemblyAI's pre-recorded API, for its word scores.
 *
 * Server only: it uses the API key. The Voice Agent API heard this turn first and
 * gave text with no confidence. This hears it again and scores every word.
 *
 * The same region keyterms are passed in. Without them the second opinion would be
 * worse at local names than the first, and would flag "Thokar Niaz Baig" on every
 * Lahore record — noise, not review.
 */

import type { Word } from "./review";

const BASE = "https://api.assemblyai.com/v2";

export interface SecondOpinion {
  text: string;
  words: Word[];
}

/** How long to wait for a few seconds of audio. Well inside a serverless limit. */
const MAX_WAIT_MS = 25_000;

export async function secondOpinion(
  wav: Uint8Array,
  apiKey: string,
  keyterms: string[] = [],
): Promise<SecondOpinion> {
  const auth = { authorization: apiKey };

  const upload = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/octet-stream" },
    body: Buffer.from(wav),
  });
  if (!upload.ok) throw new Error("upload failed: HTTP " + upload.status);
  const { upload_url } = (await upload.json()) as { upload_url: string };

  const payload: Record<string, unknown> = {
    audio_url: upload_url,
    speech_models: ["universal-3-5-pro", "universal-2"],
    prompt: "A delivery driver describing a stop: names, buildings, entrances, amounts.",
  };
  if (keyterms.length) payload.keyterms_prompt = keyterms.slice(0, 100);

  const created = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!created.ok) {
    throw new Error("transcript request failed: HTTP " + created.status + " " + (await created.text()));
  }
  const { id } = (await created.json()) as { id: string };

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/transcript/${id}`, { headers: auth });
    if (!res.ok) throw new Error("poll failed: HTTP " + res.status);
    const body = (await res.json()) as {
      status: string;
      text?: string;
      error?: string;
      words?: { text: string; confidence: number }[];
    };
    if (body.status === "completed") {
      return {
        text: body.text ?? "",
        words: (body.words ?? []).map((w) => ({ text: w.text, confidence: w.confidence })),
      };
    }
    if (body.status === "error") throw new Error(body.error ?? "transcription failed");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("transcription took longer than " + MAX_WAIT_MS / 1000 + " seconds");
}
