# Lastmile — Technical Spec

Voice-first delivery exception reporting for last-mile drivers.
Built on the AssemblyAI Voice Agent API. Target: lablab.ai AssemblyAI Voice Agent Hackathon, Sep 2026.

---

## 1. One-line definition

**After a stop, while stationary**, a driver speaks what happened; the agent asks only for the
details still missing, confirms out loud, and writes a structured delivery record with the
driver's own words attached.

Two things this is *not*, stated up front because both are easy to overclaim:

- **This is not outcome capture.** Drivers already tap "attempted" or "left with neighbour",
  because the scanner blocks the next stop until they do. What gets skipped is the *narrative* —
  which lobby, the gateman's name, who signed, why. **Lastmile captures the narrative.**
- **This is not proof of delivery.** A driver's recording is a statement by an interested party.
  It is an **auditable exception narrative**, and it becomes evidence only alongside
  machine-observed facts (§3.2). Real proof of delivery is scans, photos and signatures, and the
  incumbents already do that well.

Region-agnostic by design: address conventions are loaded as data, not baked into the product.

---

## 1.1 The safety gate — a hard rule

**The agent will not start a conversation unless the vehicle is stationary.**

A multi-turn dialogue with a moving driver is a liability, not a feature. It is cognitively
demanding even when it is hands-free, and no fleet safety officer will approve it. Commercial
driving rules in most markets restrict handheld phone use and require hands-free operation, and a
back-and-forth conversation is a distraction whether or not hands are involved.

So the product is **park, speak, go** — capture right after the stop, while the memory is fresh
and the vehicle is still.

### Implementing it, including the awkward part

Check speed before opening the session. Above a low threshold (start at 5 km/h) the driver screen
shows *"Waiting until you've stopped"* and the microphone stays shut.

**`GeolocationCoordinates.speed` is null on a lot of hardware**, including most laptops and some
phones. That has to be handled deliberately or this feature quietly does nothing, or worse, blocks
everything:

1. Read `coords.speed`. If it is a number, use it.
2. If it is null, derive speed from two consecutive positions and their timestamps.
3. If it is still unknown, **allow the session** and record
   `observed.stationary: "unknown"` rather than `true`.

Step 3 matters. Blocking on unknown would make the product unusable on the devices that cannot
report speed, and would make the demo impossible to record. An honest "unknown" in the record is
better than a false "stationary" or a dead app.

**For the video, we need a way to fake motion.** A dev-only speed override (a query parameter is
fine) so the gate can be filmed refusing and then allowing. Without it, the opening beat of the
video cannot be shot from a desk. Build the override in week 2, at the same time as the gate, not
on the 23rd.

This also removes a technical problem. A dash-mounted phone holding a live microphone socket in a
moving car is the worst case for a mobile browser — backgrounding, wake lock, Bluetooth routing.
A stationary driver holding the phone for twenty seconds is the easy case. The safety rule and the
engineering reality point the same way.

It is a demo beat too. It is the kind of guardrail judges notice, and no other team will have one.

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
        "notes":    { "type": "string" }
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

    "observed": {
      "type": "object",
      "description": "Machine-observed facts. Never spoken, never asked for, not the driver's to edit.",
      "properties": {
        "occurred_at": { "type": "string", "format": "date-time" },
        "coords":      { "type": "object", "properties": { "lat": {"type":"number"}, "lng": {"type":"number"} } },
        "gps_delta_m": { "type": "number", "description": "Metres from the manifest drop address" },
        "stationary":  { "type": "string", "enum": ["yes", "no", "unknown"], "description": "Safety gate state at capture. Unknown when the device cannot report speed, see section 1.1" },
        "scan_ref":    { "type": "string", "description": "Barcode, where the order was scanned" }
      }
    },

    "proof": {
      "type": "object",
      "description": "Recipient-supplied evidence. Declared for completeness; out of scope for this build.",
      "properties": {
        "signature_ref": { "type": "string" },
        "photo_ref":     { "type": "string" },
        "otp_verified":  { "type": "boolean" }
      }
    },

    "confidence": {
      "type": "object",
      "description": "Per-field recognition confidence, used to route weak records to review (§3.3)",
      "additionalProperties": { "type": "number" }
    },

    "audio_ref": {
      "type": "object",
      "description": "Turn-level citation: the driver turn that set the field",
      "properties": {
        "session_id": { "type": "string" },
        "turn_index": { "type": "integer" },
        "start_ms":   { "type": "integer", "description": "Start of that turn, not of the word" },
        "end_ms":     { "type": "integer", "description": "End of that turn" }
      }
    }
  },
  "required": ["order_ref", "outcome"]
}
```

### 3.2 Three kinds of evidence — keep them apart

The record has three columns, and conflating them is how a product like this loses an argument:

| Column | What it is | Where it comes from | Driver can change it? |
|---|---|---|---|
| **Stated** | `outcome`, `location`, `recipient`, `failure_reason`, `payment`, `next_action` | The driver's own words | Yes — it is their account |
| **Observed** | `observed.*` — time, coordinates, distance from the drop, stationary flag, scan | The device | No |
| **Proof** | `proof.*` — signature, photo, one-time code | The recipient | No |

**Only the stated column is ever asked for.** The follow-up table below never asks about
`observed` or `proof`, because those are not the driver's to supply.

This is what makes the GPS distance honest. A record showing *"driver said main lobby"* next to
*"300m from the drop address"* is not an accusation. It is two independent columns, and the
dispatcher decides what to make of them. That is a much stronger position than claiming the audio
proves anything by itself.

### 3.3 Confidence and review

Recognition on street names and personal names will sometimes be poor, and a wrong name written
silently into a record is worse than no record at all.

Any field below a confidence threshold marks the record **needs review** rather than accepted. It
still reaches the board immediately - it is simply flagged, with the audio turn attached, so a
dispatcher can listen and confirm in a couple of seconds.

Demo this. A system that knows when it is unsure reads as engineered. One that is always confident
reads as a toy.

### 3.4 Audio: turn-level, not word-level

`audio_ref` points at **the driver turn that caused the field to be written**, not at a word span
inside it. Storing the causing turn is honest, cheap, and enough to settle a dispute.

Word-level alignment is possible in principle, since streaming turn events carry word timings, but
it is a project of its own and not what this build is about. **Do not show a waveform with five
highlighted word ranges in the video.** Show the dispatcher clicking `recipient.name` and hearing
the driver say "Marcus, he signed."

**Retention:** keep the clipped turns a record cites, not the whole route's open microphone.
Ambient conversation, other people's voices and unrelated speech are a liability with no upside.
A recording indicator stays visible on the driver screen the whole time the session is live.

`location.place` / `location.entrance` are deliberately generic. A region pack (§5) supplies the
words the agent uses for them — "gate", "lobby", "buzzer", "unit" — without changing the schema.

### 3.0 Which order — tap first, speak second

**The order is chosen by tapping it on screen. Voice ordinals are a shortcut, not the mechanism.**

"The third one" works in a scripted demo and fails in operations. Drivers reorder stops, go back to
an earlier address, and carry several parcels at once. Attributing an exception to the wrong order
destroys trust faster than a mis-transcribed street name ever will.

So the driver screen opens on the manifest with the current stop already selected from the route.
The driver taps if it is wrong. `lookup_manifest` stays as a convenience for "the Camden drop", and
a resolved order is always read back before anything is written.

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

### System prompt

The live copy is `agents/driver.json`, and it is sent to the API unchanged. Edit it there, not
here, and run `npm run agent:update`.

Two rules it must keep, because they are the product:

- **Ask only for what is missing.** In week 2 the missing-field list arrives as a tool result and
  the prompt defers to it. Until the tools exist, the prompt asks the model to work it out, which
  is weaker but at least coherent.
- **Never ask the driver to repeat themselves in standard English.** If a name is unclear, ask
  them to spell it.

**A lesson from the first live test.** The prompt said *"You will be told which fields are still
missing after every tool call."* No tools were registered, so that list never arrived. The agent
followed instructions about machinery that did not exist and invented questions instead — it
asked for the address, which we already know. A prompt that refers to something absent does not
degrade gracefully; it produces confident nonsense.

### Key settings

| Setting | Value | Reason |
|---------|-------|--------|
| Greeting | Very short ("Go ahead.") | Driver initiated; don't waste their time |
| Barge-in / interruption | **Enabled** | Drivers self-correct mid-sentence constantly |
| Silence threshold | Tuned longer than default | Street noise and thinking pauses; avoid cutting them off |
| Keyterm biasing | Loaded from the active region pack | Single highest-impact tuning knob |
| Voice | Clear, moderate pace | Heard through street noise, often on a phone speaker |

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
gates, gatemen), **Pakistan/Lahore** (phases, blocks, chowkidars, landmark-based directions).
Three packs is enough to prove generality; more is padding.

Pakistan replaces the originally planned US/urban pack. Two reasons: the keyterm-biasing gain is
far larger where the vocabulary is non-Western, and "London, Lagos, Lahore" is a much stronger
generality claim than a second Western city. It is also the one pack a team member can record
natively.

**Demo value:** running the same agent against two packs back to back — identical code, different
recognition and phrasing — is the clearest possible proof that the approach generalizes. Put it
in the video.

---

## 6. Tools — two tiers

**There is one voice surface: the driver.** Every tool is a client-side function tool, which keeps
the demo self-contained on Vercel with no server round-trip inside the voice loop.

| Tool | Purpose |
|------|---------|
| `lookup_manifest` | Convenience resolver for "the Camden drop" → `order_ref`. Not the primary path — see §3.0 |
| `log_delivery_event` | Write or patch the event; **returns the still-missing field list** |
| `close_session` | Confirm and end cleanly |

Three tools. That is the whole surface.

### What used to be here, and why it is gone

An earlier draft had a second tier of view tools letting a dispatcher say *"show me everything
stuck at entrances since noon"* and watch the board rearrange.

**Cut.** It is a filtering problem wearing a microphone, it shares no logic with the driver loop,
and it needs the auth, tenancy and real event store this build explicitly refuses. In four weeks
with two people it would have become a search box with speech bolted on, and it would have made
the project read as "voice on everything" instead of one sharp idea.

The board stays. It just updates by itself instead of listening.

### Two behavioural rules that remain

**Read back before writing.** A mis-heard "delivered to Marcus" costs a dispute, so every record
is confirmed out loud before `close_session`.

**Never block the screen on speech.** Apply each tool call to the receipt the moment it arrives and
let the spoken acknowledgement land afterwards. If the screen waits for the voice, the whole thing
feels slow.

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

**Driver** — the screen is a *receipt*, not an interface. It opens on the manifest with the current
stop selected. Fields fill in as they speak, missing ones highlight, the confirmation appears.
Glanceable, never required. No voice navigation at all, because there is nothing to navigate.

**Dispatcher** — a live board, read-only and updating by itself. Three columns per record: what the
driver said, what the device observed, and whether it needs review. Click any stated field to hear
the driver's own turn. **No voice on this surface** — see §6.

---

## 9. Deliberately out of scope

Authentication · native mobile app · route optimisation · multi-tenancy · admin panels ·
real TMS integration · offline sync · generative UI · **voice control of the dispatcher board** ·
**recipient proof capture** (signature, photo, one-time code) · **word-level audio alignment**.

The manifest is a fixture file. Nobody expects a real backend, and every hour here is an hour not
spent on the video.

Two of those deserve a sentence, because they are things a real product would need:

- **Offline.** A browser voice socket needs connectivity, and estates and basements do not always
  have it. For a real product, queue the audio locally and transcribe on reconnect. For this
  build, say plainly that it is an online prototype. Incumbents treat offline as table stakes, and
  pretending otherwise in front of an operator would cost more credibility than admitting it.
- **Recipient proof.** Signature and photo are what actually prove a delivery. We are not building
  them, we are declaring where they would sit (§3.2), and we are not claiming our audio replaces
  them.

---

## 10. Known risks

| Risk | Mitigation |
|------|-----------|
| **Driver safety and fleet liability** | The safety gate (§1.1). No session above a low speed threshold, and the record stores whether the gate was satisfied |
| **Privacy of recorded third parties** — concierge names, ambient speech | Keep only the cited turns, not the route audio. Visible recording indicator. Say the retention rule out loud in the video |
| **Wrong order attributed to an exception** | Tap-to-select is the primary path (§3.0); resolved orders are read back before writing |
| **A wrong name written silently into a record** | Confidence thresholds route the record to review rather than accepting it (§3.3) |
| **No connectivity in a basement or a gated estate** | Out of scope, and stated as such. This is an online prototype |
| **WebSocket billing** — sessions bill on connection time, not audio | Close in a `finally`; hard client-side session cap; verify no orphaned sockets before every dev session |
| Free tier: 5 new streams/min | Fine for a demo; state it as a known limit rather than hiding it |
| Road noise degrades recognition | Test against real noise clips in week 3; report findings in the writeup |
| Local place names mis-transcribed | Region-pack keyterms; measure before/after per pack |
| Live demo fails on the day | Record a backup run of the full flow in week 3, before you need it |

---

## 11. What makes this score

- **Application of Technology** — JSON-Schema tool calling is the core loop, not decoration.
  Keyterm biasing, barge-in and turn tuning are each used for a stated reason, and the keyterm
  numbers are measured rather than asserted.
- **Business value** — the missing thing is not the outcome code, which the scanner already
  forces. It is the narrative: which entrance, who took it, whether they signed. That is the field
  a dispute turns on and the one nobody types. Region packs widen the market beyond one country.
- **Originality** — schema-driven follow-ups are the idea. The agent is told what is missing by
  code on every turn, so it cannot drift. Most voice entries this month will be a prompt and a
  transcript.
- **Presentation** — the demo is 90 seconds: the gate holds until the van stops, one messy
  sentence fills three fields, the agent asks only for the holes, the record lands with its audio,
  then the same code runs against another country.

**The comparison to run on camera.** Same clip, two agents side by side: a plain prompted one and
ours. The plain one asks for the outcome the driver already gave. Ours does not. Eight seconds,
and it makes the architecture visible — otherwise the judges only see a nice voice demo and never
see the part that took the work.
