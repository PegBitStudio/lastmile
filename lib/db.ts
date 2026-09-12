/**
 * The delivery event store.
 *
 * Server only. This file must never be imported from a client component — it holds
 * the database credentials.
 *
 * Provider-neutral on purpose. It speaks to whatever DATABASE_URL points at, so
 * the choice between Neon and Supabase stays a deployment decision rather than a
 * code one. Use the pooled connection string either way: a serverless function
 * that opens a direct connection per request runs a managed Postgres out of
 * connections quickly.
 *
 * If DATABASE_URL is missing, every call here says so plainly instead of throwing.
 * A missing database must never be the reason a live demo goes blank.
 */

import postgres from "postgres";
import { readFile } from "node:fs/promises";
import type { DeliveryEvent, MissingField } from "./requirements";

export interface StoredEvent {
  id: string;
  order_ref: string;
  region: string | null;
  event: DeliveryEvent;
  missing: MissingField[];
  complete: boolean;
  closed: boolean;
  created_at: string;
  updated_at: string;
}

export const configured = Boolean(process.env.DATABASE_URL);

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

function client() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      // One connection per serverless instance. The pooler does the pooling.
      max: 1,
      // Supabase's transaction pooler (port 6543) cannot hold prepared statements
      // between transactions, and postgres.js prepares by default. Left on, it
      // fails at random with "prepared statement does not exist".
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
}

/**
 * Apply db/schema.sql, once per process.
 *
 * Every statement is `if not exists`, so running it on every cold start is cheap
 * and safe. A four-week project does not need a migration tool, and one more thing
 * to remember before a demo is a thing that gets forgotten.
 */
async function migrate() {
  const db = client();
  if (!db) return;
  if (!ready) {
    ready = (async () => {
      const schema = await readFile(process.cwd() + "/db/schema.sql", "utf8");
      await db.unsafe(schema);
    })().catch((err) => {
      // Let the next call try again rather than caching a failure for ever.
      ready = null;
      throw err;
    });
  }
  return ready;
}

/**
 * Write the record, or update the one already there.
 *
 * Called on every tool call, not only at the end, so the board fills in while the
 * driver is still speaking. `id` is made in the browser when the capture starts,
 * which is what keeps all those writes on one row.
 *
 * created_at is left alone on update. It is when the driver started talking, and
 * that is worth keeping.
 */
export async function saveEvent(row: {
  id: string;
  order_ref: string;
  region?: string | null;
  event: DeliveryEvent;
  missing: MissingField[];
  complete: boolean;
  closed: boolean;
}): Promise<StoredEvent | null> {
  const db = client();
  if (!db) return null;
  await migrate();

  const [saved] = await db<StoredEvent[]>`
    insert into delivery_events ${db({
      id: row.id,
      order_ref: row.order_ref,
      region: row.region ?? null,
      event: db.json(row.event as never),
      missing: db.json(row.missing as never),
      complete: row.complete,
      closed: row.closed,
    })}
    on conflict (id) do update set
      event      = excluded.event,
      missing    = excluded.missing,
      complete   = excluded.complete,
      -- A closed record never quietly reopens.
      closed     = delivery_events.closed or excluded.closed,
      updated_at = now()
    returning *
  `;
  return saved ?? null;
}

/** Newest first. What the dispatcher board reads. */
export async function listEvents(limit = 50): Promise<StoredEvent[]> {
  const db = client();
  if (!db) return [];
  await migrate();

  return db<StoredEvent[]>`
    select * from delivery_events
    order by updated_at desc
    limit ${Math.min(Math.max(limit, 1), 200)}
  `;
}

/**
 * Keep one turn of the driver's voice.
 *
 * Idempotent on (capture, turn): a retry after a slow network does not store the
 * same turn twice, and the second write simply wins.
 */
export async function saveTurnAudio(row: {
  capture_id: string;
  turn_index: number;
  wav: Uint8Array;
  heard: string;
  seconds: number;
}): Promise<boolean> {
  const db = client();
  if (!db) return false;
  await migrate();

  await db`
    insert into turn_audio (capture_id, turn_index, wav, heard, seconds)
    values (${row.capture_id}, ${row.turn_index}, ${Buffer.from(row.wav)}, ${row.heard}, ${row.seconds})
    on conflict (capture_id, turn_index) do update set
      wav = excluded.wav, heard = excluded.heard, seconds = excluded.seconds
  `;
  return true;
}

/** One turn, for playback on the board. */
export async function getTurnAudio(
  capture_id: string,
  turn_index: number,
): Promise<{ wav: Uint8Array; heard: string; seconds: number } | null> {
  const db = client();
  if (!db) return null;
  await migrate();

  const [row] = await db<{ wav: Buffer; heard: string; seconds: number }[]>`
    select wav, heard, seconds from turn_audio
    where capture_id = ${capture_id} and turn_index = ${turn_index}
  `;
  if (!row) return null;
  return { wav: new Uint8Array(row.wav), heard: row.heard, seconds: row.seconds };
}
