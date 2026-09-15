import { test } from "node:test";
import assert from "node:assert/strict";

import { agentFor, localWordsPrompt, packFor, PACKS, stopsFor } from "./regions.ts";
import manifest from "../data/manifest.fixture.json" with { type: "json" };

const DROPS = manifest.drops as { region?: string; seq: number; order_ref: string }[];

test("every region on the route has a pack", () => {
  for (const d of DROPS) assert.ok(packFor(d.region), d.order_ref + " has no pack");
});

test("every pack stays under the API's 100 keyterm cap", () => {
  for (const p of PACKS) assert.ok((p.keyterms?.length ?? 0) <= 100, p.id);
});

test("a region with its own agent uses it", () => {
  const r = agentFor("pk-lahore", { shared: "S", byRegion: { "pk-lahore": "PK" } });
  assert.deepEqual(r, { agentId: "PK", dedicated: true });
});

test("a region without one falls back, and says it is not dedicated", () => {
  const r = agentFor("pk-lahore", { shared: "S", byRegion: { "ng-lagos": "NG" } });
  assert.deepEqual(r, { agentId: "S", dedicated: false });
});

test("a blank id counts as missing", () => {
  const r = agentFor("ng-lagos", { shared: "S", byRegion: { "ng-lagos": "  " } });
  assert.equal(r.dedicated, false);
});

test("stops are filtered to the region and kept in route order", () => {
  const lahore = stopsFor("pk-lahore", DROPS);
  assert.equal(lahore.length, 6);
  assert.ok(lahore.every((d) => d.region === "pk-lahore"));
  assert.deepEqual(
    lahore.map((d) => d.seq),
    [...lahore.map((d) => d.seq)].sort((a, b) => a - b),
  );
});

test("the Lahore prompt teaches chowkidar, the Lagos one teaches gateman", () => {
  const pk = localWordsPrompt(packFor("pk-lahore")!);
  const ng = localWordsPrompt(packFor("ng-lagos")!);
  assert.match(pk, /"chowkidar" means security/);
  assert.match(ng, /"gateman" means security/);
  assert.doesNotMatch(pk, /gateman/);
});

test("every alias points at a real relationship value", () => {
  const allowed = new Set([
    "security", "concierge", "neighbour", "family", "colleague", "reception", "other",
  ]);
  for (const p of PACKS) {
    for (const [word, value] of Object.entries(p.relationship_aliases ?? {})) {
      assert.ok(allowed.has(value), `${p.id}: "${word}" maps to unknown "${value}"`);
    }
  }
});

test("all three packs are present and named, so the buttons are not blank", () => {
  assert.deepEqual(
    PACKS.map((p) => p.id),
    ["ng-lagos", "pk-lahore", "uk-london"],
  );
  for (const p of PACKS) assert.ok(p.label && p.label.trim(), p.id + " has no label");
});

test("the London pack teaches porter and buzzer", () => {
  const uk = localWordsPrompt(packFor("uk-london")!);
  assert.match(uk, /"porter" means concierge/);
  assert.match(uk, /buzzer/);
});

test("every region on the route has six stops", () => {
  for (const p of PACKS) assert.equal(stopsFor(p.id, DROPS).length, 6, p.id);
});
