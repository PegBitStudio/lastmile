/**
 * Finding an order from what the driver called it.
 *
 * This is a convenience, not the mechanism. The order is chosen by tapping it on
 * screen — drivers reorder stops, double back, and carry several parcels at once,
 * and attributing an exception to the wrong parcel destroys trust faster than a
 * mis-heard street name ever will. See spec §3.0.
 *
 * So the rule here is: be sure, or say you are not. A wrong confident answer is
 * worse than no answer, and every match is read back before anything is written.
 */

export interface Stop {
  order_ref: string;
  seq: number;
  address: string;
  recipient_name: string;
  place?: string;
  region?: string;
}

export type Lookup =
  | { found: true; stop: Stop; confirm: string }
  | { found: false; candidates: Stop[]; instruction: string };

/**
 * Spoken positions in the route.
 *
 * "one" is deliberately absent. It is a pronoun far more often than a number —
 * "that one", "the one for Ayesha" — and treating it as a position sent every
 * vague sentence to the first stop on the route. That is exactly the silent wrong
 * answer this file exists to avoid.
 */
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
  two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/** Words too common to identify anything. "The Lekki drop" is about Lekki. */
const NOISE = new Set([
  "the", "a", "an", "one", "drop", "stop", "order", "parcel", "package",
  "delivery", "for", "at", "on", "in", "to", "of", "and", "my", "next", "last",
  "that", "this", "it", "was", "is", "number", "no",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Everything about a stop that a driver might say out loud. */
function haystack(stop: Stop): string[] {
  return words(
    [stop.order_ref, stop.address, stop.recipient_name, stop.place ?? ""].join(" "),
  );
}

/**
 * Score one stop against what was said.
 *
 * Only meaningful words count. An order reference matched in full is worth more
 * than any number of address words, because it is the one thing a driver reads off
 * a label rather than remembers.
 */
function score(stop: Stop, said: string[]): number {
  const hay = haystack(stop);
  const ref = stop.order_ref.toLowerCase();
  let points = 0;

  for (const w of said) {
    if (NOISE.has(w)) continue;
    if (w === ref || ref.replace(/-/g, "") === w.replace(/-/g, "")) {
      points += 10;
      continue;
    }
    // The numeric half of a reference: "forty four twelve" is not this, but
    // "4412" is, and drivers do read those out.
    if (w.length >= 3 && ref.includes(w)) {
      points += 4;
      continue;
    }
    if (hay.includes(w)) points += 2;
  }

  return points;
}

/**
 * Resolve a spoken phrase to one stop.
 *
 * Returns found:false with candidates whenever there is any doubt, so the agent
 * asks rather than guesses. Ambiguity is a normal answer here, not a failure.
 */
export function lookupStop(query: string, stops: Stop[]): Lookup {
  const said = words(query ?? "");

  if (said.length === 0) {
    return {
      found: false,
      candidates: [],
      instruction: "Nothing to search for. Ask the driver which stop they mean.",
    };
  }

  // "The third one." A shortcut, and only trusted when nothing else was said that
  // could point somewhere different.
  for (const w of said) {
    const n = ORDINALS[w] ?? (/^\d+$/.test(w) ? Number(w) : undefined);
    if (n === undefined) continue;
    const bySeq = stops.find((s) => s.seq === n);
    // A bare number could equally be part of a house number or a reference. Only
    // take it as an ordinal when the rest of the sentence points nowhere else.
    if (bySeq && stops.every((s) => score(s, said) === 0)) {
      return { found: true, stop: bySeq, confirm: confirmLine(bySeq) };
    }
  }

  const ranked = stops
    .map((stop) => ({ stop, points: score(stop, said) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points);

  if (ranked.length === 0) {
    return {
      found: false,
      candidates: [],
      instruction:
        "No stop on today's route matches that. Ask the driver to read the order number, " +
        "or tell them to tap the stop on screen.",
    };
  }

  // A clear winner is one that beats the runner-up outright. Two stops on the same
  // street are exactly the case this protects against.
  const [best, second] = ranked;
  if (!second || best.points > second.points) {
    return { found: true, stop: best.stop, confirm: confirmLine(best.stop) };
  }

  const tied = ranked.filter((r) => r.points === best.points).map((r) => r.stop);
  return {
    found: false,
    candidates: tied,
    instruction:
      "More than one stop matches. Ask which one: " +
      tied.map((s) => s.address).join(", or ") +
      ".",
  };
}

/** The line the agent says back before anything is written to that order. */
function confirmLine(stop: Stop): string {
  return stop.address + ", for " + stop.recipient_name + ".";
}
