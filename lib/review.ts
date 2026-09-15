/**
 * "Needs review": a second opinion on the words the record depends on.
 *
 * The Voice Agent API returns what it heard as plain text, with no confidence
 * attached. So a name the agent wrote down with total conviction and a name it
 * half-guessed through traffic noise look identical in the record.
 *
 * The fix is a second model. The driver's cited turn is already kept as a WAV, so
 * it is sent once more to AssemblyAI's pre-recorded transcription, which scores
 * every word. Then, field by field: do the words the agent wrote appear in that
 * transcript, and how sure was it of them?
 *
 * A field is flagged when its words score low, or when they are not there at all.
 * Flagged is not rejected. The record still reaches the board at once; it is marked
 * so a dispatcher listens to two seconds of audio before trusting it. Spec §3.3.
 *
 * Pure functions only. The network call lives in the route.
 */

/** Below this, a word is not trusted. A first guess; tune it against real clips. */
export const REVIEW_THRESHOLD = 0.6;

/**
 * The fields worth a second opinion.
 *
 * Free text the driver said out loud, where one misheard letter makes the record
 * wrong. Enums like outcome are left out: "left it with the concierge" never
 * contains the literal word "delivered_to_third_party", so there is nothing in a
 * transcript to check them against — the model's reading of the sentence is the
 * only evidence there is.
 */
export const REVIEWED_FIELDS = [
  "recipient.name",
  "location.place",
  "location.entrance",
  "location.notes",
  "payment.collected_amount",
] as const;

export type ReviewedField = (typeof REVIEWED_FIELDS)[number];

export interface Word {
  text: string;
  confidence: number;
}

export interface FieldReview {
  path: string;
  value: string;
  /** Lowest confidence among the value's words, or null when they were not found. */
  confidence: number | null;
  /** Did every word of the value turn up in the second transcript? */
  found: boolean;
  flagged: boolean;
  /** Why, in words a dispatcher reads without a manual. */
  reason: string;
}

export function isReviewed(path: string): path is ReviewedField {
  return (REVIEWED_FIELDS as readonly string[]).includes(path);
}

/** Lowercase, strip punctuation, and join digits split by commas: "18,500" is 18500. */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Words that carry no identity. "The side gate" is checked on "side" and "gate". */
const FILLER = new Set(["the", "a", "an", "at", "of", "to", "in", "on", "by", "and", "with"]);

/** Edit distance, capped: we only ever care whether it is 0, 1, or more. */
function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  // One substitution, insertion or deletion, and only on words long enough that a
  // one-letter slip is a spelling variant rather than a different word.
  if (Math.min(a.length, b.length) < 4) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Review one field against the words of the second transcript.
 *
 * Each meaningful token of the value is looked up among the words. An exact match
 * counts at its confidence. A near match ("Marcos" for "Marcus") counts too, but at
 * a discount — two models disagreeing on a spelling is itself a reason to look.
 */
export function reviewField(
  path: string,
  value: unknown,
  words: Word[],
  threshold = REVIEW_THRESHOLD,
): FieldReview {
  const text = value === undefined || value === null ? "" : String(value);
  const wanted = tokens(text).filter((t) => !FILLER.has(t));
  const heard = words.map((w) => ({ t: tokens(w.text).join(""), c: w.confidence }));

  if (wanted.length === 0) {
    return { path, value: text, confidence: null, found: false, flagged: false, reason: "" };
  }

  let lowest = 1;
  let missing = 0;
  let respelled = false;

  for (const want of wanted) {
    const exact = heard.filter((h) => h.t === want);
    if (exact.length) {
      lowest = Math.min(lowest, Math.max(...exact.map((h) => h.c)));
      continue;
    }
    const close = heard.filter((h) => near(h.t, want));
    if (close.length) {
      respelled = true;
      // Halved: the words exist, but the two models do not agree how.
      lowest = Math.min(lowest, Math.max(...close.map((h) => h.c)) * 0.5);
      continue;
    }
    missing++;
  }

  if (missing === wanted.length) {
    return {
      path,
      value: text,
      confidence: null,
      found: false,
      flagged: true,
      reason: "not heard in the recording",
    };
  }

  const confidence = Math.round(lowest * 100) / 100;
  const found = missing === 0;
  const flagged = !found || confidence < threshold;

  let reason = "";
  if (!found) reason = "only partly heard in the recording";
  else if (respelled && flagged) reason = "heard with a different spelling";
  else if (flagged) reason = "unclear in the recording";

  return { path, value: text, confidence, found, flagged, reason };
}

/** Review every reviewable field in a set. Anything else is ignored. */
export function reviewFields(fields: Record<string, unknown>, words: Word[]): FieldReview[] {
  return Object.entries(fields)
    .filter(([path]) => isReviewed(path))
    .map(([path, value]) => reviewField(path, value, words));
}

/** Pull the cited fields' values out of a record by dotted path. */
export function valuesAt(event: Record<string, unknown>, paths: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const v = path
      .split(".")
      .reduce<unknown>(
        (node, key) =>
          node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
        event,
      );
    if (v !== undefined && v !== null && v !== "") out[path] = v;
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewRequest = {
  capture: string;
  turn: number;
  region: string;
  fields: Record<string, string>;
};

/**
 * Is this a review worth paying for?
 *
 * Each one costs a real transcription, so the route refuses anything that is not
 * a known capture, a sane turn, and at least one field that can actually be
 * checked. A request with only enum fields would buy a transcript and use none of it.
 */
export function checkReviewRequest(
  body: unknown,
): { ok: true; value: ReviewRequest } | { ok: false; status: number; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const capture = String(b.capture ?? "");
  const turn = Number(b.turn);
  const region = String(b.region ?? "");

  if (!UUID.test(capture)) return { ok: false, status: 400, error: "capture must be a uuid." };
  if (!Number.isInteger(turn) || turn < 1 || turn > 10_000) {
    return { ok: false, status: 400, error: "turn must be a whole number from 1." };
  }
  if (!/^[a-z]{2}-[a-z-]+$/.test(region)) {
    return { ok: false, status: 400, error: "region must be a pack id." };
  }

  const raw = b.fields && typeof b.fields === "object" && !Array.isArray(b.fields)
    ? (b.fields as Record<string, unknown>)
    : {};
  const fields: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (!isReviewed(path)) continue;
    if (value === null || value === undefined) continue;
    const text = String(value).slice(0, 200).trim();
    if (text) fields[path] = text;
  }
  if (Object.keys(fields).length === 0) {
    return { ok: false, status: 400, error: "No field here can be checked against audio." };
  }

  return { ok: true, value: { capture: capture.toLowerCase(), turn, region, fields } };
}
