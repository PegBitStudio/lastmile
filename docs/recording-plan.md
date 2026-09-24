# How we record this

**Yashfa records the video: all of the narration, and all of the app on screen.**
She also plays the driver in the demo, reporting Lahore deliveries in her own
voice. Dami handles what needs the code: the fixes, the slides, a backup demo,
and putting the video together.

There are no interviews with delivery drivers in this plan. We cut that.

| | Yashfa | Dami |
|---|---|---|
| Voice | all narration, and the driver in the demo | none |
| Screens | the driver screen and the board, on her own phone and laptop | the slides and the chart — still images, no app |
| Also | watches the final cut and says yes | the fixes before filming, a backup demo, the edit |

Why this split: the app shots and the voice belong together, and one person in one
room can match them without sending files between Lagos and Lahore. The slides are
still pictures that need the code on a laptop, so they sit with Dami.

---

## Step 0 · A 20-minute test, before anything else

Yashfa opens the live site on her phone and does **one** Lahore report, start to
finish. Check three things:

1. **The agent's voice comes through clearly** on the phone's speaker
2. **The replies come back quickly** — no long silences after she stops talking
3. **The report appears on the board** when she opens it on her laptop

All three work → carry on with this plan.
Any one fails → tell Dami the same day. The fallback is the earlier split: Dami
records the app, Yashfa records the voice only.

---

## The order. Do not swap these around.

1. **Dami** clears the board and does the fixes (below), then tells Yashfa it is ready
2. **Yashfa** records the narration
3. **Yashfa** records the app screens, with her narration playing in one earphone
4. **Dami** records the slides, puts it all together; Yashfa watches and says yes

Voice before screens. A screen recording can be taken again until it fits the
voice. A voice squeezed to fit a screen always sounds rushed.

The one exception is beat 3, the conversation — there the app sets the length, and
the two short narration lines go around it afterwards.

---

# Part 1 · Dami, before Yashfa films

- [ ] **Clear the old test records from the board**, so the camera sees a clean
      board and not the same order four times. **Keep one:** LH-7703 from
      21 September, flagged on the name *Ali*. Beat 7 needs a flagged record, and
      that is the only kind that cannot be made on demand.
- [ ] **Replace the AssemblyAI key** and redeploy.
- [ ] **Do the token fix**, so only our own site can start a voice session.
- [ ] **Record one backup demo** of your own, in Lagos. If Yashfa's conversation
      take fails on the day, this goes in instead.
- [ ] Send Yashfa the live link and tell her the board is ready.

---

# Part 2 · Yashfa — the narration

## Before you start

- A small room with soft things in it. A bed, curtains, clothes. Not a kitchen,
  not a bathroom, not a room with a hard floor and bare walls.
- **Phone off the desk.** Hold it, or stand it on a folded towel. A phone lying on
  a table picks up every knock through the wood.
- Fan off. Air conditioning off. Window shut.
- Phone in aeroplane mode so nothing buzzes mid-line.
- Mouth about a hand's width from the microphone, slightly off to the side.

Any voice recorder app is fine. Pick the highest quality it offers. Do not record
inside a video call or as a WhatsApp voice note — both squash the sound.

## Record this first

Stay completely silent and record **ten seconds of nothing**. Name it `00-room`.
It lets the editor take the room's hum out of every other file.

## How to read it

- **Read the whole script out loud once** before recording anything. Change any
  word that does not feel right in your mouth, keep it about the same length, and
  tell Dami what changed so the slides match.
- **Slower than feels right.** Everyone reads a script too fast. The script already
  has room in it.
- **Stop for two seconds between paragraphs.** That is where the editor cuts.
- **Numbers as words:** "sixty-five per cent", not "65%".
- **Tripped on a line? Don't stop the file.** Pause, count two, and say the whole
  sentence again from its start. The editor keeps the good one.

## The files

One file per beat of [video-script.md](video-script.md):

```
00-room          ten seconds of silence
01-problem       0:00–0:17   the problem
02-waits         0:17–0:29   it waits until you stop
03-conversation  0:29–1:39   two short lines only — the app does the talking
04-record        1:39–2:04   the record
05-cities        2:04–2:16   three cities
06-measured      2:16–3:01   what we measured  <- the most important
07-unsure        3:01–3:13   when it is not sure
08-who           3:13–3:40   who it is for
09-next          3:40–3:54   next
```

**Record `06-measured` twice**, as two separate files. It is the beat the marks
turn on.

Listen back to each file with earphones. Redo it straight away if there is a hum,
a mumbled word, or it doesn't sound like you mean it.

---

# Part 3 · Yashfa — the screens

## Set the phone up once

- **Do Not Disturb on.** One notification across the middle of the demo and the
  take is gone.
- Screen recording on, highest quality, **with sound**. On Android, pick *media
  and microphone* if it asks. On an iPhone, press and hold the record button in
  Control Centre and turn the microphone on. Both the agent's voice and yours must
  be in the recording — test ten seconds and play it back before the real take.
- Brightness to full. Battery above half. Every other app closed.
- Open the live site once before the first take so it is warmed up.

## The shots

| File | Beat | Length | What has to be on screen |
|---|---|---|---|
| `s02-waits` | 0:17–0:29 | 12s | As a **passenger**, outdoors, location on: *waiting until you've stopped*, the button doing nothing, then the vehicle stops and the microphone opens. Never while driving yourself. |
| `s03-conversation` | 0:29–1:39 | ~70s | **One unbroken take.** Two Lahore stops, LH-7701 then LH-7703, exactly as the script describes. |
| `s04-board` | 1:39–2:04 | 25s | The board on your laptop, the record from the conversation on it. Press ▶ next to the chowkidar's name and let it play out loud. |
| `s05-cities` | 2:04–2:16 | 12s | The city buttons: Lagos, London, back to Lahore — slowly, so the list of stops changes each time. |
| `s07-unsure` | 3:01–3:13 | 12s | The record flagged **needs review**, held still long enough to read. |
| `s09-end` | the last 10s | 10s | The board at rest, a real record on it. Record extra — it gets trimmed. |

For the board shots, record the laptop screen: on Windows, **Win + Alt + R**
starts and stops a recording; on a Mac, **Shift + Cmd + 5**.

## The conversation is the video

- Take it as many times as it needs. **Never cut in the middle** — a cut in a
  conversation looks like it hides a failure.
- Speak the driver's lines normally, as if standing at a gate. Don't perform them.
- Quiet room, but not silent — a little background sound is fine and real.
- If the agent asks something the script didn't expect, answer it naturally. A real
  take beats a perfect one.
- When you have a good take, **stop**. Don't chase a better one past the second
  good take.

---

# Part 4 · Dami — slides and putting it together

## The slides and the chart

1. Rebuild the chart, so slide 5 shows the current numbers:
   ```bash
   python measurement/chart.py && npm run cover
   ```
2. Open `docs/slides.html`, press <kbd>F11</kbd>, and screen-record while pressing
   <kbd>Page Down</kbd> once per slide, about five seconds each.
3. For the PDF the form wants: same file, print, **landscape, A4, margins none,
   background graphics on**. Check slide 5 shows the chart, not a blank.

## The edit

1. **Lay Yashfa's voice files end to end first.** Voice alone should come to about
   2:45–3:20. If it is over 3:30, a beat is being read too slowly.
2. **Put each screen under its voice, and trim the picture to fit.** Picture bends,
   never the voice. Beat 3 is the exception: the conversation plays in full.
3. **Drop the narration out completely** while the agent speaks and while a clip
   plays on the board.
4. Take the room hum out using `00-room`, then set the whole voice track to one
   level.
5. **Burn in subtitles and check the names by hand.** Auto-subtitles get
   *chowkidar*, *Lahore* and *AssemblyAI* wrong — and a misspelt *AssemblyAI* in a
   video judged by AssemblyAI is a costly typo.
6. Export 1080p MP4, under 300 MB. Watch it once on a phone before uploading.

---

## Before it is final, both of us confirm

- [ ] Under 5:00. It is a hard limit, not a target
- [ ] "No change at all" for London is said out loud, and the chart is on screen
- [ ] The agent can be heard speaking, not just described
- [ ] No claim is made that the picture does not then show
- [ ] Yashfa has watched it end to end and is happy her name is on it
- [ ] A copy is saved somewhere other than one laptop
