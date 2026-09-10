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
