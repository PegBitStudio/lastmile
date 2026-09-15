/**
 * Tests for the tool handler.
 *
 * The table itself is tested in requirements.test.ts. What is tested here is the
 * part that stands between a language model and the record: what it is allowed to
 * write, and what happens when it sends something it should not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DeliveryDraft, handleTool, TOOLS } from "./tools.ts";
import type { ManifestDrop } from "./requirements.ts";

const plain: ManifestDrop = { order_ref: "LG-4412" };
const cod: ManifestDrop = {
  order_ref: "LG-4413",
  cash_on_delivery: true,
  payment: { expected_amount: 18500, currency: "NGN" },
};

test("a draft starts with the order taken from the selected stop", () => {
  const d = new DeliveryDraft(plain);
  assert.equal(d.event.order_ref, "LG-4412");
});

test("the agent cannot change which order this is", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ order_ref: "LG-9999", outcome: "rescheduled" });
  assert.equal(d.event.order_ref, "LG-4412");
});

test("the agent cannot write the observed or proof columns", () => {
  const d = new DeliveryDraft(plain);
  d.apply({
    outcome: "delivered_to_recipient",
    observed: { stationary: "yes", gps_delta_m: 0 },
    proof: { otp_verified: true },
  });
  assert.equal("observed" in d.event, false);
  assert.equal("proof" in d.event, false);
});

test("facts add up across calls instead of replacing each other", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ outcome: "delivered_to_third_party", recipient: { relationship: "concierge" } });
  d.apply({ location: { entrance: "side door" } });
  const r = d.apply({ recipient: { name: "Marcus" } });

  assert.equal(d.event.recipient?.relationship, "concierge");
  assert.equal(d.event.recipient?.name, "Marcus");
  assert.equal(d.event.location?.entrance, "side door");
  assert.equal(r.complete, true);
});

test("a driver correcting themselves overwrites the old value", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ recipient: { name: "Marcus" } });
  d.apply({ recipient: { name: "Marco" } });
  assert.equal(d.event.recipient?.name, "Marco");
});

test("the expected amount comes from the manifest, not from the driver", () => {
  const d = new DeliveryDraft(cod);
  assert.equal(d.event.payment?.expected_amount, 18500);
  d.apply({ payment: { collected_amount: 10000, method: "cash" } });
  assert.equal(d.event.payment?.expected_amount, 18500);
  assert.equal(d.event.payment?.collected_amount, 10000);
});

test("the demo sentence leaves exactly one question", () => {
  // "Customer wasn't in, left it with the concierge at the side entrance."
  const d = new DeliveryDraft(plain);
  const r = d.apply({
    outcome: "delivered_to_third_party",
    recipient: { relationship: "concierge" },
    location: { entrance: "side entrance" },
  });
  assert.equal(r.missing.length, 1);
  assert.equal(r.next?.path, "recipient.name");
});

test("an unknown tool is answered rather than left hanging", () => {
  const d = new DeliveryDraft(plain);
  const r = handleTool(d, "delete_everything", {}) as { error?: string };
  assert.match(r.error ?? "", /no tool called/);
});

test("the declared tool never offers the model a field it must not write", () => {
  const tool = TOOLS.find((t) => t.name === "log_delivery_event");
  assert.ok(tool);
  const props = Object.keys(
    (tool.parameters as { properties: Record<string, unknown> }).properties,
  );
  for (const banned of ["order_ref", "observed", "proof", "confidence", "audio_ref"]) {
    assert.equal(props.includes(banned), false, banned + " must not be declared");
  }
});

test("the committed agent config matches the tools in this file", async () => {
  const { default: config } = await import("../agents/driver.json", {
    with: { type: "json" },
  });
  assert.deepEqual(
    config.tools,
    JSON.parse(JSON.stringify(TOOLS)),
    "agents/driver.json is stale. Run: npm run tools:sync",
  );
});

test("close_session is refused while anything is still missing", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ outcome: "delivered_to_third_party", recipient: { relationship: "concierge" } });
  const r = d.close({});
  assert.equal(r.closed, false);
  assert.equal(d.closed, false);
  assert.ok(r.missing.length > 0);
  assert.match(r.instruction, /Not yet/);
});

test("a refused close names the field to ask for", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ outcome: "delivery_failed", failure_reason: "customer_absent" });
  const r = d.close({});
  assert.equal(r.closed, false);
  assert.deepEqual(
    r.missing.map((m) => m.path),
    ["next_action"],
  );
});

test("close_session is accepted once the record is complete", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ outcome: "rescheduled", next_action: "reattempt_tomorrow" });
  const r = d.close({});
  assert.equal(r.closed, true);
  assert.equal(d.closed, true);
});

test("a note given at close is kept, and an empty one is not", () => {
  const complete = { outcome: "rescheduled", next_action: "reattempt_tomorrow" } as const;

  const withNote = new DeliveryDraft(plain);
  withNote.apply(complete);
  withNote.close({ note: "buzzer broken" });
  assert.equal(withNote.event.location?.notes, "buzzer broken");

  const blank = new DeliveryDraft(plain);
  blank.apply(complete);
  blank.close({ note: "   " });
  assert.equal(blank.event.location?.notes, undefined);
});

test("a cash order cannot be closed without the money", () => {
  const d = new DeliveryDraft(cod);
  d.apply({ outcome: "delivered_to_recipient", recipient: { name: "Folake" } });
  assert.equal(d.close({}).closed, false);

  d.apply({ payment: { collected_amount: 18500, method: "cash" } });
  assert.equal(d.close({}).closed, true);
});

test("close_session is routed like any other tool", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ outcome: "rescheduled", next_action: "return_to_hub" });
  const r = handleTool(d, "close_session", {}) as { closed: boolean };
  assert.equal(r.closed, true);
});

test("the observed column is written by the app and left alone by the table", () => {
  const d = new DeliveryDraft(plain);
  d.observe({ stationary: "unknown", gps_delta_m: 240 });
  const r = d.apply({ outcome: "rescheduled", next_action: "return_to_hub" });

  assert.equal(d.event.observed?.stationary, "unknown");
  assert.equal(d.event.observed?.gps_delta_m, 240);
  // Nothing in observed is ever asked for. Spec 3.2.
  assert.equal(r.complete, true);
});

test("a later observation adds to the column instead of replacing it", () => {
  const d = new DeliveryDraft(plain);
  d.observe({ stationary: "yes" });
  d.observe({ coords: { lat: 6.44, lng: 3.52 } });
  assert.equal(d.event.observed?.stationary, "yes");
  assert.equal(d.event.observed?.coords?.lat, 6.44);
});

test("the agent still cannot reach observed through a tool call", () => {
  const d = new DeliveryDraft(plain);
  d.observe({ stationary: "no" });
  d.apply({ outcome: "rescheduled", observed: { stationary: "yes" } });
  assert.equal(d.event.observed?.stationary, "no");
});

test("a lookup moves the report and asks for it to be read back", () => {
  const d = new DeliveryDraft(plain);
  let moved: string | null = null;
  const r = handleTool(d, "lookup_manifest", { query: "the Johar Town drop" }, (s) => {
    moved = s.order_ref;
  }) as { found: boolean; order_ref?: string; instruction: string };

  assert.equal(r.found, true);
  assert.equal(r.order_ref, "LH-7703");
  assert.equal(moved, "LH-7703");
  assert.match(r.instruction, /Say this back/);
});

test("an unclear lookup does not move anything", () => {
  const d = new DeliveryDraft(plain);
  let moved = false;
  const r = handleTool(d, "lookup_manifest", { query: "the Gulberg one" }, () => {
    moved = true;
  }) as { found: boolean; candidates?: string[] };

  assert.equal(r.found, false);
  assert.equal(moved, false);
  assert.equal(r.candidates?.length, 2);
});

test("the order stops being negotiable once the driver has said something", () => {
  const d = new DeliveryDraft(plain);
  d.apply({ outcome: "delivery_failed" });

  let moved = false;
  const r = handleTool(d, "lookup_manifest", { query: "LH-7703" }, () => {
    moved = true;
  }) as { found: boolean; instruction: string };

  // A half-finished account must not be reattached to a different parcel. Far more
  // likely to be a mis-heard word than a real correction.
  assert.equal(r.found, false);
  assert.equal(moved, false);
  assert.match(r.instruction, /already begun/);
});

test("a fresh draft is not yet started", () => {
  assert.equal(new DeliveryDraft(plain).started, false);
  assert.equal(new DeliveryDraft(cod).started, false, "an expected amount is not the driver talking");
});

test("a lookup only searches the region the agent is serving", () => {
  const d = new DeliveryDraft(plain);
  const r = handleTool(d, "lookup_manifest", { query: "Johar Town" }, undefined, "ng-lagos") as {
    found: boolean;
  };
  assert.equal(r.found, false, "a Lahore stop must not be reachable from the Lagos agent");
  const ok = handleTool(d, "lookup_manifest", { query: "Johar Town" }, undefined, "pk-lahore") as {
    found: boolean;
  };
  assert.equal(ok.found, true);
});

test("being far from the address is mentioned once, and never blocks the record", () => {
  const d = new DeliveryDraft(plain);
  d.observe({ gps_delta_m: 640 });

  const first = d.apply({ outcome: "rescheduled" });
  assert.match(first.instruction, /640 metres from the address/);
  assert.match(first.instruction, /Do not argue/);

  // Said once. A second mention reads as an accusation.
  const second = d.apply({ next_action: "reattempt_tomorrow" });
  assert.doesNotMatch(second.instruction, /metres from the address/);

  // Advisory only: the record is complete and closes normally.
  assert.equal(second.complete, true);
  assert.equal(d.close({}).closed, true);
});

test("a normal distance is never mentioned", () => {
  const d = new DeliveryDraft(plain);
  d.observe({ gps_delta_m: 40 });
  assert.doesNotMatch(d.apply({ outcome: "rescheduled" }).instruction, /metres/);
});

test("no position at all is not treated as far away", () => {
  const d = new DeliveryDraft(plain);
  d.observe({ stationary: "unknown" });
  assert.doesNotMatch(d.apply({ outcome: "rescheduled" }).instruction, /metres/);
});
