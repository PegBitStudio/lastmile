# The live voice test

Ten minutes. Do it once on the laptop, then once on a phone.

Nothing in this project has ever heard a real human voice. Everything below is built
and unit-tested, which is not the same thing.

**Before you start:** open the dispatcher board in a second window. Half of what you
are checking happens there.

---

## Setup

```powershell
npm run dev
```

Driver screen: `http://localhost:3000/drive`
Board: `http://localhost:3000/board`

If the board says *"No database on this deployment"*, stop. `DATABASE_URL` is missing
from `.env.local` and nothing will save.

---

## Test 1 — the gate holds

1. Open `http://localhost:3000/drive?speed=36`

**Should happen:** red bar, *"Waiting until you've stopped — 36 km/h"*, a black
**SIMULATED SPEED** tag, and a grey dead button.

2. Change the address to `?speed=0`

**Should happen:** green bar, button goes black and says *"Report a drop"*.

✅ or ❌ ...................

---

## Test 2 — one sentence, one question

Stay on `?speed=0`. Leave **Nigeria / Lagos** selected. Tap the first stop.

Press **Report a drop**, wait for *"Listening. Go ahead."*, then say — normally, at
normal speed, do not slow down for the machine:

> **"Customer wasn't in, I left it with the gateman at the side gate."**

**Should happen:**

- Your words appear on screen as you speak
- The record panel fills in: outcome, who took it, entrance
- The agent asks **one** question, and it is about the **name**
- It does **not** ask what happened, or where, or which stop

Answer it:

> **"His name is Musa."**

**Should happen:**

- The agent reads the record back **once**
- It stops listening by itself. You do not press Stop
- Within 2 seconds the record appears on the board, tagged **closed**

✅ or ❌ ...................

**The one thing to watch for:** if it asks about something you already said, the
missing-field list is not reaching it. That is the whole product failing, and I need
to know immediately.

---

## Test 3 — the board tells the truth

On the board, find that record.

- **Stated** shows your words
- **Observed** shows `stationary` and the time. `unknown` is correct on a laptop
- **Proof** says *"not captured in this build"*
- A **hear** button sits beside the name. Press it — you should hear yourself

Wait about 10 seconds and look again. If the second model was unsure of "Musa", the
card gets a red **NEEDS REVIEW** tag and the name is underlined.

Either result is fine. Tell me which one you got.

✅ or ❌ ...................

---

## Test 4 — a different country

Go back to the driver screen. Tap **Pakistan / Lahore**. The route changes to the
Lahore stops. Tap one.

Press **Report a drop** and say:

> **"Nobody was home, gave it to the chowkidar at the main gate. His name is Bilal."**

**Should happen:**

- "chowkidar" is transcribed correctly — not "chalk a dar"
- The record says the relationship is **security**
- Nothing else is asked, because you gave everything

This is the region pack earning its keep. It is also the strongest 20 seconds of the
video.

✅ or ❌ ...................

---

## Test 5 — cash

Tap **Nigeria / Lagos**, then the stop marked **COLLECT 18,500**.

Say:

> **"Delivered to the customer, Folake. She only had ten thousand, paid cash."**

**Should happen:**

- It asks **what happens next**, and nothing else
- It does **not** ask why the money was short — it already knows
- The board shows `collected 10000 of 18500 — short`

✅ or ❌ ...................

---

## Test 6 — the phone

Same as Test 2, on your phone, on mobile data, on the Vercel URL.

Allow the microphone and the location when asked.

**Watch for:** the agent audible through the phone speaker, and the gate showing a
real speed rather than unknown.

✅ or ❌ ...................

---

## If something goes wrong

Send me all three of these. Any one alone is usually not enough:

1. **What you said, and what it said back** — copy the lines off the screen
2. **The browser console.** Press F12, click Console, copy anything red
3. **The terminal** where `npm run dev` is running — the last 20 lines

The most useful sentence you can send me is *"it asked me X after I had already said
Y"*, because that names the failure exactly.

---

## What I need back

One line per test: pass, or what happened instead.

If tests 1 to 3 pass, the demo can be filmed. If test 2 fails, nothing else matters
until it is fixed.
