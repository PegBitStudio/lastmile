/**
 * Tests for finding an order from what the driver called it.
 *
 * The cases that matter are the ones where it should refuse. Attributing an
 * exception to the wrong parcel is the mistake this product cannot walk back, so a
 * confident wrong answer is worse here than no answer at all.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { lookupStop, type Stop } from "./manifest.ts";
import manifest from "../data/manifest.fixture.json" with { type: "json" };

const STOPS = manifest.drops as Stop[];

/** Two stops on the same street, which is the case that must not resolve. */
const TWINS: Stop[] = [
  { order_ref: "X-1", seq: 1, address: "12 Camden Road", recipient_name: "Ada" },
  { order_ref: "X-2", seq: 2, address: "40 Camden Road", recipient_name: "Ben" },
];

test("an order number resolves", () => {
  const r = lookupStop("LG-4412", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.equal(r.stop.order_ref, "LG-4412");
});

test("a place name resolves", () => {
  const r = lookupStop("the Parkview Estate drop", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.equal(r.stop.order_ref, "LG-4413");
});

test("a Lahore place name resolves too", () => {
  const r = lookupStop("Johar Town", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.equal(r.stop.order_ref, "LH-7703");
});

test("the customer's name resolves", () => {
  const r = lookupStop("the one for Ayesha", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.equal(r.stop.order_ref, "LH-7702");
});

test("an ordinal resolves when nothing else points elsewhere", () => {
  const r = lookupStop("the third one", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.equal(r.stop.seq, 3);
});

test("two stops on the same street are refused, not guessed", () => {
  const r = lookupStop("the Camden drop", TWINS);
  assert.equal(r.found, false);
  if (r.found) return;
  assert.equal(r.candidates.length, 2);
  assert.match(r.instruction, /More than one stop matches/);
});

test("a street nobody is delivering to is refused", () => {
  const r = lookupStop("the Baker Street one", STOPS);
  assert.equal(r.found, false);
  if (r.found) return;
  assert.match(r.instruction, /read the order number|tap the stop/);
});

test("an empty query is refused rather than matching the first stop", () => {
  const r = lookupStop("", STOPS);
  assert.equal(r.found, false);
});

test("filler words alone match nothing", () => {
  const r = lookupStop("the drop, you know, that one", STOPS);
  assert.equal(r.found, false);
});

test("a named place stops a bare number being taken as a position", () => {
  // "Number three" alone would be seq 3, Osapa London. But Gulberg was also said,
  // and that points somewhere else entirely, so the position is not trusted.
  // Two stops are in Gulberg, so the honest answer is to ask which.
  const r = lookupStop("number three, the Gulberg one", STOPS);
  assert.equal(r.found, false);
  if (r.found) return;
  assert.equal(r.candidates.length, 2);
  assert.ok(r.candidates.every((c) => c.address.includes("Gulberg")));
});

test("\"one\" is a pronoun, not the first stop", () => {
  // The bug this caught: "that one" and "the one for X" both resolved to stop 1.
  assert.equal(lookupStop("that one", STOPS).found, false);
  assert.equal(lookupStop("the Baker Street one", STOPS).found, false);

  const r = lookupStop("the one for Ayesha", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.equal(r.stop.recipient_name, "Ayesha Siddiqui");
});

test("a match is given as a line to read back, not just an id", () => {
  const r = lookupStop("LH-7701", STOPS);
  assert.equal(r.found, true);
  if (!r.found) return;
  assert.match(r.confirm, /DHA Phase 5/);
  assert.match(r.confirm, /Bilal Ahmed/);
});

test("every stop on the route can be found by its own address", () => {
  for (const stop of STOPS) {
    const r = lookupStop(stop.address, STOPS);
    assert.equal(r.found, true, stop.address + " did not resolve");
    if (!r.found) continue;
    assert.equal(r.stop.order_ref, stop.order_ref, "wrong stop for " + stop.address);
  }
});

test("every stop can be found by its order number", () => {
  for (const stop of STOPS) {
    const r = lookupStop(stop.order_ref, STOPS);
    assert.equal(r.found, true, stop.order_ref + " did not resolve");
    if (!r.found) continue;
    assert.equal(r.stop.order_ref, stop.order_ref);
  }
});
