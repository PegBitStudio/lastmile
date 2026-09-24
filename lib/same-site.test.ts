/**
 * Tests for the own-site check on the routes that spend AssemblyAI credit.
 *
 * The cases that matter: our own driver page must always get through, in every
 * browser, and another website must never.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { fromOwnSite } from "./same-site.ts";

const URL_ = "https://lastmile-peach.vercel.app/api/token";

function h(values: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

test("our own page, in a current browser, gets through", () => {
  assert.equal(fromOwnSite(h({ "sec-fetch-site": "same-origin" }), URL_), true);
});

test("another website is refused, even in a current browser", () => {
  assert.equal(
    fromOwnSite(h({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }), URL_),
    false,
  );
});

test("a sibling subdomain is not our page", () => {
  assert.equal(fromOwnSite(h({ "sec-fetch-site": "same-site" }), URL_), false);
});

test("sec-fetch-site wins over an origin that happens to match", () => {
  assert.equal(
    fromOwnSite(h({ "sec-fetch-site": "cross-site", origin: "https://lastmile-peach.vercel.app" }), URL_),
    false,
  );
});

test("an older browser that sends only Origin gets through when it is ours", () => {
  assert.equal(fromOwnSite(h({ origin: "https://lastmile-peach.vercel.app" }), URL_), true);
  assert.equal(fromOwnSite(h({ origin: "https://evil.example" }), URL_), false);
});

test("older Safari, which sends only Referer, gets through from our pages", () => {
  assert.equal(fromOwnSite(h({ referer: "https://lastmile-peach.vercel.app/drive" }), URL_), true);
  assert.equal(fromOwnSite(h({ referer: "https://evil.example/page" }), URL_), false);
});

test("the host behind a proxy counts as ours", () => {
  // Vercel can hand the function an internal URL; the public host arrives in a header.
  assert.equal(
    fromOwnSite(
      h({ origin: "https://lastmile-peach.vercel.app", "x-forwarded-host": "lastmile-peach.vercel.app" }),
      "http://localhost:3000/api/token",
    ),
    true,
  );
});

test("local development works", () => {
  assert.equal(
    fromOwnSite(h({ referer: "http://localhost:3000/drive" }), "http://localhost:3000/api/token"),
    true,
  );
});

test("no browser signal at all — curl or a script — is refused", () => {
  assert.equal(fromOwnSite(h({}), URL_), false);
});

test("a malformed Origin is refused rather than thrown on", () => {
  assert.equal(fromOwnSite(h({ origin: "not a url" }), URL_), false);
});
