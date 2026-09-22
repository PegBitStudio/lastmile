# Measuring what the region packs are worth

One number decides the strongest slide in the deck: **how much better recognition
gets when the region pack's keyterms are switched on.**

So every clip is transcribed twice — once with keyterms, once without — from a
single upload. One run on its own produces a number with nothing to compare it to.

## 1. Record

`lahore_recording_manifest.xlsx` lists 20 Lahore addresses. Say each one, save it as
the filename in the sheet, and put the files in `measurement/audio/`.

Rules that matter more than the microphone:

- **Same room, same distance, same phone, every time.** A change in method looks
  exactly like a change in accuracy.
- Say the address the way a driver would, not the way a newsreader would.
- The **Correct Text** column is the truth we score against. Fix it if you said
  something slightly different — do not re-record to match the sheet.

## 2. Run it

```powershell
python -m pip install requests openpyxl
python measurement/evaluate_addresses.py --audio-dir ./measurement/audio --manifest ./measurement/lahore_recording_manifest.xlsx --pack ./regions/pk-lahore.json
```

The key is read from `.env.local` if it is not in the environment. Clips with no
audio file are skipped with a note, so a half-finished set still runs.

`--runs on` or `--runs off` does a single side, for a quick check.

## 3. What comes out

Two things, both written for you:

- **The spreadsheet**, with a `Summary` sheet: exact match and average WER, before
  and after, and the change between them.
- **A CSV beside it**, in the column order frozen in `docs/architecture.md` §8, so
  the numbers go into the deck without being retyped.

Exact match should go **up**. WER should go **down**.

## The two scores, and which one goes on the slide

- **Exact match** — did the whole address come out right? Harsh, and the one a
  person understands instantly. This is the headline.
- **WER** — what fraction of words were wrong. Kinder, and it shows movement even
  when no address is perfect. This is the diagnostic.

Report both. Lead with exact match.

## Who records which pack

A region pack is a claim about how people speak in one place, so the voice has to
come from someone who lives there. A Lahore speaker reading Lagos addresses tests a
Pakistani accent on Nigerian place names, which is nobody's real situation.

| Pack | Recorded by | Sheet |
|---|---|---|
| Lahore | Yashfa | `lahore_recording_manifest.xlsx`, and her own clips in `lahore_human_manifest.xlsx` |
| Lagos | Dami | `lagos_recording_manifest.xlsx` |
| London | Nobody on the team | Generated voice, labelled as such |

## Do the same for every pack

```powershell
python measurement/evaluate_addresses.py --audio-dir ./measurement/audio-lagos --manifest ./measurement/lagos_recording_manifest.xlsx --pack ./regions/ng-lagos.json
```

The sheet names the file it expects for each line — `los-01.m4a` and so on. Rename
your recordings to match, or change the sheet: whichever is quicker.
