# Learning log

One line a day each. Anything that surprised you, confused you, or turned out to be different
from what you expected.

Do not write a diary. Do not save them up. One line, the day it happens.

This file becomes the *"What we learned about the Voice Agent API"* section of the README, which
is a required part of the submission. Writing it here as we go means we do not have to invent it
on Sep 28.

Format:

```
- YYYY-MM-DD — Name — what you learned
```

---

- 2026-09-05 — Dami — Sessions bill on how long the WebSocket is open, not how long anyone is
  speaking. A forgotten browser tab costs real credit.
- 2026-09-07 — Dami — Voice agents are created with a POST to /v1/agents, not in a dashboard.
  So the system prompt is a file we can keep in git and diff, which beats a text box in a UI.
- 2026-09-07 — Dami — Browser tokens are single use and last 60 seconds. Fetch a fresh one immediately
  before opening each socket, not once at page load.
- 2026-09-10 — Dami — The keyterm list is capped at 100 by the API, so a region pack has to
  choose. Place names first, then the words for gates and doors, then first names — a name we
  never bias is one wrong record, a street we never bias is wrong every single day.
- 2026-09-10 — Dami — Writing the follow-up table as tests first showed a hole the spec table
  does not cover: a driver who collected nothing. Zero is a real answer, so it must not read as
  a missing field, or the agent asks the same question until the driver gives up.
- 2026-09-10 — Dami — Three things about tool calls that the code had wrong, all from the API
  spec: the `result` goes on the wire as a JSON string and not an object, it must be sent inside
  the `reply.done` handler and not the moment `tool.call` arrives, and `reply.audio` carries its
  base64 in `data`. A result sent early is simply dropped, and the agent then waits for an answer
  that already went past.
- 2026-09-10 — Dami — `node --experimental-strip-types` removes types without rewriting anything,
  so a TypeScript constructor parameter property is a syntax error there. Fine in Next, broken in
  a script. Worth knowing before writing more shared code.
- 2026-09-10 — Dami — Ending a voice session is not the same as closing a socket. close_session
  arrives while the agent is still reading the record back, so closing on the spot cuts it off
  mid-sentence and reads as a crash. Stop listening first, let the queued audio drain, then close.
- 2026-09-10 — Dami — A phone sitting still on a dashboard wanders by tens of metres. Divide that
  drift by half a second and you have invented a speeding van that blocks a parked driver from
  ever opening the microphone. The fix is to compare movement against the accuracy the device
  itself reports, and to refuse to divide by anything under a second.
- 2026-09-10 — Dami — `next/server` will not resolve outside Next's own module resolver, so a
  route handler cannot be imported by a plain Node test. Moving the decisions into a normal file
  and leaving the route as a wrapper made them testable, and made the route shorter. Worth doing
  from the start on the next route.
- 2026-09-10 — Dami — `input.turn_detection` had been left null the whole time, so the agent has
  been running on adaptive defaults tuned for a quiet room. The knobs are vad_threshold,
  min_silence, max_silence and interrupt_response. Raising the threshold is what makes a noisy
  street usable; a low one hears a passing engine as the start of a sentence.
- 2026-09-10 — Dami — A session needs an ending for the case where nobody says anything. The
  designed ending is close_session, but the table refuses to close an incomplete record, so a
  driver who walks off mid-report leaves the agent asking a question forever on a socket we pay
  for by the second.
- 2026-09-10 — Dami — Running `npm run build` while `npm run dev` is up corrupts `.next`, because
  they share it. The symptom is misleading: pages return 200, chunks 404, nothing hydrates, and
  the app looks like a React bug. `rm -rf .next` and restart. Never run both at once.
- 2026-09-10 — Dami — "One" is a pronoun far more often than a number. Treating it as a route
  position sent "that one" and "the one for Ayesha" both to the first stop on the list — a
  confident wrong answer, on the exact field that must never be wrong. Found by a test, not by a
  demo, which is the only reason it is not still there.
- 2026-09-11 — Dami — The browser's own recorder makes WebM with no duration or index, so seeking
  into it is unreliable in Chrome. We already had clean PCM, because that is what we send the agent,
  so each driver turn is cut from that and kept as a WAV. No seeking needed, and nothing new to load.
- 2026-09-11 — Dami — Testing the audio found that production has never had a database. The live
  site answers `configured: false`, so the Postgres layer has not saved a single record and the
  dispatcher board has been empty. It degrades so politely that nothing looked broken. A feature
  that fails silently needs a test that looks for it, not a demo.

- 2026-09-15 — Dami — Two people writing the same region pack produced two good packs that could
  not both exist. Merging them hit the 100 keyterm cap at 109, so something had to go. Street and
  area names stayed; first names were cut first. A wrong name is one bad record. A wrong street is
  wrong every single day.
- 2026-09-15 — Dami — The Voice Agent API gives the transcript as plain text with no confidence at
  all, so a confident name and a guessed one look identical in the record. The pre-recorded API
  scores every word (0.40 to 1.00 on the sample). We already keep each cited turn as a WAV, so a
  second model reviews it. Two AssemblyAI models disagreeing turned out to be the best "not sure"
  signal we have.
- 2026-09-21 — Dami — Without keyterms, two of twenty Lahore addresses came back in Devanagari
  script: the recogniser heard South Asian speech and stopped transcribing English. With the pack
  on, both were perfect. The region pack is not only spelling help, it keeps the recogniser in the
  right language.
- 2026-09-22 — Dami — On Yashfa's own voice, "DHA Lahore" came out as "DHL Award" with keyterms
  off: the largest housing authority in Pakistan turned into a courier company, inside a delivery
  app. Real speech gives a smaller gap than synthetic speech (40 to 80 percent, against 65 to 100),
  and the real one is the number we should show.
- 2026-09-22 — Dami — A scoring bug made every result look worse than it was: "24-A" and "24A"
  were treated as different addresses because the normaliser split on the hyphen. It hit both
  columns equally, so the comparison held, but each absolute number was wrong. Worth checking a
  normaliser against its own edge cases before trusting any of its output.
- 2026-09-22 — Dami — Keyterms can make recognition worse. London scored 60 percent with the pack
  against 65 without, and one clip explained it all: the pack listed "W1", so the postcode "W11"
  came back as "W1 1". A keyterm that is a prefix of a longer word can split that word. Dropping
  the bare postcodes restored the score exactly. Without the keyterms-off control run we would
  have shipped a pack that quietly damaged one of our three markets.
