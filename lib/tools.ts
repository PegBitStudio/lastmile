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
  toolResult,
  type DeliveryEvent,
  type ManifestDrop,
  type RegionPack,
  type ToolResult,
} from "./requirements.ts";

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

export const TOOLS: ToolDefinition[] = [LOG_DELIVERY_EVENT];

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
export class DeliveryDraft {
  event: DeliveryEvent;
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

  /** Apply a log_delivery_event call and produce the reply the agent gets back. */
  apply(args: Record<string, unknown>): ToolResult {
    // order_ref is ours. If the model sends one, drop it on the floor.
    const { order_ref: _ignored, observed: _obs, proof: _proof, ...stated } = args;
    this.event = merge(this.event, stated);
    return toolResult(this.event, this.drop, this.pack);
  }
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
): unknown {
  switch (name) {
    case "log_delivery_event":
      return draft.apply(args);
    default:
      return { error: "There is no tool called " + name + "." };
  }
}
