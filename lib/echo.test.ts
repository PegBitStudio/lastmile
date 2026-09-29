/**
 * Tests for the echo gate: the driver is not heard while the agent is talking.
 *
 * The case that matters most is the one that fails silently: a speaker the phone
 * suspended must never leave the driver muted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { agentAudible, ECHO_TAIL_S } from "./echo.ts";

test("while the agent's audio is still queued, the driver is not heard", () => {
  assert.equal(agentAudible(10, 12, true), true);
});

test("just after the agent stops, the room still rings, so wait a moment", () => {
  assert.equal(agentAudible(12.1, 12, true), true);
});

test("once the tail has passed, the driver is heard again", () => {
  assert.equal(agentAudible(12 + ECHO_TAIL_S + 0.01, 12, true), false);
});

test("before the agent has said anything, the driver is heard", () => {
  assert.equal(agentAudible(3, 0, true), false);
});

test("a suspended speaker never mutes the driver", () => {
  // Suspended, the clock stops, so 'now' can sit behind the queue forever.
  assert.equal(agentAudible(10, 12, false), false);
});
