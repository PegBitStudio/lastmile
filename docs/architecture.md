# Lastmile — Architecture

Who this is for: the team. It answers four questions directly —
**what is the agent made of, how do the parts coordinate, which LLM, which RAG.**

Companion to `lastmile-spec.md` (what we're building) and `build-plan.md` (when).
Where this doc and the spec disagree, this doc is newer.

---

## 0. Three assumptions to drop before reading on

These are the normal assumptions for an AI project in 2026, and all three are wrong here.
Most of this document follows from them being wrong.

**1. There is no multi-agent system. There is one agent.**
No planner, no router, no supervisor, no specialist sub-agents talking to each other. One agent,
one conversation, three tools. A driver reporting a delivery is a single short exchange with a
single participant — there is no second role for a second agent to play. A swarm here would add
latency, failure modes and moving parts to a 90-second demo, and would score nothing.

**2. There is no RAG.** No vector store, no embeddings, no retrieval step. §4 covers what does
each of the jobs people normally reach for RAG to do.

**3. We are not building the pipeline.** The AssemblyAI Voice Agent API is one WebSocket that
already contains speech-to-text, turn detection, LLM routing, tool calling and text-to-speech.
We are not wiring an STT to an LLM to a TTS ourselves. We configure one thing and handle its tool
calls. That is the whole integration.

The engineering difficulty in this project is **not** in the AI plumbing. It is in the
conditional-requirements table (§5), the region packs, and making it feel instant.

---

## 1. The shape

```
 Driver's phone (browser)
        │
        │  mic audio, over one WebSocket
        ▼
 ┌───────────────────────────────────────┐
 │      AssemblyAI Voice Agent API       │   <- the "agent". One config, one agent ID.
 │  STT · turn-taking · LLM · TTS        │
 └───────────────┬───────────────────────┘
                 │  tool calls (JSON Schema)
                 ▼
     our client-side tool handlers  ──────┐
     (React, running in the browser)      │
                 │                        │
                 ▼                        ▼
        POST /api/events            the driver's screen
                 │                  (fills in as they speak)
                 ▼
            Postgres  ──────▶  /board  (dispatcher, polls 2s)
                 ▲
                 │
        POST /api/audio ──▶ blob store
        (MediaRecorder, uploaded at session end)
```

Stack: **Next.js on Vercel · Postgres (Neon or Supabase) · two routes, `/drive` and `/board`.**

---

## 2. What "the agent" is actually made of

Six pieces, all inside the one WebSocket. We build and host none of them:

| Piece | What it does | Model |
|---|---|---|
| Speech-to-text | Driver's speech to text, word-level timings | Universal-3 Pro |
| Turn detection / VAD | Decides when the driver has finished speaking | Built in, tunable |
| LLM routing | Decides what to say and which tool to call | See §3 |
| Tool calling | Emits JSON-Schema-validated calls to our functions | Built in |
| Text-to-speech | Agent's reply to audio | Built in, voice is a config field |
| Session management | Connection, barge-in, teardown | Built in |

What **we** supply — this is the entire surface we control:

1. **System prompt** (spec §4)
2. **Tool definitions** — JSON Schemas for the three tools (§6)
3. **Tool handlers** — our TypeScript functions, running in the browser
4. **Settings** — greeting, voice, silence threshold, barge-in on
5. **Keyterms** — loaded from the active region pack
6. **The conditional-requirements table** — in our code, not in the prompt (§5)

Item 6 is the product. Items 1–5 are configuration.

---

## 3. Which LLM

**Short answer: whichever one is fastest. It is a config field, not an architectural decision.**

The Voice Agent API routes to an LLM for us. If we want to choose explicitly, the AssemblyAI
**LLM Gateway** (`llm-gateway.assemblyai.com/v1/chat/completions`) is OpenAI-SDK compatible and
exposes 25+ models — Claude, GPT, Gemini, Qwen, Kimi — with automatic retry and fallback.

The reason this matters less than it looks: **the model is not deciding anything hard.** Its job
on each turn is only to

- pull field values out of what the driver just said, and
- ask for the one field our code has told it is still missing.

It never decides *what* is missing. That is computed deterministically by our table. So model
intelligence is close to irrelevant here, and **model latency is everything** — every extra 200ms
is dead air while a driver stands at a gate.

**Decision:** start on the Voice Agent API default. Only swap models to cut end-to-end turn
latency, and benchmark that number rather than answer quality. Keep the numbers either way — a
latency comparison across models is a good slide and a good README section.

---

## 4. Which RAG — none. Here is what does each job instead

Four things in this product look like retrieval problems. None of them are:

| The job | What people reach for | What we actually use |
|---|---|---|
| "the third one" / "the Camden drop" to an order ID | Vector search over orders | `lookup_manifest`: fuzzy string + ordinal match over **~12 rows** in a fixture file |
| Getting local street and estate names transcribed correctly | Retrieval over a gazetteer | **Keyterm biasing** — the region pack's terms go to the recogniser *before* it listens. This fixes recognition, which retrieval cannot do |
| Knowing what to ask the driver next | Prompt plus retrieved examples | The **conditional-requirements table** in code (§5) — deterministic, testable, cannot drift |
| Using the right local words ("buzzer" vs "gate") | Retrieval over regional documents | The region pack's `vocabulary` object, injected into the system prompt at session start |

**Why there is genuinely no corpus here.** RAG exists to pull a few relevant passages out of a
large document set. We have no document set. We have a 12-row manifest, a five-value enum, and a
word list. A vector store would add a network hop, a failure mode and latency to a real-time
voice loop, and would improve nothing.

Worth saying out loud in the video and the README, so it reads as a considered decision rather
than a gap. The honest line: *keyterm biasing solves at the recogniser what RAG would only try to
patch afterwards.*

---

## 5. How the parts coordinate — the real control loop

This section is the heart of the project. Read it twice.

**The rule: the LLM decides *how* to ask. Our code decides *what* is still missing.**

**Before any of it runs**, two preconditions:

- **The safety gate.** No session opens unless the device reports the vehicle is stationary
  (spec §1.1). The record stores whether the gate was satisfied.
- **The order is already chosen.** The screen opens on the manifest with the current stop
  selected; the driver taps to change it (spec §3.0). `lookup_manifest` is a convenience, not the
  mechanism.

Each turn:

1. Driver speaks. STT transcribes.
2. The agent calls `log_delivery_event` with whatever fields it heard — a **partial** record.
3. **Our handler runs the conditional-requirements table** (spec §3.1) against the record so far
   and computes the missing-field list.
4. The handler **returns that list to the agent as the tool result.**
5. The agent asks for the first missing item, in its own words, in one short sentence.
6. Repeat from 1 until the list comes back empty.
7. Empty list: the agent reads a one-line confirmation aloud, then calls `close_session`.
8. Any field below the confidence threshold marks the record **needs review** (spec §3.3). It
   still reaches the board — flagged, with its audio turn attached.

Only **stated** fields are ever in that list. `observed` (time, coordinates, distance, stationary
flag) and `proof` (signature, photo) are never asked for, because they are not the driver's to
give. See spec §3.2 — keeping those three columns apart is what makes the GPS distance readable as
information rather than as an accusation.

Step 4 is the whole trick. The agent is never asked to remember or reason about what a complete
record looks like. It is told, every single turn, by code.

### Worked example

The manifest has 12 drops. Order 3 is `ORD-1043`, Camden, not cash-on-delivery.

| # | Driver says | Agent calls | Our handler returns | Agent says |
|---|---|---|---|---|
| 1 | "Third one, customer wasn't in, left it with the concierge" | `lookup_manifest("third")` | `ORD-1043` | — |
| 2 | | `log_delivery_event{order_ref, outcome: delivered_to_third_party, recipient.relationship: concierge}` | `missing: ["recipient.name", "location.entrance"]` | "Concierge's name?" |
| 3 | "Marcus" | `log_delivery_event{recipient.name: "Marcus"}` | `missing: ["location.entrance"]` | "Which entrance?" |
| 4 | "Main lobby on Camden Road" | `log_delivery_event{location.entrance: "main lobby, Camden Road"}` | `missing: []` | "ORD-1043, left with Marcus, concierge, main lobby. Logged." |
| 5 | | `close_session` | | — |

Four spoken turns, no form, no fixed script. If the driver had said *"left it with Marcus the
concierge at the main lobby"* in one breath, the list would come back empty at step 2 and the
agent would go straight to confirming. **Nothing in the prompt changes to make that work** — the
table simply returns a shorter list. That is the thing to demo.

### GPS check (Yashfa's addition)

Runs inside the same `log_delivery_event` handler, before the missing-field list is computed:

- compare browser geolocation against the drop's coordinates in the manifest
- over threshold (start at 200m): set `location.gps_delta_m`, and **push a soft prompt onto the
  returned list**
- the agent raises it out loud: *"That's about 300 metres from the drop address. Want to add a
  note?"*
- it is a **note, never a block.** The driver can say no and the record still closes.

---

## 6. The three tools

All client-side function tools, running in the browser. This keeps the demo self-contained on
Vercel with no server round-trip inside the voice loop.

| Tool | In | Out |
|---|---|---|
| `lookup_manifest` | a description like "the Camden drop" | `order_ref` — a convenience, not the primary path |
| `log_delivery_event` | partial delivery event | **the missing-field list** |
| `close_session` | — | — |

Three tools. That is the whole surface.

**There is no view tier any more.** An earlier draft let a dispatcher talk to the board:
*"show me everything stuck at entrances since noon"*. It is cut. It is a filtering problem wearing
a microphone, it shares no logic with the driver loop, and it needs the auth, tenancy and real
event store this build refuses. In four weeks with two people it would have become a search box
with speech bolted on, and it would have made the project read as "voice on everything" rather
than one sharp idea.

The board stays. It updates by itself instead of listening.

**Read back before writing.** A wrong "delivered to Marcus" costs a dispute, so every record is
confirmed aloud before `close_session`.

---

## 7. Data

| Store | Holds | Notes |
|---|---|---|
| `manifest.fixture.json` | ~12 drops, 2 regions, 3 cash-on-delivery, **plus coordinates** | A fixture. There is no real TMS integration and nobody expects one |
| Postgres | `delivery_events`, `sessions` | Neon or Supabase |
| Blob store | Session audio, uploaded on close | `audio_ref` offsets point into it |
| `regions/*.json` | Region packs | Data, not code. See §8 |

**Auth:** the AssemblyAI key never reaches the browser. A server route mints a short-lived token
per session — the Voice Agent API supports this for exactly this purpose.

**Billing:** sessions bill on **WebSocket open time, not audio duration.** Close in a `finally`,
cap session length client-side, and check for orphaned sockets before every dev session. This is
the easiest way to burn the $50 of credits by accident.

---

## 8. The contract between us

So we can work in parallel across a four-hour timezone gap without blocking each other.

**Frozen now — neither of us changes these without telling the other:**

```jsonc
// regions/<id>.json
{
  "id": "pk-lahore",
  "language": "en",                     // en, with code-switching expected
  "currency": "PKR",
  "vocabulary": {
    "place":    "block or phase",       // how the agent refers to a place here
    "entrance": "gate or flat number"   // how the agent refers to an entrance here
  },
  "keyterms": ["...", "..."],           // fed to the recogniser before it listens
  "relationship_aliases": { "chowkidar": "security" }   // local word -> schema enum
}
```

The delivery event schema (spec §3) and the conditional-requirements table (spec §3.1) are frozen
too. If either needs to change, that is a conversation, not a commit.

**Measurement output** — one CSV per pack, so the numbers drop straight into the deck:

```
pack_id, utterance_id, ground_truth, transcript_no_keyterms, transcript_with_keyterms, score_before, score_after
```

**Ownership**

| Area | Owner |
|---|---|
| Voice Agent config, tools, follow-up table, `/drive`, `/board`, Postgres, audio | Dami |
| Region packs: **Pakistan / Lahore** and **UK / London** | Yashfa |
| Region pack: **Nigeria/Lagos** | Dami |
| ~20 spoken addresses per pack, plus keyterms on/off measurement | Yashfa |
| GPS check — data and threshold | Dami, from Yashfa's spec |
| Video, deck, cover image, README | Both, week 4 |

Note: the third pack was originally planned as US/urban. **Lahore replaces it** — the keyterm gain
will be much larger, "London, Lagos, Lahore" is a far stronger generality claim than a second
Western city, and it is the one pack a team member can record natively.

---

## 9. Open questions — settle this week

1. Does the Lahore pack need Urdu-script keyterm variants, or is romanised text enough?
   (Yashfa's call.)
2. GPS threshold: 200m or 300m? Needs one real test, not a guess.
2b. Confidence threshold for "needs review". Start at 0.6 and tune it on the real clips.
3. Do we score word error rate, or exact match on the address span only? Exact match is a blunter
   measure but a much clearer slide.
4. Named prize recipient — must be able to receive a US wire and file a W-8BEN.
