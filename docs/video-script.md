# The five-minute video

Target **4:20**, hard limit 5:00. MP4, under 300 MB.

**Yashfa narrates the whole video.** Every word below marked **VOICE** is hers.
Nobody else speaks, with one exception, and it is not narration: inside the demo
the driver says a line out loud, because that is the product being used. That
voice is the app's user. Yashfa's is the film's.

Presentation is a quarter of the score, and it is the quarter most teams lose.
The rule for every shot: **show the thing working, then say why it matters.**
Never the other way round, and never say anything the screen is not already
proving.

Read [recording-plan.md](recording-plan.md) before you record anything. It has
the order the pieces must be made in, and the settings.

---

## How to read this script

Every beat has three parts.

- **SCREEN** — what Dami captures, with no talking over it.
- **VOICE** — what Yashfa reads. Word for word. This is the only spoken track.
- **LENGTH** — how long the finished beat runs.

Slide numbers refer to [slides.md](slides.md). Where a beat says *Slide 3*, the
screen is the deck, not the app.

---

## 0:00–0:18 · The gap · Slide 1, then Slide 2 · 18s

**SCREEN:** Slide 1 (the title) for three seconds, then Slide 2 — the delivery
record with three fields filled and the story missing.

**VOICE:**

> A delivery driver finishes thirty stops a day. Six or eight of them go wrong.
> The customer is out. The gate is locked. A neighbour takes the parcel.
>
> The outcome always gets recorded, because the scanner will not let the driver
> move on without it. What never gets recorded is the story. Which gate. Whose
> name. Whether anyone signed.
>
> Three weeks later a customer says nothing arrived, and that story is the only
> thing that would have settled it.

**Do not say "AI" yet.** Eighteen seconds on the problem buys the next four minutes.

---

## 0:18–0:33 · It refuses to start · 15s

**SCREEN:** the driver screen while the phone is moving. It reads *waiting until
you've stopped*. Press the button — nothing happens. Then stop. The microphone
opens.

**VOICE:**

> It will not talk to a driver who is driving.
>
> A back-and-forth conversation with someone at the wheel is a liability no fleet
> would sign off, so it waits until the vehicle stops. Park, speak, go.

The one guardrail nobody else in the gallery will have. Fifteen seconds is enough.

---

## 0:33–1:35 · The loop, in one take · 62s

**SCREEN:** one continuous recording of the driver screen. No cuts. A cut in the
middle of a voice conversation looks like a cut that hides a failure.

Dami speaks the driver's lines into the phone. First stop, one sentence:

> *"Couldn't deliver, customer wasn't in, left it with the gateman."*

The agent asks for the name. Answer it. It asks which gate. Answer it. It reads
the record back and stops.

Then a second stop, and this time everything at once:

> *"Left it with Ademola the gateman at the black gate."*

**It asks nothing.** It confirms and closes.

**VOICE**, laid over both runs:

> Nothing changed between those two conversations. No different prompt. No second
> agent.
>
> Our code works out which fields are still empty, and hands the agent that list
> on every single turn. The agent only decides how to ask. Say everything at once
> and there is nothing left to ask — so it asks nothing.

That contrast **is** the product. Do not rush it, and do not talk across the
agent's own replies — leave the agent's voice audible.

---

## 1:35–2:05 · The record, and the driver's own voice · 30s

**SCREEN:** switch to `/board`. The record is already there. Then click the ▶
next to a field and let the driver's own voice play out loud.

**VOICE:**

> Three columns, kept apart on purpose. What the driver said. What the phone saw
> — the time, the location, how far from the address. And what the customer gave,
> which is nothing, and we say so.

*(let the clip play — silence over it)*

> That is the part a carrier pays for. Not a text box somebody typed. The driver
> saying who took it, at the stop, kept against the field it proves.
>
> Only the clips a field actually cites ever leave the phone. Everything else is
> thrown away.

---

## 2:05–2:25 · Two countries, one codebase · 20s

**SCREEN:** the region switch. Pick Lahore. Report a drop using a Lahore address.

**VOICE:**

> Same code. A different word list.
>
> Local knowledge is data here, not code. Adding a country is a JSON file.

---

## 2:25–3:05 · What we measured · Slide 5 · 40s

**SCREEN:** `docs/chart-regions.png`, full screen, held still. Do not animate it.
Let the reader read it.

**VOICE:**

> We did not want to claim that word lists help. We measured it.
>
> Eighty recordings, in our own voices — mine in Lahore, my teammate's in Lagos.
> Each one transcribed twice. The word list is the only thing that changes
> between the two runs.
>
> Lagos goes from sixty-five per cent of addresses heard correctly, to ninety.
> Lahore, seventy-five to eighty-five.
>
> Then we pointed it at London with a synthetic British voice, and it changed
> nothing. Sixty-five, both ways, identical.
>
> So we recorded London again, in a Nigerian voice — because a great many
> Nigerians drive deliveries in Britain. That is the hardest set we have. Forty
> per cent without the word list. Fifty-five with it.
>
> Biasing the recogniser pays where the words are not what it expects. Where they
> already are what it expects, it does nothing at all.

**Say the flat London number clearly.** A team that reports a result against
itself is a team whose other numbers you believe. This is the most valuable forty
seconds in the video — and the Nigerian-voice row is the one no other team will
have thought to measure.

---

## 3:05–3:22 · When it is not sure · 17s

**SCREEN:** a record flagged **needs review**.

**VOICE:**

> A wrong name written down silently is worse than no record at all.
>
> When the recogniser is unsure, a second model checks the words the record
> depends on, and the record is flagged rather than accepted.

---

## 3:22–4:05 · Who buys it, and what it is not · Slide 6 · 43s

**SCREEN:** Slide 6 — what this is, and what it is not, side by side.

**VOICE:**

> This is not proof of delivery, and we do not claim it is. A driver's recording
> is a statement by someone with an interest in it. Real proof is a scan, a
> photo, a signature, and those tools already exist.
>
> What did not exist is the story that sits next to them. This is an evidence
> layer beside the scanner a carrier already runs, and it hands back a structured
> record with the audio attached.
>
> The buyer is the operations manager with twenty to two hundred drivers, who
> loses money on failed deliveries and on disputes, and has nothing but a dropdown
> to show for either.

---

## 4:05–4:20 · What is next · Slide 7 · 15s

**SCREEN:** Slide 7, then cut back to the board with a real record on it, and
hold there while the last line is read.

**VOICE:**

> Next: scanning the parcel instead of tapping it, which matters because plenty of
> drivers do not read easily. Capture that survives losing signal. And a fourth
> region, which is a JSON file and an afternoon.
>
> Everything you have seen is in the repository, including every transcript the
> measurement is built on.

End on the board. No logo animation, no music sting, no fade.

---

## Things that lose marks

- Explaining the architecture before showing it work
- A silent screen recording with a voiceover bolted on afterwards that does not line up
- Saying "as you can see" while the screen shows something else
- Reading the schema, or any code, out loud
- Talking over the agent's replies in the demo — the judge needs to hear it work
- Any claim the video does not then demonstrate
- Going over five minutes. It is a hard limit, not a target
