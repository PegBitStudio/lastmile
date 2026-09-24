# Where the packs came from

The originals, as they were handed over, before being merged into `regions/`.

| File | From | Now lives in |
|---|---|---|
| `lahore-keyterms-yashfa.docx` | Yashfa, 15 Sep | `regions/pk-lahore.json` |
| `london-prefix-postcode-bug.xlsx` | The London run of 22 Sep, before the fix | kept as evidence, not shipped |

Kept because a region pack is a claim about how people in a place actually speak,
and it matters who made that claim. The merged pack is the one the agent uses; this
is the paper trail behind it.

All 39 of her terms are in the shipped pack — checked, ignoring spacing and
punctuation, before this file was filed away. The pack is at the API's cap of
exactly 100 terms, so the rest of that list is ours: Lagos-style delivery words,
and the street and area names her twenty recordings needed.

## The London run that found the prefix bug

`london-prefix-postcode-bug.xlsx` is the 34-keyterm run that scored 60% against 65%
with the pack off. One keyterm, the bare postcode `W1`, split `W11` into `W1 1`.
RESULTS.md tells that story; this is the sheet it happened in.

The ten bare postcodes came out, and the same twenty clips were run again on the
24-term pack: 65% either way. That run is the one in `measurement/`. This one is
kept because a bug you can no longer see the evidence for is just a claim.
