# Lastmile

**Voice-first delivery exception reporting for last-mile drivers.**

A driver finishes a drop and says what happened, out loud, in normal words. The agent asks only
for the details they left out, reads the record back to confirm, and files it. The audio stays
linked to the record, so a dispatcher can click any field and hear the driver say it.

Built on the [AssemblyAI Voice Agent API](https://www.assemblyai.com/) for the lablab.ai
AssemblyAI Voice Agent Hackathon, September 2026.

> **Status: in development.** The build window is Sep 1–30, 2026. This README is filled in as the
> project is built.

---

## The idea in one paragraph

Delivery drivers hit problems all day: the customer is out, the gate is locked, a neighbour takes
the parcel. Today they either type it into a form while standing in the road, or they do not
record it at all. Both are bad, and unrecorded exceptions become failed deliveries and disputes.

Lastmile lets the driver just talk.

## What makes it an agent, not a voice-driven form

The agent does not ask a fixed list of questions. **Our code works out what is still missing and
tells the agent, on every turn.**

A driver says *"customer wasn't in, left it with the concierge."* That already gives us the
outcome and who took the parcel, so the agent asks two things: which entrance, and the concierge's
name. If the driver had already said the gate, it asks one. If they said everything in one breath,
it asks nothing and goes straight to confirming.

Nothing in the prompt changes to make that work. See [`docs/architecture.md`](docs/architecture.md)
§5 for the control loop and a full worked example.

## It works in more than one country

Address conventions are loaded as **data, not code**. A region pack holds the local vocabulary —
street and estate names, how people say entrances, the landmarks everyone navigates by — and those
terms are given to the speech recogniser before it listens, so it stops mangling them.

Three packs ship: **UK / London**, **Nigeria / Lagos**, **Pakistan / Lahore**.

Swapping the pack retargets the product to a new market without touching the schema, the
follow-up logic, or the agent.

---

## Architecture in short

```
Driver's phone (browser)
        │  microphone, over one WebSocket
        ▼
AssemblyAI Voice Agent API        <- speech to text, turn-taking, LLM, speech out
        │  tool calls (JSON Schema)
        ▼
our client-side tool handlers  ──▶  the driver's screen
        │
        ▼
   Postgres  ──▶  /board  (dispatcher view)
```

**Stack:** Next.js on Vercel · Postgres · two routes, `/drive` and `/board`.

Three things worth knowing up front, because they are the decisions people ask about:

- **One agent, not many.** A driver reporting one delivery is a short exchange with one
  participant. There is no second role for a second agent to play.
- **No RAG.** There is no corpus here — a 12-row manifest, a five-value enum and a word list.
  Keyterm biasing fixes local place names *at the recogniser, before it listens*, which retrieval
  cannot do. Full reasoning in `docs/architecture.md` §4.
- **The agent emits view state, never UI.** A closed vocabulary of filters and layouts; React
  renders from it as normal.

---

## Quickstart

> Filled in once the app runs. It will be: clone, `npm install`, set two environment variables,
> `npm run dev`.

**Never commit the AssemblyAI API key.** The browser gets a short-lived token minted by a server
route. The key stays on the server.

**One billing note for anyone running this:** streaming sessions are billed on **how long the
WebSocket is open**, not how long anyone is speaking. Close it in a `finally` block. A forgotten
browser tab costs real money.

---

## Documentation

| File | What it covers |
|---|---|
| [`docs/lastmile-spec.md`](docs/lastmile-spec.md) | What we are building. Schema, follow-up table, region packs, tools |
| [`docs/architecture.md`](docs/architecture.md) | How it works. The control loop, the LLM choice, why there is no RAG |
| [`docs/learning-log.md`](docs/learning-log.md) | What we learned while building, one line at a time |

## What we learned about the Voice Agent API

> Written up at the end of the build, from `docs/learning-log.md`.

## Team

- **Dami** — the agent and the app
- **Yashfa** — the region packs and the recognition measurements

## Licence

MIT. See [LICENSE](LICENSE).
