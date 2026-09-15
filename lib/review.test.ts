/**
 * Tests for the "needs review" second opinion.
 *
 * The case that matters most: a name the agent wrote down confidently, which the
 * recording does not support. That is a wrong record that looks right, and it is
 * exactly what this exists to catch.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { REVIEW_THRESHOLD, reviewField, reviewFields, valuesAt, type Word } from "./review.ts";

const w = (text: string, confidence: number): Word => ({ text, confidence });

/** "Left it with Marcus at the side gate." */
const CLEAR = [
  w("Left", 0.98), w("it", 0.99), w("with", 0.97), w("Marcus", 0.94),
  w("at", 0.99), w("the", 0.99), w("side", 0.91), w("gate.", 0.95),
];

test("a clearly heard name passes", () => {
  const r = reviewField("recipient.name", "Marcus", CLEAR);
  assert.equal(r.flagged, false);
  assert.equal(r.found, true);
  assert.equal(r.confidence, 0.94);
});

test("a name heard through noise is flagged as unclear", () => {
  const noisy = [w("Left", 0.9), w("it", 0.9), w("with", 0.8), w("Marcus", 0.41)];
  const r = reviewField("recipient.name", "Marcus", noisy);
  assert.equal(r.flagged, true);
  assert.equal(r.confidence, 0.41);
  assert.equal(r.reason, "unclear in the recording");
});

test("a name the recording does not contain at all is flagged", () => {
  // The agent wrote "Chidi". The second model heard something else entirely.
  const r = reviewField("recipient.name", "Chidi", CLEAR);
  assert.equal(r.flagged, true);
  assert.equal(r.found, false);
  assert.equal(r.confidence, null);
  assert.equal(r.reason, "not heard in the recording");
});

test("a spelling the two models disagree on is flagged even if both were sure", () => {
  const r = reviewField("recipient.name", "Marcos", CLEAR);
  assert.equal(r.flagged, true);
  assert.equal(r.reason, "heard with a different spelling");
});

test("filler words do not count, so 'the side gate' is checked on side and gate", () => {
  const r = reviewField("location.entrance", "the side gate", CLEAR);
  assert.equal(r.flagged, false);
  assert.equal(r.confidence, 0.91);
});

test("a multi-word value with one word missing is flagged as partly heard", () => {
  const r = reviewField("location.entrance", "north gate", CLEAR);
  assert.equal(r.flagged, true);
  assert.equal(r.found, false);
  assert.equal(r.reason, "only partly heard in the recording");
});

test("amounts match whether or not the transcript puts a comma in", () => {
  const words = [w("collected", 0.95), w("18,500", 0.88), w("naira", 0.9)];
  const r = reviewField("payment.collected_amount", 18500, words);
  assert.equal(r.flagged, false);
  assert.equal(r.confidence, 0.88);
});

test("short words are not fuzzy-matched, so 'Ali' does not pass as 'Ala'", () => {
  const r = reviewField("recipient.name", "Ali", [w("Ala", 0.99)]);
  assert.equal(r.flagged, true);
  assert.equal(r.found, false);
});

test("an empty value is neither reviewed nor flagged", () => {
  const r = reviewField("recipient.name", "", CLEAR);
  assert.equal(r.flagged, false);
});

test("enum fields are skipped, because a transcript never contains them", () => {
  const out = reviewFields(
    { outcome: "delivered_to_third_party", "recipient.name": "Marcus" },
    CLEAR,
  );
  assert.deepEqual(out.map((r) => r.path), ["recipient.name"]);
});

test("the threshold is the line, not a rough guide", () => {
  const at = reviewField("recipient.name", "Marcus", [w("Marcus", REVIEW_THRESHOLD)]);
  const under = reviewField("recipient.name", "Marcus", [w("Marcus", REVIEW_THRESHOLD - 0.01)]);
  assert.equal(at.flagged, false);
  assert.equal(under.flagged, true);
});

test("values are pulled out of a record by path", () => {
  const event = {
    recipient: { name: "Marcus", relationship: "concierge" },
    location: { entrance: "" },
  };
  assert.deepEqual(valuesAt(event, ["recipient.name", "location.entrance", "payment.method"]), {
    "recipient.name": "Marcus",
  });
});

import { checkReviewRequest } from "./review.ts";

const CAPTURE = "11111111-2222-3333-4444-555555555555";

test("a good review request is accepted, keeping only fields that can be checked", () => {
  const r = checkReviewRequest({
    capture: CAPTURE,
    turn: 3,
    region: "pk-lahore",
    fields: { "recipient.name": "Bilal", outcome: "delivered_to_recipient" },
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value.fields, { "recipient.name": "Bilal" });
});

test("a request with nothing checkable is refused, so no transcript is bought for nothing", () => {
  const r = checkReviewRequest({
    capture: CAPTURE,
    turn: 3,
    region: "pk-lahore",
    fields: { outcome: "rescheduled" },
  });
  assert.equal(r.ok, false);
});

test("a bad capture, turn or region is refused", () => {
  const fields = { "recipient.name": "Bilal" };
  assert.equal(checkReviewRequest({ capture: "x", turn: 3, region: "pk-lahore", fields }).ok, false);
  assert.equal(checkReviewRequest({ capture: CAPTURE, turn: 0, region: "pk-lahore", fields }).ok, false);
  assert.equal(checkReviewRequest({ capture: CAPTURE, turn: 3, region: "../etc", fields }).ok, false);
});
