# The five-minute video

Target **4:20**, hard limit 5:00. MP4, under 300 MB.

Presentation is a quarter of the score, and it is the quarter most teams lose. The
rule for every shot below: **show the thing working, then say why it matters.**
Never the other way round, and never say anything the screen is not already
proving.

Record the demo in one take if you can. A cut in the middle of a voice
conversation looks like a cut that hides a failure.

---

## Before you press record

- [ ] `npm run dev`, or use the live URL. Both work; local has no cold start
- [ ] Phone on the desk, screen recording on, **notifications off**
- [ ] The backup take already recorded, in case the live one fails
- [ ] Say the numbers out loud once. 90, 85, 60. You will fluff them otherwise

Two voices is better than one. Dami narrates and drives; Yashfa takes 2:35–3:05,
which is her work. A second voice wakes a tired judge up at exactly the right moment.

---

## 0:00–0:20 · The problem, from the kerb

**Shot:** a phone in one hand, a parcel under the other arm. A locked gate if you
can film one.

> A driver finishes thirty stops a day. Six or eight go wrong. The customer is out,
> the gate is locked, a neighbour takes the parcel.
>
> The outcome gets recorded, because the scanner will not let them move on. What
> never gets recorded is the story. Which gate. Whose name. Whether he signed.
>
> Three weeks later a customer says nothing arrived, and that story is the only
> thing that would have settled it.

**Do not say "AI" yet.** Twenty seconds on the problem buys you the next four minutes.

---

## 0:20–0:35 · The agent refuses to start

**Shot:** the driver screen while moving. "Waiting until you've stopped." Press the
button; nothing happens. Then stop, and the microphone opens.

> It will not talk to a driver who is driving.
>
> A back-and-forth conversation with someone at the wheel is a liability no fleet
> would sign off. So it waits until the van stops. Park, speak, go.

Fifteen seconds, and it is the one guardrail nobody else will have.

---

## 0:35–1:40 · The loop, in one take

**Shot:** one continuous recording of the driver screen. Speak normally, with
background noise if you have it.

Say this, in one breath:

> *"Couldn't deliver, customer wasn't in, left it with the gateman."*

The agent asks for the name. Answer. It asks which gate. Answer. It reads the
record back and stops.

Then **do it again on a second stop**, and this time say everything at once:

> *"Left it with Ademola the gateman at the black gate."*

**It asks nothing.** It confirms and closes.

> Nothing changed between those two runs. No different prompt, no second agent.
>
> Our code works out which fields are still empty and hands the agent that list on
> every single turn. The agent only decides how to ask. Say everything at once and
> there is nothing left to ask, so it asks nothing.

That contrast **is** the product. Give it room.

---

## 1:40–2:10 · The record, and the driver's own voice

**Shot:** switch to `/board`. The record is already there.

> Three columns, kept apart on purpose. What the driver said. What the phone saw —
> time, location, how far from the address. What the customer gave, which is
> nothing, and we say so.

**Click the ▶ next to a field.** Let the driver's own voice play.

> That is the part a carrier pays for. Not a text box somebody typed. The driver
> saying who took it, at the stop, kept against the field it proves.
>
> We only keep the clips a field actually cites. Everything else stays on the phone.

---

## 2:10–2:35 · Two countries, same code

**Shot:** the region switch. Pick Lahore. Report a drop using a Lahore address.

> Same code. A different word list.
>
> Local knowledge is data here, not code. Adding a country is a JSON file.

---

## 2:35–3:05 · The measurement — Yashfa

**Shot:** the results table, on screen, large.

> We did not want to claim that word lists help. We measured it.
>
> Sixty recordings in our own voices, each transcribed twice. The word list is the
> only thing that changes between the two runs.

| | Off | On |
|---|---|---|
| Lagos | 65% | **90%** |
| Lahore | 75% | **85%** |
| London | 65% | **60%** |

> Lagos goes from 65 to 90. Lahore, 75 to 85.
>
> And London gets slightly worse. We are showing you that because it is the finding:
> biasing helps where the words are far from English, and gets in the way where they
> already are English.

**Say the London number out loud.** A team that reports a result against itself is a
team whose other numbers you believe.

---

## 3:05–3:25 · When it is not sure

**Shot:** a record flagged **needs review**.

> A wrong name written silently is worse than no record. When the recogniser is
> unsure, a second model checks the words the record depends on, and the record is
> flagged rather than accepted.

---

## 3:25–4:10 · Who buys it, and what it is not

**Shot:** the board, stationary. Talking head is fine here.

> This is not proof of delivery, and we do not claim it is. A driver's recording is
> a statement by someone with an interest. Real proof is a scan, a photo, a
> signature — and those tools already exist.
>
> What did not exist is the story next to them. This is an evidence layer that sits
> beside the scanner a carrier already runs, and hands back a structured record with
> the audio attached.
>
> The buyer is the operations manager with twenty to two hundred drivers, who loses
> money on failed deliveries and disputes and has nothing but a dropdown to show for
> them.

---

## 4:10–4:20 · What is next

> Next: scan the parcel instead of tapping it, which matters because plenty of
> drivers do not read easily. Offline capture. And the fourth region pack, which is
> a JSON file and an afternoon.

End on the board with a real record on it. No logo animation. No music sting.

---

## Things that lose marks

- Explaining the architecture before showing it work
- A silent screen recording with a voiceover bolted on afterwards
- Saying "as you can see" while the screen shows something else
- Reading the schema out loud
- Any claim the video does not then demonstrate
- Going over five minutes. It is a hard limit
