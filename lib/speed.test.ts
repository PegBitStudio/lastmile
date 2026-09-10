/**
 * Tests for the safety gate.
 *
 * The gate is a safety rule, so the cases that matter most are the awkward ones:
 * a device that will not report speed, a phone jittering on a dashboard while
 * parked, and a driver who is actually moving.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  currentSpeed,
  gateMessage,
  gateState,
  mayOpen,
  metresBetween,
  overrideSpeed,
  speedBetween,
  stationaryFlag,
  type Fix,
} from "./speed.ts";

const lekki = { lat: 6.4402, lng: 3.5271 };

test("distance between two points is about right", () => {
  // Ikeja to Lekki, roughly 20 km across Lagos.
  const d = metresBetween({ lat: 6.6018, lng: 3.3495 }, lekki);
  assert.ok(d > 22000 && d < 28000, "got " + Math.round(d));
});

test("the same point is no distance at all", () => {
  assert.equal(Math.round(metresBetween(lekki, lekki)), 0);
});

test("the device is believed when it reports a speed", () => {
  const fix: Fix = { ...lekki, speed: 8, at: 1000 };
  assert.equal(currentSpeed(fix), 8);
});

test("zero from the device is a reading, not a silence", () => {
  const fix: Fix = { ...lekki, speed: 0, at: 1000 };
  assert.equal(currentSpeed(fix), 0);
  assert.equal(gateState(currentSpeed(fix)), "stopped");
});

test("with no reported speed and only one fix, we do not know", () => {
  assert.equal(currentSpeed({ ...lekki, speed: null, at: 1000 }), null);
});

test("speed is worked out from two fixes when the device will not say", () => {
  const a: Fix = { lat: 6.4402, lng: 3.5271, speed: null, at: 0 };
  // About 100 m north, ten seconds later: roughly 10 m/s.
  const b: Fix = { lat: 6.4411, lng: 3.5271, speed: null, at: 10_000 };
  const v = currentSpeed(b, a);
  assert.ok(v !== null && v > 8 && v < 12, "got " + v);
});

test("two fixes too close in time are not enough to divide by", () => {
  const a: Fix = { ...lekki, speed: null, at: 0 };
  const b: Fix = { lat: 6.4403, lng: 3.5271, speed: null, at: 400 };
  assert.equal(speedBetween(a, b), null);
});

test("a parked phone wandering inside its own error bars is not moving", () => {
  // 15 m of drift in 2 s would read as 27 km/h. The device claims 30 m accuracy.
  const a: Fix = { lat: 6.4402, lng: 3.5271, speed: null, at: 0, accuracy: 30 };
  const b: Fix = { lat: 6.44033, lng: 3.5271, speed: null, at: 2000, accuracy: 30 };
  assert.equal(speedBetween(a, b), 0);
  assert.equal(gateState(speedBetween(a, b)), "stopped");
});

test("real movement is still caught when accuracy is poor", () => {
  const a: Fix = { lat: 6.4402, lng: 3.5271, speed: null, at: 0, accuracy: 30 };
  // 500 m in 30 s is 60 km/h, and well outside the error bars.
  const b: Fix = { lat: 6.4447, lng: 3.5271, speed: null, at: 30_000, accuracy: 30 };
  const v = speedBetween(a, b);
  assert.ok(v !== null && v > 12, "got " + v);
  assert.equal(gateState(v), "moving");
});

test("walking pace is stopped, driving is moving", () => {
  assert.equal(gateState(1.0), "stopped"); // 3.6 km/h
  assert.equal(gateState(3.0), "moving"); // 10.8 km/h
});

test("unknown allows the session, and moving does not", () => {
  assert.equal(mayOpen("stopped"), true);
  assert.equal(mayOpen("unknown"), true);
  assert.equal(mayOpen("moving"), false);
});

test("the record keeps three states, not a boolean", () => {
  assert.equal(stationaryFlag("stopped"), "yes");
  assert.equal(stationaryFlag("moving"), "no");
  assert.equal(stationaryFlag("unknown"), "unknown");
});

test("a moving driver is told the speed, not just told to wait", () => {
  assert.match(gateMessage("moving", 10), /36 km\/h/);
});

test("the override reads km per hour and returns metres per second", () => {
  const v = overrideSpeed("?speed=36");
  assert.ok(v !== null && Math.abs(v - 10) < 0.01, "got " + v);
  assert.equal(gateState(overrideSpeed("?speed=36")), "moving");
});

test("an override of zero is a real value and holds the gate open", () => {
  assert.equal(overrideSpeed("?speed=0"), 0);
  assert.equal(gateState(overrideSpeed("?speed=0")), "stopped");
});

test("no override, or a nonsense one, means no override", () => {
  assert.equal(overrideSpeed(""), null);
  assert.equal(overrideSpeed("?region=pk-lahore"), null);
  assert.equal(overrideSpeed("?speed=fast"), null);
  assert.equal(overrideSpeed("?speed=-5"), null);
});
