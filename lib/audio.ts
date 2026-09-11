/**
 * The decisions behind /api/audio, kept out of the route so plain Node can test
 * them. `next/server` does not resolve outside Next, so anything worth testing
 * lives here and the route only turns answers into responses.
 */

/** About forty seconds of 24 kHz mono. Anything bigger is a mistake, not a turn. */
export const MAX_WAV_BYTES = 2_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Check<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** Which turn, from the query string. Used by both upload and playback. */
export function checkTurnRef(params: URLSearchParams): Check<{ capture: string; turn: number }> {
  const capture = params.get("capture") ?? "";
  const turn = Number(params.get("turn"));
  if (!UUID.test(capture)) return { ok: false, status: 400, error: "capture must be a uuid." };
  if (!Number.isInteger(turn) || turn < 1 || turn > 10_000) {
    return { ok: false, status: 400, error: "turn must be a whole number from 1." };
  }
  return { ok: true, value: { capture: capture.toLowerCase(), turn } };
}

/**
 * Is this really one turn of our WAV?
 *
 * We accept exactly what the browser makes: RIFF/WAVE, 16-bit PCM, mono, 24 kHz.
 * An endpoint that stores whatever it is given is an open file host with our
 * database behind it.
 */
export function checkWav(bytes: Uint8Array): Check<{ seconds: number }> {
  if (bytes.length <= 44) return { ok: false, status: 400, error: "That is not a WAV file." };
  if (bytes.length > MAX_WAV_BYTES) {
    return { ok: false, status: 413, error: "One turn is never that long." };
  }

  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...Array.from(bytes.slice(at, at + 4)));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || tag(36) !== "data") {
    return { ok: false, status: 400, error: "That is not a WAV file." };
  }
  const pcm = v.getUint16(20, true) === 1;
  const mono = v.getUint16(22, true) === 1;
  const rate = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  if (!pcm || !mono || bits !== 16 || rate !== 24000) {
    return { ok: false, status: 415, error: "Expected 16-bit mono PCM at 24 kHz." };
  }
  const dataBytes = v.getUint32(40, true);
  if (dataBytes > bytes.length - 44) {
    return { ok: false, status: 400, error: "The WAV header says more than was sent." };
  }
  return { ok: true, value: { seconds: dataBytes / 2 / rate } };
}

/** The text is for reading on the board, nothing more. Keep it short and plain. */
export function cleanHeard(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}
