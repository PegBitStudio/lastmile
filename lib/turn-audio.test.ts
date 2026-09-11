/**
 * Tests for the turn recorder.
 *
 * The recorder decides what audio a dispatcher hears behind a field. The failures
 * that matter are the quiet ones: a clip cut from the wrong place, a clip that
 * silently comes back empty after the buffer wraps, and a field credited to a turn
 * that did not say it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { TurnRecorder, encodeWav, changedFields, MAX_TURN_SECONDS } from "./turn-audio.ts";

/** A block of samples that all carry one value, so a clip shows where it came from. */
function block(value: number, n: number) {
  return new Int16Array(n).fill(value);
}

test("a turn is cut from where speech started to where the transcript arrived", () => {
  const r = new TurnRecorder(10, 100); // 10 samples a second keeps the numbers small
  r.push(block(1, 50)); // five seconds of silence
  r.startTurn(0); // no pre-roll, so the start is exact
  r.push(block(7, 20)); // two seconds of the driver speaking
  const t = r.endTurn("Ademola took it");

  assert.equal(t.index, 1);
  assert.equal(t.start, 50);
  assert.equal(t.end, 70);
  const clip = r.clip(t)!;
  assert.equal(clip.length, 20);
  assert.ok(clip.every((s) => s === 7), "the clip is the speech and only the speech");
});

test("pre-roll keeps the first word that arrives before the server notices", () => {
  const r = new TurnRecorder(10, 100);
  r.push(block(1, 50));
  r.startTurn(1); // one second of pre-roll
  r.push(block(7, 20));
  const t = r.endTurn("yes");
  assert.equal(t.start, 40);
  const clip = r.clip(t)!;
  assert.equal(clip.length, 30);
  assert.ok(clip.slice(0, 10).every((s) => s === 1));
});

test("pre-roll never reaches back before the session started", () => {
  const r = new TurnRecorder(10, 100);
  r.push(block(1, 3));
  r.startTurn(5);
  r.push(block(7, 5));
  assert.equal(r.endTurn("x").start, 0);
});

test("a second start while a turn is open keeps the earliest one", () => {
  const r = new TurnRecorder(10, 100);
  r.startTurn(0);
  r.push(block(7, 10));
  r.startTurn(0); // would move the start past the first word
  r.push(block(8, 10));
  assert.equal(r.endTurn("x").start, 0);
});

test("a turn with no start seen still gets a clip, rather than none", () => {
  const r = new TurnRecorder(10, 100);
  r.push(block(1, 100));
  const t = r.endTurn("the black gate");
  assert.ok(t.end > t.start, "a missed start must not produce an empty citation");
  assert.equal(t.end, 100);
});

test("turns number from one and the last one is the one a tool call cites", () => {
  const r = new TurnRecorder(10, 100);
  r.startTurn(0); r.push(block(1, 5)); r.endTurn("first");
  r.startTurn(0); r.push(block(2, 5)); r.endTurn("second");
  assert.equal(r.turnCount, 2);
  assert.equal(r.lastTurn?.text, "second");
  assert.equal(r.lastTurn?.index, 2);
  assert.equal(r.turn(1)?.text, "first");
});

test("a clip the ring has overwritten comes back null, not as someone else's audio", () => {
  const r = new TurnRecorder(10, 5); // a ring of 50 samples
  r.startTurn(0);
  r.push(block(7, 10));
  const old = r.endTurn("old");
  r.push(block(9, 60)); // wraps past the old turn
  assert.equal(r.clip(old), null);
});

test("a clip that wrapped around the ring is still read in order", () => {
  const r = new TurnRecorder(10, 5); // 50 samples
  r.push(block(1, 45));
  r.startTurn(0);
  const speech = Int16Array.from({ length: 10 }, (_, i) => 100 + i);
  r.push(speech); // straddles the end of the ring
  const clip = r.clip(r.endTurn("x"))!;
  assert.deepEqual(Array.from(clip), Array.from(speech));
});

test("a stuck turn is capped, keeping the end where the answer is", () => {
  const rate = 10;
  const r = new TurnRecorder(rate, 200);
  r.startTurn(0);
  r.push(block(1, rate * (MAX_TURN_SECONDS + 20)));
  const t = r.endTurn("x");
  assert.equal(t.end - t.start, rate * MAX_TURN_SECONDS);
  assert.equal(t.end, r.total);
});

test("a WAV has a correct header and carries the samples unchanged", () => {
  const pcm = Int16Array.from([0, 1000, -1000, 32767, -32768]);
  const wav = encodeWav(pcm, 24000);
  const v = new DataView(wav.buffer);
  const ascii = (at: number, n: number) =>
    String.fromCharCode(...Array.from(wav.slice(at, at + n)));

  assert.equal(wav.length, 44 + pcm.length * 2);
  assert.equal(ascii(0, 4), "RIFF");
  assert.equal(ascii(8, 4), "WAVE");
  assert.equal(ascii(36, 4), "data");
  assert.equal(v.getUint16(20, true), 1, "PCM");
  assert.equal(v.getUint16(22, true), 1, "mono");
  assert.equal(v.getUint32(24, true), 24000);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) assert.equal(v.getInt16(44 + i * 2, true), pcm[i]);
});

test("only the fields a call set or changed are credited to the latest turn", () => {
  const before = { outcome: "delivery_failed", recipient: { name: "Ademola" } };
  const after = {
    outcome: "delivery_failed", // unchanged: an earlier turn said this
    recipient: { name: "Ademola", relationship: "neighbour" },
    location: { entrance: "black gate" },
  };
  assert.deepEqual(changedFields(before, after).sort(), [
    "location.entrance",
    "recipient.relationship",
  ]);
});

test("a correction is credited to the turn that made it", () => {
  const before = { recipient: { name: "Ademola" } };
  const after = { recipient: { name: "Adebola" } };
  assert.deepEqual(changedFields(before, after), ["recipient.name"]);
});

test("the observed column is never credited to the driver's voice", () => {
  const after = { observed: { stationary: "yes", gps_delta_m: 300 }, outcome: "rescheduled" };
  assert.deepEqual(changedFields({}, after), ["outcome"]);
});
