# What the region pack is worth

Every clip is transcribed twice: once with its region's keyterms, once without.
Nothing else changes between the two runs.

## The four sets, side by side

| Region | Voice | Off | On | Gap |
|---|---|---|---|---|
| **Lagos** | Dami, Nigerian | 65% | **90%** | **+25** |
| **Lahore** | Yashfa, Pakistani | 75% | **85%** | **+10** |
| **London** | Dami, Nigerian, on London addresses | 40% | **55%** | **+15** |
| **London** | Synthetic British | 65% | **65%** | **0** |

Addresses fully correct, same agent, same clips, keyterms the only difference.

**The pack pays where the vocabulary is furthest from what the recogniser expects,
and does nothing where it is already native.** That is the claim the market research
made in week one, now measured — including where it goes against us.

## 1. Synthetic voice — 20 addresses, made first

Text-to-speech stand-ins, generated on 2026-09-21 because no human recordings
existed yet and the slide could not wait for them.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **65%** | **100%** |
| Average word error rate | 29.5% | 0.0% |

## 2. Real voice — Yashfa, Lahore, all 20 addresses

Recorded by a Lahore speaker reading her own city's addresses. **This is the set
that counts**, and the one for the slide.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **75%** | **85%** |
| Average word error rate | 4.6% | 1.9% |

Complete: twenty of twenty.

### Two numbers, and why the smaller pair was wrong

The first scoring said 26% against 37%. Almost every failure looked like this:

| She said | The sheet said |
|---|---|
| "House **number** 9, street **number** 4" | "House 9, Street 4" |
| "Gulberg **Phase 3**" | "Gulberg **III**" |

The recogniser heard those correctly. They were scored as failures because nobody
writes an address the way they say it. That measured our spreadsheet, not the
model.

So scoring now ignores a spoken "number" and treats Gulberg III and Gulberg 3 as
one place — `--spoken`, in `evaluate_addresses.py`. Every rule is applied to both
runs.

**The gap did not move: +11 points either way.**

| Scoring | Keyterms off | on | Gap |
|---|---|---|---|
| Strict, as written | 30% | 40% | **+10** |
| Spoken conventions ignored | 75% | 85% | **+10** |

That is the check that matters. A change to scoring that moved the gap would be
flattering the claim; this one only removes noise sitting on top of both runs.
Word error rate more than halves, 4.6% to 1.9%, because the pack fixes the words
that remain.

**Five clips said 40% to 80%.** Twenty say 75% to 85%. The bigger set is the
honest one: five clips measure nothing, and those five happened to be the ones the
pack helps most.

### A caveat on the synthetic set above

Two of its clips came back written in Hindi script, on the keyterms-off run only.
They score zero, so part of that set's jump from 65% to 100% is the recogniser
guessing a language rather than the pack doing work. The real-voice set has none
of this, which is one more reason to lead with it.

## 3. Real voice — Dami, Lagos, 20 addresses

Recorded by a Lagos speaker reading his own city's addresses, 23 September.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **65%** | **90%** |
| Average word error rate | 7.3% | 1.6% |

**The largest gain of any set: +25 points.** Without the pack the recogniser wrote
"Blog si Banana Island ikuii" for Block C, Banana Island, Ikoyi, and "Shongotedo"
for Sangotedo. With it, both are right.

The spoken-conventions scoring changes nothing here — 65% to 90% either way —
because these errors are real mis-hearings of place names, not a writing
convention.

## 4. London — synthetic British voice, 20 addresses

Re-run on 24 September against the fixed 24-term pack.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **65%** | **65%** |
| Average word error rate | 6.4% | 6.4% |

**The pack changes nothing at all here, and that is the finding.** English street
names in a British accent are already what the recogniser expects, so there is
nothing for a biasing term to fix. Identical to the decimal place, in both columns.

The earlier run of this set scored 60% and looked like active harm. That was our own
bug, not the model's — see §6. Keyterm biasing earns its keep where the vocabulary
is unexpected, and this row is what that claim is measured against.

## 5. London — Dami, Nigerian voice on London addresses, 20 addresses

Recorded 24 September. Not a mismatch: a great many Nigerians drive deliveries in
the UK, so this is an ordinary day's work rather than a stress test.

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **40%** | **55%** |
| Average word error rate | 20.8% | 15.1% |

**The hardest set we have, and the pack still pays.** 40% without it is worse than
any speaker in their own city — the accent and the place names miss independently,
and the errors are not the ones either set makes alone: `buzzer number 6` became
`Bursa No. 6`, `Islington` became `Eastlington`, `Hammersmith` became `Amersmith`.

Two clips resist the pack entirely: `Marlow Point, Canary Wharf` and `Rosslyn Hill,
Hampstead`. Both are in the keyterm list. The audio is the limit there, not the
vocabulary.

## How to check any of this

Every transcript is kept, so the scoring can be re-run for nothing:

```powershell
python measurement/rescore.py measurement/lahore_human_manifest-results.csv
```

It prints both scorings side by side for whichever set you point it at.

Lahore and Lagos run 2026-09-22, London 2026-09-24. Model `universal-3-5-pro`.
Rows in the `-results.csv` files beside each sheet.

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

**Re-measured on 24 September, and it holds:** 65% and 6.4% in both columns, from a
fresh run of the same twenty clips against the 24-term pack. The sheet from the
broken run is kept at `source/london-prefix-postcode-bug.xlsx`, because a bug whose
evidence you deleted is just a claim.

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
| Lahore | Yashfa | 20 of 20, done 22 Sep |
| Lagos | Dami | 20 of 20, done 23 Sep |
| London | Dami, plus a synthetic voice | 20 of each, done 24 Sep |

**London is still the honest gap, in a narrower way.** Neither of us lives in
London. The synthetic British voice tests the pack against the accent the
recogniser already expects; Dami's clips test it against a Nigerian driver working
London streets, which is a real and common case but not the only one. A London-born
speaker would complete the picture, and we do not have one.

Also outstanding:

- A noisy-street set. Yashfa tested in noise informally on 2026-09-21 and reported
  it worked, but nothing was measured.
