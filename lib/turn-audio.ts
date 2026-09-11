/**
 * The driver's own voice, one turn at a time.
 *
 * This is what lets a dispatcher click "took it: Ademola" and hear the driver say
 * it. Spec §3.4: the citation is turn-level, not word-level, and only the turns a
 * field actually cites are ever kept.
 *
 * Why turns and not one long recording. The browser's own recorder produces WebM
 * with no duration or index, and seeking into it is unreliable in Chrome. We
 * already have clean 24 kHz PCM, because that is what we send to the agent. So we
 * keep a copy of what we sent, cut it at turn boundaries, and wrap each clip as a
 * WAV. A WAV of one turn plays instantly, needs no seeking, and is a few hundred
 * kilobytes.
 *
 * Why only cited turns. A driver's microphone at a kerb hears other people,
 * traffic, and whatever else is said in the van. A turn nothing cites never leaves
 * the phone. That is a privacy rule, and it is enforced by what gets uploaded, not
 * by a promise.
 *
 * Pure. Nothing here touches the browser, so plain Node tests it.
 */

export const TURN_RATE = 24000;

/** Speech usually starts a beat before the server says it did. Keep that beat. */
export const PRE_ROLL_SECONDS = 0.6;

/** Enough for any turn a tool call will cite. A turn older than this is not coming. */
export const RING_SECONDS = 120;

/** A hard ceiling on one clip, so a stuck turn cannot become a huge upload. */
export const MAX_TURN_SECONDS = 40;

export interface Turn {
  index: number;
  /** Absolute sample positions in the stream we sent. */
  start: number;
  end: number;
  text: string;
}

/**
 * A ring buffer of the audio we sent, plus the turns cut from it.
 *
 * Positions are absolute: sample N is the Nth sample sent since the session
 * started, whatever the ring has since overwritten. That keeps a turn's start and
 * end meaningful even after the buffer has wrapped.
 */
export class TurnRecorder {
  readonly rate: number;
  private ring: Int16Array;
  private written = 0;
  private openStart: number | null = null;
  private turns: Turn[] = [];

  constructor(rate = TURN_RATE, seconds = RING_SECONDS) {
    this.rate = rate;
    this.ring = new Int16Array(Math.max(1, Math.round(rate * seconds)));
  }

  /** Samples written since the start. */
  get total() {
    return this.written;
  }

  /** The most recent turn that has ended, if any. */
  get lastTurn(): Turn | null {
    return this.turns.length ? this.turns[this.turns.length - 1] : null;
  }

  get turnCount() {
    return this.turns.length;
  }

  turn(index: number): Turn | null {
    return this.turns.find((t) => t.index === index) ?? null;
  }

  /** Append audio exactly as it was sent to the agent. */
  push(pcm: Int16Array) {
    const cap = this.ring.length;
    for (let i = 0; i < pcm.length; i++) {
      this.ring[(this.written + i) % cap] = pcm[i];
    }
    this.written += pcm.length;
  }

  /**
   * The server says the driver started speaking.
   *
   * A second start while one is already open is ignored: the turn keeps its
   * earliest start, which is the one that holds the first word.
   */
  startTurn(preRollSeconds = PRE_ROLL_SECONDS) {
    if (this.openStart !== null) return;
    this.openStart = Math.max(0, this.written - Math.round(preRollSeconds * this.rate));
  }

  /**
   * The server has the finished transcript of what was just said.
   *
   * If no start was seen — the event can be missed, or the first turn can begin
   * before we were listening for it — the turn is taken as the last few seconds,
   * rather than dropped. A citation with a little extra audio is better than a
   * field with none.
   */
  endTurn(text: string): Turn {
    const end = this.written;
    const fallback = Math.max(0, end - Math.round(6 * this.rate));
    let start = this.openStart ?? fallback;
    // Never longer than the ceiling, keeping the end, which holds the answer.
    const longest = Math.round(MAX_TURN_SECONDS * this.rate);
    if (end - start > longest) start = end - longest;

    const turn: Turn = { index: this.turns.length + 1, start, end, text: text.trim() };
    this.turns.push(turn);
    this.openStart = null;
    return turn;
  }

  /** The audio of one turn, or null if the ring has already overwritten it. */
  clip(turn: Turn): Int16Array | null {
    const cap = this.ring.length;
    if (turn.end <= turn.start) return null;
    if (turn.start < this.written - cap) return null; // gone
    const out = new Int16Array(turn.end - turn.start);
    for (let i = 0; i < out.length; i++) out[i] = this.ring[(turn.start + i) % cap];
    return out;
  }
}

/** Wrap 16-bit mono PCM as a WAV file. The header is 44 bytes and nothing more. */
export function encodeWav(pcm: Int16Array, rate = TURN_RATE): Uint8Array {
  const data = pcm.length * 2;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };

  ascii(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  v.setUint32(40, data, true);

  const out = new Int16Array(buf, 44);
  out.set(pcm);
  return new Uint8Array(buf);
}

/**
 * The stated fields as flat paths, for comparing one tool call with the last.
 *
 * Only the stated column. Observed and proof are not the driver's words, so there
 * is no turn of the driver's voice that could cite them.
 */
export const STATED_PATHS = [
  "outcome",
  "recipient.name",
  "recipient.relationship",
  "recipient.signed",
  "location.place",
  "location.entrance",
  "location.notes",
  "failure_reason",
  "next_action",
  "payment.collected_amount",
  "payment.method",
] as const;

export type StatedPath = (typeof STATED_PATHS)[number];

function at(event: unknown, path: string): unknown {
  let cur: unknown = event;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Which stated fields did this tool call set or change? Those are the ones the
 *  driver's latest turn is evidence for. */
export function changedFields(before: unknown, after: unknown): StatedPath[] {
  return STATED_PATHS.filter((p) => {
    const b = at(before, p);
    const a = at(after, p);
    return a !== undefined && a !== null && a !== "" && a !== b;
  });
}
