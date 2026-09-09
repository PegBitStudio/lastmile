/**
 * Tests for the conditional-requirements table.
 *
 * Run: npm test
 *
 * These are worth having because the table is the one piece of this project that
 * has to behave the same way every single run. The agent is allowed to be creative
 * about wording. It is not allowed to be creative about what a record needs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isAnswered,
  isComplete,
  missingFields,
  toolResult,
  type DeliveryEvent,
  type ManifestDrop,
} from "./requirements.ts";

const plain: ManifestDrop = { order_ref: "LG-4412" };
const cod: ManifestDrop = {
  order_ref: "LG-4413",
  cash_on_delivery: true,
  payment: { expected_amount: 18500, currency: "NGN" },
};

const paths = (e: DeliveryEvent, d?: ManifestDrop) => missingFields(e, d).map((m) => m.path);

test("an empty event asks for the order and the outcome, and stops there", () => {
  assert.deepEqual(paths({}), ["order_ref", "outcome"]);
});

test("without an outcome it does not guess at follow-ups", () => {
  assert.deepEqual(paths({ order_ref: "LG-4412" }), ["outcome"]);
});

test("delivered to the customer needs only their name", () => {
  assert.deepEqual(
    paths({ order_ref: "LG-4412", outcome: "delivered_to_recipient" }, plain),
    ["recipient.name"],
  );
});

test("left with a third party needs the name, who they are, and the entrance", () => {
  assert.deepEqual(
    paths({ order_ref: "LG-4412", outcome: "delivered_to_third_party" }, plain),
    ["recipient.name", "recipient.relationship", "location.entrance"],
  );
});

test("this is the whole demo: one sentence fills three fields and only one hole is left", () => {
  // "Third one, customer wasn't in, left it with the concierge at the side entrance."
  const spoken: DeliveryEvent = {
    order_ref: "LG-4412",
    outcome: "delivered_to_third_party",
    recipient: { relationship: "concierge" },
    location: { entrance: "side entrance" },
  };
  assert.deepEqual(paths(spoken, plain), ["recipient.name"]);
  assert.equal(toolResult(spoken, plain).next?.path, "recipient.name");
});

test("a field already volunteered is never asked for again", () => {
  const e: DeliveryEvent = {
    order_ref: "LG-4412",
    outcome: "delivery_failed",
    failure_reason: "access_denied",
  };
  assert.deepEqual(paths(e, plain), ["next_action"]);
});

test("a failed delivery needs a reason and a next step", () => {
  assert.deepEqual(paths({ order_ref: "LG-4412", outcome: "delivery_failed" }, plain), [
    "failure_reason",
    "next_action",
  ]);
});

test("a reschedule needs only a next step", () => {
  assert.deepEqual(paths({ order_ref: "LG-4412", outcome: "rescheduled" }, plain), [
    "next_action",
  ]);
});

test("cash on delivery is asked whatever happened at the door", () => {
  assert.deepEqual(paths({ order_ref: "LG-4413", outcome: "delivered_to_recipient" }, cod), [
    "recipient.name",
    "payment.collected_amount",
    "payment.method",
  ]);
});

test("a non-cash order never asks about money", () => {
  const e: DeliveryEvent = {
    order_ref: "LG-4412",
    outcome: "delivered_to_recipient",
    recipient: { name: "Chidi" },
  };
  assert.deepEqual(paths(e, plain), []);
});

test("collecting zero is an answer, not a silence", () => {
  const e: DeliveryEvent = {
    order_ref: "LG-4413",
    outcome: "delivered_to_recipient",
    recipient: { name: "Folake" },
    payment: { collected_amount: 0, method: "none" },
  };
  // Zero is recorded, so the amount is not asked again. It is short, so the table
  // fills in the reason itself and asks only what happens next.
  assert.deepEqual(paths(e, cod), ["failure_reason", "next_action"]);
  const short = missingFields(e, cod).find((m) => m.path === "failure_reason");
  assert.equal(short?.expect, "payment_shortfall");
});

test("a shortfall names its own reason instead of asking the driver", () => {
  const e: DeliveryEvent = {
    order_ref: "LG-4413",
    outcome: "delivered_to_recipient",
    recipient: { name: "Folake" },
    payment: { collected_amount: 10000, method: "cash" },
  };
  const reason = missingFields(e, cod).find((m) => m.path === "failure_reason");
  assert.equal(reason?.expect, "payment_shortfall");
  assert.ok(paths(e, cod).includes("next_action"));
});

test("paying in full asks nothing more", () => {
  const e: DeliveryEvent = {
    order_ref: "LG-4413",
    outcome: "delivered_to_recipient",
    recipient: { name: "Folake" },
    payment: { collected_amount: 18500, method: "cash" },
  };
  assert.deepEqual(paths(e, cod), []);
  assert.equal(isComplete(e, cod), true);
});

test("overpaying is not a shortfall", () => {
  const e: DeliveryEvent = {
    order_ref: "LG-4413",
    outcome: "delivered_to_recipient",
    recipient: { name: "Folake" },
    payment: { collected_amount: 20000, method: "cash" },
  };
  assert.deepEqual(paths(e, cod), []);
});

test("the region pack changes the words and not the rules", () => {
  const e: DeliveryEvent = { order_ref: "LH-7701", outcome: "delivered_to_third_party" };
  const lagos = missingFields(e, plain, { vocabulary: { entrance: "gate" } });
  const lahore = missingFields(e, plain, { vocabulary: { entrance: "gate or house number" } });

  assert.deepEqual(
    lagos.map((m) => m.path),
    lahore.map((m) => m.path),
  );
  assert.equal(lagos.find((m) => m.path === "location.entrance")?.label, "the gate");
  assert.equal(
    lahore.find((m) => m.path === "location.entrance")?.label,
    "the gate or house number",
  );
});

test("an empty string is not an answer", () => {
  assert.equal(isAnswered({ recipient: { name: "   " } }, "recipient.name"), false);
  assert.equal(isAnswered({ recipient: { name: "Marcus" } }, "recipient.name"), true);
});

test("signed false is an answer, because false is a real reply", () => {
  assert.equal(isAnswered({ recipient: { signed: false } }, "recipient.signed"), true);
});

test("a missing branch does not throw", () => {
  assert.equal(isAnswered({}, "recipient.name"), false);
  assert.equal(isAnswered({}, "payment.method"), false);
});

test("the tool result tells the agent to ask for one thing only", () => {
  const r = toolResult({ order_ref: "LG-4412", outcome: "delivered_to_third_party" }, plain);
  assert.equal(r.saved, true);
  assert.equal(r.complete, false);
  assert.match(r.instruction, /Ask for that alone/);
});

test("a complete record is told to read back and close", () => {
  const r = toolResult(
    { order_ref: "LG-4412", outcome: "rescheduled", next_action: "reattempt_tomorrow" },
    plain,
  );
  assert.equal(r.complete, true);
  assert.equal(r.next, null);
  assert.match(r.instruction, /Read the record back/);
});

test("every drop in the fixture route can reach a complete record", async () => {
  const { default: manifest } = await import("../data/manifest.fixture.json", {
    with: { type: "json" },
  });

  for (const drop of manifest.drops as ManifestDrop[]) {
    const e: DeliveryEvent = {
      order_ref: drop.order_ref,
      outcome: "delivered_to_recipient",
      recipient: { name: "Test" },
      payment: drop.cash_on_delivery
        ? { collected_amount: drop.payment?.expected_amount, method: "cash" }
        : undefined,
    };
    assert.equal(
      isComplete(e, drop),
      true,
      drop.order_ref + " still wants " + paths(e, drop).join(", "),
    );
  }
});
