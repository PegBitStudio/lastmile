/**
 * Tests for the audio endpoint's decisions.
 *
 * The upload is unauthenticated on a demo deployment, so what it refuses matters as
 * much as what it accepts: anything that is not one turn of our own WAV is turned
 * away before it reaches the database.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkTurnRef, checkWav, cleanHeard, MAX_WAV_BYTES } from "./audio.ts";
import { encodeWav } from "./turn-audio.ts";

const ID = "3f2b7c1e-9a4d-4e21-8b6f-0c5d2a1e9f00";

test("a well-formed turn reference is accepted", () => {
  const r = checkTurnRef(new URLSearchParams({ capture: ID, turn: "3" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { capture: ID, turn: 3 });
});

test("a capture that is not a uuid is refused", () => {
  const r = checkTurnRef(new URLSearchParams({ capture: "../../etc", turn: "1" }));
  assert.equal(r.ok, false);
});

test("turn zero, negative, fractional or missing is refused", () => {
  for (const turn of ["0", "-1", "1.5", "", "abc"]) {
    assert.equal(checkTurnRef(new URLSearchParams({ capture: ID, turn })).ok, false, turn);
  }
});

test("our own WAV is accepted and its length is read from the header", () => {
  const wav = encodeWav(new Int16Array(24000 * 2), 24000); // two seconds
  const r = checkWav(wav);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.seconds, 2);
});

test("something that is not a WAV is refused", () => {
  const junk = new Uint8Array(1000).fill(65);
  assert.equal(checkWav(junk).ok, false);
});

test("a WAV at the wrong rate is refused", () => {
  const r = checkWav(encodeWav(new Int16Array(100), 16000));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 415);
});

test("an oversized upload is refused before anything is parsed", () => {
  const r = checkWav(new Uint8Array(MAX_WAV_BYTES + 1));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 413);
});

test("a header that claims more data than was sent is refused", () => {
  const wav = encodeWav(new Int16Array(100), 24000);
  const cut = wav.slice(0, 60);
  assert.equal(checkWav(cut).ok, false);
});

test("the heard text is flattened and capped", () => {
  assert.equal(cleanHeard("  Ademola \n took   it "), "Ademola took it");
  assert.equal(cleanHeard(null), "");
  assert.equal(cleanHeard("x".repeat(900)).length, 500);
});
