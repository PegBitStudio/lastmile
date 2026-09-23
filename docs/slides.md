# The deck

Seven slides. It does two jobs at once, and that is deliberate:

1. It is the PDF the submission form asks for.
2. It is what fills the screen in the video whenever the app is *not* on screen.

So every slide has to survive with no narration (a judge clicking through the PDF)
**and** work as a held still frame behind Yashfa's voice. That is why there are no
bullet lists of things she says out loud — a slide that repeats the narration makes
the judge read instead of listen.

`docs/slides.html` is the built deck. Open it and print to PDF: **landscape, A4,
background graphics on, margins none.** It is the same fonts and the same colours
as the cover, and it needs no internet connection.

Slide numbers here match the **Slide n** markers in [video-script.md](video-script.md).

---

## Slide 1 · Title · *on screen 0:00–0:03*

> # Lastmile
> ### The driver talks. The record writes itself.
>
> Voice-first delivery exception reporting
> Built on AssemblyAI · Lagos · Lahore · London

Nothing else. Three seconds.

---

## Slide 2 · The gap · *0:03–0:18*

A delivery record, drawn the way the industry actually keeps it.

> **outcome** — not delivered
> **reason** — customer not in
> **time** — 14:32
>
> **who took it** — *blank*
> **which entrance** — *blank*
> **did they sign** — *blank*

with one line under it:

> Three weeks later, a customer says nothing arrived.
> The blanks are the only thing that would have settled it.

The three blanks are the whole slide. Grey them, do not hide them.

---

## Slide 3 · How the loop works · *not in the video — PDF readers only*

The sequence diagram from the README, one screen, no commentary:

> Driver speaks → the agent logs only what it heard → **our table works out what is
> still missing** → the agent asks for that one thing → repeat → nothing missing →
> it reads the record back and closes.

One sentence underneath:

> The agent is never told what to ask. It is handed the list of empty fields on
> every turn, and only decides how to ask.

The video shows this happening instead of drawing it, which is better. The PDF
cannot, so it gets the diagram.

---

## Slide 4 · What the phone keeps · *not in the video — PDF readers only*

Three columns, the same three as the board:

> **Stated** — what the driver said
> **Observed** — time, location, distance from the address, whether the van was stopped
> **Proof** — what the customer gave. Usually nothing, and we say so.

Under it, the rule that decides what uploads:

> A field can cite the turn of audio it came from. Only cited turns leave the phone.
> Everything else is thrown away when the session ends.

---

## Slide 5 · What we measured · *2:25–3:05*

`docs/chart-regions.png`, full bleed, and nothing else on the slide. No title over
it — the chart already has one, and the narration carries the rest.

The image is rebuilt from the results files by `python measurement/chart.py`, so it
cannot drift from the claim. Rebuild it before you export the PDF.

---

## Slide 6 · What this is, and what it is not · *3:22–4:05*

Two columns, side by side, equal weight. The right-hand column is the one that
earns the marks.

> **What it is**
> An evidence layer beside the scanner a carrier already runs.
> A structured record, with the driver's own audio attached to the field it proves.
>
> **What it is not**
> Proof of delivery. A driver's recording is a statement by someone with an interest.
> Scans, photos and signatures are the proof, and those already exist.

Footer line:

> Bought by the operations manager with 20–200 drivers.

---

## Slide 7 · Next · *4:05–4:20*

Three items, no more:

> Scan the parcel instead of tapping it — plenty of drivers do not read easily
> Capture that survives losing signal
> A fourth region: a JSON file and an afternoon

And the last line on the deck, which is the line that should stay on a judge's
screen while they make their note:

> Every transcript behind the numbers is in the repository.
