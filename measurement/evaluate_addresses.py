#!/usr/bin/env python3
"""
Lastmile address evaluation
Audio in -> AssemblyAI transcript -> Exact Match + WER -> XLSX + CSV

Written by Yashfa. The scoring is hers, unchanged. What was added is the second
run: every clip is transcribed twice, once with the region pack's keyterms and
once without, because "keyterms on versus keyterms off" is the measurement the
whole project rests on. One run alone produces a number with nothing to compare
it to.

Usage (PowerShell on Windows; the key can also live in .env.local):

  pip install requests openpyxl
  python measurement/evaluate_addresses.py `
      --audio-dir ./measurement/audio `
      --manifest ./measurement/lahore_recording_manifest.xlsx `
      --pack ./regions/pk-lahore.json

The manifest must contain:
  Test ID | Audio Filename | Correct Text

Everything else is written back into it, and a CSV is written beside it in the
column order frozen in docs/architecture.md section 8, so the numbers drop
straight into the deck.

Each clip is uploaded once and transcribed twice from the same URL. Uploading it
again for the second run would cost time and prove nothing.
"""

import argparse
import csv
import json
import os
import re
import time
import unicodedata
from pathlib import Path

import requests
from openpyxl import load_workbook

BASE = "https://api.assemblyai.com/v2"
TIMEOUT = 60


def normalize(text: str) -> str:
    """Safe normalization for address matching; preserves word/number identity."""
    text = unicodedata.normalize("NFKC", text or "").casefold()
    # Hyphens and apostrophes join a word rather than break it: "24-A" and "24A"
    # are the same address, and splitting them scored a correct transcript wrong.
    text = re.sub(r"[-‐-―'’]", "", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


# How an address is said out loud, against how it is written down. Nobody writes
# "House number 9", and everybody says it. Scoring that as a miss measures a
# writing convention, not the recogniser.
#
# Every rule below is applied to BOTH sides and to BOTH runs, so the gap between
# keyterms on and off — the only thing the claim rests on — cannot be flattered by
# any of it. Deliberately short: each rule is one we watched cost a real clip.
SPOKEN_FILLERS = {"number", "no", "nos", "phase"}
ROMAN = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6",
         "vii": "7", "viii": "8", "ix": "9", "x": "10"}
WORD_ORDINALS = {"first": "1", "second": "2", "third": "3", "fourth": "4", "fifth": "5"}


def normalize_spoken(text: str) -> str:
    """normalize(), plus the ways an address is spoken rather than written."""
    out = []
    for word in normalize(text).split():
        if word in SPOKEN_FILLERS:
            continue  # "house number 9" is "house 9"
        out.append(ROMAN.get(word, WORD_ORDINALS.get(word, word)))
    return " ".join(out)


def levenshtein_words(reference: str, hypothesis: str, norm=None) -> tuple[int, int, int]:
    """Return substitutions, deletions, insertions using word-level edit distance."""
    norm = norm or normalize
    ref = norm(reference).split()
    hyp = norm(hypothesis).split()
    n, m = len(ref), len(hyp)

    # dp[i][j] = (cost, S, D, I)
    dp = [[(0, 0, 0, 0) for _ in range(m + 1)] for __ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = (i, 0, i, 0)
    for j in range(1, m + 1):
        dp[0][j] = (j, 0, 0, j)

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                candidates = [
                    (dp[i - 1][j - 1][0] + 1, dp[i - 1][j - 1][1] + 1,
                     dp[i - 1][j - 1][2], dp[i - 1][j - 1][3]),  # substitution
                    (dp[i - 1][j][0] + 1, dp[i - 1][j][1],
                     dp[i - 1][j][2] + 1, dp[i - 1][j][3]),      # deletion
                    (dp[i][j - 1][0] + 1, dp[i][j - 1][1],
                     dp[i][j - 1][2], dp[i][j - 1][3] + 1),      # insertion
                ]
                dp[i][j] = min(candidates, key=lambda x: x[0])
    return dp[n][m][1], dp[n][m][2], dp[n][m][3]


def upload_file(audio_path: Path, api_key: str) -> str:
    """Upload once. Both runs transcribe from the same URL."""
    with audio_path.open("rb") as f:
        upload = requests.post(
            f"{BASE}/upload",
            headers={"authorization": api_key},
            data=f,
            timeout=TIMEOUT,
        )
    upload.raise_for_status()
    return upload.json()["upload_url"]


def transcribe(audio_url: str, api_key: str, keyterms: list[str], language: str) -> str:
    """One transcription. Pass keyterms=[] for the control run."""
    headers = {"authorization": api_key}

    payload = {
        "audio_url": audio_url,
        "speech_models": ["universal-3-5-pro", "universal-2"],
        "prompt": "Last-mile delivery address spoken by a driver. The recording contains addresses, buildings, entrances, local place names and delivery details.",
    }

    # The control run sends no keyterms at all, rather than an empty list, so the
    # two requests differ in exactly one thing.
    if keyterms:
        payload["keyterms_prompt"] = keyterms

    # en-GB is useful for the London pack. For Lahore, en-PK may not be
    # accepted by every model configuration, so fall back to no explicit code.
    if language:
        payload["language_code"] = language

    response = requests.post(
        f"{BASE}/transcript",
        headers={**headers, "content-type": "application/json"},
        json=payload,
        timeout=TIMEOUT,
    )

    # If a locale is rejected, retry without language_code.
    if response.status_code >= 400 and "language_code" in payload:
        payload.pop("language_code", None)
        response = requests.post(
            f"{BASE}/transcript",
            headers={**headers, "content-type": "application/json"},
            json=payload,
            timeout=TIMEOUT,
        )

    response.raise_for_status()
    transcript_id = response.json()["id"]

    while True:
        result = requests.get(
            f"{BASE}/transcript/{transcript_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        result.raise_for_status()
        data = result.json()
        status = data.get("status")

        if status == "completed":
            return data.get("text", "")
        if status == "error":
            raise RuntimeError(data.get("error", "AssemblyAI transcription failed"))

        time.sleep(3)


def score(reference: str, hypothesis: str, spoken: bool = False) -> dict:
    """Exact match and WER for one pair. Yashfa's scoring, unchanged.

    `spoken` adds the layer above, which treats "House number 9" and "House 9" as
    the same address. It never changes which run wins, because it is applied to
    both of them.
    """
    norm = normalize_spoken if spoken else normalize
    exact = norm(reference) == norm(hypothesis)
    subs, dels, ins = levenshtein_words(reference, hypothesis, norm)
    ref_words = len(norm(reference).split())
    return {
        "exact": exact,
        "wer": (subs + dels + ins) / ref_words if ref_words else 0.0,
        "detail": f"S={subs}, D={dels}, I={ins}",
    }


def column(ws, headers: dict, name: str) -> int:
    """Find a column by its heading, adding it on the right if it is new."""
    if name in headers:
        return headers[name]
    col = ws.max_column + 1
    ws.cell(1, col).value = name
    headers[name] = col
    return col


def read_key() -> str:
    """The key, from the environment or from .env.local, which git ignores."""
    key = os.getenv("ASSEMBLYAI_API_KEY")
    if key:
        return key
    env_local = Path(".env.local")
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ASSEMBLYAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'").strip('"')
    return ""


OFF = "no keyterms"
ON = "with keyterms"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-dir", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--pack", required=True, type=Path)
    parser.add_argument(
        "--runs",
        choices=["both", "on", "off"],
        default="both",
        help="both (default) measures what the pack is worth. on or off is one side only.",
    )
    parser.add_argument(
        "--spoken",
        action="store_true",
        help=(
            "Score how an address is said, not how it is written: ignore a spoken "
            "'number', and treat Gulberg III and Gulberg 3 as one place. Applied to "
            "both runs, so the gap between keyterms on and off is unchanged."
        ),
    )
    parser.add_argument(
        "--csv",
        type=Path,
        help="Where to write the CSV. Defaults to <manifest>-results.csv beside it.",
    )
    args = parser.parse_args()

    api_key = read_key()
    if not api_key:
        raise SystemExit("No ASSEMBLYAI_API_KEY, and none in .env.local.")

    pack = json.loads(args.pack.read_text(encoding="utf-8"))
    pack_id = pack.get("id", args.pack.stem)
    keyterms = pack.get("keyterms", [])
    language = pack.get("language", "")

    if args.runs in ("both", "on") and not keyterms:
        raise SystemExit(f"{pack_id} has no keyterms, so there is nothing to measure.")

    runs = [OFF, ON] if args.runs == "both" else [ON if args.runs == "on" else OFF]

    wb = load_workbook(args.manifest)
    ws = wb.active
    headers = {cell.value: cell.column for cell in ws[1] if cell.value}

    required = ["Test ID", "Audio Filename", "Correct Text"]
    missing = [h for h in required if h not in headers]
    if missing:
        raise SystemExit(f"Manifest is missing columns: {missing}")

    cols = {
        run: {
            "transcript": column(ws, headers, f"Transcript ({run})"),
            "exact": column(ws, headers, f"Exact Match ({run})"),
            "wer": column(ws, headers, f"WER ({run})"),
            "detail": column(ws, headers, f"Notes ({run})"),
        }
        for run in runs
    }

    rows = []

    for row in range(2, ws.max_row + 1):
        test_id = ws.cell(row, headers["Test ID"]).value
        filename = ws.cell(row, headers["Audio Filename"]).value
        reference = ws.cell(row, headers["Correct Text"]).value

        if not filename or not reference:
            continue

        audio_path = args.audio_dir / str(filename)
        if not audio_path.exists():
            print(f"[{test_id}] no audio at {audio_path}, skipped")
            continue

        print(f"[{test_id}] uploading {audio_path.name} ...")
        audio_url = upload_file(audio_path, api_key)

        record = {"pack_id": pack_id, "utterance_id": test_id, "ground_truth": reference}

        for run in runs:
            print(f"[{test_id}] transcribing, {run} ...")
            transcript = transcribe(audio_url, api_key, keyterms if run == ON else [], language)
            result = score(reference, transcript, spoken=args.spoken)

            ws.cell(row, cols[run]["transcript"]).value = transcript
            ws.cell(row, cols[run]["exact"]).value = "Yes" if result["exact"] else "No"
            ws.cell(row, cols[run]["wer"]).value = result["wer"]
            ws.cell(row, cols[run]["detail"]).value = result["detail"]

            if run == OFF:
                record["transcript_no_keyterms"] = transcript
                record["score_before"] = round(result["wer"], 4)
                record["exact_before"] = "Yes" if result["exact"] else "No"
            else:
                record["transcript_with_keyterms"] = transcript
                record["score_after"] = round(result["wer"], 4)
                record["exact_after"] = "Yes" if result["exact"] else "No"

        rows.append(record)

    def mean(values):
        return (sum(values) / len(values)) if values else None

    exact = {}
    wer = {}
    for run in runs:
        ekey = "exact_before" if run == OFF else "exact_after"
        skey = "score_before" if run == OFF else "score_after"
        exact[run] = mean([1.0 if r.get(ekey) == "Yes" else 0.0 for r in rows])
        wer[run] = mean([r[skey] for r in rows if skey in r])

    # Summary sheet: the two runs side by side, and the gap between them.
    if "Summary" in wb.sheetnames:
        del wb["Summary"]
    summary = wb.create_sheet("Summary")
    summary["A1"] = "Metric"
    summary["B1"] = OFF
    summary["C1"] = ON
    summary["D1"] = "Change"
    summary["A2"] = "Exact match"
    summary["A3"] = "Average WER"

    for col, run in (("B", OFF), ("C", ON)):
        if run in runs:
            summary[f"{col}2"] = exact[run]
            summary[f"{col}3"] = wer[run]
            summary[f"{col}2"].number_format = "0.0%"
            summary[f"{col}3"].number_format = "0.0%"

    if len(runs) == 2 and rows:
        summary["D2"] = (exact[ON] or 0) - (exact[OFF] or 0)
        summary["D3"] = (wer[ON] or 0) - (wer[OFF] or 0)
        summary["D2"].number_format = "+0.0%;-0.0%"
        summary["D3"].number_format = "+0.0%;-0.0%"
        summary["A5"] = "Read this as"
        summary["B5"] = "Exact match should go up. WER should go down."

    summary["A7"] = "Primary metric"
    summary["B7"] = "Normalized Exact Match"
    summary["A8"] = "Secondary diagnostic"
    summary["B8"] = "Word Error Rate (WER)"
    summary["A9"] = "Clips scored"
    summary["B9"] = len(rows)
    summary["A10"] = "Region pack"
    summary["B10"] = f"{pack_id} ({len(keyterms)} keyterms)"

    wb.save(args.manifest)
    print(f"Saved results to {args.manifest}")

    # The CSV column order is frozen in docs/architecture.md section 8, so these
    # numbers drop straight into the deck without being retyped.
    csv_path = args.csv or args.manifest.with_name(f"{args.manifest.stem}-results.csv")
    fields = [
        "pack_id",
        "utterance_id",
        "ground_truth",
        "transcript_no_keyterms",
        "transcript_with_keyterms",
        "score_before",
        "score_after",
        "exact_before",
        "exact_after",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for record in rows:
            writer.writerow(record)
    print(f"Saved {len(rows)} rows to {csv_path}")

    if len(runs) == 2 and rows:
        print("")
        print(f"Exact match: {exact[OFF]:.0%} without keyterms, {exact[ON]:.0%} with.")
        print(f"Average WER: {wer[OFF]:.1%} without, {wer[ON]:.1%} with.")


if __name__ == "__main__":
    main()
