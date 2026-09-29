/**
 * The tools the agent can call, and the handlers behind them.
 *
 * Only the *stated* column is ever declared here. The agent cannot write
 * observed.* or proof.*, because those are not the driver's to supply and a model
 * that can write them will eventually invent one. See docs/lastmile-spec.md §3.2.
 *
 * The tool definitions are pushed to the agent with `npm run agent:update`. They
 * live in agents/driver.json so they are in git and diffable, and this file is the
 * single source they are generated from.
 */

import {
  FAR_FROM_DROP_M,
  toolResult,
  type DeliveryEvent,
  type ManifestDrop,
  type RegionPack,
  type Observed,
  type ToolResult,
} from "./requirements.ts";
import { lookupStop, type Stop } from "./manifest.ts";
import manifestFixture from "../data/manifest.fixture.json" with { type: "json" };

const STOPS = manifestFixture.drops as Stop[];

/** A tool as the create-agent endpoint wants it. No `http` block means we run it
 *  in the browser and answer over the socket. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execution_mode?: "interactive" | "hold";
  timeout_seconds?: number;
}

const OUTCOMES = [
  "delivered_to_recipient",
  "delivered_to_third_party",
  "delivery_failed",
  "refused_by_customer",
  "rescheduled",
];

export const LOG_DELIVERY_EVENT: ToolDefinition = {
  name: "log_delivery_event",
  description:
    "Record what the driver said about this stop. Call this as soon as you have heard " +
    "anything at all, and call it again every time you learn one more fact. Send only the " +
    "fields you actually heard; never guess a value to fill the shape. The result tells you " +
    "what is still missing and what to ask next.",
  // "hold" so the agent stays quiet while we compute. It is a synchronous table
  // lookup, so there is nothing to fill a transition phrase with anyway.
  execution_mode: "hold",
  timeout_seconds: 10,
  parameters: {
    type: "object",
    properties: {
      outcome: {
        type: "string",
        enum: OUTCOMES,
        description: "What happened at the stop. Only what the driver said, never a guess.",
      },
      location: {
        type: "object",
        properties: {
          place: { type: "string", description: "The building, estate, block or landmark" },
          entrance: { type: "string", description: "The gate, lobby, buzzer, unit or door" },
          notes: { type: "string", description: "Anything else said about the location" },
        },
      },
      recipient: {
        type: "object",
        properties: {
          name: { type: "string", description: "The name of whoever took the parcel" },
          relationship: {
            type: "string",
            enum: [
              "security",
              "concierge",
              "neighbour",
              "family",
              "colleague",
              "reception",
              "other",
            ],
            description: "Who that person is to the customer",
          },
          signed: { type: "boolean" },
        },
      },
      failure_reason: {
        type: "string",
        enum: [
          "customer_absent",
          "address_incorrect",
          "access_denied",
          "customer_refused",
          "payment_shortfall",
          "unsafe_conditions",
        ],
      },
      payment: {
        type: "object",
        properties: {
          collected_amount: { type: "number", description: "How much the driver took" },
          method: { type: "string", enum: ["cash", "card", "transfer", "none"] },
        },
      },
      next_action: {
        type: "string",
        enum: [
          "reattempt_today",
          "reattempt_tomorrow",
          "return_to_hub",
          "contact_dispatcher",
        ],
      },
    },
    required: [],
  },
};

export const CLOSE_SESSION: ToolDefinition = {
  name: "close_session",
  description:
    "End the conversation. Call this only after you have read the record back to the driver, " +
    "and only when log_delivery_event has told you nothing is missing. If anything is still " +
    "missing this call is refused and you must ask for it instead.",
  execution_mode: "hold",
  timeout_seconds: 10,
  parameters: {
    type: "object",
    properties: {
      note: {
        type: "string",
        description:
          "Anything the driver said that does not belong in a field. Leave it out otherwise.",
      },
    },
    required: [],
  },
};

export const LOOKUP_MANIFEST: ToolDefinition = {
  name: "lookup_manifest",
  description:
    "Find which stop the driver means when they name it out loud — a street, a customer, an " +
    "order number, or a position on the route. Only call this if they name a DIFFERENT stop " +
    "from the one already selected on screen. The stop on screen is already correct by default. " +
    "If the result is not found, ask which one; never pick for them.",
  execution_mode: "hold",
  timeout_seconds: 10,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What the driver called the stop, in their own words.",
      },
    },
    required: ["query"],
  },
};

export const TOOLS: ToolDefinition[] = [LOOKUP_MANIFEST, LOG_DELIVERY_EVENT, CLOSE_SESSION];

/** Deep-merge one tool call into the record so far. Objects merge; everything else
 *  replaces, because a driver correcting themselves is the normal case. */
function merge(into: DeliveryEvent, patch: Record<string, unknown>): DeliveryEvent {
  const out: Record<string, unknown> = { ...into };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      out[k] = { ...((out[k] as object) ?? {}), ...(v as object) };
    } else {
      out[k] = v;
    }
  }
  return out as DeliveryEvent;
}

/**
 * One stop's worth of state.
 *
 * The agent sends fragments across several calls. This holds the record they are
 * adding up to, and answers each call with what is still missing.
 *
 * order_ref is set here from the stop selected on screen, not by the agent. A
 * mis-heard order number attaches an exception to somebody else's parcel, which is
 * the one mistake in this product that cannot be walked back. See spec §3.0.
 */
/**
 * A distance the voice can say. Round metres close by; whole kilometres past one,
 * because nobody at a gate needs "fourteen thousand eight hundred and ninety".
 */
export function spokenDistance(metres: number): string {
  if (metres < 1000) return "about " + Math.round(metres / 10) * 10 + " metres";
  const km = Math.round(metres / 1000);
  return "about " + km + (km === 1 ? " kilometre" : " kilometres");
}

export class DeliveryDraft {
  event: DeliveryEvent;
  /** Set once close_session has been accepted. The record is final after this. */
  closed = false;
  /** The distance has been mentioned. Once is information; twice is an accusation. */
  private saidFar = false;
  // Written out longhand rather than as constructor parameter properties, because
  // node --experimental-strip-types removes types without rewriting anything, and
  // a parameter property is a type annotation that has to become an assignment.
  private drop: ManifestDrop;
  private pack?: RegionPack;

  constructor(drop: ManifestDrop, pack?: RegionPack) {
    this.drop = drop;
    this.pack = pack;
    this.event = {
      order_ref: drop.order_ref,
      ...(drop.payment?.expected_amount !== undefined
        ? { payment: { expected_amount: drop.payment.expected_amount } }
        : {}),
    };
  }

  /**
   * Write the observed column.
   *
   * Called by the app, never by the agent, and it is deliberately not reachable
   * from any tool. These are facts the device supplies: when, where, and whether
   * the vehicle was stopped. The driver cannot edit them and neither can the
   * model. See spec §3.2.
   */
  observe(patch: Observed) {
    this.event = { ...this.event, observed: { ...this.event.observed, ...patch } };
  }

  /**
   * Record which driver turn is the evidence for these fields.
   *
   * Called by the app after a tool call changes them, never reachable from a tool.
   * A later turn that corrects a field replaces its citation, because the
   * correction is what the dispatcher needs to hear. Spec §3.4.
   */
  cite(fields: readonly string[], turn: number) {
    if (!fields.length) return;
    const refs = { ...(this.event.audio_ref ?? {}) };
    for (const f of fields) refs[f] = turn;
    this.event = { ...this.event, audio_ref: refs };
  }

  /** Has the driver said anything about this stop yet? Once they have, the order
   *  this record belongs to stops being negotiable. */
  get started(): boolean {
    return Boolean(
      this.event.outcome ||
        this.event.location ||
        this.event.recipient ||
        this.event.failure_reason ||
        this.event.next_action ||
        this.event.payment?.collected_amount !== undefined,
    );
  }

  /** Apply a log_delivery_event call and produce the reply the agent gets back. */
  apply(args: Record<string, unknown>): ToolResult {
    // order_ref is ours. If the model sends one, drop it on the floor.
    const {
      order_ref: _ignored,
      observed: _obs,
      proof: _proof,
      audio_ref: _audio,
      ...stated
    } = args;
    this.event = merge(this.event, stated);
    const result = toolResult(this.event, this.drop, this.pack);

    // The phone thinks the driver is nowhere near the address on the manifest.
    // Worth saying out loud once, because the usual cause is a wrong address in
    // the system and the driver is the only person who can tell us. It is never
    // a challenge to their account, and it never holds the record up.
    //
    // A statement, not a question. It used to ask "note this?", which added a
    // turn to every far-away report and meant a driver who said everything at
    // once was still asked something. The distance is already in the observed
    // column; the driver only needs to hear it, and can correct it if they like.
    //
    // Kilometres past one, because "14890 metres" came out of the voice as
    // "fourteen, eight, nine, zero metres".
    const far = this.event.observed?.gps_delta_m;
    if (!this.saidFar && typeof far === "number" && far > FAR_FROM_DROP_M) {
      this.saidFar = true;
      result.instruction =
        // The sentence is given word for word, spoken to the driver. Described in
        // the third person, the agent read it out that way: "the phone puts them".
        'Say this once, as a statement and not a question: "The phone puts you ' +
        spokenDistance(far) + ' from the address. I have noted that." ' +
        "If they say the address is wrong, put what they say in location.notes. " +
        "Do not argue, do not ask about it, and do not mention it again. Then: " +
        result.instruction;
    }
    return result;
  }

  /**
   * Answer close_session.
   *
   * Refused while anything is still missing. An agent that closes early leaves a
   * half-written record and a driver who thinks they are finished, and there is no
   * second chance to ask — they have already driven off. The same table that
   * decides the questions decides when there are none left.
   */
  close(args: Record<string, unknown>): CloseResult {
    const state = toolResult(this.event, this.drop, this.pack);
    if (!state.complete) {
      return {
        closed: false,
        missing: state.missing,
        instruction:
          "Not yet. " + state.instruction + " Do not call close_session again until it is answered.",
      };
    }

    const note = typeof args.note === "string" ? args.note.trim() : "";
    if (note) this.event = merge(this.event, { location: { notes: note } });
    this.closed = true;

    return {
      closed: true,
      missing: [],
      instruction: "Recorded. Say nothing further.",
    };
  }
}

export interface CloseResult {
  closed: boolean;
  missing: ToolResult["missing"];
  instruction: string;
}

/**
 * Route a tool call by name.
 *
 * An unknown name is answered rather than thrown. A tool call that never gets a
 * result leaves the agent waiting on a socket we are paying for by the second.
 */
export function handleTool(
  draft: DeliveryDraft,
  name: string,
  args: Record<string, unknown>,
  onStopChange?: (stop: Stop) => void,
  regionId?: string,
): unknown {
  switch (name) {
    case "lookup_manifest": {
      // Refuse to move once the driver has said anything about this stop. Rewriting
      // which parcel a half-finished account belongs to is the worst outcome here,
      // and it is far more likely to be a mis-heard word than a real correction.
      if (draft.started) {
        return {
          found: false,
          instruction:
            "This report has already begun for " +
            draft.event.order_ref +
            ". Ask the driver to finish it, then tap the other stop on screen.",
        };
      }
      // Only this region's stops. The socket is open to this region's agent, with
      // this region's keyterms, so a stop in another country is not reachable from
      // here — the driver switches region on screen, not by voice.
      const pool = regionId ? STOPS.filter((s) => s.region === regionId) : STOPS;
      const result = lookupStop(String(args.query ?? ""), pool);
      if (result.found) {
        onStopChange?.(result.stop);
        return {
          found: true,
          order_ref: result.stop.order_ref,
          instruction: "Say this back before anything else: " + result.confirm,
        };
      }
      return {
        found: false,
        candidates: result.candidates.map((c) => c.address),
        instruction: result.instruction,
      };
    }
    case "log_delivery_event":
      return draft.apply(args);
    case "close_session":
      return draft.close(args);
    default:
      return { error: "There is no tool called " + name + "." };
  }
}
