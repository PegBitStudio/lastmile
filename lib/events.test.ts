/**
 * Tests for what the events route allows through.
 *
 * The round trip against a real Postgres is NOT covered here — there is no local
 * database on this machine. See db/README.md for how to check that by hand.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkWrite } from "./events.ts";

const ID = "11111111-2222-3333-4444-555555555555";

test("a good write is allowed, and stores the order from the manifest", () => {
  const r = checkWrite({
    id: ID,
    event: { order_ref: "LG-4412", outcome: "rescheduled", next_action: "return_to_hub" },
  });

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.row.order_ref, "LG-4412");
  assert.equal(r.row.region, "ng-lagos");
  assert.equal(r.row.complete, true);
  assert.equal(r.row.closed, false);
});

test("an id that is not a uuid is refused", () => {
  const r = checkWrite({ id: "../../etc/passwd", event: { order_ref: "LG-4412" } });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
  assert.match(r.error, /uuid/);
});

test("an order that is not on the route is refused", () => {
  const r = checkWrite({ id: ID, event: { order_ref: "LG-9999" } });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /Unknown order_ref/);
});

test("a write with no event is refused", () => {
  assert.equal(checkWrite({ id: ID }).ok, false);
  assert.equal(checkWrite({ id: ID, event: "hello" }).ok, false);
  assert.equal(checkWrite({ id: ID, event: [] }).ok, false);
  assert.equal(checkWrite(null).ok, false);
});

test("the missing list is recomputed, not believed", () => {
  // The browser claims the record is finished. It is not: a third-party delivery
  // still needs a name and an entrance.
  const r = checkWrite({
    id: ID,
    event: {
      order_ref: "LG-4412",
      outcome: "delivered_to_third_party",
      recipient: { relationship: "concierge" },
    },
    missing: [],
    complete: true,
  });

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.row.complete, false);
  assert.deepEqual(
    r.row.missing.map((m) => m.path),
    ["recipient.name", "location.entrance"],
  );
});

test("a cash order is not complete until the money is recorded", () => {
  const r = checkWrite({
    id: ID,
    event: {
      order_ref: "LG-4413",
      outcome: "delivered_to_recipient",
      recipient: { name: "Folake" },
    },
  });

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.row.complete, false);
  assert.ok(r.row.missing.some((m) => m.path === "payment.collected_amount"));
});

test("closed is only true when it is asked for", () => {
  const done = { order_ref: "LG-4412", outcome: "rescheduled", next_action: "return_to_hub" };
  const open = checkWrite({ id: ID, event: done });
  const shut = checkWrite({ id: ID, event: done, closed: true });

  assert.equal(open.ok && open.row.closed, false);
  assert.equal(shut.ok && shut.row.closed, true);
});
