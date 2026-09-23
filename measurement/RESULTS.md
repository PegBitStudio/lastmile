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

## 2. Real voice — Yashfa, Lahore, 19 addresses

Recorded by a Lahore speaker reading her own city's addresses. **This is the set
that counts**, and it is the one to put on the slide.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **26%** | **37%** |
| Average word error rate | 16.9% | 13.3% |

Nineteen of the twenty: LHR-12, Bahria Town, has no recording yet.

**The first five clips said 40% to 80%.** With nineteen it is 26% to 37%. The
smaller number is the true one: five clips is too few to measure anything, and the
first five happened to be the ones the pack helps most. Reporting the flattering
number would have been the easiest mistake in this project to make.

### What is actually going wrong, which is not what we expected

Most of the remaining error is not a mis-heard place name. It is how an address is
said out loud against how it is written down:

| Said | Written in the sheet |
|---|---|
| "House **number** 9, street **number** 4" | "House 9, Street 4" |
| "Gulberg **Phase 3**" | "Gulberg **III**" |
| "Office **number** 5" | "Office 5" |

The recogniser heard those clips correctly. They score as failures because the
words differ from the sheet. Keyterms cannot fix that, and no pack ever will.

So the honest reading is: **the pack helps with local names, and roughly half of
what is left is a scoring convention, not a recognition problem.** Normalising
spoken numbers and ordinals before comparing would separate the two. Both runs
would gain equally, so the gap between them — the thing the claim rests on — would
not be flattered by it.

That is Yashfa's call, since the scoring is hers.

## 3. London — 20 addresses, synthetic British voice

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **65%** | **65%** |
| Average word error rate | 6.4% | 6.4% |

**The pack makes no difference in London, and that is the finding.** English street
names in a British accent are already what the recogniser expects. Keyterm biasing
earns its keep where the vocabulary is non-Western — which is exactly the claim the
market research made, now measured rather than asserted.

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

## London found a bug in our own pack

The first London run came back *worse* with keyterms on: 60% against 65%. One clip
caused all of it.

> *"9 Colville Mews, Notting Hill, **W11**"* → **on:** `Notting Hill, **W1 1**`

The pack listed `W1` as a keyterm. Biasing towards `W1` split the longer postcode
`W11` into `W1 1`. **A keyterm that is a prefix of a longer word can corrupt that
word.** The same trap was waiting in `E1` against `E14`, and `N1` against `N16`.

Removing the ten bare postcode fragments restored the score to exactly 65% and 6.4%
— identical to keyterms off, which is the correct result for London. The pack is
fixed and the London agent is updated.

This is the strongest argument for measuring at all. Without the control run, we
would have shipped a pack that quietly made London worse and never known.

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

## Still to do, and who can do it

A region pack is a claim about how people speak in one place, so **the recordings
have to come from someone who lives there.** Yashfa reading Lagos addresses would
measure nothing — it would test a Pakistani speaker on Nigerian place names, which
is not a case any driver is in.

| Pack | Who records it | State |
|---|---|---|
| Lahore | Yashfa | 5 done, 15 to go |
| Lagos | Dami | 20 to record — sheet ready at `lagos_recording_manifest.xlsx` |
| London | Nobody on the team | Generated voice, labelled as such on the slide |

**London is the honest gap.** Neither of us is a London speaker. We use a
text-to-speech voice, say so plainly, and treat it as a demonstration that the pack
loads and changes the vocabulary — not as evidence about recognition.

Also outstanding:

- A noisy-street set. Yashfa tested in noise informally on 2026-09-21 and reported
  it worked, but nothing was measured.
