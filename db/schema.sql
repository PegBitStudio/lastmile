-- Lastmile: the delivery event store.
--
-- Applied automatically on first write (see lib/db.ts), and kept here so it can be
-- read, reviewed and run by hand against any Postgres. Neon and Supabase both work;
-- nothing here is specific to either.

create table if not exists delivery_events (
  -- Made in the browser when a capture starts, so every write for one stop lands
  -- on the same row and the board watches it fill in.
  id          uuid        primary key,

  order_ref   text        not null,
  region      text,

  -- The whole record, exactly as lib/delivery-event.schema.json describes it. Kept
  -- as one document rather than spread over columns, because the schema is frozen
  -- between the two of us and splitting it would make every change a migration.
  event       jsonb       not null,

  -- What the table still wanted at the time of the last write. Useful on the board:
  -- a record that stopped halfway shows what it was waiting for.
  missing     jsonb       not null default '[]'::jsonb,

  complete    boolean     not null default false,
  -- True only when close_session was accepted. A complete record that was never
  -- closed is a driver who walked away mid-sentence, and that is worth telling apart.
  closed      boolean     not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The board reads newest first and polls every two seconds.
create index if not exists delivery_events_updated_at_idx
  on delivery_events (updated_at desc);

-- The driver's own voice, one turn per row. Spec §3.4.
--
-- Only turns that a field in the record cites are ever uploaded. A turn nothing
-- cites never leaves the phone, so ambient speech at the kerb is not kept here.
--
-- Stored in Postgres rather than a blob store on purpose: one turn is a few hundred
-- kilobytes, and one more service with one more key is one more thing to break the
-- night before the demo.
create table if not exists turn_audio (
  capture_id  uuid        not null,
  turn_index  integer     not null,
  wav         bytea       not null,
  -- What the recogniser heard, so a dispatcher can read it before pressing play.
  heard       text        not null default '',
  seconds     real        not null,
  created_at  timestamptz not null default now(),
  primary key (capture_id, turn_index)
);

-- A second opinion on the words a record depends on. Spec §3.3.
--
-- The Voice Agent API gives text with no confidence attached, so each cited turn is
-- transcribed once more by a model that scores every word, and each free-text
-- field is checked against it. Kept apart from delivery_events on purpose: the
-- driver page rewrites that row on every tool call, and a review written into it
-- would be overwritten by the next one.
create table if not exists field_review (
  capture_id  uuid        not null,
  path        text        not null,
  turn_index  integer     not null,
  value       text        not null,
  confidence  real,
  found       boolean     not null,
  flagged     boolean     not null,
  reason      text        not null default '',
  -- What the second model heard, so a dispatcher can compare the two by eye.
  heard       text        not null default '',
  reviewed_at timestamptz not null default now(),
  primary key (capture_id, path)
);

-- Lock the tables away from Supabase's public API.
--
-- Supabase publishes every table in `public` through its REST API, reachable with
-- the project's anon key — and that key is public by design. Row level security
-- with no policies means the API returns nothing from these tables, to anyone.
--
-- The app is unaffected: it connects with DATABASE_URL as the role that created
-- these tables, and a table's owner is not subject to its row level security.
-- Harmless on any other Postgres; there it simply has no API to close.
alter table delivery_events enable row level security;
alter table turn_audio      enable row level security;
alter table field_review    enable row level security;
