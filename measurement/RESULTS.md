# What the region pack is worth

Every clip is transcribed twice: once with the pack's 100 Lahore keyterms, once
without. Nothing else changes between the two runs.

## 1. Synthetic voice — 20 addresses, made first

Text-to-speech stand-ins, generated on 2026-09-21 because no human recordings
existed yet and the slide could not wait for them.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **65%** | **100%** |
| Average word error rate | 29.5% | 0.0% |

## 2. Real voice — Yashfa, Lahore, 5 addresses

Recorded 2026-09-21 by a Lahore speaker reading her own city's addresses. This is
the set that counts.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **40%** | **80%** |
| Average word error rate | 8.7% | 2.2% |

Run 2026-09-22. Model `universal-3-5-pro`. Rows in the two `-results.csv` files.

**Both sets, in the order they happened.** The synthetic set came first and is
larger, so it shows more failure modes. The real voice came a day later and is the
evidence that counts — and note that its gap is *smaller*. Synthetic speech is
cleaner than a person, which is why its keyterms-on score reaches a perfect 100%.
**Quote the human numbers. Use the synthetic ones to show the failures.**

---

## What broke without the pack

**On the synthetic voice**, two clips came back in **Devanagari script** — the
recogniser heard South Asian speech and stopped transcribing English at all:

> `अपार्टमेंट टwelve ब्लॉक ई वॉप डे टाउन लाहौर`

Also `Wapda Town` → **`Wobdetown`**, `Gulberg` → **`Gulbeg`**, `DHA` → **`DH`**.

**On the real voice:**

> *"House number 17, street number 6, Phase 5, DHA Lahore"*
> **off:** `... Phase 5, DHL Award.` **on:** `... Phase 5, DHA Lahore.`

DHA — the largest housing authority in Pakistan — became **DHL**, the courier
company, and "Lahore" became "Award". In a delivery app, of all the wrong words to
choose.

> *"Flat number 8, Block C, **Gulberg III**"* → **off:** `Gulberg 3`

A dispatcher searching for Wapda Town finds nothing. The parcel is lost inside the
system even though the driver said the right thing.

**So the pack is not only spelling help. It keeps the recogniser in the right
language.**

---

## Honest notes

**One open question on the real set.** `LHR-04` is written as *House 42* in the
sheet, and both runs heard *House 48*. Two models agreeing against the sheet
suggests she read 48, but nobody has confirmed it. Until someone listens, it counts
as a miss in both columns. **If she said 48, keyterms-on is 5 out of 5.**

**A scoring bug was fixed on 2026-09-22.** `24-A` and `24A` were being scored as
different addresses, because the normaliser split on the hyphen. That penalised both
columns equally, so the gap never moved — but it made every score look worse. Fixed;
both sets were re-run.

**The synthetic voices are an Indian-English text-to-speech voice**, not Pakistani
and not human. Synthetic speech is cleaner than a person at a kerb, which is why its
keyterms-on score reaches 100%. Treat the gap as the finding, never the number.

## Still to do

- 15 more real Lahore clips, to match the synthetic set size.
- Lagos and London have no recordings at all.
- A noisy-street set. Yashfa tested in noise informally on 2026-09-21 and reported it
  worked, but nothing was measured.
