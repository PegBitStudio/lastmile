/**
 * What the events route decides, kept apart from how it replies.
 *
 * The route itself is now a thin wrapper. Everything worth being sure about lives
 * here, in a file that plain Node can import and test — `next/server` only
 * resolves inside Next's own resolver, and a rule that cannot be tested is a rule
 * that quietly stops being true.
 */

import { missingFields, type DeliveryEvent, type ManifestDrop, type MissingField } from "./requirements.ts";
import manifest from "../data/manifest.fixture.json" with { type: "json" };

const DROPS = manifest.drops as (ManifestDrop & { region?: string })[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WriteCheck =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      row: {
        id: string;
        order_ref: string;
        region: string | null;
        event: DeliveryEvent;
        missing: MissingField[];
        complete: boolean;
        closed: boolean;
      };
    };

/**
 * Is this write allowed, and what exactly should be stored?
 *
 * The missing list is recomputed here rather than believed from the browser. The
 * same table runs in both places, and the one that decides what gets stored is
 * this one — a client can send anything.
 */
export function checkWrite(body: unknown): WriteCheck {
  const { id, event, closed } = (body ?? {}) as {
    id?: unknown;
    event?: unknown;
    closed?: unknown;
  };

  if (typeof id !== "string" || !UUID.test(id)) {
    return { ok: false, status: 400, error: "id must be a uuid." };
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return { ok: false, status: 400, error: "event is required." };
  }

  const record = event as DeliveryEvent;

  // The order has to be one of ours. A record attached to an order that is not on
  // the route is a record nobody can act on.
  const drop = DROPS.find((d) => d.order_ref === record.order_ref);
  if (!drop) {
    return {
      ok: false,
      status: 400,
      error: "Unknown order_ref: " + String(record.order_ref),
    };
  }

  const missing = missingFields(record, drop);

  return {
    ok: true,
    row: {
      id,
      order_ref: drop.order_ref,
      region: drop.region ?? null,
      event: record,
      missing,
      complete: missing.length === 0,
      closed: closed === true,
    },
  };
}
