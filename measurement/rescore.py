#!/usr/bin/env python
"""Score a finished run again, without paying to transcribe it again.

Every transcript is already in the `-results.csv`. Changing how we score should
not cost another upload of every clip, and it should never be a reason to leave
a scoring question unanswered.

    python measurement/rescore.py measurement/lahore_human_manifest-results.csv

Prints both scorings side by side:

  strict  — exactly as written in the sheet
  spoken  — ignoring a spoken "number", and Gulberg III against Gulberg 3

Both are applied to both runs, so the gap between keyterms on and off is the
same either way. That gap is the claim; the rest is presentation.
"""
import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from evaluate_addresses import score  # noqa: E402

RUNS = (("keyterms off", "transcript_no_keyterms"), ("keyterms on", "transcript_with_keyterms"))


def summarise(rows, spoken):
    out = {}
    for label, col in RUNS:
        scored = [score(r["ground_truth"], r.get(col, ""), spoken=spoken) for r in rows]
        exact = 100 * sum(1 for s in scored if s["exact"]) / len(scored)
        wer = 100 * sum(s["wer"] for s in scored) / len(scored)
        out[label] = (exact, wer)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    path = Path(sys.argv[1])
    rows = list(csv.DictReader(io.open(path, encoding="utf-8")))
    if not rows:
        print("No rows in", path)
        return 1

    print(f"{path.name}: {len(rows)} clips\n")
    print(f"{'':28} {'exact':>16}   {'word error rate':>18}")
    for label, spoken in (("strict", False), ("spoken", True)):
        d = summarise(rows, spoken)
        off_e, off_w = d["keyterms off"]
        on_e, on_w = d["keyterms on"]
        print(
            f"{label:<28} {off_e:5.0f}% -> {on_e:3.0f}%   "
            f"{off_w:8.1f}% -> {on_w:4.1f}%   gap {on_e - off_e:+.0f} points"
        )

    print("\nThe gap is what the pack is worth. It does not move between the two rows,")
    print("because every rule is applied to both runs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
