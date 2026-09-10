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
