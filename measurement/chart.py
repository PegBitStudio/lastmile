#!/usr/bin/env python
"""Draw the result chart from the results themselves.

    python measurement/chart.py

Writes docs/chart-regions.svg. `npm run cover` turns it into a PNG for the deck
and the video.

The numbers are read from the `-results.csv` files every time, so the chart and
the claim cannot drift apart. Nothing here is typed in by hand.

Form: a dumbbell, because the job is change with direction. Bars would make the
reader subtract four pairs in their head, and London's flat line is the whole
point — a pair of dots sitting on top of each other says "no effect" faster than
any number can.

Colour: blue for a gain, rust for a fall. Not green and red — those are the pair
a colourblind reader cannot separate. This pair was checked with the palette
validator and passes on every measure, and every dot is labelled anyway, so the
chart reads with no colour at all.
"""
import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from evaluate_addresses import score  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

SETS = [
    ("Lagos", "Nigerian voice", "lagos_recording_manifest-results.csv"),
    ("Lahore", "Pakistani voice", "lahore_human_manifest-results.csv"),
    ("London", "Nigerian voice", "london_human_manifest-results.csv"),
    ("London", "synthetic voice", "london_recording_manifest-results.csv"),
]

INK, MUTE, RULE, PAPER = "#14171A", "#7C7A73", "#D4D6CF", "#F4F5F2"
UP, DOWN = "#1F6FB2", "#B3402A"


def exact(rows, col, spoken=True):
    hits = [score(r["ground_truth"], r.get(col, ""), spoken=spoken)["exact"] for r in rows]
    return 100 * sum(1 for h in hits if h) / len(hits)


def measure():
    out = []
    for name, voice, fname in SETS:
        rows = list(csv.DictReader(io.open(HERE / fname, encoding="utf-8")))
        off = exact(rows, "transcript_no_keyterms")
        on = exact(rows, "transcript_with_keyterms")
        out.append((name, voice, off, on, len(rows)))
    return out


def main():
    data = measure()

    rows = len(data)
    W = 1460
    left, right = 420, 1150          # plot area in x
    top, gap = 250, 150              # first row, spacing
    last = top + (rows - 1) * gap    # y of the bottom row
    H = last + 210                   # room for the axis, rule and caption
    x = lambda pct: left + (right - left) * pct / 100

    p = []
    add = p.append
    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    add("""  <defs><style>
    .display{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-weight:700}
    .body{font-family:Georgia,"Times New Roman",serif}
    .mono{font-family:Consolas,"Courier New",monospace}
  </style></defs>""")
    add(f'  <rect width="{W}" height="{H}" fill="{PAPER}"/>')

    # Title says what is measured, so no axis label has to.
    add(f'  <text class="display" x="60" y="86" font-size="46" fill="{INK}">'
        "Addresses heard correctly, with the local word list off and on</text>")
    add(f'  <text class="body" x="60" y="130" font-size="26" fill="{MUTE}">'
        f"{sum(d[4] for d in data)} recordings, each transcribed twice. "
        "The word list is the only difference.</text>")

    # Legend: two states, so one is required.
    add(f'  <circle cx="{left + 10}" cy="176" r="9" fill="{PAPER}" stroke="{MUTE}" stroke-width="3"/>')
    add(f'  <text class="mono" x="{left + 32}" y="183" font-size="21" fill="{MUTE}">word list off</text>')
    add(f'  <circle cx="{left + 210}" cy="176" r="10" fill="{INK}"/>')
    add(f'  <text class="mono" x="{left + 232}" y="183" font-size="21" fill="{MUTE}">word list on</text>')

    # Gridlines, recessive.
    for pct in range(0, 101, 25):
        add(f'  <line x1="{x(pct):.0f}" y1="215" x2="{x(pct):.0f}" y2="{last + 60}" '
            f'stroke="{RULE}" stroke-width="1"/>')
        add(f'  <text class="mono" x="{x(pct):.0f}" y="{last + 96}" font-size="20" '
            f'fill="{MUTE}" text-anchor="middle">{pct}%</text>')

    for i, (name, voice, off, on, n) in enumerate(data):
        y = top + i * gap
        rose = on >= off
        # A row that did not move is not a win. Painting a flat result in the gain
        # colour would let the eye count four blue rows and read four successes.
        colour = MUTE if on == off else (UP if rose else DOWN)
        x0, x1 = x(off), x(on)

        add(f'  <text class="display" x="{left - 60}" y="{y + 8}" font-size="34" fill="{INK}" '
            f'text-anchor="end">{name}</text>')
        add(f'  <text class="mono" x="{left - 60}" y="{y + 38}" font-size="19" fill="{MUTE}" '
            f'text-anchor="end">{voice} · {n} clips</text>')

        # The connector carries the direction; a 2px surface gap keeps the dots clean.
        # A row that did not move has no direction to carry, so it gets neither line
        # nor arrowhead: two dots in the same place is the clearest way to say "nothing
        # happened", and it is a finding, not a gap in the chart.
        sign = 1 if x1 > x0 else -1
        if abs(x1 - x0) > 24:
            add(f'  <line x1="{x0 + 12 * sign:.0f}" y1="{y}" x2="{x1 - 20 * sign:.0f}" y2="{y}" '
                f'stroke="{colour}" stroke-width="5"/>')
            head = 14
            add(f'  <polygon points="{x1:.0f},{y} {x1 - head * sign:.0f},{y - 8} '
                f'{x1 - head * sign:.0f},{y + 8}" fill="{colour}"/>')

        add(f'  <circle cx="{x0:.0f}" cy="{y}" r="10" fill="{PAPER}" stroke="{MUTE}" stroke-width="3"/>')
        add(f'  <circle cx="{x1:.0f}" cy="{y}" r="11" fill="{colour}" stroke="{PAPER}" stroke-width="2"/>')

        # Direct labels on both ends, each sitting on the outside of its own dot.
        # Centring them above the dots collides whenever the two are close, which
        # is exactly the row — London — that the reader most needs to read.
        if abs(x1 - x0) > 24:
            add(f'  <text class="mono" x="{x0 - 22 * sign:.0f}" y="{y + 9}" font-size="25" fill="{MUTE}" '
                f'text-anchor="{"end" if rose else "start"}">{off:.0f}%</text>')
            add(f'  <text class="display" x="{x1 + 24 * sign:.0f}" y="{y + 11}" font-size="32" '
                f'fill="{colour}" text-anchor="{"start" if rose else "end"}">{on:.0f}%</text>')
        else:
            # Both ends in the same place: two labels would print on top of each
            # other. One label, saying so in words, is the readable version.
            add(f'  <text class="display" x="{x1 + 26:.0f}" y="{y + 11}" font-size="32" '
                f'fill="{colour}" text-anchor="start">{on:.0f}%</text>')
            add(f'  <text class="mono" x="{x1 + 26 + 86:.0f}" y="{y + 10}" font-size="22" '
                f'fill="{MUTE}" text-anchor="start">both ways</text>')

        change = on - off
        add(f'  <text class="display" x="{W - 130}" y="{y + 10}" font-size="32" fill="{colour}" '
            f'text-anchor="end">{change:+.0f}</text>')
        add(f'  <text class="mono" x="{W - 130}" y="{y + 38}" font-size="18" fill="{MUTE}" '
            f'text-anchor="end">points</text>')

    add(f'  <line x1="60" y1="{H - 96}" x2="{W - 60}" y2="{H - 96}" stroke="{RULE}" stroke-width="2"/>')
    add(f'  <text class="body" x="60" y="{H - 52}" font-size="25" fill="{INK}">'
        "The word list pays where the words are not what the recogniser expects — and does "
        "nothing at all where they are.</text>")
    add(f'  <text class="mono" x="60" y="{H - 20}" font-size="18" fill="{MUTE}">'
        "measurement/RESULTS.md · every transcript kept · rerun with measurement/rescore.py</text>")
    add("</svg>")

    out = ROOT / "docs" / "chart-regions.svg"
    io.open(out, "w", encoding="utf-8").write("\n".join(p) + "\n")
    print(f"wrote {out.relative_to(ROOT)}")
    for name, voice, off, on, n in data:
        print(f"  {name:<8} {off:5.0f}% -> {on:3.0f}%  ({on - off:+.0f})  {n} clips, {voice}")


if __name__ == "__main__":
    main()
