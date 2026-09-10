# The database

One table. `db/schema.sql` is the whole thing.

## Getting one

Any Postgres works. Neon and Supabase both have a free tier that is plenty for this,
and nothing in `lib/db.ts` is specific to either.

**Use the pooled connection string.** A serverless function that opens a direct
connection per request runs a managed Postgres out of connections quickly, and it
fails at the worst moment — under the only load this project will ever see, which
is a judge opening the demo.

Set it in two places:

- `.env.local` for your laptop
- the Vercel project settings, for the deployed site

```
DATABASE_URL=postgres://user:password@host/db?sslmode=require
```

## Applying the schema

Nothing to run. `lib/db.ts` applies `db/schema.sql` on the first write of each
process. Every statement is `if not exists`, so it is cheap and safe to repeat.

A four-week project does not need a migration tool, and one more thing to remember
before a demo is one more thing to forget.

To apply it by hand anyway:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## Without a database

The app runs. Records live in the browser tab and the driver screen says `not saved`.
The board will be empty.

This is deliberate. A missing `DATABASE_URL` must never be the reason a live demo
shows a broken page.

## What is not tested

`lib/events.test.ts` covers what the route allows through. **It never touches a
database.** There is no local Postgres on the machine this was written on, so the
round trip — insert, conflict, update, read back — has only been reasoned about, not
run.

Check it by hand once, the first time a `DATABASE_URL` exists:

```bash
# 1. Start the app with DATABASE_URL set.
npm run dev

# 2. Write a record twice with the same id. The second must update, not duplicate.
curl -s localhost:3000/api/events -H 'content-type: application/json' -d '{
  "id":"11111111-2222-3333-4444-555555555555",
  "event":{"order_ref":"LG-4412","outcome":"delivery_failed"}
}'

curl -s localhost:3000/api/events -H 'content-type: application/json' -d '{
  "id":"11111111-2222-3333-4444-555555555555",
  "event":{"order_ref":"LG-4412","outcome":"delivery_failed",
           "failure_reason":"customer_absent","next_action":"reattempt_tomorrow"},
  "closed":true
}'

# 3. One row, complete, closed.
curl -s localhost:3000/api/events | jq '.records | length, .[0].complete, .[0].closed'
```

Expected: `1`, `true`, `true`.

Two rows means the `on conflict` is wrong. That is the one thing worth checking
before trusting any of this.
