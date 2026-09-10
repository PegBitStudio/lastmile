/**
 * The safety gate: how fast is the vehicle moving, and may a session open?
 *
 * The rule is in docs/lastmile-spec.md §1.1 and it is a hard one. The agent does
 * not start a conversation with a moving driver. A multi-turn dialogue at the wheel
 * is a liability whether or not hands are involved, and no fleet safety officer
 * would sign it off.
 *
 * The awkward part is that GeolocationCoordinates.speed is null on a great many
 * devices, laptops especially. Handled carelessly that either blocks everything or
 * quietly does nothing. So there are three states here, not two, and "unknown" is a
 * real answer that gets written into the record.
 *
 * This file is pure arithmetic so it can be tested without a browser.
 */

/** Above this we do not open a session. 5 km/h — walking pace. Spec §1.1. */
export const MOVING_THRESHOLD_MPS = 5 / 3.6;

export type GateState = "stopped" | "moving" | "unknown";

/** What goes into observed.stationary. Three values, and unknown is honest. */
export type Stationary = "yes" | "no" | "unknown";

export interface Fix {
  lat: number;
  lng: number;
  /** Metres per second, straight from the device. Null on most laptops. */
  speed?: number | null;
  /** Milliseconds. */
  at: number;
  /** Metres of horizontal error the device claims. */
  accuracy?: number | null;
}

/**
 * Great-circle distance in metres.
 *
 * Earth as a sphere is wrong by about 0.3%, which at the distances that matter
 * here is a few centimetres. The device's own accuracy is tens of metres.
 */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Work out speed from two fixes, for devices that will not report it.
 *
 * Returns null rather than a number we do not believe. Two fixes close together in
 * time are mostly GPS jitter: a phone sitting still on a dashboard wanders by tens
 * of metres, and dividing that by half a second invents a speeding van.
 */
export function speedBetween(a: Fix, b: Fix): number | null {
  const seconds = (b.at - a.at) / 1000;
  if (!Number.isFinite(seconds) || seconds < 1) return null;

  const metres = metresBetween(a, b);

  // Movement smaller than the error bars is not movement.
  const noise = Math.max(a.accuracy ?? 0, b.accuracy ?? 0);
  if (noise > 0 && metres < noise) return 0;

  return metres / seconds;
}

/**
 * The current speed, in metres per second, or null if we genuinely cannot tell.
 *
 * The device is asked first. Only when it will not answer do we work it out from
 * the last two fixes.
 */
export function currentSpeed(latest: Fix, previous?: Fix): number | null {
  if (typeof latest.speed === "number" && Number.isFinite(latest.speed) && latest.speed >= 0) {
    return latest.speed;
  }
  if (previous) return speedBetween(previous, latest);
  return null;
}

/** Turn a speed into a decision. Null means we could not tell, not that it is zero. */
export function gateState(speedMps: number | null): GateState {
  if (speedMps === null) return "unknown";
  return speedMps > MOVING_THRESHOLD_MPS ? "moving" : "stopped";
}

/**
 * May a session open?
 *
 * Unknown allows. Blocking on unknown would make the product unusable on every
 * device that cannot report speed, and would make the demo impossible to film. An
 * honest "unknown" in the record beats a false "stationary" or a dead app.
 */
export function mayOpen(state: GateState): boolean {
  return state !== "moving";
}

/** What the record stores. Not a boolean, because two of the three are not booleans. */
export function stationaryFlag(state: GateState): Stationary {
  if (state === "stopped") return "yes";
  if (state === "moving") return "no";
  return "unknown";
}

/** What the driver reads on screen. */
export function gateMessage(state: GateState, speedMps: number | null): string {
  switch (state) {
    case "moving":
      return `Waiting until you've stopped — ${Math.round((speedMps ?? 0) * 3.6)} km/h`;
    case "stopped":
      return "Stopped. Ready when you are.";
    default:
      return "This device cannot report speed. Recorded as unknown.";
  }
}

/**
 * A forced speed for filming, in km/h, read from the query string.
 *
 * The opening beat of the video is the gate refusing and then allowing, and
 * coords.speed is null on the machine it will be filmed on. Without this there is
 * no way to shoot it from a desk.
 *
 * It works on the deployed site rather than only in development, because that is
 * where the video is filmed. That is safe only because the screen says loudly that
 * the number is simulated — see the driver page. A hidden override would be a way
 * of writing "stationary: yes" onto a moving van.
 */
export function overrideSpeed(search: string): number | null {
  const raw = new URLSearchParams(search).get("speed");
  if (raw === null) return null;
  const kmh = Number(raw);
  if (!Number.isFinite(kmh) || kmh < 0) return null;
  return kmh / 3.6;
}
