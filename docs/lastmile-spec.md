# Lastmile — Technical Spec

Voice-first delivery exception reporting for last-mile drivers.
Built on the AssemblyAI Voice Agent API. Target: lablab.ai AssemblyAI Voice Agent Hackathon, Sep 2026.

---

## 1. One-line definition

A driver speaks what happened at a drop; the agent asks only for the details still missing,
confirms out loud, and writes a structured delivery record that stays linked to the audio.

Region-agnostic by design: address conventions are loaded as data, not baked into the product.

---

## 2. The core mechanic

Everything here is one idea: **the schema knows what it still needs, and the agent asks for
exactly that — nothing more.**

A driver saying "left it with the concierge" has supplied `outcome` and `recipient.relationship`
but not `recipient.name` or `location.entrance`. Those two become the agent's next two questions.
If the entrance was already volunteered, the agent asks one question instead of two.

This is what separates a voice agent from a voice-driven form, and it is the thing to demo.

---

## 3. Delivery event schema

Used directly as the JSON Schema for the `log_delivery_event` tool.

```jsonc
{
  "type": "object",
  "properties": {
    "order_ref":   { "type": "string", "description": "Order ID resolved from the manifest" },

    "outcome": {
      "type": "string",
      "enum": [
        "delivered_to_recipient",
        "delivered_to_third_party",
        "delivery_failed",
        "refused_by_customer",
        "rescheduled"
      ]
    },

    "location": {
      "type": "object",
      "properties": {
        "place":    { "type": "string", "description": "Estate, complex, building or landmark" },
        "entrance": { "type": "string", "description": "Gate, lobby, buzzer, unit or door" },
        "notes":    { "type": "string" },
        "gps_delta_m": {
          "type": "number",
          "description": "Metres between the driver's position and the manifest drop address at log time. Advisory only — never blocks a record."
        }
      }
    },

    "recipient": {
      "type": "object",
      "properties": {
        "name":         { "type": "string" },
        "relationship": {
          "type": "string",
          "enum": ["security", "concierge", "neighbour", "family", "colleague", "reception", "other"]
        },
        "signed":       { "type": "boolean" }
      }
    },

    "failure_reason": {
      "type": "string",
      "enum": [
        "customer_absent", "address_incorrect", "access_denied",
        "customer_refused", "payment_shortfall", "unsafe_conditions"
      ]
    },

    "payment": {
      "type": "object",
      "properties": {
        "expected_amount":  { "type": "number" },
        "collected_amount": { "type": "number" },
        "currency":         { "type": "string" },
        "method": { "type": "string", "enum": ["cash", "card", "transfer", "none"] }
      }
    },

    "next_action": {
      "type": "string",
      "enum": ["reattempt_today", "reattempt_tomorrow", "return_to_hub", "contact_dispatcher"]
    },

    "occurred_at": { "type": "string", "format": "date-time" },

    "audio_ref": {
      "type": "object",
      "description": "Citation link back into the recording",
      "properties": {
        "session_id": { "type": "string" },
        "start_ms":   { "type": "integer" },
        "end_ms":     { "type": "integer" }
      }
    }
  },
  "required": ["order_ref", "outcome"]
}
```

`location.place` / `location.entrance` are deliberately generic. A region pack (§5) supplies the
words the agent uses for them — "gate", "lobby", "buzzer", "unit" — without changing the schema.

### 3.1 Conditional requirements — the follow-up table

The base schema hard-requires only `order_ref` and `outcome`. Everything else is required
*conditionally*, and this table drives the agent's questions:

| If `outcome` is            | Then also require                                                      |
|----------------------------|------------------------------------------------------------------------|
| `delivered_to_recipient`   | `recipient.name`                                                       |
| `delivered_to_third_party` | `recipient.name`, `recipient.relationship`, `location.entrance`        |
| `delivery_failed`          | `failure_reason`, `next_action`                                        |
| `refused_by_customer`      | `failure_reason`, `next_action`                                        |
| `rescheduled`              | `next_action`                                                          |

Independent of outcome:

| Condition | Then also require |
|-----------|-------------------|
| order is cash-on-delivery in the manifest | `payment.collected_amount`, `payment.method` |
| `payment.collected_amount` < `expected_amount` | `failure_reason` = `payment_shortfall`, `next_action` |

**Implementation:** keep this table in code, not in the prompt. After each partial tool call,
compute the missing-field list and hand it back to the agent as the next thing to ask about.
The LLM decides *how* to ask; your code decides *what* is still missing. Prompts drift; a table
does not — and this is precisely the reliability point to make in the writeup.

---

## 4. Agent configuration

### System prompt (shape, not final copy)

```
You are a dispatch assistant for delivery drivers who are on the road, often with
their hands full and traffic noise around them.

Rules:
- Ask about ONE missing field at a time. Never batch questions.
- Keep every utterance under 12 words. Drivers are driving.
- NEVER invent or assume a field value. If you did not hear it, ask.
- If the driver gives extra information unprompted, capture it and skip that question.
- When all required fields are filled, read back a one-line confirmation and stop talking.
- Use the local vocabulary supplied for this region when naming places and entrances.
- Accept regional accents, dialects and code-switching naturally. Never ask the driver
  to repeat themselves in "standard" English.
```

### Key settings

| Setting | Value | Reason |
|---------|-------|--------|
| Greeting | Very short ("Go ahead.") | Driver initiated; don't waste their time |
| Barge-in / interruption | **Enabled** | Drivers self-correct mid-sentence constantly |
| Silence threshold | Tuned longer than default | Road noise + thinking pauses; avoid cutting them off |
| Keyterm biasing | Loaded from the active region pack | Single highest-impact tuning knob |
| Voice | Clear, moderate pace | Heard through road noise and a helmet |

---

## 5. Region packs — how it works everywhere

A region pack is **data, not code**. Swapping it retargets the product to a new market without
touching the schema, the follow-up table, or the agent logic.

```jsonc
{
  "id": "uk-london",
  "language": "en-GB",
  "currency": "GBP",
  "vocabulary": {
    "place":    "building",
    "entrance": "buzzer or flat number"
  },
  "keyterms": [
    "buzzer", "flat", "concierge", "porter", "council estate",
    "mews", "terrace", "letterbox", "safe place"
  ],
  "relationship_aliases": { "porter": "concierge", "caretaker": "security" }
}
```

Reference packs to ship: **UK/London** (buzzers, flats, porters), **Nigeria/Lagos** (estates,
gates, gatemen), **Pakistan/Karachi** (phases, blocks, chowkidars, landmark-based directions).
Three packs is enough to prove generality; more is padding.

Pakistan replaces the originally planned US/urban pack. Two reasons: the keyterm-biasing gain is
far larger where the vocabulary is non-Western, and "London, Lagos, Karachi" is a much stronger
generality claim than a second Western city. It is also the one pack a team member can record
natively.

**Demo value:** running the same agent against two packs back to back — identical code, different
recognition and phrasing — is the clearest possible proof that the approach generalizes. Put it
in the video.

---

## 6. Tools — two tiers

The agent both **records data** and **drives the interface**. Both go through client-side function
tools, which keeps the demo self-contained on Vercel.

### Tier 1 — data tools

| Tool | Purpose |
|------|---------|
| `lookup_manifest` | Resolve "third one" / "the Camden drop" → `order_ref` |
| `log_delivery_event` | Write/patch the event; **returns the still-missing field list** |
| `close_session` | Confirm and end cleanly |

### Tier 2 — view tools (dispatcher side)

| Tool | Purpose |
|------|---------|
| `set_filter` | Status, area, driver, time window, exception type |
| `focus_order` | Open one order |
| `set_layout` | Board / list / map |
| `highlight` | Draw attention to a subset |

**Critical rule: the agent emits view *state*, it never generates UI.** Define a small closed
vocabulary — a filter object, a layout mode, a focus target — and let the agent pick and
parameterize from it. React renders from that state as normal.

Fully generative UI (model produces markup) is a trap on a four-week build: nondeterministic,
unstyleable, untestable, and it will break live. A closed vocabulary delivers the same felt
experience — *"I spoke and the interface rearranged"* — with none of the fragility.

### Two behavioural rules

**Free actions vs confirmed actions.** View changes are cheap to get wrong — apply instantly, no
confirmation; the user just says the next thing. State changes are expensive to get wrong — read
back and confirm. A mis-heard filter costs nothing; a mis-heard "delivered to Marcus" costs a dispute.

**Latency budget.** Apply view tool calls optimistically the moment they arrive; let the spoken
acknowledgement land afterwards. If the screen waits on the voice, the whole thing feels sluggish.

**Discoverability.** Nobody knows what they may say. Surface two or three contextual hints on
screen that change with state, so the interface teaches its own vocabulary.

---

## 7. Architecture

```
Driver phone browser  ──mic──▶  Voice Agent API (WebSocket, token auth)
        │                                │
        │                          tool calls
        │                                ▼
        │                   client-side tool handlers
        │                    (data tier + view tier)
        │                                │
        └──MediaRecorder──▶  POST /api/audio      POST /api/events
                                     │                  │
                                     ▼                  ▼
                                 blob store         Postgres
                                                        │
                                     Dispatcher board ◀──┘  (poll 2s)
```

**Stack:** Next.js on Vercel · Postgres (Neon or Supabase) · routes `/drive`, `/board`.

**Auth:** never ship the AssemblyAI API key to the browser. A server route mints a short-lived
token for the browser client — the Voice Agent API supports token auth for exactly this.

**Audio retention:** record the mic locally with `MediaRecorder`, upload the blob on session end,
store the URL. `audio_ref` offsets point into it. This powers "play what the driver actually said"
on the dispatcher board.

**Dispatcher board:** poll every 2 seconds. SSE is nicer and one more thing to break on demo day.

---

## 8. The two surfaces

**Driver** — the screen is a *receipt*, not an interface. Fields fill in as they speak, missing
ones highlight, confirmation appears. Glanceable at a red light, never required. No voice
navigation at all, because there is nothing to navigate.

**Dispatcher** — a live board that also takes voice. *"Show me everything stuck at entrances since
noon"* → board reorganizes; *"just the cash ones"* → filters again. Voice earns its place here
because expressing a filter beats constructing it through five menus.

---

## 9. Deliberately out of scope

Authentication · native mobile app · route optimisation · multi-tenancy · admin panels ·
real TMS integration · offline sync · generative UI.

The manifest is a fixture file. Nobody expects a real backend, and every hour here is an hour not
spent on the video.

---

## 10. Known risks

| Risk | Mitigation |
|------|-----------|
| **WebSocket billing** — sessions bill on connection time, not audio | Close in a `finally`; hard client-side session cap; verify no orphaned sockets before every dev session |
| Free tier: 5 new streams/min | Fine for a demo; state it as a known limit rather than hiding it |
| Road noise degrades recognition | Test against real noise clips in week 3; report findings in the writeup |
| Local place names mis-transcribed | Region-pack keyterms; measure before/after per pack |
| Voice-driven UI feels sluggish | Optimistic view updates; never block the screen on speech |
| Live demo fails on the day | Record a backup run of the full flow in week 3, before you need it |

---

## 11. What makes this score

- **Application of Technology** — JSON-Schema tool calling is the core loop, not decoration;
  client-side tools drive both data and interface; keyterm biasing, barge-in and turn tuning are
  each used for a stated reason.
- **Business value** — unlogged exceptions cause failed drops and disputes; the audio-linked
  record is the thing a carrier actually buys. Region packs make the market global, not niche.
- **Originality** — driver-facing voice capture is genuine whitespace; funded voice-AI logistics
  companies are aimed at freight brokerage, not the last mile.
- **Presentation** — the demo is 90 seconds: speak, watch the record appear, click to hear it
  back, then swap the region pack and watch it work somewhere else.
