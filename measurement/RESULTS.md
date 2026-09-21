# What the region pack is worth

**Lahore, 20 addresses, each transcribed twice: once with the pack's 100 keyterms,
once without. Nothing else changed.**

| | Keyterms off | Keyterms on |
|---|---|---|
| **Addresses fully correct** | **60%** | **95%** |
| Average word error rate | 30.9% | 1.4% |

Run on 2026-09-21. Model: `universal-3-5-pro`. Raw rows in
`lahore_recording_manifest-results.csv`, workings in the spreadsheet's `Summary` tab.

---

## Read this before the numbers

**The voices are synthetic.** These 20 clips were generated with a text-to-speech
voice (ElevenLabs, Indian English — no Pakistani voice was available), because
Yashfa's recordings had not arrived and the slide could not wait. They are a
stand-in, not a result about real drivers.

What that changes:

- Synthetic speech is **cleaner** than a person at a kerb. Both columns are
  flattered. The *gap* between them is the finding, not either number alone.
- One accent, one speaker, no background noise. A real test needs several people.

**Replace them.** When Yashfa's recordings land, drop them into `measurement/audio`
and run the same command. The numbers will change; the method does not.

---

## What actually broke without the pack

Seven of the twenty came out differently. Three kinds of failure:

**1. The recogniser switched language entirely.** Two clips came back in Devanagari
script — it heard South Asian speech and gave up on English.

> *"Apartment 12, Block E, Wapda Town, Lahore"*
> **off:** `अपार्टमेंट टwelve ब्लॉक ई वॉप डे टाउन लाहौर`
> **on:** `Apartment 12, Block E, Wapda Town, Lahore`

This is the one to put on screen. It is not a near miss, it is an unusable record.

**2. Place names dissolved into other words.**

> *"House 36, Street 10, Wapda Town, near Canal Road"* → **`Wobdetown`**
> *"Flat 4, Block A, Gulberg III"* → **`Gulbeg 3`**

A dispatcher searching for Wapda Town finds nothing. The parcel is lost in the
system even though the driver said the right thing.

**3. Local conventions were normalised away.** `Gulberg III` became `Gulberg 3`,
`DHA` became `DH`. Small on screen, wrong in a database.

---

## Why both scores are reported

- **Addresses fully correct** (normalised exact match) — the headline. A person
  understands it instantly and it is the harsher test.
- **Word error rate** — the diagnostic. It shows movement even when no address is
  perfect, and it is what makes the language-switch failures visible as a number.

Exact match goes up, WER goes down. Both moved a long way here.

## Still to do

- The same run for Lagos and London. Neither has recordings yet.
- Real human voices, several speakers, with street noise.
