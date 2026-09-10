/**
 * The conditional-requirements table.
 *
 * This is the product. The base schema hard-requires only order_ref and outcome;
 * everything else is required *conditionally*, and this file is where that lives.
 *
 * Why it is code and not prompt text: after every partial tool call we compute what
 * is still missing and hand that list back to the agent. The model decides *how* to
 * ask. This table decides *what* is still missing. Prompts drift between runs. A
 * table does not, and that is the reliability claim in the writeup.
 *
 * See docs/lastmile-spec.md section 3.1.
 */

export type Outcome =
  | "delivered_to_recipient"
  | "delivered_to_third_party"
  | "delivery_failed"
  | "refused_by_customer"
  | "rescheduled";

export type Relationship =
  | "security"
  | "concierge"
  | "neighbour"
  | "family"
  | "colleague"
  | "reception"
  | "other";

export type FailureReason =
  | "customer_absent"
  | "address_incorrect"
  | "access_denied"
  | "customer_refused"
  | "payment_shortfall"
  | "unsafe_conditions";

export type NextAction =
  | "reattempt_today"
  | "reattempt_tomorrow"
  | "return_to_hub"
  | "contact_dispatcher";

export type PaymentMethod = "cash" | "card" | "transfer" | "none";

/** The machine-observed column. Written by the app from the device, never by the
 *  agent and never by the driver. The follow-up table never asks about any of it. */
export interface Observed {
  occurred_at?: string;
  coords?: { lat: number; lng: number };
  gps_delta_m?: number;
  stationary?: "yes" | "no" | "unknown";
  scan_ref?: string;
}

/** Recipient-supplied evidence. Declared so the model is complete; nothing in this
 *  build writes it. Saying so is better than quietly implying the audio proves
 *  something it does not. Spec §1. */
export interface Proof {
  signature_ref?: string;
  photo_ref?: string;
  otp_verified?: boolean;
}

/** A partial delivery event. Every field is optional: the whole point is that we are
 *  working out what is not here yet. Shape matches lib/delivery-event.schema.json. */
export interface DeliveryEvent {
  order_ref?: string;
  outcome?: Outcome;
  location?: { place?: string; entrance?: string; notes?: string };
  recipient?: { name?: string; relationship?: Relationship; signed?: boolean };
  failure_reason?: FailureReason;
  payment?: {
    expected_amount?: number;
    collected_amount?: number;
    currency?: string;
    method?: PaymentMethod;
  };
  next_action?: NextAction;
  observed?: Observed;
  proof?: Proof;
}

/** One drop from data/manifest.fixture.json. Only the parts this table reads. */
export interface ManifestDrop {
  order_ref: string;
  region?: string;
  cash_on_delivery?: boolean;
  payment?: { expected_amount?: number; currency?: string };
}

/** The parts of a region pack this table reads. It supplies the words, never the rules. */
export interface RegionPack {
  vocabulary?: { place?: string; entrance?: string };
}

export interface MissingField {
  /** Dotted path into the event, e.g. "recipient.name". */
  path: string;
  /** What to call it when asking. Region packs change this; they never change the rule. */
  label: string;
  /** The allowed values, where the schema constrains them. */
  options?: readonly string[];
  /** Set when the table already knows the answer and only needs it recorded. */
  expect?: string;
  /** Why this is being asked. For the board and for debugging, not for the driver. */
  because: string;
}

/** What each outcome requires on top of the base two. Spec section 3.1. */
const BY_OUTCOME: Record<Outcome, readonly string[]> = {
  delivered_to_recipient: ["recipient.name"],
  delivered_to_third_party: ["recipient.name", "recipient.relationship", "location.entrance"],
  delivery_failed: ["failure_reason", "next_action"],
  refused_by_customer: ["failure_reason", "next_action"],
  rescheduled: ["next_action"],
};

const OPTIONS: Record<string, readonly string[]> = {
  outcome: [
    "delivered_to_recipient",
    "delivered_to_third_party",
    "delivery_failed",
    "refused_by_customer",
    "rescheduled",
  ],
  "recipient.relationship": [
    "security",
    "concierge",
    "neighbour",
    "family",
    "colleague",
    "reception",
    "other",
  ],
  failure_reason: [
    "customer_absent",
    "address_incorrect",
    "access_denied",
    "customer_refused",
    "payment_shortfall",
    "unsafe_conditions",
  ],
  next_action: ["reattempt_today", "reattempt_tomorrow", "return_to_hub", "contact_dispatcher"],
  "payment.method": ["cash", "card", "transfer", "none"],
};

/** Default wording. A region pack overrides place and entrance, and nothing else. */
const LABELS: Record<string, string> = {
  order_ref: "which order",
  outcome: "what happened",
  "location.place": "the building or estate",
  "location.entrance": "the entrance",
  "recipient.name": "the name of the person who took it",
  "recipient.relationship": "who that person is",
  failure_reason: "why it did not go through",
  next_action: "what should happen next",
  "payment.collected_amount": "how much was collected",
  "payment.method": "how they paid",
};

/** Read a dotted path. Returns undefined for a missing branch rather than throwing. */
function at(event: DeliveryEvent, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      event,
    );
}

/**
 * Is this field already answered?
 *
 * An empty string is not an answer. Zero is — "collected nothing" is a real reply to
 * how much was collected, and treating it as missing would ask the same question
 * for ever.
 */
export function isAnswered(event: DeliveryEvent, path: string): boolean {
  const v = at(event, path);
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v);
  return true;
}

function label(path: string, pack?: RegionPack): string {
  if (path === "location.place" && pack?.vocabulary?.place) {
    return "the " + pack.vocabulary.place;
  }
  if (path === "location.entrance" && pack?.vocabulary?.entrance) {
    return "the " + pack.vocabulary.entrance;
  }
  return LABELS[path] ?? path;
}

function field(path: string, because: string, pack?: RegionPack): MissingField {
  const m: MissingField = { path, label: label(path, pack), because };
  if (OPTIONS[path]) m.options = OPTIONS[path];
  return m;
}

/**
 * Everything the record still needs, in the order it should be asked for.
 *
 * The order matters. outcome comes first because it decides most of the rest, and
 * asking the wrong follow-up and then throwing the answer away wastes a turn of a
 * driver's time while they are standing in the street.
 */
export function missingFields(
  event: DeliveryEvent,
  drop?: ManifestDrop,
  pack?: RegionPack,
): MissingField[] {
  const out: MissingField[] = [];
  const add = (path: string, because: string) => {
    if (!isAnswered(event, path) && !out.some((m) => m.path === path)) {
      out.push(field(path, because, pack));
    }
  };

  add("order_ref", "every record needs an order");
  add("outcome", "the outcome decides what else is needed");

  // Nothing below can be worked out until we know the outcome.
  if (!event.outcome) return out;

  for (const path of BY_OUTCOME[event.outcome] ?? []) {
    add(path, "the outcome is " + event.outcome);
  }

  // Cash on delivery is a fact of the order, not of the outcome, so it is asked
  // whatever happened at the door. Money that was expected and never mentioned is
  // the most expensive silence in this record.
  if (drop?.cash_on_delivery === true) {
    add("payment.collected_amount", "the manifest marks this order cash on delivery");
    add("payment.method", "the manifest marks this order cash on delivery");
  }

  // A shortfall is something we can see for ourselves once both numbers are in. So
  // we do not ask the driver why in the abstract. We record the reason we already
  // know, and ask only for what happens next.
  const expected = drop?.payment?.expected_amount ?? event.payment?.expected_amount;
  const collected = event.payment?.collected_amount;
  if (typeof expected === "number" && typeof collected === "number" && collected < expected) {
    if (event.failure_reason !== "payment_shortfall") {
      const f = field("failure_reason", "less was collected than the order expected", pack);
      const existing = out.findIndex((m) => m.path === "failure_reason");
      if (existing >= 0) out.splice(existing, 1);
      out.push({ ...f, expect: "payment_shortfall" });
    }
    add("next_action", "less was collected than the order expected");
  }

  return out;
}

/** Is the record complete enough to read back and close? */
export function isComplete(
  event: DeliveryEvent,
  drop?: ManifestDrop,
  pack?: RegionPack,
): boolean {
  return missingFields(event, drop, pack).length === 0;
}

export interface ToolResult {
  saved: true;
  missing: MissingField[];
  complete: boolean;
  next: MissingField | null;
  instruction: string;
}

/**
 * The tool result for log_delivery_event.
 *
 * The agent gets a list and a sentence. The sentence is there because a model handed
 * only structured data will sometimes narrate the structure out loud, and "your next
 * required field is location.entrance" is not a thing any driver should hear.
 */
export function toolResult(
  event: DeliveryEvent,
  drop?: ManifestDrop,
  pack?: RegionPack,
): ToolResult {
  const missing = missingFields(event, drop, pack);
  return {
    saved: true,
    missing,
    complete: missing.length === 0,
    next: missing.length === 0 ? null : missing[0],
    instruction:
      missing.length === 0
        ? "Nothing is missing. Read the record back to the driver, then close the session."
        : "Ask about " +
          missing[0].label +
          ". Ask for that alone. Do not ask about anything else in this turn.",
  };
}
